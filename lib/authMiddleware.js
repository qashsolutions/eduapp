import { validateStudentSession } from './studentAuth';

/**
 * Middleware to validate authentication for API routes
 * Handles both Supabase tokens (parents/teachers) and student session tokens
 */
export async function validateAuth(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return { authenticated: false, error: 'No authorization header' };
  }
  
  // Check if it's a student token
  if (authHeader.startsWith('Student ')) {
    const token = authHeader.replace('Student ', '');
    const studentData = await validateStudentSession(token);
    
    if (!studentData) {
      return { authenticated: false, error: 'Invalid or expired student session' };
    }
    
    return { 
      authenticated: true, 
      user: studentData,
      isStudent: true 
    };
  }
  
  // Handle regular Bearer tokens (parents/teachers)
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    
    // We'll validate this in the API endpoint itself
    // since we need the Supabase client with service role
    return {
      authenticated: true,
      user: null, // Actual validation happens in the endpoint
      isStudent: false
    };
  }
  
  return { authenticated: false, error: 'Invalid authorization format' };
}