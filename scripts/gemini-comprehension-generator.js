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
const DELAY_BETWEEN_CALLS = 2000; // Increased to 2 seconds to avoid rate limits
const TARGET_PASSAGES = 200;
const WORD_TOLERANCE = 50; // Allow passages to be up to 50 words short
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds on rate limit error

// Grade-specific word counts and topics
const GRADE_CONFIGS = {
  5: {
    wordCount: { min: 75, max: 150 },
    topics: [
      { name: 'Finding the Main Idea', desc: 'Identifying what a short story or article is mostly about' },
      { name: 'Simple Character Traits', desc: 'Describing characters using evidence from the text (brave kind helpful etc)' },
      { name: 'Sequence of Events', desc: 'Putting story events in the correct order using signal words (first then next finally)' },
      { name: 'Basic Cause and Effect', desc: 'Understanding simple why something happened relationships in stories' },
      { name: 'Context Clues for Vocabulary', desc: 'Using picture clues and nearby words to figure out unknown words' },
      { name: 'Fact vs Fiction', desc: 'Telling the difference between real information and made-up stories' },
      { name: 'Simple Predictions', desc: 'Guessing what might happen next based on story clues' },
      { name: 'Author\'s Purpose - Basic', desc: 'Understanding if the author wants to tell a story teach something or entertain' },
      { name: 'Text Features', desc: 'Using titles headings pictures and captions to understand texts better' },
      { name: 'Simple Comparisons', desc: 'Finding how two characters or things in a story are alike or different' }
    ]
  },
  6: {
    wordCount: { min: 100, max: 175 },
    topics: [
      { name: 'Main Idea with Supporting Details', desc: 'Finding the main idea and 2-3 details that support it' },
      { name: 'Character Feelings and Motivations', desc: 'Understanding why characters act the way they do and how they feel' },
      { name: 'Story Elements', desc: 'Identifying setting characters problem and solution in stories' },
      { name: 'Simple Inferences', desc: 'Making logical guesses about information not directly stated in text' },
      { name: 'Text Structure Recognition', desc: 'Recognizing when text tells a sequence describes or compares things' },
      { name: 'Author\'s Point of View', desc: 'Understanding who is telling the story (first person third person narrator)' },
      { name: 'Simple Summarizing', desc: 'Retelling the most important parts of a story or article in your own words' },
      { name: 'Context Clues - Advanced', desc: 'Using multiple strategies to determine word meanings in longer texts' },
      { name: 'Distinguishing Fact from Opinion', desc: 'Identifying statements that can be proven vs personal beliefs' },
      { name: 'Making Connections', desc: 'Relating story events to personal experiences or other texts' }
    ]
  },
  7: {
    wordCount: { min: 125, max: 200 },
    topics: [
      { name: 'Theme Identification', desc: 'Understanding the lesson or message the author wants readers to learn' },
      { name: 'Character Development', desc: 'Tracking how characters change throughout a story and why' },
      { name: 'Advanced Inferences', desc: 'Drawing conclusions using multiple clues from different parts of the text' },
      { name: 'Text Evidence Support', desc: 'Finding specific quotes or examples to support answers and opinions' },
      { name: 'Compare and Contrast Texts', desc: 'Analyzing similarities and differences between two related passages' },
      { name: 'Author\'s Tone and Mood', desc: 'Identifying the author\'s attitude and the feeling created in readers' },
      { name: 'Literary Devices - Basic', desc: 'Recognizing similes metaphors and personification in texts' },
      { name: 'Argument Identification', desc: 'Finding the main claim an author makes in persuasive texts' },
      { name: 'Multiple Meaning Words', desc: 'Understanding how the same word can have different meanings in different contexts' },
      { name: 'Text Organization Patterns', desc: 'Recognizing problem-solution chronological and compare-contrast structures' }
    ]
  },
  8: {
    wordCount: { min: 150, max: 250 },
    topics: [
      { name: 'Complex Theme Analysis', desc: 'Identifying and explaining universal themes across different types of texts' },
      { name: 'Advanced Character Analysis', desc: 'Analyzing character relationships conflicts and growth with textual evidence' },
      { name: 'Critical Inference Skills', desc: 'Making sophisticated inferences about author intent and implicit meanings' },
      { name: 'Rhetorical Devices Introduction', desc: 'Understanding basic persuasive techniques like repetition and emotional appeals' },
      { name: 'Multi-Text Synthesis', desc: 'Combining information from two or more related texts to form new understanding' },
      { name: 'Advanced Literary Elements', desc: 'Analyzing setting symbolism conflict types and plot development' },
      { name: 'Bias and Perspective Recognition', desc: 'Identifying when authors show preference or particular viewpoints' },
      { name: 'Argument Evaluation', desc: 'Assessing whether evidence strongly supports an author\'s claims' },
      { name: 'Advanced Vocabulary Strategies', desc: 'Using word parts context and reference materials for complex vocabulary' },
      { name: 'Genre Characteristics', desc: 'Understanding features of different text types (poetry drama biography etc)' }
    ]
  },
  9: {
    wordCount: { min: 350, max: 450 },
    topics: [
      { name: 'Main Idea and Central Theme', desc: 'Identifying the primary message or central argument in fiction and non-fiction texts' },
      { name: 'Author\'s Purpose and Tone', desc: 'Understanding why an author wrote a text and determining their attitude toward the subject' },
      { name: 'Inference and Implicit Meaning', desc: 'Drawing logical conclusions from textual evidence and context clues' },
      { name: 'Text Structure and Organization', desc: 'Recognizing how authors organize information (chronological sequence cause-effect comparison-contrast problem-solution)' },
      { name: 'Character Analysis and Development', desc: 'Analyzing how characters change throughout a story and their motivations' },
      { name: 'Literary Devices and Figurative Language', desc: 'Identifying and interpreting metaphors similes symbolism irony and other literary techniques' },
      { name: 'Context Clues and Vocabulary', desc: 'Using surrounding text to determine meanings of unfamiliar words' },
      { name: 'Cause and Effect Relationships', desc: 'Understanding how events actions and ideas influence each other in texts' },
      { name: 'Fact vs Opinion Distinction', desc: 'Differentiating between objective statements and subjective viewpoints' },
      { name: 'Basic Argument Analysis', desc: 'Identifying claims and simple supporting evidence in persuasive texts' }
    ]
  },
  10: {
    wordCount: { min: 400, max: 500 },
    topics: [
      { name: 'Advanced Inference and Analysis', desc: 'Making complex inferences about character motivations themes and implicit meanings' },
      { name: 'Comparative Text Analysis', desc: 'Analyzing similarities and differences between multiple texts on similar topics' },
      { name: 'Rhetorical Strategies and Appeals', desc: 'Understanding ethos pathos logos and how authors persuade audiences' },
      { name: 'Historical and Cultural Context', desc: 'Interpreting texts within their historical social and cultural backgrounds' },
      { name: 'Advanced Literary Analysis', desc: 'Analyzing complex themes symbolism allegory and literary movements' },
      { name: 'Data Interpretation in Texts', desc: 'Reading and analyzing graphs charts and statistical information within passages' },
      { name: 'Synthesis of Multiple Sources', desc: 'Combining information from various texts to form comprehensive understanding' },
      { name: 'Bias and Perspective Analysis', desc: 'Identifying author bias and understanding how perspective shapes meaning' },
      { name: 'Advanced Vocabulary in Context', desc: 'Determining precise meanings of sophisticated vocabulary using context' },
      { name: 'Argumentative Text Evaluation', desc: 'Assessing the strength of arguments evidence quality and logical reasoning' }
    ]
  },
  11: {
    wordCount: { min: 450, max: 600 },
    topics: [
      { name: 'Complex Thematic Analysis', desc: 'Analyzing universal themes and their development across different literary works' },
      { name: 'Advanced Rhetorical Analysis', desc: 'Examining sophisticated persuasive techniques and their effectiveness' },
      { name: 'Textual Evidence Integration', desc: 'Using multiple pieces of evidence to support complex analytical claims' },
      { name: 'Cross-Cultural Literary Comparison', desc: 'Comparing works from different cultures and time periods (IB focus)' },
      { name: 'Philosophical and Abstract Concepts', desc: 'Understanding complex philosophical social and psychological ideas in texts' },
      { name: 'Advanced Synthesis Writing', desc: 'Combining multiple complex sources to create original analytical arguments' },
      { name: 'Satirical and Ironic Analysis', desc: 'Understanding complex forms of satire irony and social commentary' },
      { name: 'Genre Conventions and Innovation', desc: 'Analyzing how authors work within or subvert traditional literary genres' },
      { name: 'Advanced Data Analysis', desc: 'Interpreting complex statistical information research findings and scientific data' },
      { name: 'Critical Evaluation of Sources', desc: 'Assessing credibility bias and reliability of various text sources' },
      { name: 'Interdisciplinary Text Analysis', desc: 'Connecting literary works to history science psychology and other fields' },
      { name: 'Advanced Argument Construction', desc: 'Building sophisticated multi-layered arguments with counterargument consideration' },
      { name: 'Postmodern and Contemporary Analysis', desc: 'Understanding experimental narrative techniques and contemporary literary movements' },
      { name: 'Global Perspectives and Literature', desc: 'Analyzing literature from diverse global perspectives (IB Global Contexts)' },
      { name: 'Research and Citation Skills', desc: 'Properly incorporating and citing sources in analytical writing' }
    ]
  }
};

// Generate hash for question uniqueness
function generateQuestionHash(question, topic) {
  const content = `${topic}-${question.question}-${JSON.stringify(question.options)}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

// Call Gemini API with retry logic
async function callGeminiAPI(prompt, retryCount = 0) {
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

    if (response.status === 429 && retryCount < MAX_RETRIES) {
      console.log(`  ⏳ Rate limit hit, waiting ${RETRY_DELAY/1000}s before retry ${retryCount + 1}/${MAX_RETRIES}...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return callGeminiAPI(prompt, retryCount + 1);
    }

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
    if (retryCount < MAX_RETRIES && error.message.includes('fetch')) {
      console.log(`  ⏳ Network error, retrying ${retryCount + 1}/${MAX_RETRIES}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return callGeminiAPI(prompt, retryCount + 1);
    }
    throw error;
  }
}

// Create prompt for specific grade and topic
function createPrompt(grade, topic, wordCount) {
  return `Create a reading comprehension exercise for grade ${grade} students.

CRITICAL REQUIREMENTS:
1. PASSAGE LENGTH: The passage MUST be between ${wordCount.min} and ${wordCount.max} words.
2. TOPIC FOCUS: ${topic.name} - ${topic.desc}
3. NUMBER OF QUESTIONS: Generate EXACTLY 6 questions.
4. ANSWER OPTIONS: Each question MUST have EXACTLY 4 options labeled A, B, C, and D.
5. CORRECT ANSWER: EXACTLY ONE option must be correct. The other three must be incorrect.
6. ANSWER FORMAT: The "correct" field MUST contain ONLY the letter (A, B, C, or D).

PASSAGE REQUIREMENTS:
- Grade ${grade} reading level (age ${grade + 5}-${grade + 6})
- Educational and age-appropriate
- Complete with beginning, middle, and end
- Focus on "${topic.name}" skill

QUESTION REQUIREMENTS:
All 6 questions should test the specific skill: "${topic.name}"
For example, if the topic is "Finding the Main Idea", all questions should relate to identifying main ideas.
If the topic is "Character Traits", all questions should be about character descriptions and evidence.

VALIDATION:
✓ Passage length: ${wordCount.min}-${wordCount.max} words
✓ Exactly 6 questions
✓ Each question has exactly 4 options (A, B, C, D)
✓ Each question has exactly 1 correct answer
✓ All questions test the skill: ${topic.name}

Return ONLY valid JSON:
{
  "passage": "The complete passage text (${wordCount.min}-${wordCount.max} words)...",
  "word_count": <actual count>,
  "questions": [
    {
      "question": "Question focused on ${topic.name}",
      "options": {
        "A": "First option",
        "B": "Second option", 
        "C": "Third option",
        "D": "Fourth option"
      },
      "correct": "B",
      "explanation": "Why B is the correct answer"
    }
  ]
}

REMEMBER: All 6 questions must focus on "${topic.name}" - ${topic.desc}`;
}

// Generate passage with validation
async function generatePassage(grade, topic, mood = 'focused', difficulty = 5) {
  const wordCount = GRADE_CONFIGS[grade].wordCount;
  const prompt = createPrompt(grade, topic, wordCount);
  
  try {
    const result = await callGeminiAPI(prompt);
    
    // Validate word count with tolerance
    const actualWords = result.passage.trim().split(/\s+/).length;
    const shortage = wordCount.min - actualWords;
    
    console.log(`  Word count: ${actualWords} (target: ${wordCount.min}-${wordCount.max})`);
    
    // Check if passage is too short even with tolerance
    if (shortage > WORD_TOLERANCE) {
      console.log(`  ⚠️  Passage too short by ${shortage} words (tolerance: ${WORD_TOLERANCE})`);
      
      // Determine appropriate lower grade
      let targetGrade = grade;
      for (let g = grade - 1; g >= 5; g--) {
        if (actualWords >= GRADE_CONFIGS[g].wordCount.min - WORD_TOLERANCE) {
          targetGrade = g;
          break;
        }
      }
      
      if (targetGrade < grade) {
        console.log(`  → Moving to grade ${targetGrade}`);
        difficulty = Math.max(1, difficulty - (grade - targetGrade));
      }
      
      grade = targetGrade;
    }
    
    // Validate questions
    if (!result.questions || result.questions.length !== 6) {
      console.error(`  ❌ Wrong number of questions: ${result.questions?.length || 0}`);
      return [];
    }
    
    // Validate each question has 4 options and correct answer
    for (let i = 0; i < result.questions.length; i++) {
      const q = result.questions[i];
      const options = Object.keys(q.options || {});
      
      if (options.length !== 4 || !options.includes('A') || !options.includes('B') || 
          !options.includes('C') || !options.includes('D')) {
        console.error(`  ❌ Question ${i + 1} doesn't have exactly 4 options (A,B,C,D)`);
        return [];
      }
      
      if (!['A', 'B', 'C', 'D'].includes(q.correct)) {
        console.error(`  ❌ Question ${i + 1} has invalid correct answer: ${q.correct}`);
        return [];
      }
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
    console.error(`  ❌ Generation failed: ${error.message}`);
    return [];
  }
}

// Insert questions to database
async function insertQuestions(questions) {
  if (questions.length === 0) return;
  
  const { error } = await supabase
    .from('question_cache')
    .insert(questions);
    
  if (error) {
    console.error('Database insert error:', error);
  }
}

// Main generation process
async function main() {
  console.log('Gemini 2.0 Flash - Comprehensive Reading Generator');
  console.log('=================================================\n');
  
  if (!GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY not found in .env.local');
    return;
  }
  
  console.log(`Configuration:`);
  console.log(`- Target passages: ${TARGET_PASSAGES}`);
  console.log(`- Questions per passage: 6`);
  console.log(`- Total questions target: ${TARGET_PASSAGES * 6}`);
  console.log(`- Word count tolerance: ${WORD_TOLERANCE} words\n`);
  
  let totalGenerated = 0;
  let passagesGenerated = 0;
  const moods = ['focused', 'creative', 'analytical', 'curious'];
  
  // Generate passages across all grades and topics
  for (let passageCount = 0; passageCount < TARGET_PASSAGES; passageCount++) {
    // Rotate through grades and topics
    const gradeKeys = Object.keys(GRADE_CONFIGS);
    const gradeIndex = passageCount % gradeKeys.length;
    const grade = parseInt(gradeKeys[gradeIndex]);
    
    const topics = GRADE_CONFIGS[grade].topics;
    const topicIndex = Math.floor(passageCount / gradeKeys.length) % topics.length;
    const topic = topics[topicIndex];
    
    const mood = moods[passageCount % moods.length];
    const difficulty = 3 + (passageCount % 4); // Difficulty 3-6
    
    console.log(`\n[${passageCount + 1}/${TARGET_PASSAGES}] Grade ${grade}: ${topic.name}`);
    console.log(`  Mood: ${mood}, Difficulty: ${difficulty}/8`);
    
    const questions = await generatePassage(grade, topic, mood, difficulty);
    
    if (questions.length > 0) {
      await insertQuestions(questions);
      totalGenerated += questions.length;
      passagesGenerated++;
      console.log(`  ✓ Generated ${questions.length} questions`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CALLS));
  }
  
  console.log(`\n=== GENERATION COMPLETE ===`);
  console.log(`Passages generated: ${passagesGenerated}`);
  console.log(`Total questions: ${totalGenerated}`);
  
  // Cost estimate
  const avgTokensPerCall = 800;
  const totalTokens = passagesGenerated * avgTokensPerCall;
  const inputCost = (totalTokens * 0.5 * 0.10) / 1_000_000; // 50% input
  const outputCost = (totalTokens * 0.5 * 0.40) / 1_000_000; // 50% output
  
  console.log(`\nEstimated cost:`);
  console.log(`- Total tokens: ~${totalTokens.toLocaleString()}`);
  console.log(`- Cost: ~$${(inputCost + outputCost).toFixed(3)}`);
}

// Run the script
main().catch(console.error);