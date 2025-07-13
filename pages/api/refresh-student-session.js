import { refreshStudentSession } from '../../lib/studentAuth';
import { authMiddleware } from '../../lib/authMiddleware';

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

    // Refresh the session
    const result = await refreshStudentSession(token);
    
    return res.status(200).json({
      success: true,
      expiresAt: result.expiresAt,
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