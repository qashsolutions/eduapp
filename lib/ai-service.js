import { AI_ROUTING, EDUCATIONAL_TOPICS, getRandomContext, getSocraticPrompt, getISEEStandard, getMoodStyle } from './utils';

// Note: AI clients are initialized in the API routes, not here
// This file only contains helper functions

// Basic profanity filter for educational content
const profanityList = [
  'fuck', 'shit', 'ass', 'damn', 'hell', 'bitch', 'bastard', 'dick', 'cock', 
  'pussy', 'piss', 'crap', 'whore', 'slut', 'fag', 'gay', 'retard', 'nigger',
  'cunt', 'twat', 'douche', 'jerk', 'idiot', 'stupid', 'dumb', 'moron'
];

// Check content for profanity
const containsProfanity = (text) => {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return profanityList.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerText);
  });
};

// Sanitize question content
const sanitizeContent = (question) => {
  const fieldsToCheck = ['question', 'context', 'explanation'];
  const optionsToCheck = question.options ? Object.values(question.options) : [];
  
  // Check main fields
  for (const field of fieldsToCheck) {
    if (question[field] && containsProfanity(question[field])) {
      throw new Error('Generated content contains inappropriate language');
    }
  }
  
  // Check options
  for (const option of optionsToCheck) {
    if (containsProfanity(option)) {
      throw new Error('Generated content contains inappropriate language');
    }
  }
  
  return question;
};

// Generate question based on topic and difficulty
export const generateQuestion = async (topic, difficulty, studentGrade) => {
  const aiModel = AI_ROUTING[topic];
  const topicConfig = EDUCATIONAL_TOPICS[topic];
  
  if (!topicConfig) {
    throw new Error(`Invalid topic: ${topic}`);
  }
  
  const context = getRandomContext(topicConfig.contexts);
  const subtopic = topicConfig.subtopics[Math.floor(Math.random() * topicConfig.subtopics.length)];
  
  const prompt = createQuestionPrompt(topic, difficulty, studentGrade, context, subtopic);
  
  try {
    if (aiModel === 'openai') {
      return await generateWithOpenAI(prompt);
    } else {
      return await generateWithClaude(prompt);
    }
  } catch (error) {
    console.error('Error generating question:', error);
    throw error;
  }
};

// Create prompt for question generation
export const createQuestionPrompt = (topic, difficulty, grade, context, subtopic, mood = null) => {
  const difficultyDescriptions = {
    1: "very easy, basic concepts",
    2: "easy, fundamental understanding",
    3: "moderate, applying concepts",
    4: "challenging, deeper analysis",
    5: "difficult, complex reasoning",
    6: "advanced, synthesis of ideas",
    7: "expert, abstract thinking",
    8: "mastery level, creative application"
  };
  
  // Get ISEE standards for this grade and topic
  const iseeStandard = getISEEStandard(grade, topic);
  const moodStyle = mood ? getMoodStyle(mood) : '';
  
  let iseeSection = '';
  if (iseeStandard) {
    iseeSection = `
ISEE Alignment:
- Standards: ${iseeStandard.standards.join(', ')}
- Focus: ${iseeStandard.focus}
- Question Types: ${iseeStandard.questionTypes.join(', ')}
`;
  }
  
  let moodSection = '';
  if (moodStyle) {
    moodSection = `
Presentation Style: ${moodStyle}
`;
  }
  
  return `Create a multiple-choice question for a grade ${grade} student.

Topic: ${topic.replace(/_/g, ' ')}
Subtopic: ${subtopic}
Context: ${context}
Difficulty: Level ${difficulty} - ${difficultyDescriptions[difficulty] || difficultyDescriptions[5]}
${iseeSection}${moodSection}
Requirements:
1. Question should be engaging and age-appropriate
2. Include 4 answer options (A, B, C, D)
3. Only one correct answer
4. Wrong answers should be plausible but clearly incorrect
5. CRITICAL: ALL questions MUST include substantial context/passage in the "context" field
6. For reading comprehension, include a comprehensive passage (minimum ${getMinimumWordCount(grade)} words for grade ${grade})
7. For math, include detailed real-world context and problem setup
8. IMPORTANT: Content must be appropriate for K-12 education with no profanity, violence, or inappropriate themes
9. Align with ISEE standards while maintaining the mood-based presentation style

Return JSON format:
{
  "question": "The main question text",
  "context": "Optional passage or problem context (for comprehension/word problems)",
  "options": {
    "A": "First option",
    "B": "Second option",
    "C": "Third option",
    "D": "Fourth option"
  },
  "correct": "B",
  "explanation": "Brief explanation of why this is correct"
}

CRITICAL REQUIREMENTS:
1. The "correct" field MUST contain ONLY the letter (A, B, C, or D) that corresponds to the correct answer
2. Do NOT put the actual answer value in the "correct" field
3. The correct answer MUST be one of the four options provided
4. Example: If the answer is "3" and it's option B, then "correct": "B" (NOT "correct": "3")`;
};

// These functions will be called from the API route with the initialized clients
export const generateWithOpenAI = async (openai, prompt) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert educational content creator specializing in K-12 curriculum. Create only age-appropriate content with no profanity or inappropriate themes. Always return responses in valid JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });
    
    const content = completion.choices[0].message.content;
    
    // Parse JSON response
    try {
      const parsedContent = JSON.parse(content);
      return sanitizeContent(parsedContent);
    } catch (parseError) {
      // If response is not pure JSON, try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedContent = JSON.parse(jsonMatch[0]);
        return sanitizeContent(parsedContent);
      }
      throw new Error('Invalid JSON response from OpenAI');
    }
  } catch (error) {
    console.error('OpenAI generation error:', error);
    throw error;
  }
};

// Generate with Claude
export const generateWithClaude = async (anthropic, prompt) => {
  try {
    console.log('[Claude] Starting question generation...');
    
    // Add JSON instruction to the prompt
    const jsonPrompt = `You are an expert educational content creator specializing in K-12 curriculum. Create only age-appropriate content with no profanity or inappropriate themes. ${prompt}

IMPORTANT: Return ONLY valid JSON, no additional text or formatting.`;
    
    console.log('[Claude] Sending request to API...');
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      messages: [
        {
          role: "user",
          content: jsonPrompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });
    
    console.log('[Claude] Response received:', {
      id: response.id,
      model: response.model,
      stop_reason: response.stop_reason,
      usage: response.usage
    });
    
    // Extract JSON from Claude's response
    const content = response.content[0].text;
    console.log('[Claude] Raw response content:', content.substring(0, 200) + '...');
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('[Claude] No JSON found in response. Full content:', content);
      throw new Error('Invalid JSON response from Claude');
    }
    
    console.log('[Claude] Parsing JSON...');
    const parsedContent = JSON.parse(jsonMatch[0]);
    
    console.log('[Claude] Parsed content keys:', Object.keys(parsedContent));
    console.log('[Claude] Correct answer:', parsedContent.correct);
    
    return sanitizeContent(parsedContent);
  } catch (error) {
    console.error('[Claude] Generation error:', error.message);
    console.error('[Claude] Error type:', error.constructor.name);
    console.error('[Claude] Error details:', {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    
    // Log specific Anthropic API errors
    if (error.response) {
      console.error('[Claude] API Response:', error.response);
    }
    if (error.error) {
      console.error('[Claude] API Error:', error.error);
    }
    
    throw error;
  }
};

// Generate Socratic follow-up for wrong answers
export const generateSocraticFollowup = async (aiClient, topic, question, wrongAnswer, difficulty, hintLevel = 1) => {
  const basePrompt = getSocraticPrompt(topic, difficulty);
  const aiModel = AI_ROUTING[topic];
  
  const hintGuidance = {
    1: "Give a general thinking prompt that encourages the student to reconsider without any specific clues.",
    2: "Point out key words or concepts they should focus on, but don't eliminate any answers.",
    3: "Help eliminate 1-2 wrong answers or give a stronger clue about the correct answer's characteristics.",
    4: "Give a very strong hint that makes the correct answer obvious without directly stating it."
  };
  
  const prompt = `A student answered incorrectly and needs hint level ${hintLevel} of 4. Generate a helpful Socratic prompt.

Question: ${question}
Student's answer: ${wrongAnswer}
Base prompt style: ${basePrompt}
Hint Level ${hintLevel}: ${hintGuidance[hintLevel]}

Create a gentle, encouraging follow-up that:
1. Matches the hint level guidance exactly
2. Is progressively more helpful (level ${hintLevel} of 4)
3. Is age-appropriate and supportive
4. Builds on previous hint levels

Return just the prompt text, no formatting.`;
  
  try {
    if (aiModel === 'openai') {
      const completion = await aiClient.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a supportive teacher using the Socratic method." },
          { role: "user", content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 150
      });
      
      return completion.choices[0].message.content.trim();
    } else {
      const response = await aiClient.messages.create({
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.8
      });
      
      return response.content[0].text.trim();
    }
  } catch (error) {
    console.error('Error generating Socratic prompt:', error);
    return basePrompt; // Fallback to base prompt
  }
};

// Grade-based minimum word counts for passages
const getMinimumWordCount = (grade) => {
  const wordCounts = {
    5: 100,
    6: 150, 
    7: 200,
    8: 250,
    9: 300,
    10: 350,
    11: 500
  };
  return wordCounts[grade] || wordCounts[8]; // Default to grade 8 if not found
};

// Check if question refers to the passage
const validatePassageQuestionCoherence = (question, context) => {
  const questionText = question.toLowerCase();
  const passageReferenceWords = [
    'passage', 'text', 'reading', 'according to', 'based on', 'in the passage',
    'the author', 'the story', 'the article', 'mentioned', 'states that',
    'refers to', 'suggests', 'indicates', 'describes', 'main idea',
    'central theme', 'purpose', 'tone', 'character', 'setting'
  ];
  
  const hasPassageReference = passageReferenceWords.some(word => 
    questionText.includes(word)
  );
  
  if (!hasPassageReference) {
    console.error('Validation failed: Question does not reference the passage');
    return false;
  }
  
  return true;
};

// Validate question format with enhanced passage validation
export const validateQuestion = (question, topic = null, grade = 8) => {
  const required = ['question', 'options', 'correct', 'explanation'];
  const hasRequired = required.every(field => question[field]);
  
  if (!hasRequired) {
    console.error('Validation failed: Missing required fields');
    return false;
  }
  
  const hasOptions = ['A', 'B', 'C', 'D'].every(opt => question.options[opt]);
  const correctValid = ['A', 'B', 'C', 'D'].includes(question.correct);
  
  // Basic validation
  if (!hasOptions || !correctValid) {
    console.error('Validation failed: Invalid options or correct answer format');
    return false;
  }
  
  // Ensure correct answer exists in options
  const correctAnswerExists = question.options[question.correct] !== undefined;
  if (!correctAnswerExists) {
    console.error('Validation failed: correct answer not in options');
    return false;
  }
  
  // Check if AI mistakenly put the answer value instead of letter
  if (!correctValid && question.correct) {
    console.error(`Invalid correct answer format: "${question.correct}" - should be A, B, C, or D`);
    return false;
  }
  
  // CRITICAL: All questions MUST have context/passage
  if (!question.context || !question.context.trim()) {
    console.error('Validation failed: ALL questions must have context/passage - cannot display answers without context');
    return false;
  }
  
  // Enhanced validation for reading comprehension topics
  if (topic && topic.includes('comprehension')) {
    const minWordCount = getMinimumWordCount(grade);
    const wordCount = question.context.trim().split(/\s+/).length;
    
    if (wordCount < minWordCount) {
      console.error(`Validation failed: Passage too short (${wordCount} words, minimum ${minWordCount} for grade ${grade})`);
      return false;
    }
    
    // Check for incomplete passages
    const context = question.context.trim();
    const incompleteSigns = [
      context.endsWith('...'),
      context.includes('[incomplete]'),
      context.includes('[continue]'),
      context.length < 200, // Too short in characters
      !context.includes('.'), // No sentences
      context.split('.').length < 3 // Less than 3 sentences
    ];
    
    if (incompleteSigns.some(sign => sign)) {
      console.error('Validation failed: Passage appears incomplete or malformed');
      return false;
    }
    
    // Validate that question actually refers to the passage
    if (!validatePassageQuestionCoherence(question.question, question.context)) {
      return false;
    }
  }
  
  // For non-comprehension topics, ensure context is still meaningful
  if (topic && !topic.includes('comprehension')) {
    const wordCount = question.context.trim().split(/\s+/).length;
    if (wordCount < 20) { // Minimum context for any question type
      console.error(`Validation failed: Context too minimal (${wordCount} words, minimum 20 for non-comprehension questions)`);
      return false;
    }
  }
  
  return true;
};