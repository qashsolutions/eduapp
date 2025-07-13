import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role for session management
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Generate a secure session token for students
 * @param {string} studentId - The student's user ID
 * @returns {Object} Session token and expiry
 */
export async function createStudentSession(studentId) {
  try {
    // Generate a secure random token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Set expiry to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Store session in database
    const { data, error } = await supabase
      .from('student_sessions')
      .insert({
        student_id: studentId,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      token: sessionToken,
      expiresAt: expiresAt.toISOString()
    };
  } catch (error) {
    console.error('Error creating student session:', error);
    throw error;
  }
}

/**
 * Validate a student session token
 * @param {string} token - The session token to validate
 * @returns {Object|null} Student data if valid, null if invalid
 */
export async function validateStudentSession(token) {
  if (!token) return null;
  
  try {
    // Get session and check if valid
    const { data: session, error } = await supabase
      .from('student_sessions')
      .select(`
        student_id,
        expires_at,
        users!inner(
          id,
          first_name,
          email,
          role,
          grade
        )
      `)
      .eq('session_token', token)
      .gte('expires_at', new Date().toISOString())
      .single();
    
    if (error || !session) return null;
    
    // Update last accessed time
    await supabase
      .from('student_sessions')
      .update({ last_accessed: new Date().toISOString() })
      .eq('session_token', token);
    
    // Return student data
    return {
      id: session.users.id,
      firstName: session.users.first_name,
      email: session.users.email,
      role: session.users.role,
      grade: session.users.grade
    };
  } catch (error) {
    console.error('Error validating student session:', error);
    return null;
  }
}

/**
 * Clean up expired sessions
 * Should be called periodically (e.g., daily cron job)
 */
export async function cleanupExpiredSessions() {
  try {
    const { error } = await supabase
      .from('student_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());
    
    if (error) throw error;
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
  }
}