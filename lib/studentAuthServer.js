import { createClient } from '@supabase/supabase-js';

// Only import crypto on server-side
let crypto;
if (typeof window === 'undefined') {
  crypto = require('crypto');
}

// Create Supabase client - use service role only on server
let supabase;
if (typeof window === 'undefined') {
  // Server-side: use service role
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
} else {
  // Client-side: use anon key
  supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Generate a secure session token for students
 * @param {string} studentId - The student's user ID
 * @returns {Object} Session token and expiry
 */
export async function createStudentSession(studentId) {
  // This function should only be called server-side
  if (typeof window !== 'undefined') {
    throw new Error('createStudentSession can only be called on the server');
  }
  
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

/**
 * Store session data with optional persistence
 * @param {Object} sessionData - Session data to store
 * @param {boolean} persist - Whether to persist across browser sessions
 */
export function storeSessionData(sessionData, persist = false) {
  const storage = persist ? localStorage : sessionStorage;
  storage.setItem('studentData', JSON.stringify(sessionData));
}

/**
 * Retrieve session data from available storage
 * @returns {Object|null} Session data if exists
 */
export function retrieveSessionData() {
  // Check sessionStorage first (current session)
  let data = sessionStorage.getItem('studentData');
  if (data) return JSON.parse(data);
  
  // Check localStorage for persistent session
  data = localStorage.getItem('studentData');
  if (data) {
    const parsed = JSON.parse(data);
    // Validate session hasn't expired
    if (new Date(parsed.expiresAt) > new Date()) {
      // Move to sessionStorage for this session
      sessionStorage.setItem('studentData', data);
      return parsed;
    } else {
      // Clean up expired persistent session
      localStorage.removeItem('studentData');
    }
  }
  
  return null;
}

/**
 * Clear session data from all storage
 */
export function clearSessionData() {
  sessionStorage.removeItem('studentData');
  localStorage.removeItem('studentData');
}

/**
 * Refresh session expiry for active students
 * @param {string} token - Current session token
 * @returns {Object} Updated expiry info
 */
export async function refreshStudentSession(token) {
  if (!token) throw new Error('Token required');
  
  try {
    // Validate current session first
    const currentSession = await validateStudentSession(token);
    if (!currentSession) throw new Error('Invalid session');
    
    // Calculate new expiry (7 days from now)
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);
    
    // Update session expiry in database
    const { data, error } = await supabase
      .from('student_sessions')
      .update({ 
        expires_at: newExpiresAt.toISOString(),
        last_accessed: new Date().toISOString()
      })
      .eq('session_token', token)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      expiresAt: newExpiresAt.toISOString(),
      refreshed: true
    };
  } catch (error) {
    console.error('Error refreshing session:', error);
    throw error;
  }
}