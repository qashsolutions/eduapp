import { signUp, signIn, logOut } from '../../lib/firebase';
import { createUser } from '../../lib/db';

export default async function handler(req, res) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        const { action, email, password, role, grade } = req.body;
        console.log('Auth API:', { action, email, role, grade });
        
        if (action === 'signup') {
          // Sign up new user with Firebase
          const { user, error } = await signUp(email, password);
          
          if (error) {
            console.log('Firebase signup error:', error);
            return res.status(400).json({ error });
          }
          
          // Create user profile in Supabase
          if (user) {
            console.log('Creating Supabase user:', { email, uid: user.uid, role: role || 'student', grade });
            const userProfile = await createUser(email, user.uid, role || 'student', grade);
            if (!userProfile) {
              return res.status(500).json({ error: 'Failed to create user profile' });
            }
            console.log('User profile created:', userProfile);
          }
          
          return res.status(200).json({ 
            user: {
              id: user.uid,
              email: user.email
            },
            message: 'Account created successfully' 
          });
        }
        
        if (action === 'login') {
          // Sign in with Firebase
          const { user, error } = await signIn(email, password);
          
          if (error) {
            return res.status(400).json({ error });
          }
          
          return res.status(200).json({ 
            user: {
              id: user.uid,
              email: user.email
            }
          });
        }
        
        if (action === 'logout') {
          // Sign out from Firebase
          const { error } = await logOut();
          
          if (error) {
            return res.status(400).json({ error });
          }
          
          return res.status(200).json({ message: 'Logged out successfully' });
        }
        
        return res.status(400).json({ error: 'Invalid action' });
        
      default:
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}