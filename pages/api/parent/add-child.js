import { supabase } from '../../../lib/db';

// In-memory rate limit store
const rateLimitStore = new Map();

// Verify Supabase token
async function verifySupabaseToken(token) {
  if (!token) return null;
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('Token verification failed:', error);
      return null;
    }
    
    return user.id;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const verifiedUserId = await verifySupabaseToken(token);
    
    if (!verifiedUserId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { parentId, childEmail, childName, childGrade } = req.body;

    // Verify parent
    if (verifiedUserId !== parentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check parent exists and is a parent
    const { data: parent, error: parentError } = await supabase
      .from('users')
      .select('*')
      .eq('id', parentId)
      .eq('role', 'parent')
      .single();

    if (parentError || !parent) {
      return res.status(403).json({ error: 'Not a parent account' });
    }

    // Check children count
    const { data: existingChildren, error: countError } = await supabase
      .from('users')
      .select('id')
      .eq('parent_id', parentId);

    if (existingChildren && existingChildren.length >= 5) {
      return res.status(400).json({ error: 'Maximum 5 children allowed' });
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!';

    // Create Supabase account for child
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: childEmail,
      password: tempPassword,
      options: {
        data: {
          role: 'student',
          grade: childGrade,
          parentId: parentId
        }
      }
    });

    if (authError) {
      return res.status(400).json({ 
        error: authError.message || 'Failed to create account' 
      });
    }

    const supabaseUser = authData.user;

    // Create user in database
    const { data: newUser, error: dbError } = await supabase
      .from('users')
      .insert([{
        id: supabaseUser.id,
        email: childEmail,
        role: 'student',
        grade: childGrade,
        parent_id: parentId,
        added_by_parent: true,
        account_type: 'trial',
        subscription_status: 'free',
        // All proficiency fields default to 5
        english_comprehension: 5,
        english_grammar: 5,
        english_vocabulary: 5,
        english_sentences: 5,
        english_synonyms: 5,
        english_antonyms: 5,
        english_fill_blanks: 5,
        math_number_theory: 5,
        math_algebra: 5,
        math_geometry: 5,
        math_statistics: 5,
        math_precalculus: 5,
        math_calculus: 5
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    // Send password reset email so child can set their own password
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(childEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`
    });

    if (resetError) {
      console.error('Failed to send password reset email:', resetError);
    }

    return res.status(200).json({
      success: true,
      message: 'Child account created and invitation sent',
      user: newUser
    });

  } catch (error) {
    console.error('Add child error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}