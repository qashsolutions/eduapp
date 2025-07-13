import { authMiddleware } from '../../lib/authMiddleware';
import { supabase } from '../../lib/db';

/**
 * API endpoint to refresh student session
 * Extends session expiry for active students
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify student authentication
    const auth = authMiddleware(req);
    if (!auth.user || auth.user.role !== 'student') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract token from authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader.replace('Student ', '');

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
    
    return res.status(200).json({
      success: true,
      expiresAt: newExpiresAt.toISOString(),
      message: 'Session refreshed successfully'
    });

  } catch (error) {
    console.error('Session refresh error:', error);
    return res.status(500).json({ 
      error: 'Failed to refresh session',
      message: error.message 
    });
  }
}