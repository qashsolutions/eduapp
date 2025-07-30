/**
 * Collaborative Actions API - Real-time Action Logging
 * 
 * Handles logging of real-time actions during collaborative sessions
 * for synchronization between tutor/parent and student.
 */

import { validateAuth } from '../../lib/authMiddleware';
import { supabase } from '../../lib/db';

export default async function handler(req, res) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  const { method } = req;
  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${method} not allowed` });
  }

  try {
    const { sessionId, actionType, actionData, questionHash } = req.body;
    
    // Validate authentication
    const authResult = await validateAuth(req);
    if (!authResult.authenticated) {
      return res.status(401).json({ error: authResult.error || 'Authentication required' });
    }

    // Validate required fields
    if (!sessionId || !actionType) {
      return res.status(400).json({ error: 'Session ID and action type are required' });
    }

    // Verify user is part of the session
    const { data: session, error: sessionError } = await supabase
      .from('study_sessions')
      .select('initiator_id, participant_id, collaboration_status')
      .eq('id', sessionId)
      .eq('is_collaborative', true)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user is authorized for this session
    const userId = authResult.user.id;
    if (session.initiator_id !== userId && session.participant_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if session is active
    if (session.collaboration_status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    // Log the action
    const { data: action, error: actionError } = await supabase
      .from('collaborative_actions')
      .insert({
        session_id: sessionId,
        user_id: userId,
        action_type: actionType,
        action_data: actionData || {},
        question_hash: questionHash || null
      })
      .select()
      .single();

    if (actionError) {
      console.error('Action logging error:', actionError);
      return res.status(500).json({ error: 'Failed to log action' });
    }

    // Handle specific action types
    switch (actionType) {
      case 'answer_select':
        // Update session with current answer selection
        await supabase
          .from('study_sessions')
          .update({
            question_started_at: new Date().toISOString() // Update activity timestamp
          })
          .eq('id', sessionId);
        break;
        
      case 'question_next':
        // Update session progress
        if (actionData.nextIndex !== undefined) {
          await supabase
            .from('study_sessions')
            .update({
              current_question_index: actionData.nextIndex,
              current_question_hash: actionData.nextQuestionHash,
              question_started_at: new Date().toISOString()
            })
            .eq('id', sessionId);
        }
        break;
    }

    return res.status(200).json({
      success: true,
      action: {
        id: action.id,
        actionType: action.action_type,
        timestamp: action.created_at
      }
    });

  } catch (error) {
    console.error('Collaborative actions API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}