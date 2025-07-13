import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { generateWithOpenAI, generateWithClaude, validateQuestion, createQuestionPrompt, generateSocraticFollowup } from '../../lib/ai-service';
import { getUser, updateUserProficiency, logQuestionAttempt, getCachedQuestion, cacheQuestion, checkQuestionHash } from '../../lib/db';
import { mapProficiencyToDifficulty, updateProficiency, AI_ROUTING, EDUCATIONAL_TOPICS, getRandomContext, generateQuestionHash } from '../../lib/utils';
import { validateAuth } from '../../lib/authMiddleware';

// Rate limiting store - tracks requests per user per minute
const rateLimitStore = new Map();

// Clean up old entries every 5 minutes to prevent memory leak
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, timestamp] of rateLimitStore.entries()) {
    if (timestamp < fiveMinutesAgo) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Check rate limit - 3 requests per minute per user
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
  
  if (userRequests.length >= 3) {
    return false;
  }
  
  // Add new request timestamp
  rateLimitStore.set(`${key}:${now}`, now);
  return true;
}

// Import Supabase for token verification
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for RLS bypass
);

// Initialize AI clients server-side only
const openaiKey = process.env.OPENAI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

console.log('AI Keys configured:', {
  openai: !!openaiKey,
  anthropic: !!anthropicKey
});

// Initialize clients only if keys exist
const openai = openaiKey ? new OpenAI({
  apiKey: openaiKey,
}) : null;

const anthropic = anthropicKey ? new Anthropic({
  apiKey: anthropicKey,
}) : null;

export default async function handler(req, res) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  // Handle robots.txt request
  if (req.url === '/api/generate?robots') {
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /login

Sitemap: https://learnai.com/api/generate?sitemap`);
    return;
  }

  // Handle sitemap.xml request
  if (req.url === '/api/generate?sitemap') {
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://learnai.com/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
    return;
  }

  const { method } = req;

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${method} not allowed` });
  }

  try {
    const { action, userId, topic, answer, timeSpent, hintsUsed } = req.body;

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
      const { data: { user }, error } = await supabase.auth.getUser(req.headers.authorization.split('Bearer ')[1]);
      if (error || !user || user.id !== userId) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    
    // Check rate limit
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        message: 'Please wait a minute before making more requests' 
      });
    }

    if (action === 'generate') {
      // Validate inputs
      if (!topic) {
        return res.status(400).json({ error: 'Missing topic' });
      }

      // Check if AI keys are configured
      const aiModel = AI_ROUTING[topic];
      if (aiModel === 'openai' && !openaiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }
      if (aiModel === 'claude' && !anthropicKey) {
        return res.status(500).json({ error: 'Anthropic API key not configured' });
      }

      // Get user data
      const user = await getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get current proficiency
      const currentProficiency = user[topic] || 5;
      
      // Map proficiency to difficulty
      const difficulty = mapProficiencyToDifficulty(currentProficiency, [1, 2, 3, 4, 5, 6, 7, 8]);
      
      // Extract grade from user data (default to 8 if not set)
      const grade = user.grade || 8;

      // Get topic config
      const topicConfig = EDUCATIONAL_TOPICS[topic];
      
      if (!topicConfig) {
        return res.status(400).json({ error: 'Invalid topic' });
      }
      
      // Try to get cached question first
      let question = null;
      let questionHash = null;
      let attempts = 0;
      const maxAttempts = 3;
      
      // Check cache first
      const cached = await getCachedQuestion(topic, difficulty, grade);
      
      if (cached && cached.question) {
        question = cached.question;
        // Still need to check if user has seen this exact question
        const tempHash = generateQuestionHash(topic, '', '', difficulty, question.question);
        const isDuplicate = await checkQuestionHash(userId, tempHash);
        
        if (!isDuplicate) {
          questionHash = tempHash;
        } else {
          question = null; // Force generation
        }
      }
      
      // Generate new question if not cached or duplicate
      while (!question && attempts < maxAttempts) {
        attempts++;
        
        // Generate question context
        const context = getRandomContext(topicConfig.contexts);
        const subtopic = topicConfig.subtopics[Math.floor(Math.random() * topicConfig.subtopics.length)];
        
        // Create the prompt
        const prompt = createQuestionPrompt(topic, difficulty, grade, context, subtopic);
        
        // Generate question with appropriate AI
        let generatedQuestion;
        if (aiModel === 'openai') {
          if (!openai) throw new Error('OpenAI client not initialized');
          generatedQuestion = await generateWithOpenAI(openai, prompt);
        } else {
          if (!anthropic) throw new Error('Anthropic client not initialized');
          generatedQuestion = await generateWithClaude(anthropic, prompt);
        }
        
        // Validate question format
        if (!validateQuestion(generatedQuestion)) {
          continue;
        }
        
        // Generate hash and check for duplicates
        const hash = generateQuestionHash(topic, subtopic, context, difficulty, generatedQuestion.question);
        const isDuplicate = await checkQuestionHash(userId, hash);
        
        if (!isDuplicate) {
          question = generatedQuestion;
          questionHash = hash;
          
          // Cache the question for future use
          await cacheQuestion(topic, difficulty, grade, question, aiModel);
        }
      }
      
      if (!question) {
        throw new Error('Unable to generate unique question');
      }

      return res.status(200).json({
        question,
        difficulty,
        currentProficiency,
        questionHash
      });
    }

    if (action === 'socratic') {
      // Validate inputs
      if (!userId || !topic || !req.body.question || req.body.wrongAnswer === undefined || req.body.difficulty === undefined) {
        return res.status(400).json({ error: 'Missing required fields for Socratic hint' });
      }

      const { question, wrongAnswer, difficulty, hintLevel = 1 } = req.body;

      // Check if AI keys are configured
      const aiModel = AI_ROUTING[topic];
      if (aiModel === 'openai' && !openaiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }
      if (aiModel === 'claude' && !anthropicKey) {
        return res.status(500).json({ error: 'Anthropic API key not configured' });
      }

      // Generate Socratic hint
      try {
        const aiClient = aiModel === 'openai' ? openai : anthropic;
        const hint = await generateSocraticFollowup(aiClient, topic, question, wrongAnswer, difficulty, hintLevel);
        return res.status(200).json({ hint });
      } catch (error) {
        console.error('Error generating Socratic prompt:', error);
        return res.status(500).json({ 
          error: 'Failed to generate hint',
          fallback: "Think about what the question is really asking. Look for key words that might give you clues."
        });
      }
    }

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
      const { correct } = req.body;
      
      // Log the attempt with hash
      const questionHash = req.body.questionHash || null;
      await logQuestionAttempt(userId, topic, correct, timeSpent, hintsUsed || 0, questionHash);

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
    
    // Return more specific error messages
    if (error.message.includes('API key')) {
      return res.status(500).json({ error: 'AI API key not configured' });
    }
    if (error.message.includes('AI')) {
      return res.status(503).json({ error: 'AI service temporarily unavailable' });
    }
    
    return res.status(500).json({ 
      error: 'Failed to process request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}