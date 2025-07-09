import { AI_ROUTING, EDUCATIONAL_TOPICS, getRandomContext, getSocraticPrompt } from './utils';

// Note: AI clients are initialized in the API routes, not here
// This file only contains helper functions

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
const createQuestionPrompt = (topic, difficulty, grade, context, subtopic) => {
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
  
  return `Create a multiple-choice question for a grade ${grade} student.

Topic: ${topic.replace(/_/g, ' ')}
Subtopic: ${subtopic}
Context: ${context}
Difficulty: Level ${difficulty} - ${difficultyDescriptions[difficulty] || difficultyDescriptions[5]}

Requirements:
1. Question should be engaging and age-appropriate
2. Include 4 answer options (A, B, C, D)
3. Only one correct answer
4. Wrong answers should be plausible but clearly incorrect
5. For reading comprehension, include a short passage (2-3 sentences)
6. For math, include real-world context when possible

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
}`;
};

// These functions will be called from the API route with the initialized clients
export const generateWithOpenAI = async (openai, prompt) => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert educational content creator specializing in K-12 curriculum."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('OpenAI generation error:', error);
    throw error;
  }
};

// Generate with Claude
export const generateWithClaude = async (anthropic, prompt) => {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      messages: [
        {
          role: "user",
          content: `You are an expert educational content creator. ${prompt}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });
    
    // Extract JSON from Claude's response
    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Claude');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Claude generation error:', error);
    throw error;
  }
};

// Generate Socratic follow-up for wrong answers
export const generateSocraticFollowup = async (topic, question, wrongAnswer, difficulty) => {
  const basePrompt = getSocraticPrompt(topic, difficulty);
  const aiModel = AI_ROUTING[topic];
  
  const prompt = `A student answered incorrectly. Generate a helpful Socratic prompt.

Question: ${question}
Student's answer: ${wrongAnswer}
Base prompt style: ${basePrompt}

Create a gentle, encouraging follow-up that:
1. Doesn't give away the answer
2. Guides thinking in the right direction
3. Relates to the student's current understanding
4. Is age-appropriate and supportive

Return just the prompt text, no formatting.`;
  
  try {
    if (aiModel === 'openai') {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a supportive teacher using the Socratic method." },
          { role: "user", content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 150
      });
      
      return response.choices[0].message.content.trim();
    } else {
      const response = await anthropic.messages.create({
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

// Validate question format
export const validateQuestion = (question) => {
  const required = ['question', 'options', 'correct', 'explanation'];
  const hasRequired = required.every(field => question[field]);
  
  if (!hasRequired) return false;
  
  const hasOptions = ['A', 'B', 'C', 'D'].every(opt => question.options[opt]);
  const correctValid = ['A', 'B', 'C', 'D'].includes(question.correct);
  
  return hasOptions && correctValid;
};