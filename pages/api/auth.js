import { supabase, createUser } from '../../lib/db';

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        const { action, email, password } = req.body;
        
        if (action === 'signup') {
          // Sign up new user
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
          });
          
          if (authError) {
            return res.status(400).json({ error: authError.message });
          }
          
          // Create user profile
          if (authData.user) {
            const userProfile = await createUser(email, authData.user.id);
            if (!userProfile) {
              return res.status(500).json({ error: 'Failed to create user profile' });
            }
          }
          
          return res.status(200).json({ 
            user: authData.user,
            message: 'Account created successfully' 
          });
        }
        
        if (action === 'login') {
          // Sign in existing user
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (error) {
            return res.status(400).json({ error: error.message });
          }
          
          return res.status(200).json({ 
            user: data.user,
            session: data.session 
          });
        }
        
        if (action === 'logout') {
          // Sign out user
          const { error } = await supabase.auth.signOut();
          
          if (error) {
            return res.status(400).json({ error: error.message });
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