require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 1000;

// Grade-based word count requirements - ALL minimum 350 words
const WORD_COUNTS = {
  5: { min: 350, max: 400 },
  6: { min: 350, max: 450 },
  7: { min: 350, max: 500 },
  8: { min: 400, max: 550 },
  9: { min: 450, max: 600 },
  10: { min: 500, max: 650 },
  11: { min: 550, max: 700 }
};

// Reading comprehension subtopics
const COMPREHENSION_TOPICS = {
  'narrative-fiction': ['adventure stories', 'mystery tales', 'coming-of-age stories', 'fantasy adventures', 'historical fiction'],
  'historical-texts': ['American Revolution', 'Civil War', 'World War II', 'Ancient civilizations', 'Renaissance period'],
  'science-articles': ['space exploration', 'climate change', 'human biology', 'technology advances', 'ocean life'],
  'biography-memoir': ['scientists', 'historical figures', 'artists', 'explorers', 'inventors'],
  'nature-environment': ['ecosystems', 'endangered species', 'natural disasters', 'conservation efforts', 'geological wonders']
};

// Generate hash for question uniqueness
function generateQuestionHash(question, topic) {
  const content = `${topic}-${question.question}-${JSON.stringify(question.options)}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

// Call Gemini API
async function callGeminiAPI(prompt) {
  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error('No response from Gemini');
    }

    const text = data.candidates[0].content.parts[0].text;
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Gemini API call failed:', error);
    throw error;
  }
}

// Create prompt for reading comprehension
function createComprehensionPrompt(grade, subtopic, wordCount, mood, difficulty) {
  const difficultyDescriptions = {
    1: 'very simple vocabulary and short sentences',
    2: 'simple vocabulary with clear explanations',
    3: 'grade-appropriate vocabulary with context clues',
    4: 'some challenging vocabulary with varied sentence structures',
    5: 'advanced vocabulary requiring inference',
    6: 'complex vocabulary and sophisticated concepts',
    7: 'highly advanced with abstract thinking',
    8: 'expert level with nuanced understanding'
  };

  const moodStyles = {
    creative: 'imaginative and engaging with vivid descriptions',
    focused: 'clear, informative, and well-structured',
    curious: 'thought-provoking with interesting facts and questions',
    analytical: 'detailed with logical progression and evidence',
    adventurous: 'exciting with action and exploration',
    calm: 'peaceful, reflective, and contemplative',
    energetic: 'dynamic, fast-paced, and enthusiastic',
    relaxed: 'gentle, easy-going, and comfortable'
  };

  return `Create an educational reading comprehension exercise for grade ${grade} students.

CRITICAL REQUIREMENTS - MUST FOLLOW EXACTLY:
1. PASSAGE LENGTH: Minimum ${wordCount.min} words, maximum ${wordCount.max} words. The passage MUST be at least ${wordCount.min} words long.
2. NUMBER OF QUESTIONS: Generate EXACTLY 6 questions (not 5, not 4 - exactly 6).
3. ANSWER OPTIONS: Each question MUST have EXACTLY 4 options labeled A, B, C, and D.
4. CORRECT ANSWER: One and ONLY ONE option must be 100% correct. The other three must be incorrect.
5. ANSWER FORMAT: The "correct" field MUST contain ONLY the letter (A, B, C, or D) of the correct answer.

PASSAGE REQUIREMENTS:
- Topic: ${subtopic}
- Writing style: ${moodStyles[mood]}
- Difficulty level ${difficulty}/8: ${difficultyDescriptions[difficulty]}
- Age-appropriate for ${grade + 5}-${grade + 6} year olds
- Complete passage with clear beginning, middle, and end
- Educational value with factual accuracy

QUESTION TYPES (generate exactly 6):
1. Main idea or central theme
2. Specific detail from the passage
3. Vocabulary meaning in context
4. Making an inference
5. Author's purpose or tone
6. Another detail or comprehension question

VALIDATION CHECKLIST:
✓ Passage is AT LEAST ${wordCount.min} words
✓ Exactly 6 questions provided
✓ Each question has exactly 4 options (A, B, C, D)
✓ Each question has exactly 1 correct answer
✓ Correct answer is specified as a single letter

Return ONLY valid JSON in this exact format:
{
  "passage": "The complete passage text of AT LEAST ${wordCount.min} words...",
  "word_count": <actual word count>,
  "questions": [
    {
      "question": "What is the main idea of this passage?",
      "options": {
        "A": "First option - incorrect",
        "B": "Second option - this is the correct answer",
        "C": "Third option - incorrect",
        "D": "Fourth option - incorrect"
      },
      "correct": "B",
      "explanation": "B is correct because..."
    },
    {
      "question": "According to the passage, what happened when...?",
      "options": {
        "A": "This is what actually happened (correct)",
        "B": "This did not happen",
        "C": "This is not mentioned",
        "D": "This is the opposite"
      },
      "correct": "A",
      "explanation": "A is correct - the passage states..."
    },
    {
      "question": "The word 'example' in paragraph 2 means:",
      "options": {
        "A": "Wrong meaning 1",
        "B": "Wrong meaning 2",
        "C": "Wrong meaning 3",
        "D": "Correct meaning based on context"
      },
      "correct": "D",
      "explanation": "D is correct - in this context..."
    },
    {
      "question": "Based on the passage, we can infer that...?",
      "options": {
        "A": "Incorrect inference",
        "B": "Unsupported inference",
        "C": "Correct inference based on evidence",
        "D": "Contradictory inference"
      },
      "correct": "C",
      "explanation": "C is correct - this can be inferred from..."
    },
    {
      "question": "Why did the author write this passage?",
      "options": {
        "A": "Incorrect purpose",
        "B": "The correct purpose - to inform/explain/persuade",
        "C": "Too narrow purpose",
        "D": "Wrong purpose"
      },
      "correct": "B",
      "explanation": "B is correct - the author's purpose is..."
    },
    {
      "question": "Which statement best describes...?",
      "options": {
        "A": "Partially correct but incomplete",
        "B": "Incorrect description",
        "C": "Opposite of what's true",
        "D": "The correct and complete description"
      },
      "correct": "D",
      "explanation": "D is correct - this best describes..."
    }
  ]
}

REMEMBER: You MUST generate EXACTLY 6 questions, each with EXACTLY 4 options (A,B,C,D), with EXACTLY 1 correct answer.`;
}

// Generate a single passage with questions
async function generatePassage(grade, subtopic, mood, difficulty) {
  const wordCount = WORD_COUNTS[grade];
  const prompt = createComprehensionPrompt(grade, subtopic, wordCount, mood, difficulty);
  
  try {
    const result = await callGeminiAPI(prompt);
    
    // Validate word count
    const actualWords = result.passage.trim().split(/\s+/).length;
    console.log(`Generated ${actualWords} word passage about ${subtopic}`);
    
    if (actualWords < wordCount.min) {
      console.error(`❌ Passage too short: ${actualWords} words (minimum: ${wordCount.min})`);
      return [];
    }
    
    // Validate number of questions
    if (!result.questions || result.questions.length !== 6) {
      console.error(`❌ Wrong number of questions: ${result.questions?.length || 0} (expected: 6)`);
      return [];
    }
    
    // Convert to database format
    return result.questions.map(q => {
      const questionData = {
        question: q.question,
        options: q.options,
        correct: q.correct,
        context: result.passage,
        explanation: q.explanation
      };
      
      return {
        topic: 'english_comprehension',
        difficulty,
        grade,
        mood,
        ai_model: 'gemini-2',
        question: questionData,
        question_hash: generateQuestionHash(questionData, 'english_comprehension'),
        answer_explanation: q.explanation,
        usage_count: 0,
        expires_at: null
      };
    });
  } catch (error) {
    console.error(`Failed to generate passage:`, error.message);
    return [];
  }
}

// Check existing passages
async function getExistingCount(grade) {
  const { count } = await supabase
    .from('question_cache')
    .select('*', { count: 'exact', head: true })
    .eq('topic', 'english_comprehension')
    .eq('grade', grade)
    .is('expires_at', null);
  
  return count || 0;
}

// Insert questions to database
async function insertQuestions(questions) {
  if (questions.length === 0) return;
  
  const { error } = await supabase
    .from('question_cache')
    .insert(questions);
    
  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log(`✓ Inserted ${questions.length} questions`);
  }
}

// Main generation process
async function main() {
  console.log('Gemini 2.0 Flash - Reading Comprehension Generator');
  console.log('================================================\n');
  
  if (!GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY not found in .env.local');
    console.log('\nTo get a Gemini API key:');
    console.log('1. Visit: https://aistudio.google.com/app/apikey');
    console.log('2. Create a new API key');
    console.log('3. Add to .env.local: GEMINI_API_KEY=your-key-here\n');
    return;
  }
  
  // Check current stats
  console.log('Current passage counts by grade:');
  for (let grade = 5; grade <= 11; grade++) {
    const count = await getExistingCount(grade);
    console.log(`Grade ${grade}: ${count} questions`);
  }
  
  // Generation parameters - LIMITED TO 50 QUESTIONS FOR TESTING
  const TARGET_QUESTIONS = 50;
  const QUESTIONS_PER_PASSAGE = 6;
  const PASSAGES_NEEDED = Math.ceil(TARGET_QUESTIONS / QUESTIONS_PER_PASSAGE); // ~9 passages
  
  console.log(`\nTarget: ${TARGET_QUESTIONS} questions (${PASSAGES_NEEDED} passages)\n`);
  
  // Test configuration - mix of grades and settings
  const testConfigs = [
    { grade: 7, subtopic: 'adventure stories', mood: 'creative', difficulty: 4 },
    { grade: 8, subtopic: 'World War II', mood: 'focused', difficulty: 5 },
    { grade: 9, subtopic: 'space exploration', mood: 'curious', difficulty: 5 },
    { grade: 10, subtopic: 'scientists', mood: 'analytical', difficulty: 6 },
    { grade: 11, subtopic: 'climate change', mood: 'focused', difficulty: 6 },
    { grade: 8, subtopic: 'mystery tales', mood: 'creative', difficulty: 4 },
    { grade: 9, subtopic: 'Ancient civilizations', mood: 'curious', difficulty: 5 },
    { grade: 10, subtopic: 'technology advances', mood: 'analytical', difficulty: 6 },
    { grade: 11, subtopic: 'environmental issues', mood: 'focused', difficulty: 6 }
  ];
  
  let totalGenerated = 0;
  let passagesGenerated = 0;
  
  for (const config of testConfigs) {
    if (totalGenerated >= TARGET_QUESTIONS) break;
    
    const { grade, subtopic, mood, difficulty } = config;
    const wordCount = WORD_COUNTS[grade];
    
    console.log(`\n[${passagesGenerated + 1}/${PASSAGES_NEEDED}] Grade ${grade}: ${subtopic}`);
    console.log(`  - Word count: ${wordCount.min}-${wordCount.max}`);
    console.log(`  - Mood: ${mood}, Difficulty: ${difficulty}/8`);
    
    const questions = await generatePassage(grade, subtopic, mood, difficulty);
    
    if (questions.length > 0) {
      await insertQuestions(questions);
      totalGenerated += questions.length;
      passagesGenerated++;
      console.log(`  ✓ Generated ${questions.length} questions`);
    } else {
      console.log(`  ❌ Failed to generate questions`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
  }
  
  console.log(`\n✓ Generation complete!`);
  console.log(`Generated ${totalGenerated} total questions`);
  
  // Estimate cost
  const estimatedInputTokens = totalGenerated * 500; // ~500 tokens per prompt
  const estimatedOutputTokens = totalGenerated * 400; // ~400 tokens per response
  const estimatedCost = (estimatedInputTokens * 0.10 + estimatedOutputTokens * 0.40) / 1_000_000;
  
  console.log(`\nEstimated Gemini 2.0 Flash costs:`);
  console.log(`- Input tokens: ~${estimatedInputTokens.toLocaleString()}`);
  console.log(`- Output tokens: ~${estimatedOutputTokens.toLocaleString()}`);
  console.log(`- Total cost: ~$${estimatedCost.toFixed(4)}`);
}

// Run the script
main().catch(console.error);