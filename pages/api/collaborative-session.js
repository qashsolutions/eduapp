/**
 * Collaborative Session API - Real-time Learning Sessions
 * 
 * Handles creation, joining, and management of collaborative learning sessions
 * where parents/tutors can observe students solving questions in real-time.
 * 
 * @author EduApp Team
 * @version 1.0.0 - Collaborative Learning
 */

import { validateAuth } from '../../lib/authMiddleware';
import { supabase } from '../../lib/db';

// Generate mixed session questions for collaborative learning
async function generateCollaborativeQuestions(userId, grade) {
  try {
    // Get user's answered questions to avoid duplicates
    const { data: user } = await supabase
      .from('users')
      .select('answered_question_hashes')
      .eq('id', userId)
      .single();

    const answeredHashes = user?.answered_question_hashes || [];

    // Get 10 questions for collaborative session (shorter than full 30-question session)
    const questionTypes = [
      { topic: 'english_comprehension', count: 3 },
      { topic: 'english_synonyms', count: 2 },
      { topic: 'english_antonyms', count: 2 },
      { topic: 'english_sentences', count: 2 },
      { topic: 'english_vocabulary', count: 1 }
    ];

    const allQuestions = [];
    
    for (const { topic, count } of questionTypes) {
      // Get questions for this topic
      const { data: questions, error } = await supabase
        .from('question_cache')
        .select('*')
        .eq('topic', topic)
        .eq('grade', grade)
        .in('difficulty', [3, 4, 5]) // Medium difficulty for collaborative sessions
        .is('expires_at', null)
        .not('question_hash', 'in', `(${answeredHashes.map(h => `"${h}"`).join(',')})`)
        .limit(count * 2); // Get extra questions for variety

      if (error) {
        console.error(`Error fetching ${topic} questions:`, error);
        continue;
      }

      if (questions && questions.length > 0) {
        // Randomly select from available questions
        const selectedQuestions = questions
          .sort(() => Math.random() - 0.5)
          .slice(0, count)
          .map(q => ({
            ...q.question,
            topic,
            difficulty: q.difficulty,
            questionHash: q.question_hash,
            hash: q.question_hash
          }));

        allQuestions.push(...selectedQuestions);
      }
    }

    // Shuffle final questions
    return allQuestions.sort(() => Math.random() - 0.5);
  } catch (error) {
    console.error('Error generating collaborative questions:', error);
    throw error;
  }
}

// Generate random 6-digit session code
function generateSessionCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Clean up abandoned sessions (15 min wait, 1 hour idle)
async function cleanupAbandonedSessions() {
  try {
    // Cancel sessions waiting for more than 15 minutes
    await supabase
      .from('study_sessions')
      .update({ 
        collaboration_status: 'cancelled',
        session_end: new Date().toISOString()
      })
      .eq('is_collaborative', true)
      .eq('collaboration_status', 'waiting')
      .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    // Cancel active sessions inactive for more than 1 hour
    await supabase
      .from('study_sessions')
      .update({ 
        collaboration_status: 'cancelled',
        session_end: new Date().toISOString()
      })
      .eq('is_collaborative', true)
      .eq('collaboration_status', 'active')
      .lt('question_started_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}

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
    const { action, sessionCode, studentId } = req.body;
    
    // Validate authentication
    const authResult = await validateAuth(req);
    if (!authResult.authenticated) {
      return res.status(401).json({ error: authResult.error || 'Authentication required' });
    }

    // Clean up abandoned sessions before processing
    await cleanupAbandonedSessions();

    /**
     * CREATE ACTION - Parent/tutor creates a new collaborative session
     */
    if (action === 'create') {
      const { participantId, topic = 'mixed_session' } = req.body;
      
      // Validate required fields
      if (!participantId) {
        return res.status(400).json({ error: 'Participant ID is required' });
      }

      // Verify participant exists and is a student
      const { data: participant, error: participantError } = await supabase
        .from('users')
        .select('id, first_name, role, grade, parent_id')
        .eq('id', participantId)
        .single();

      if (participantError || !participant) {
        return res.status(404).json({ error: 'Participant not found' });
      }

      if (participant.role !== 'student') {
        return res.status(400).json({ error: 'Participant must be a student' });
      }

      // Verify initiator has permission (parent or teacher)
      const { data: initiator } = await supabase
        .from('users')
        .select('id, first_name, role')
        .eq('id', authResult.user.id)
        .single();

      if (initiator.role === 'parent' && participant.parent_id !== initiator.id) {
        return res.status(403).json({ error: 'Cannot create session for student not under your supervision' });
      }

      // Generate unique session code
      let sessionCode;
      let codeExists = true;
      let attempts = 0;
      
      while (codeExists && attempts < 10) {
        sessionCode = generateSessionCode();
        const { data: existingSession } = await supabase
          .from('study_sessions')
          .select('id')
          .eq('session_code', sessionCode)
          .eq('is_collaborative', true)
          .in('collaboration_status', ['waiting', 'active'])
          .single();
        
        codeExists = !!existingSession;
        attempts++;
      }

      if (codeExists) {
        return res.status(500).json({ error: 'Unable to generate unique session code' });
      }

      // Create collaborative session
      const { data: session, error: sessionError } = await supabase
        .from('study_sessions')
        .insert({
          student_id: participantId, // For compatibility with existing structure
          topic: topic,
          session_type: 'collaborative',
          is_collaborative: true,
          initiator_id: authResult.user.id,
          participant_id: participantId,
          session_code: sessionCode,
          collaboration_status: 'waiting',
          current_question_index: 0
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        return res.status(500).json({ error: 'Failed to create collaborative session' });
      }

      // Log session creation action
      await supabase
        .from('collaborative_actions')
        .insert({
          session_id: session.id,
          user_id: authResult.user.id,
          action_type: 'session_create',
          action_data: { 
            participant_id: participantId,
            session_code: sessionCode 
          }
        });

      return res.status(201).json({
        success: true,
        session: {
          id: session.id,
          sessionCode: sessionCode,
          status: 'waiting',
          participantName: participant.first_name,
          participantGrade: participant.grade,
          createdAt: session.created_at
        }
      });
    }

    /**
     * JOIN ACTION - Student joins an existing collaborative session
     */
    if (action === 'join') {
      if (!sessionCode) {
        return res.status(400).json({ error: 'Session code is required' });
      }

      // Find session by code
      const { data: session, error: sessionError } = await supabase
        .from('study_sessions')
        .select(`
          *,
          initiator:users!initiator_id(id, first_name, role),
          participant:users!participant_id(id, first_name, grade)
        `)
        .eq('session_code', sessionCode)
        .eq('is_collaborative', true)
        .eq('collaboration_status', 'waiting')
        .single();

      if (sessionError || !session) {
        return res.status(404).json({ error: 'Session not found or no longer available' });
      }

      // Verify user is the intended participant
      if (session.participant_id !== authResult.user.id) {
        return res.status(403).json({ error: 'You are not authorized to join this session' });
      }

      // Generate questions for the session
      try {
        const questions = await generateCollaborativeQuestions(session.participant_id, session.participant.grade);
        
        if (!questions || questions.length === 0) {
          return res.status(503).json({ 
            error: 'No questions available',
            userMessage: 'Questions are being updated. Please try again shortly.'
          });
        }

        // Update session to active and set first question
        const { error: updateError } = await supabase
          .from('study_sessions')
          .update({
            collaboration_status: 'active',
            participant_joined_at: new Date().toISOString(),
            question_started_at: new Date().toISOString(),
            current_question_hash: questions[0].questionHash,
            current_question_index: 0
          })
          .eq('id', session.id);

        if (updateError) {
          console.error('Session update error:', updateError);
          return res.status(500).json({ error: 'Failed to join session' });
        }

        // Log join action
        await supabase
          .from('collaborative_actions')
          .insert({
            session_id: session.id,
            user_id: authResult.user.id,
            action_type: 'session_join',
            action_data: { joined_at: new Date().toISOString() }
          });

        return res.status(200).json({
          success: true,
          session: {
            id: session.id,
            status: 'active',
            initiatorName: session.initiator.first_name,
            initiatorRole: session.initiator.role,
            questions: questions,
            currentQuestionIndex: 0,
            totalQuestions: questions.length
          }
        });
      } catch (error) {
        console.error('Question generation error:', error);
        return res.status(500).json({ 
          error: 'Failed to prepare questions',
          userMessage: 'Unable to load questions. Please try again.'
        });
      }
    }

    /**
     * STATUS ACTION - Get current session status
     */
    if (action === 'status') {
      if (!sessionCode) {
        return res.status(400).json({ error: 'Session code is required' });
      }

      const { data: session, error: sessionError } = await supabase
        .from('study_sessions')
        .select(`
          *,
          initiator:users!initiator_id(id, first_name, role),
          participant:users!participant_id(id, first_name, grade)
        `)
        .eq('session_code', sessionCode)
        .eq('is_collaborative', true)
        .single();

      if (sessionError || !session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Verify user is part of this session
      if (session.initiator_id !== authResult.user.id && session.participant_id !== authResult.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.status(200).json({
        success: true,
        session: {
          id: session.id,
          status: session.collaboration_status,
          currentQuestionIndex: session.current_question_index,
          questionStartedAt: session.question_started_at,
          participantJoinedAt: session.participant_joined_at,
          initiator: session.initiator,
          participant: session.participant
        }
      });
    }

    /**
     * END ACTION - End collaborative session
     */
    if (action === 'end') {
      if (!sessionCode) {
        return res.status(400).json({ error: 'Session code is required' });
      }

      const { data: session, error: sessionError } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('session_code', sessionCode)
        .eq('is_collaborative', true)
        .single();

      if (sessionError || !session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Verify user can end session (initiator or participant)
      if (session.initiator_id !== authResult.user.id && session.participant_id !== authResult.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Update session to completed
      const { error: updateError } = await supabase
        .from('study_sessions')
        .update({
          collaboration_status: 'completed',
          session_end: new Date().toISOString()
        })
        .eq('id', session.id);

      if (updateError) {
        console.error('Session end error:', updateError);
        return res.status(500).json({ error: 'Failed to end session' });
      }

      // Log end action
      await supabase
        .from('collaborative_actions')
        .insert({
          session_id: session.id,
          user_id: authResult.user.id,
          action_type: 'session_end',
          action_data: { ended_by: authResult.user.id }
        });

      return res.status(200).json({
        success: true,
        message: 'Session ended successfully'
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Collaborative session API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}