/**
 * Question Generation API - Cache-Based Version
 * 
 * MAJOR UPDATE (July 2025): Removed AI dependencies (OpenAI/Claude)
 * Now serves questions from pre-generated cache (45,000+ questions in question_cache table)
 * 
 * Changes from AI version:
 * - Removed OpenAI and Anthropic imports and clients
 * - Removed AI generation logic (generateWithOpenAI, generateWithClaude)
 * - Added cache-based question retrieval
 * - Added timer logic (60s for grades 5-7, 45s for grades 8-11)
 * - Simplified rate limiting since no AI API costs
 * 
 * @author EduApp Team
 * @version 2.0.0 - Cache-based
 */

import { getUser, updateUserProficiency, logQuestionAttempt } from '../../lib/db';
import { mapProficiencyToDifficulty, updateProficiency } from '../../lib/utils';
import { validateAuth } from '../../lib/authMiddleware';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for database queries
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service role for RLS bypass
);

// Rate limiting store - tracks requests per user per minute
// UPDATED: Increased limit from 3 to 20 per minute since we're not using expensive AI APIs
const rateLimitStore = new Map();
const RATE_LIMIT_PER_MINUTE = 20; // Increased from 3 since no AI costs

// Clean up old entries every 5 minutes to prevent memory leak
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, timestamp] of rateLimitStore.entries()) {
    if (timestamp < fiveMinutesAgo) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Check rate limit - 20 requests per minute per user (increased from 3)
function checkRateLimit(userId) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const key = `${userId}:${minute}`;
  
  // Get all entries for this user in the current minute
  const userRequests = [];
  for (const [k, v] of rateLimitStore.entries()) {
    if (k.startsWith(`${userId}:${minute}`)) {
      userRequests.push(v);
    }
  }
  
  if (userRequests.length >= RATE_LIMIT_PER_MINUTE) {
    return false;
  }
  
  // Add new request timestamp
  rateLimitStore.set(`${key}:${now}`, now);
  return true;
}

/**
 * Get question timer duration based on grade
 * Grades 5-7: 60 seconds per question
 * Grades 8-11: 45 seconds per question
 */
function getTimerDuration(grade) {
  return grade <= 7 ? 60 : 45;
}

/**
 * Determine next topic based on session flow
 * Flow: 2 comprehension passages → 3-5 of each other topic
 */
async function getNextTopicForSession(sessionId, userId, requestedTopic) {
  // Get session flow state
  const { data: session, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('student_id', userId)
    .single();
  
  if (error || !session) {
    console.log('[Flow] No session found, using requested topic:', requestedTopic);
    return requestedTopic;
  }
  
  const {
    current_flow_stage,
    comprehension_sets_completed,
    vocabulary_completed,
    synonyms_completed,
    antonyms_completed,
    grammar_completed,
    sentences_completed,
    fill_blanks_completed
  } = session;
  
  console.log('[Flow] Current stage:', current_flow_stage, 'Comprehension sets:', comprehension_sets_completed);
  
  // Stage 1: Comprehension (2 passages)
  if (current_flow_stage === 'comprehension' && comprehension_sets_completed < 2) {
    return 'english_comprehension';
  }
  
  // Transition to topic rotation after 2 comprehension sets
  if (current_flow_stage === 'comprehension' && comprehension_sets_completed >= 2) {
    await supabase
      .from('study_sessions')
      .update({ current_flow_stage: 'topic_rotation' })
      .eq('id', sessionId);
  }
  
  // Stage 2: Topic rotation (3-5 questions each)
  if (current_flow_stage === 'topic_rotation' || comprehension_sets_completed >= 2) {
    const topics = [
      { name: 'english_vocabulary', completed: vocabulary_completed, min: 3, max: 5 },
      { name: 'english_synonyms', completed: synonyms_completed, min: 3, max: 5 },
      { name: 'english_antonyms', completed: antonyms_completed, min: 3, max: 5 },
      { name: 'english_grammar', completed: grammar_completed, min: 3, max: 5 },
      { name: 'english_sentences', completed: sentences_completed, min: 3, max: 5 },
      { name: 'english_fill_blanks', completed: fill_blanks_completed, min: 3, max: 5 }
    ];
    
    // Find next topic that hasn't reached minimum
    for (const topic of topics) {
      if (topic.completed < topic.min) {
        console.log('[Flow] Next topic:', topic.name, 'Completed:', topic.completed);
        return topic.name;
      }
    }
    
    // All topics have minimum, check if any want more (up to max)
    for (const topic of topics) {
      if (topic.completed < topic.max) {
        return topic.name;
      }
    }
    
    // All complete - mark session as completed and restart cycle
    await supabase
      .from('study_sessions')
      .update({ 
        current_flow_stage: 'completed',
        comprehension_sets_completed: 0,
        vocabulary_completed: 0,
        synonyms_completed: 0,
        antonyms_completed: 0,
        grammar_completed: 0,
        sentences_completed: 0,
        fill_blanks_completed: 0
      })
      .eq('id', sessionId);
    
    return 'english_comprehension'; // Start new cycle
  }
  
  // Default to requested topic
  return requestedTopic;
}

/**
 * Try alternative topics when primary topic has no questions
 * Returns next available topic based on session flow priorities
 */
async function getFallbackTopic(sessionId, userId, attemptedTopic, attemptedTopics = []) {
  const allTopics = [
    'english_vocabulary',
    'english_synonyms', 
    'english_antonyms',
    'english_grammar',
    'english_sentences',
    'english_fill_blanks',
    'english_comprehension'
  ];
  
  // Track attempted topics to avoid infinite loop
  const tried = new Set([...attemptedTopics, attemptedTopic]);
  
  // If we have a session, try topics in flow order
  if (sessionId) {
    const { data: session } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('student_id', userId)
      .single();
    
    if (session) {
      // Priority order based on what needs completion
      const priorities = [
        { name: 'english_vocabulary', completed: session.vocabulary_completed },
        { name: 'english_synonyms', completed: session.synonyms_completed },
        { name: 'english_antonyms', completed: session.antonyms_completed },
        { name: 'english_grammar', completed: session.grammar_completed },
        { name: 'english_sentences', completed: session.sentences_completed },
        { name: 'english_fill_blanks', completed: session.fill_blanks_completed }
      ];
      
      // Sort by least completed first
      priorities.sort((a, b) => a.completed - b.completed);
      
      // Try topics in priority order
      for (const topic of priorities) {
        if (!tried.has(topic.name)) {
          console.log('[Fallback] Trying alternative topic:', topic.name);
          return topic.name;
        }
      }
    }
  }
  
  // No session or all prioritized topics tried - try any remaining topic
  for (const topic of allTopics) {
    if (!tried.has(topic)) {
      console.log('[Fallback] Trying any available topic:', topic);
      return topic;
    }
  }
  
  return null; // All topics exhausted
}

/**
 * Update session counters after successful question delivery
 */
async function updateSessionCounters(sessionId, topic, isBatch = false) {
  if (!sessionId) return;
  
  const columnMap = {
    'english_comprehension': 'comprehension_sets_completed',
    'english_vocabulary': 'vocabulary_completed',
    'english_synonyms': 'synonyms_completed',
    'english_antonyms': 'antonyms_completed',
    'english_grammar': 'grammar_completed',
    'english_sentences': 'sentences_completed',
    'english_fill_blanks': 'fill_blanks_completed'
  };
  
  const column = columnMap[topic];
  if (!column) return;
  
  // For comprehension, we count sets/batches, for others we count individual questions
  // This increment happens when question is delivered, not when answered
  const increment = (topic === 'english_comprehension' && isBatch) ? 1 : 0;
  
  if (increment > 0) {
    const { error } = await supabase.rpc('increment', {
      table_name: 'study_sessions',
      column_name: column,
      row_id: sessionId,
      increment_value: increment
    });
    
    if (error) {
      // Fallback to manual update if RPC doesn't exist
      const { data: current } = await supabase
        .from('study_sessions')
        .select(column)
        .eq('id', sessionId)
        .single();
      
      if (current) {
        await supabase
          .from('study_sessions')
          .update({ [column]: (current[column] || 0) + increment })
          .eq('id', sessionId);
      }
    }
    
    console.log('[Session] Updated', column, '+', increment);
  }
}

/**
 * Retrieve question from cache based on user's proficiency and history
 * This replaces the AI generation logic
 */
async function getMixedSessionQuestions(userId, grade) {
  console.log('[getMixedSessionQuestions] Starting mixed session for:', { userId, grade });
  
  try {
    // Get user's answered questions to avoid duplicates
    const { data: user } = await supabase
      .from('users')
      .select('answered_question_hashes')
      .eq('id', userId)
      .single();
    
    const answeredHashes = user?.answered_question_hashes || [];
    
    // Define question distribution for 30 questions
    const questionTypes = [
      { topic: 'english_comprehension', count: 8 }, // 2-4 passages, 4-6 questions each
      { topic: 'english_synonyms', count: 6 },
      { topic: 'english_antonyms', count: 6 },
      { topic: 'english_sentences', count: 6 },
      { topic: 'english_vocabulary', count: 4 }
    ];
    
    const allQuestions = [];
    
    // Get questions for each type
    for (const { topic, count } of questionTypes) {
      console.log(`[getMixedSessionQuestions] Getting ${count} questions for ${topic}`);
      
      if (topic === 'english_comprehension') {
        try {
          // For comprehension, get 2-3 passages
          const passages = await getBatchFromCache(userId, topic, null, grade);
          if (passages && passages.length > 0) {
            // Take first 8 questions from passages
            allQuestions.push(...passages.slice(0, count));
          }
        } catch (comprehensionError) {
          console.log(`[getMixedSessionQuestions] Failed to get comprehension questions:`, comprehensionError.message);
        }
      } else {
        // For other topics, get individual questions  
        // Try different difficulties to get variety
        const difficulties = [3, 4, 5, 6]; // Mix of difficulties
        
        for (let i = 0; i < count; i++) {
          try {
            const difficulty = difficulties[i % difficulties.length];
            const question = await getQuestionFromCache(userId, topic, difficulty, grade);
            if (question && question.question) {
              allQuestions.push({
                ...question.question,
                topic,
                difficulty: question.difficulty || difficulty,
                questionHash: question.questionHash
              });
            }
          } catch (topicError) {
            console.log(`[getMixedSessionQuestions] Failed to get ${topic} question:`, topicError.message);
            // Continue to next question without failing entire process
          }
        }
      }
    }
    
    // Check if we got any questions at all
    if (allQuestions.length === 0) {
      throw new Error('No questions available in cache for any topic');
    }
    
    // Shuffle questions randomly
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }
    
    console.log(`[getMixedSessionQuestions] Generated ${allQuestions.length} mixed questions`);
    return allQuestions.slice(0, 30); // Return up to 30 questions
    
  } catch (error) {
    console.error('[getMixedSessionQuestions] Error:', error);
    throw error;
  }
}

async function getQuestionFromCache(userId, topic, difficulty, grade) {
  console.log('[getQuestionFromCache] Starting with params:', { userId, topic, difficulty, grade });
  
  try {
    // First, get user's answered question hashes to avoid duplicates
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('answered_question_hashes')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.error('[getQuestionFromCache] Error fetching user data:', userError);
    }
    
    const answeredHashes = userData?.answered_question_hashes || [];
    console.log('[getQuestionFromCache] User answered hashes:', {
      count: answeredHashes.length,
      type: Array.isArray(answeredHashes) ? 'array' : typeof answeredHashes,
      sample: answeredHashes.slice(0, 3)
    });
    
    // Query question_cache for matching questions
    // Filter out questions the user has already answered
    let query = supabase
      .from('question_cache')
      .select('*')
      .eq('topic', topic)
      .eq('grade', grade)
      .eq('difficulty', difficulty)
      .is('expires_at', null); // Only permanent questions
    
    console.log('[getQuestionFromCache] Base query built for:', { topic, grade, difficulty });
    
    
    // Filter out answered questions
    if (answeredHashes.length > 0) {
      console.log('[getQuestionFromCache] Applying answered filter with', answeredHashes.length, 'hashes');
      // Use filter syntax for not in array
      query = query.filter('question_hash', 'not.in', `(${answeredHashes.map(h => `"${h}"`).join(',')})`);
    }
    
    // Get up to 10 questions and randomly select one
    console.log('[getQuestionFromCache] Executing query...');
    const { data: questions, error } = await query.limit(10);
    
    if (error) {
      console.error('[getQuestionFromCache] Query error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to fetch questions from cache: ${error.message}`);
    }
    
    console.log('[getQuestionFromCache] Query result:', {
      questionsFound: questions?.length || 0,
      topic,
      grade,
      difficulty,
    });
    
    if (!questions || questions.length === 0) {
      console.log('[getQuestionFromCache] No questions found, trying fallback strategies...');
      
      // Try adjacent difficulties if still no questions
      if (difficulty > 1) {
        return getQuestionFromCache(userId, topic, difficulty - 1, grade);
      } else if (difficulty < 8) {
        return getQuestionFromCache(userId, topic, difficulty + 1, grade);
      }
      
      throw new Error('No available questions in cache');
    }
    
    // Randomly select one question
    const selectedQuestion = questions[Math.floor(Math.random() * questions.length)];
    
    
    // Update usage count
    await supabase
      .from('question_cache')
      .update({ usage_count: (selectedQuestion.usage_count || 0) + 1 })
      .eq('id', selectedQuestion.id);
    
    // Transform the question to match expected format
    const questionData = selectedQuestion.question;
    let transformedQuestion;
    
    // Handle both comprehension format and regular format
    if (questionData.question && typeof questionData.options === 'object' && !Array.isArray(questionData.options)) {
      // Comprehension format (already has proper structure)
      transformedQuestion = {
        question: questionData.question,
        options: questionData.options,
        correct: questionData.correct,
        explanation: questionData.explanation || selectedQuestion.answer_explanation,
        context: questionData.context || ''
      };
    } else {
      // Regular format (needs transformation)
      transformedQuestion = {
        question: questionData.question_text,
        options: {},
        correct: null,
        explanation: questionData.explanation || selectedQuestion.answer_explanation,
        context: questionData.context || ''
      };
      
      // Convert array options to object format (A, B, C, D)
      if (Array.isArray(questionData.options)) {
        questionData.options.forEach((option, index) => {
          const letter = String.fromCharCode(65 + index); // A, B, C, D
          transformedQuestion.options[letter] = option;
          if (option === questionData.correct_answer) {
            transformedQuestion.correct = letter;
          }
        });
      }
    }
    
    return {
      question: transformedQuestion,
      questionHash: selectedQuestion.question_hash,
      cacheId: selectedQuestion.id
    };
  } catch (error) {
    console.error('Cache retrieval error:', error);
    throw error;
  }
}

/**
 * Get batch of questions for reading comprehension
 * Returns multiple questions from the same passage
 */
async function getBatchFromCache(userId, topic, difficulty, grade) {
  try {
    // Get user's answered question hashes
    const { data: userData } = await supabase
      .from('users')
      .select('answered_question_hashes')
      .eq('id', userId)
      .single();
    
    const answeredHashes = userData?.answered_question_hashes || [];
    
    // For reading comprehension, we need to find questions that share the same context/passage
    // First, find a passage the user hasn't seen
    let query = supabase
      .from('question_cache')
      .select('*')
      .eq('topic', topic)
      .eq('grade', grade)
      .eq('difficulty', difficulty)
      .is('expires_at', null);
    
    
    if (answeredHashes.length > 0) {
      // Use filter syntax for not in array
      query = query.filter('question_hash', 'not.in', `(${answeredHashes.map(h => `"${h}"`).join(',')})`);
    }
    
    const { data: availableQuestions, error } = await query.limit(100);
    
    if (error || !availableQuestions || availableQuestions.length === 0) {
      throw new Error('No available questions in cache');
    }
    
    // Group questions by their passage (context)
    const passageGroups = {};
    availableQuestions.forEach(q => {
      const passageKey = q.question.context; // Use context as the passage
      if (!passageGroups[passageKey]) {
        passageGroups[passageKey] = [];
      }
      passageGroups[passageKey].push(q);
    });
    
    // Find a passage with enough questions (4-6 for reading comprehension)
    let selectedPassage = null;
    let selectedQuestions = [];
    
    for (const [passage, questions] of Object.entries(passageGroups)) {
      if (questions.length >= 4) {
        selectedPassage = passage;
        selectedQuestions = questions.slice(0, Math.min(6, questions.length));
        break;
      }
    }
    
    if (!selectedPassage || selectedQuestions.length < 4) {
      // Fallback to regular single questions if no good passage found
      throw new Error('No suitable passage with multiple questions found');
    }
    
    // Update usage count for all selected questions
    const questionIds = selectedQuestions.map(q => q.id);
    for (const question of selectedQuestions) {
      await supabase
        .from('question_cache')
        .update({ usage_count: (question.usage_count || 0) + 1 })
        .eq('id', question.id);
    }
    
    // Format for batch response
    return selectedQuestions.map((q, index) => {
      const questionData = q.question;
      // Handle both comprehension format and regular format
      let transformedQuestion;
      
      if (questionData.question && typeof questionData.options === 'object' && !Array.isArray(questionData.options)) {
        // Comprehension format (already has proper structure)
        transformedQuestion = {
          question: questionData.question,
          options: questionData.options,
          correct: questionData.correct,
          explanation: questionData.explanation || q.answer_explanation,
          context: questionData.context || '',
          questionHash: q.question_hash, // Use questionHash consistently
          difficulty,
          position: index + 1
        };
      } else {
        // Regular format (needs transformation)
        transformedQuestion = {
          question: questionData.question_text,
          options: {},
          correct: null,
          explanation: questionData.explanation || q.answer_explanation,
          context: questionData.context || '',
          questionHash: q.question_hash, // Use questionHash consistently
          difficulty,
          position: index + 1
        };
        
        // Convert array options to object format (A, B, C, D)
        if (Array.isArray(questionData.options)) {
          questionData.options.forEach((option, idx) => {
            const letter = String.fromCharCode(65 + idx); // A, B, C, D
            transformedQuestion.options[letter] = option;
            if (option === questionData.correct_answer) {
              transformedQuestion.correct = letter;
            }
          });
        }
      }
      
      return transformedQuestion;
    });
  } catch (error) {
    console.error('Batch retrieval error:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  const { method } = req;

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${method} not allowed` });
  }

  try {
    const { action, userId, topic, answer, timeSpent, hintsUsed, sessionId } = req.body;

    // Validate authentication using middleware
    const authResult = await validateAuth(req);
    
    if (!authResult.authenticated) {
      return res.status(401).json({ error: authResult.error || 'Authentication required' });
    }
    
    // For students, verify the userId matches their session
    if (authResult.isStudent) {
      if (authResult.user.id !== userId) {
        console.error('Student ID mismatch:', { sessionId: authResult.user.id, requestId: userId });
        return res.status(403).json({ error: 'Unauthorized access' });
      }
    } else {
      // For parents/teachers using Supabase auth
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization header' });
      }
      
      const token = authHeader.split('Bearer ')[1];
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user || user.id !== userId) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    
    // Check rate limit (increased to 20/minute for cache-based system)
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        message: 'Please wait a minute before making more requests' 
      });
    }

    /**
     * GENERATE ACTION - Get single question from cache
     * Replaces AI generation with cache retrieval
     */
    if (action === 'generate') {
      // Validate inputs
      if (!topic) {
        return res.status(400).json({ error: 'Missing topic' });
      }

      // Get user data
      const user = await getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const grade = user.grade || 8;
      const timerDuration = 45; // Fixed 45 seconds for all questions

      // Handle mixed session
      if (topic === 'mixed_session') {
        console.log('[Generate] Starting mixed session');
        
        try {
          const questions = await getMixedSessionQuestions(userId, grade);
          
          if (!questions || questions.length === 0) {
            return res.status(404).json({ 
              error: 'No questions available', 
              message: 'Unable to generate mixed session questions' 
            });
          }
          
          // Return the entire question set for the session
          return res.status(200).json({
            questions: questions,
            question: questions[0],
            questionHash: questions[0].questionHash || questions[0].hash,
            difficulty: questions[0].difficulty || 5,
            currentProficiency: 5,
            fromCache: true,
            timerDuration,
            sessionType: 'mixed',
            totalQuestions: questions.length
          });
          
        } catch (error) {
          console.error('[Generate] Mixed session error:', error);
          
          // Fallback: If mixed session fails, try to get just comprehension questions
          console.log('[Generate] Falling back to comprehension-only session');
          try {
            const comprehensionQuestions = await getBatchFromCache(userId, 'english_comprehension', null, grade);
            
            if (comprehensionQuestions && comprehensionQuestions.length > 0) {
              // Return up to 30 comprehension questions
              const questions = comprehensionQuestions.slice(0, 30);
              
              return res.status(200).json({
                questions: questions,
                question: questions[0],
                questionHash: questions[0].questionHash || questions[0].hash,
                difficulty: questions[0].difficulty || 5,
                currentProficiency: 5,
                fromCache: true,
                timerDuration,
                sessionType: 'mixed',
                totalQuestions: questions.length,
                fallbackMode: true,
                message: 'Using comprehension questions only'
              });
            }
          } catch (fallbackError) {
            console.error('[Generate] Fallback also failed:', fallbackError);
          }
          
          // Return user-friendly error when no questions are available
          return res.status(503).json({ 
            error: 'Questions temporarily unavailable', 
            message: 'We are currently updating our question database. Please try again in a few minutes, or contact support if the issue persists.',
            userMessage: 'Questions are being updated. Please try again shortly.',
            showRetry: true
          });
        }
      }

      // Handle single topic (existing logic)
      let actualTopic = topic;
      
      if (sessionId) {
        actualTopic = await getNextTopicForSession(sessionId, userId, topic);
        console.log('[Flow] Topic override:', topic, '->', actualTopic);
      }

      // Get current proficiency and map to difficulty
      const currentProficiency = user[actualTopic] || 5;
      const difficulty = mapProficiencyToDifficulty(currentProficiency, [1, 2, 3, 4, 5, 6, 7, 8]);
      
      // Try to get question with fallback logic
      let cachedData = null;
      let finalTopic = actualTopic;
      const attemptedTopics = [];
      
      while (!cachedData && finalTopic) {
        try {
          console.log('[Generate] Attempting topic:', finalTopic);
          cachedData = await getQuestionFromCache(userId, finalTopic, difficulty, grade);
          
          // Basic existence check
          if (!cachedData.question) {
            throw new Error('No question data found');
          }
          
          // Success - no need to update counters here, we update when answered
          
        } catch (error) {
          console.log('[Generate] Failed to get question for topic:', finalTopic, error.message);
          attemptedTopics.push(finalTopic);
          
          // Try fallback topic
          finalTopic = await getFallbackTopic(sessionId, userId, finalTopic, attemptedTopics);
          
          if (!finalTopic) {
            console.error('All topics exhausted, no questions available');
            return res.status(500).json({ 
              error: 'No questions available. Please try a different topic or contact support.',
              details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
          }
        }
      }
      
      return res.status(200).json({
        question: cachedData.question,
        difficulty,
        currentProficiency: user[finalTopic] || 5,
        questionHash: cachedData.questionHash,
        timerDuration,
        fromCache: true,
        actualTopic: finalTopic // Include actual topic used
      });
    }

    /**
     * GENERATE-BATCH ACTION - Get multiple questions for reading comprehension
     * Now retrieves from cache instead of generating
     */
    if (action === 'generate-batch') {
      if (!topic) {
        return res.status(400).json({ error: 'Missing topic' });
      }

      // Get user data
      const user = await getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Calculate difficulty based on proficiency and grade
      const currentProficiency = user[topic] || 5;
      const grade = user.grade || 8;
      
      // Grade-based difficulty scaling
      let gradeMultiplier = 1.0;
      if (grade <= 6) gradeMultiplier = 0.8;
      else if (grade === 7) gradeMultiplier = 0.9;
      else if (grade >= 9 && grade <= 10) gradeMultiplier = 1.2;
      else if (grade >= 11) gradeMultiplier = 1.4;
      
      const baseDifficulty = Math.min(8, Math.max(1, Math.round(
        mapProficiencyToDifficulty(currentProficiency, [1, 2, 3, 4, 5, 6, 7, 8]) * gradeMultiplier
      )));
      
      // NEW: Get timer duration
      const timerDuration = getTimerDuration(grade);
      
      try {
        // Get batch from cache for reading comprehension
        const questions = await getBatchFromCache(userId, topic, baseDifficulty, grade);
        
        // Generate batch ID for tracking
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Update session counter for comprehension batch
        if (sessionId && topic === 'english_comprehension') {
          await updateSessionCounters(sessionId, topic, true);
        }
        
        return res.status(200).json({
          questions,
          batchId,
          currentProficiency,
          totalQuestions: questions.length,
          timerDuration, // NEW: Include timer duration
          fromCache: true // NEW: Indicate cache source
        });
      } catch (error) {
        console.error('Failed to get batch from cache:', error);
        
        // Fallback to single questions if batch fails
        try {
          const questions = [];
          for (let i = 0; i < 5; i++) {
            const cachedData = await getQuestionFromCache(userId, topic, baseDifficulty, grade);
            if (cachedData && cachedData.question) {
              questions.push({
                ...cachedData.question,
                hash: cachedData.questionHash,
                difficulty: baseDifficulty,
                position: i + 1
              });
            }
          }
          
          if (questions.length > 0) {
            const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            return res.status(200).json({
              questions,
              batchId,
              currentProficiency,
              totalQuestions: questions.length,
              timerDuration,
              fromCache: true
            });
          }
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        }
        
        return res.status(500).json({ 
          error: 'No questions available for this configuration. Please try a different topic.',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }

    /**
     * START-SESSION ACTION - Create a new study session
     */
    if (action === 'start-session') {
      const { grade } = req.body;
      
      // Validate required fields
      if (!userId || !topic) {
        return res.status(400).json({ error: 'Missing userId or topic' });
      }
      
      try {
        // Close any existing active sessions for this student
        await supabase
          .from('study_sessions')
          .update({ 
            session_end: new Date().toISOString(),
            is_active: false 
          })
          .eq('student_id', userId)
          .eq('is_active', true);
        
        // Get user's current proficiency for difficulty level
        const user = await getUser(userId);
        const proficiency = user?.[topic] || 5;
        const difficulty = mapProficiencyToDifficulty(proficiency, [1, 2, 3, 4, 5, 6, 7, 8]);
        
        // Create new study session
        const { data: sessionData, error } = await supabase
          .from('study_sessions')
          .insert({
            student_id: userId,
            topic: topic,
            session_type: 'practice',
            difficulty_level: difficulty,
            is_active: true,
            session_start: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) {
          console.error('Failed to create study session:', error);
          return res.status(500).json({ error: 'Failed to create study session' });
        }
        
        return res.status(200).json({
          success: true,
          sessionId: sessionData.id,
          message: 'Study session started'
        });
      } catch (error) {
        console.error('Start session error:', error);
        return res.status(500).json({ error: 'Failed to start session' });
      }
    }
    
    /**
     * END-SESSION ACTION - Close an active study session
     */
    if (action === 'end-session') {
      const { reason = 'completed' } = req.body;
      
      if (!userId || !sessionId) {
        return res.status(400).json({ error: 'Missing userId or sessionId' });
      }
      
      try {
        const { data, error } = await supabase
          .from('study_sessions')
          .update({
            session_end: new Date().toISOString(),
            is_active: false,
            abandonment_reason: reason
          })
          .eq('id', sessionId)
          .eq('student_id', userId)
          .select();
        
        if (error) {
          console.error('Failed to end study session:', error);
          return res.status(500).json({ error: 'Failed to end study session' });
        }
        
        // Check if we got a result (removed .single() to avoid error when no rows)
        if (!data || data.length === 0) {
          console.log('No active session found to close:', { sessionId, userId });
          return res.status(200).json({
            success: true,
            message: 'Session already closed or not found',
            sessionStats: {
              duration: 0,
              totalQuestions: 0,
              correctAnswers: 0,
              accuracy: 0
            }
          });
        }
        
        const sessionData = data[0];
        
        return res.status(200).json({
          success: true,
          message: 'Study session ended',
          sessionStats: {
            duration: sessionData.session_end && sessionData.session_start ? 
              Math.floor((new Date(sessionData.session_end) - new Date(sessionData.session_start)) / 1000) : 0,
            totalQuestions: sessionData.total_questions,
            correctAnswers: sessionData.correct_answers,
            accuracy: sessionData.total_questions > 0 ? 
              Math.round((sessionData.correct_answers / sessionData.total_questions) * 100) : 0
          }
        });
      } catch (error) {
        console.error('End session error:', error);
        return res.status(500).json({ error: 'Failed to end session' });
      }
    }

    /**
     * ABANDON ACTION - Record abandoned question
     */
    if (action === 'abandon') {
      // Validate inputs
      if (!userId || !topic || timeSpent === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const { questionHash, hintsUsed = 0 } = req.body;
      
      try {
        // Log the abandoned attempt
        await logQuestionAttempt(
          userId, 
          topic, 
          null,  // correct is null for abandoned
          timeSpent, 
          hintsUsed,  // actual hints used
          questionHash, 
          sessionId,
          true   // abandoned = true
        );
        
        // Increment questions_in_session counter even for abandoned questions
        if (sessionId) {
          // First get current count
          const { data: sessionData } = await supabase
            .from('study_sessions')
            .select('questions_in_session')
            .eq('id', sessionId)
            .eq('student_id', userId)
            .single();
          
          const currentCount = sessionData?.questions_in_session || 0;
          
          // Then update with incremented value
          await supabase
            .from('study_sessions')
            .update({ 
              questions_in_session: currentCount + 1
            })
            .eq('id', sessionId)
            .eq('student_id', userId);
        }
        
        return res.status(200).json({
          success: true,
          message: 'Abandoned question recorded'
        });
      } catch (error) {
        console.error('Failed to record abandoned question:', error);
        return res.status(500).json({ 
          error: 'Failed to record abandoned question' 
        });
      }
    }
    
    /**
     * SUBMIT ACTION - Process answer and update proficiency
     * Enhanced to update answered_question_hashes
     */
    if (action === 'submit') {
      // Validate inputs
      if (!userId || !topic || answer === undefined || !timeSpent) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get user data
      const user = await getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if answer is correct
      const { correct, questionHash } = req.body;
      
      // Log the attempt with session ID (not abandoned)
      await logQuestionAttempt(userId, topic, correct, timeSpent, hintsUsed || 0, questionHash, sessionId, false);

      // NEW: Update answered_question_hashes to prevent seeing same question again
      if (questionHash) {
        const currentHashes = user.answered_question_hashes || [];
        if (!currentHashes.includes(questionHash)) {
          await supabase
            .from('users')
            .update({ 
              answered_question_hashes: [...currentHashes, questionHash] 
            })
            .eq('id', userId);
        }
      }

      // Increment questions_in_session counter and topic counter if we have a session
      if (sessionId) {
        // First get current count
        const { data: sessionData } = await supabase
          .from('study_sessions')
          .select('questions_in_session')
          .eq('id', sessionId)
          .eq('student_id', userId)
          .single();
        
        const currentCount = sessionData?.questions_in_session || 0;
        
        // Then update with incremented value
        await supabase
          .from('study_sessions')
          .update({ 
            questions_in_session: currentCount + 1
          })
          .eq('id', sessionId)
          .eq('student_id', userId);
        
        // Update topic-specific counter (for non-comprehension topics)
        // Comprehension is counted when batch is delivered, not per question
        if (topic !== 'english_comprehension') {
          const columnMap = {
            'english_vocabulary': 'vocabulary_completed',
            'english_synonyms': 'synonyms_completed',
            'english_antonyms': 'antonyms_completed',
            'english_grammar': 'grammar_completed',
            'english_sentences': 'sentences_completed',
            'english_fill_blanks': 'fill_blanks_completed'
          };
          
          const column = columnMap[topic];
          if (column) {
            const { data: current } = await supabase
              .from('study_sessions')
              .select(column)
              .eq('id', sessionId)
              .single();
            
            if (current) {
              await supabase
                .from('study_sessions')
                .update({ [column]: (current[column] || 0) + 1 })
                .eq('id', sessionId);
            }
          }
        }
      }

      // Update proficiency
      const currentProficiency = user[topic] || 5;
      const newProficiency = updateProficiency(currentProficiency, correct);
      
      // Save updated proficiency
      await updateUserProficiency(userId, topic, newProficiency);

      return res.status(200).json({
        correct,
        oldProficiency: currentProficiency,
        newProficiency,
        proficiencyChange: newProficiency - currentProficiency
      });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('Generate API error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return res.status(500).json({ 
      error: 'Failed to process request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}