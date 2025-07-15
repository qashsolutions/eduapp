require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Configuration
const QUESTIONS_PER_SEGMENT = 100;
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds

// Load utils and ai-service modules
let EDUCATIONAL_TOPICS, AI_ROUTING, createQuestionPrompt, generateWithOpenAI, generateWithClaude;

async function loadModules() {
  // Use dynamic import for ES modules
  const utilsModule = await import('../lib/utils.js');
  const aiServiceModule = await import('../lib/ai-service.js');
  
  EDUCATIONAL_TOPICS = utilsModule.EDUCATIONAL_TOPICS;
  AI_ROUTING = utilsModule.AI_ROUTING;
  createQuestionPrompt = aiServiceModule.createQuestionPrompt;
  generateWithOpenAI = aiServiceModule.generateWithOpenAI;
  generateWithClaude = aiServiceModule.generateWithClaude;
}

// Get all valid combinations
function getAllCombinations() {
  const combinations = [];
  const grades = [5, 6, 7, 8, 9, 10, 11];
  const moods = ['creative', 'relaxed', 'focused', 'energetic', 'curious', 'calm', 'adventurous', 'analytical'];
  
  for (const [topic, config] of Object.entries(EDUCATIONAL_TOPICS)) {
    for (const grade of grades) {
      for (const difficulty of config.complexityLevels || [1, 2, 3, 4, 5, 6, 7, 8]) {
        for (const mood of moods) {
          combinations.push({ topic, grade, difficulty, mood, aiModel: AI_ROUTING[topic] });
        }
      }
    }
  }
  
  return combinations;
}

// Generate hash for question uniqueness
function generateQuestionHash(question, topic) {
  const content = `${topic}-${question.question}-${JSON.stringify(question.options)}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

// Check existing questions in pool
async function getExistingCount(topic, grade, difficulty, mood) {
  const { count, error } = await supabase
    .from('question_cache')
    .select('*', { count: 'exact', head: true })
    .eq('topic', topic)
    .eq('grade', grade)
    .eq('difficulty', difficulty)
    .eq('mood', mood)
    .is('expires_at', null);
    
  if (error) {
    console.error('Error checking existing questions:', error);
    return 0;
  }
  
  return count || 0;
}

// Generate a single question
async function generateSingleQuestion(combination) {
  const { topic, grade, difficulty, mood, aiModel } = combination;
  const topicConfig = EDUCATIONAL_TOPICS[topic];
  
  // Random subtopic and context
  const subtopic = topicConfig.subtopics[Math.floor(Math.random() * topicConfig.subtopics.length)];
  const context = topicConfig.contexts[Math.floor(Math.random() * topicConfig.contexts.length)];
  
  const prompt = createQuestionPrompt(topic, difficulty, grade, context, subtopic, mood);
  
  try {
    let result;
    if (aiModel === 'openai') {
      result = await generateWithOpenAI(openai, prompt);
    } else {
      result = await generateWithClaude(anthropic, prompt);
    }
    
    // Handle multi-question format for reading comprehension
    if (result.questions && Array.isArray(result.questions)) {
      return result.questions.map(q => {
        const questionData = {
          question: q.question,
          options: q.options,
          correct: q.correct,
          context: result.context || q.context,
          explanation: q.explanation
        };
        
        return {
          topic,
          difficulty,
          grade,
          mood,
          ai_model: aiModel,
          question: questionData,
          question_hash: generateQuestionHash(questionData, topic),
          answer_explanation: q.explanation,
          usage_count: 0,
          expires_at: null // Permanent storage
        };
      });
    }
    
    // Single question format
    const questionData = {
      question: result.question,
      options: result.options,
      correct: result.correct,
      context: result.context,
      explanation: result.explanation
    };
    
    return [{
      topic,
      difficulty,
      grade,
      mood,
      ai_model: aiModel,
      question: questionData,
      question_hash: generateQuestionHash(questionData, topic),
      answer_explanation: result.explanation,
      usage_count: 0,
      expires_at: null // Permanent storage
    }];
  } catch (error) {
    console.error(`Error generating question for ${topic} grade ${grade} difficulty ${difficulty}:`, error);
    return [];
  }
}

// Insert questions into database
async function insertQuestions(questions) {
  if (questions.length === 0) return;
  
  const { error } = await supabase
    .from('question_cache')
    .insert(questions);
    
  if (error) {
    console.error('Error inserting questions:', error);
  } else {
    console.log(`Inserted ${questions.length} questions`);
  }
}

// Generate questions for a specific segment
async function generateSegment(combination, targetCount) {
  const { topic, grade, difficulty, mood } = combination;
  console.log(`\nGenerating questions for ${topic} - Grade ${grade} - Difficulty ${difficulty} - Mood ${mood}`);
  
  const existingCount = await getExistingCount(topic, grade, difficulty, mood);
  const needed = targetCount - existingCount;
  
  if (needed <= 0) {
    console.log(`Already have ${existingCount} questions, skipping...`);
    return;
  }
  
  console.log(`Need ${needed} more questions (existing: ${existingCount})`);
  
  const questions = [];
  let generated = 0;
  
  while (generated < needed) {
    const batch = [];
    const batchTarget = Math.min(BATCH_SIZE, needed - generated);
    
    // Generate batch in parallel
    const promises = Array(batchTarget).fill(null).map(() => generateSingleQuestion(combination));
    const results = await Promise.all(promises);
    
    // Flatten results (some may return multiple questions)
    for (const result of results) {
      batch.push(...result);
    }
    
    // Deduplicate within batch
    const uniqueQuestions = [];
    const seenHashes = new Set();
    
    for (const q of batch) {
      const hash = generateQuestionHash(q.question, topic);
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        uniqueQuestions.push(q);
      }
    }
    
    questions.push(...uniqueQuestions);
    generated += uniqueQuestions.length;
    
    console.log(`Generated ${generated}/${needed} questions...`);
    
    // Insert batch
    await insertQuestions(uniqueQuestions);
    
    // Rate limiting
    if (generated < needed) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  console.log(`✓ Completed ${topic} - Grade ${grade} - Difficulty ${difficulty} - Mood ${mood}`);
}

// Main generation process
async function main() {
  console.log('Loading modules...');
  await loadModules();
  
  console.log('Starting question pool generation...');
  console.log(`Target: ${QUESTIONS_PER_SEGMENT} questions per segment`);
  
  const combinations = getAllCombinations();
  console.log(`Total segments to generate: ${combinations.length}`);
  
  // Process combinations in sequence to avoid rate limits
  for (const combination of combinations) {
    await generateSegment(combination, QUESTIONS_PER_SEGMENT);
    
    // Longer delay between different segments
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log('\n✓ Question pool generation complete!');
  
  // Show statistics
  const { count } = await supabase
    .from('question_cache')
    .select('*', { count: 'exact', head: true })
    .is('expires_at', null);
    
  console.log(`Total questions in permanent pool: ${count}`);
}

// Run the script
main().catch(console.error);