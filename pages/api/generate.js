import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { prepareQuestionGeneration, generateWithOpenAI, generateWithClaude, validateQuestion } from '../../lib/ai-service';
import { getUser, updateUserProficiency, logQuestionAttempt } from '../../lib/db';
import { mapProficiencyToDifficulty, updateProficiency } from '../../lib/utils';

// Initialize AI clients server-side only
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
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

    if (action === 'generate') {
      // Validate inputs
      if (!userId || !topic) {
        return res.status(400).json({ error: 'Missing userId or topic' });
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

      // Prepare question generation
      const { prompt, aiModel } = prepareQuestionGeneration(topic, difficulty, grade);
      
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
    console.error('Generate API error:', error);
    
    // Return more specific error messages
    if (error.message.includes('AI')) {
      return res.status(503).json({ error: 'AI service temporarily unavailable' });
    }
    
    return res.status(500).json({ error: 'Failed to process request' });
  }
}