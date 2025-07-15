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
const QUESTIONS_PER_SEGMENT = 10; // Start small for testing
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 2000;

// Topic configurations (subset for testing)
const TOPICS = {
  english_comprehension: {
    aiModel: 'openai',
    subtopics: ['narrative-fiction', 'historical-texts', 'science-articles'],
    contexts: ['adventure', 'school-life', 'real-world']
  },
  math_algebra: {
    aiModel: 'claude',
    subtopics: ['linear-equations', 'quadratic-equations', 'systems-of-equations'],
    contexts: ['real-world-problems', 'abstract-math', 'word-problems']
  }
};

const AI_ROUTING = {
  english_comprehension: 'openai',
  math_algebra: 'claude'
};

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

// Create question prompt
function createQuestionPrompt(topic, difficulty, grade, context, subtopic, mood) {
  const isComprehension = topic.includes('comprehension');
  const minWords = 200 + (grade - 5) * 50; // Scale by grade
  
  return `Generate a ${isComprehension ? 'reading comprehension exercise' : 'math problem'} for a grade ${grade} student.

TOPIC: ${topic.replace(/_/g, ' ')}
SUBTOPIC: ${subtopic}
CONTEXT: ${context}
MOOD: ${mood}
DIFFICULTY: ${difficulty}/8
GRADE: ${grade}

${isComprehension ? `
Create a reading passage of ${minWords}-${minWords + 50} words and generate 3-5 questions based on the passage length.
Each question must test different aspects (main idea, details, vocabulary, inference).
` : `
Create a word problem or mathematical question appropriate for the grade level.
Include real-world context where appropriate.
`}

Return ONLY valid JSON in this format:
${isComprehension ? `
{
  "passage": "The actual passage text here...",
  "questions": [
    {
      "question": "Question text",
      "options": {
        "A": "Option A",
        "B": "Option B", 
        "C": "Option C",
        "D": "Option D"
      },
      "correct": "B",
      "explanation": "Explanation of why B is correct"
    }
  ]
}` : `
{
  "context": "Problem context or setup",
  "question": "The actual question",
  "options": {
    "A": "Option A",
    "B": "Option B",
    "C": "Option C", 
    "D": "Option D"
  },
  "correct": "B",
  "explanation": "Step-by-step solution explanation"
}`}`;
}

// Generate with OpenAI
async function generateWithOpenAI(prompt) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert educational content creator. Create age-appropriate content and return only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const content = completion.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('OpenAI error:', error.message);
    throw error;
  }
}

// Generate with Claude
async function generateWithClaude(prompt) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      messages: [
        {
          role: "user",
          content: prompt + "\n\nReturn ONLY valid JSON, no additional text."
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });
    
    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Claude error:', error.message);
    throw error;
  }
}

// Generate a single question
async function generateSingleQuestion(topic, grade, difficulty, mood) {
  const topicConfig = TOPICS[topic];
  const aiModel = AI_ROUTING[topic];
  
  // Random subtopic and context
  const subtopic = topicConfig.subtopics[Math.floor(Math.random() * topicConfig.subtopics.length)];
  const context = topicConfig.contexts[Math.floor(Math.random() * topicConfig.contexts.length)];
  
  const prompt = createQuestionPrompt(topic, difficulty, grade, context, subtopic, mood);
  
  try {
    let result;
    if (aiModel === 'openai') {
      result = await generateWithOpenAI(prompt);
    } else {
      result = await generateWithClaude(prompt);
    }
    
    // Handle multi-question format for reading comprehension
    if (result.questions && Array.isArray(result.questions)) {
      return result.questions.map(q => {
        const questionData = {
          question: q.question,
          options: q.options,
          correct: q.correct,
          context: result.passage,
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
          expires_at: null
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
      expires_at: null
    }];
  } catch (error) {
    console.error(`Error generating question: ${error.message}`);
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
async function generateSegment(topic, grade, difficulty, mood, targetCount) {
  console.log(`\nGenerating: ${topic} - Grade ${grade} - Difficulty ${difficulty} - Mood ${mood}`);
  
  const existingCount = await getExistingCount(topic, grade, difficulty, mood);
  const needed = targetCount - existingCount;
  
  if (needed <= 0) {
    console.log(`Already have ${existingCount} questions, skipping...`);
    return;
  }
  
  console.log(`Need ${needed} more questions (existing: ${existingCount})`);
  
  let generated = 0;
  
  while (generated < needed) {
    const batchTarget = Math.min(BATCH_SIZE, needed - generated);
    const batch = [];
    
    // Generate batch
    for (let i = 0; i < batchTarget; i++) {
      const questions = await generateSingleQuestion(topic, grade, difficulty, mood);
      batch.push(...questions);
      
      // Small delay between individual generations
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Deduplicate
    const uniqueQuestions = [];
    const seenHashes = new Set();
    
    for (const q of batch) {
      if (!seenHashes.has(q.question_hash)) {
        seenHashes.add(q.question_hash);
        uniqueQuestions.push(q);
      }
    }
    
    generated += uniqueQuestions.length;
    console.log(`Generated ${generated}/${needed} questions...`);
    
    // Insert batch
    await insertQuestions(uniqueQuestions);
    
    // Rate limiting
    if (generated < needed) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  console.log(`✓ Completed segment`);
}

// Main process
async function main() {
  console.log('Starting question pool generation...');
  console.log(`Target: ${QUESTIONS_PER_SEGMENT} questions per segment`);
  
  const topics = Object.keys(TOPICS);
  const grades = [5, 6, 7, 8];
  const difficulties = [1, 2, 3, 4, 5];
  const moods = ['creative', 'focused', 'curious', 'analytical'];
  
  let totalSegments = 0;
  
  for (const topic of topics) {
    for (const grade of grades) {
      for (const difficulty of difficulties) {
        for (const mood of moods) {
          totalSegments++;
          await generateSegment(topic, grade, difficulty, mood, QUESTIONS_PER_SEGMENT);
          
          // Longer delay between segments
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
  }
  
  console.log(`\n✓ Generation complete! Processed ${totalSegments} segments`);
  
  // Show statistics
  const { count } = await supabase
    .from('question_cache')
    .select('*', { count: 'exact', head: true })
    .is('expires_at', null);
    
  console.log(`Total questions in permanent pool: ${count || 0}`);
}

// Run the script
main().catch(console.error);