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

import { validateQuestion } from '../../lib/ai-service';
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
 * Retrieve question from cache based on user's proficiency and history
 * This replaces the AI generation logic
 */
async function getQuestionFromCache(userId, topic, difficulty, grade, mood) {
  try {
    // First, get user's answered question hashes to avoid duplicates
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('answered_question_hashes')
      .eq('id', userId)
      .single();
    
    if (userError) {
      console.error('Error fetching user data:', userError);
    }
    
    const answeredHashes = userData?.answered_question_hashes || [];
    
    // Query question_cache for matching questions
    // Filter out questions the user has already answered
    let query = supabase
      .from('question_cache')
      .select('*')
      .eq('topic', topic)
      .eq('grade', grade)
      .eq('difficulty', difficulty)
      .is('expires_at', null); // Only permanent questions
    
    // Add mood filter if provided
    if (mood) {
      query = query.eq('mood', mood);
    }
    
    // Filter out answered questions
    if (answeredHashes.length > 0) {
      query = query.not('question_hash', 'in', `(${answeredHashes.join(',')})`);
    }
    
    // Get up to 10 questions and randomly select one
    const { data: questions, error } = await query.limit(10);
    
    if (error) {
      console.error('Error fetching questions from cache:', error);
      throw new Error('Failed to fetch questions from cache');
    }
    
    if (!questions || questions.length === 0) {
      // Try without mood filter if no questions found
      if (mood) {
        return getQuestionFromCache(userId, topic, difficulty, grade, null);
      }
      
      // Try adjacent difficulties if still no questions
      if (difficulty > 1) {
        return getQuestionFromCache(userId, topic, difficulty - 1, grade, mood);
      } else if (difficulty < 8) {
        return getQuestionFromCache(userId, topic, difficulty + 1, grade, mood);
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
    const transformedQuestion = {
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
async function getBatchFromCache(userId, topic, difficulty, grade, mood) {
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
    
    if (mood) {
      query = query.eq('mood', mood);
    }
    
    if (answeredHashes.length > 0) {
      query = query.not('question_hash', 'in', `(${answeredHashes.join(',')})`);
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
    await supabase
      .from('question_cache')
      .update({ usage_count: supabase.raw('usage_count + 1') })
      .in('id', questionIds);
    
    // Format for batch response
    return selectedQuestions.map((q, index) => {
      const questionData = q.question;
      const transformedQuestion = {
        question: questionData.question_text,
        options: {},
        correct: null,
        explanation: questionData.explanation || q.answer_explanation,
        context: questionData.context || '',
        hash: q.question_hash,
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
    const { action, userId, topic, answer, timeSpent, hintsUsed, mood, sessionId } = req.body;

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

      // Get current proficiency and map to difficulty
      const currentProficiency = user[topic] || 5;
      const difficulty = mapProficiencyToDifficulty(currentProficiency, [1, 2, 3, 4, 5, 6, 7, 8]);
      const grade = user.grade || 8;
      
      // NEW: Get timer duration based on grade
      const timerDuration = getTimerDuration(grade);
      
      try {
        // Get question from cache instead of generating with AI
        const cachedData = await getQuestionFromCache(userId, topic, difficulty, grade, mood);
        
        // Validate the cached question format
        if (!validateQuestion(cachedData.question, topic, grade)) {
          throw new Error('Invalid question format from cache');
        }
        
        return res.status(200).json({
          question: cachedData.question,
          difficulty,
          currentProficiency,
          questionHash: cachedData.questionHash,
          timerDuration, // NEW: Include timer duration
          fromCache: true // NEW: Indicate this came from cache
        });
      } catch (error) {
        console.error('Failed to get question from cache:', error);
        return res.status(500).json({ 
          error: 'No questions available. Please try a different topic or contact support.',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
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
        const questions = await getBatchFromCache(userId, topic, baseDifficulty, grade, mood);
        
        // Generate batch ID for tracking
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
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
            const cachedData = await getQuestionFromCache(userId, topic, baseDifficulty, grade, mood);
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
      
      const { questionHash } = req.body;
      
      try {
        // Log the abandoned attempt
        await logQuestionAttempt(
          userId, 
          topic, 
          null,  // correct is null for abandoned
          timeSpent, 
          0,     // no hints used
          questionHash, 
          sessionId,
          true   // abandoned = true
        );
        
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