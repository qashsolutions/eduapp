import { supabase } from '../../../lib/db';

// In-memory rate limit store
const rateLimitStore = new Map();

// Verify Firebase token
async function verifyFirebaseToken(token) {
  if (!token) return null;
  
  try {
    const response = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.users?.[0]?.localId || null;
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
    const verifiedUserId = await verifyFirebaseToken(token);
    
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

    // Create Firebase account for child
    const createUserResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: childEmail,
          password: tempPassword,
          returnSecureToken: true
        })
      }
    );

    if (!createUserResponse.ok) {
      const error = await createUserResponse.json();
      return res.status(400).json({ 
        error: error.error?.message || 'Failed to create account' 
      });
    }

    const firebaseUser = await createUserResponse.json();

    // Create user in database
    const { data: newUser, error: dbError } = await supabase
      .from('users')
      .insert([{
        id: firebaseUser.localId,
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
    const resetResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email: childEmail
        })
      }
    );

    if (!resetResponse.ok) {
      console.error('Failed to send password reset email');
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