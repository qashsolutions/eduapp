import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { generateWithOpenAI, generateWithClaude, validateQuestion, createQuestionPrompt } from '../../lib/ai-service';
import { getUser, updateUserProficiency, logQuestionAttempt } from '../../lib/db';
import { mapProficiencyToDifficulty, updateProficiency, AI_ROUTING, EDUCATIONAL_TOPICS, getRandomContext } from '../../lib/utils';

// Initialize AI clients server-side only
const openaiKey = process.env.OPENAI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

console.log('AI Keys configured:', {
  openai: !!openaiKey,
  anthropic: !!anthropicKey
});

const openai = new OpenAI({
  apiKey: openaiKey,
});

const anthropic = new Anthropic({
  apiKey: anthropicKey,
});

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

    // Verify that userId is provided (in production, verify the Firebase token)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
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
      
      // Generate question context
      const context = getRandomContext(topicConfig.contexts);
      const subtopic = topicConfig.subtopics[Math.floor(Math.random() * topicConfig.subtopics.length)];
      
      // Create the prompt
      const prompt = createQuestionPrompt(topic, difficulty, grade, context, subtopic);
      
      // Generate question with appropriate AI
      let question;
      if (aiModel === 'openai') {
        question = await generateWithOpenAI(openai, prompt);
      } else {
        question = await generateWithClaude(anthropic, prompt);
      }
      
      // Validate question format
      if (!validateQuestion(question)) {
        throw new Error('Invalid question format received from AI');
      }

      return res.status(200).json({
        question,
        difficulty,
        currentProficiency
      });
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
      
      // Log the attempt
      await logQuestionAttempt(userId, topic, correct, timeSpent, hintsUsed || 0);

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