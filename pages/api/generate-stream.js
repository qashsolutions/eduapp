import { generateWithOpenAI, generateWithClaude, validateQuestion, createQuestionPrompt } from '../../lib/ai-service';
import { getUser } from '../../lib/db';
import { mapProficiencyToDifficulty, AI_ROUTING, EDUCATIONAL_TOPICS, generateQuestionHash } from '../../lib/utils';
import { validateAuth } from '../../lib/authMiddleware';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Initialize AI clients
const openaiKey = process.env.OPENAI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, topic, mood, position = 1, existingQuestions = [] } = req.body;

    // Validate authentication
    const authResult = await validateAuth(req);
    if (!authResult.authenticated) {
      return res.status(401).json({ error: authResult.error || 'Authentication required' });
    }

    // Check AI model
    const aiModel = AI_ROUTING[topic];
    if (!aiModel) {
      return res.status(400).json({ error: 'Invalid topic' });
    }

    // Get user data
    const user = await getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get current proficiency and difficulty
    const currentProficiency = user[topic] || 5;
    const grade = user.grade || 8;
    
    // Apply grade-based scaling to difficulty
    let gradeMultiplier;
    if (grade <= 6) {
      gradeMultiplier = 0.8; // Grades 5 and 6 = 0.8x
    } else if (grade === 7) {
      gradeMultiplier = 0.9; // Grade 7 = 0.9x
    } else if (grade === 8) {
      gradeMultiplier = 1.0; // Grade 8 = 1.0x (baseline)
    } else if (grade >= 9 && grade <= 10) {
      gradeMultiplier = 1.2; // Grades 9 and 10 = 1.2x
    } else if (grade >= 11) {
      gradeMultiplier = 1.4; // Grade 11 and above = 1.4x
    } else {
      gradeMultiplier = 1.0; // Default
    }
    
    const baseDifficulty = Math.min(8, Math.max(1, Math.round(
      mapProficiencyToDifficulty(currentProficiency, [1, 2, 3, 4, 5, 6, 7, 8]) * gradeMultiplier
    )));
    
    // Vary difficulty for each question
    const difficulties = [
      baseDifficulty,
      Math.max(1, baseDifficulty - 1),
      baseDifficulty,
      Math.min(8, baseDifficulty + 1),
      baseDifficulty
    ];
    const difficulty = difficulties[position - 1] || baseDifficulty;
    
    const topicConfig = EDUCATIONAL_TOPICS[topic];
    
    if (!topicConfig) {
      return res.status(400).json({ error: `Invalid topic: ${topic}` });
    }

    // Generate single question with retries
    let question = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!question && attempts < maxAttempts) {
      attempts++;
      
      // Randomize context and subtopic
      const contexts = [...topicConfig.contexts].sort(() => Math.random() - 0.5);
      const subtopics = [...topicConfig.subtopics].sort(() => Math.random() - 0.5);
      const context = contexts[attempts % contexts.length];
      const subtopic = subtopics[attempts % subtopics.length];
      
      // Create enhanced prompt
      const basePrompt = createQuestionPrompt(topic, difficulty, grade, context, subtopic, mood);
      
      // Add complexity requirements for English
      const isEnglishTopic = topic.startsWith('english_');
      const complexityRequirements = isEnglishTopic ? `

IMPORTANT COMPLEXITY REQUIREMENTS FOR ENGLISH:
- For reading comprehension: Create a passage of AT LEAST 200-250 words with rich vocabulary
- Make wrong answer choices plausible and contextually relevant
- Avoid obviously incorrect options
- Use sophisticated vocabulary appropriate for grade ${grade}
- Wrong answers should represent common misconceptions or partial understanding
- Ensure all options are grammatically correct and of similar length` : '';
      
      const enhancedPrompt = basePrompt + complexityRequirements + `

This is question ${position} of 5 in a learning session.
${position === 1 ? 'Start with foundational concepts.' :
  position === 5 ? 'Create a synthesis or application question.' :
  'Build on previous concepts.'}`;
      
      try {
        // Generate question(s)
        let generatedContent;
        
        if (aiModel === 'openai') {
          if (!openai) throw new Error('OpenAI client not initialized');
          generatedContent = await generateWithOpenAI(openai, enhancedPrompt);
        } else {
          if (!anthropic) throw new Error('Anthropic client not initialized');
          generatedContent = await generateWithClaude(anthropic, enhancedPrompt);
        }
        
        // Check if we got multiple questions
        if (generatedContent.questions && Array.isArray(generatedContent.questions)) {
          console.log(`Generated ${generatedContent.questions.length} questions for passage`);
          
          // Store all questions with the same passage
          const questionsWithPassage = generatedContent.questions.map((q, idx) => {
            const uniqueElements = `${topic}-${subtopic}-${context}-${difficulty}-${q.question}-${Date.now()}-${position}-${idx}`;
            const hash = generateQuestionHash(topic, subtopic, context, difficulty, uniqueElements);
            
            return {
              ...q,
              context: generatedContent.context,
              hash,
              difficulty,
              position: position + idx,
              contextType: context,
              subtopic
            };
          });
          
          // Return all questions
          return res.status(200).json({
            questions: questionsWithPassage,
            position,
            currentProficiency,
            multiQuestion: true
          });
        }
        
        // Handle single question (legacy)
        // Validate with topic and grade
        if (!validateQuestion(generatedContent, topic, grade)) {
          console.log(`Question validation failed, attempt ${attempts}`);
          continue;
        }
        
        // Check for duplicates against existing questions
        const isDuplicate = existingQuestions.some(q => q === generatedContent.question);
        
        if (!isDuplicate) {
          // Generate unique hash
          const uniqueElements = `${topic}-${subtopic}-${context}-${difficulty}-${generatedContent.question}-${Date.now()}-${position}`;
          const hash = generateQuestionHash(topic, subtopic, context, difficulty, uniqueElements);
          
          question = {
            ...generatedContent,
            hash,
            difficulty,
            position,
            contextType: context,
            subtopic
          };
          
          console.log(`Generated single question ${position} successfully`);
        }
      } catch (error) {
        console.error(`Error generating question ${position}:`, error);
      }
    }
    
    if (!question) {
      return res.status(500).json({ 
        error: `Failed to generate question ${position}. Please try again.` 
      });
    }

    return res.status(200).json({
      question,
      position,
      currentProficiency
    });

  } catch (error) {
    console.error('Generate stream error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate question',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}