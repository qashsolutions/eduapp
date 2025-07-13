import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Use service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Complete parent verification after payment
 * Creates parent and student accounts
 */
export default async function handler(req, res) {
  console.log('=== COMPLETE VERIFICATION API ===');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, parentName, parentPassword, studentName, studentGrade, consentId, passcode } = req.body;

    console.log('Request data:', { 
      email, 
      parentName, 
      hasPassword: !!parentPassword, 
      studentName, 
      studentGrade,
      consentId,
      passcode 
    });

    // Validate inputs
    if (!email || !parentName || !parentPassword || !studentName || !studentGrade || !consentId || !passcode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if parent already exists
    console.log('Checking for existing parent...');
    const { data: existingParent, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('role', 'parent')
      .single();

    let parentId;

    if (existingParent && !checkError) {
      console.log('Parent exists, using existing account:', existingParent.id);
      parentId = existingParent.id;
      
      // Check child limit
      const { count } = await supabase
        .from('parent_consents')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', parentId);
        
      if (count >= 2) {
        return res.status(400).json({ 
          error: 'You have reached the maximum limit of 2 children per parent account.' 
        });
      }
    } else {
      // Create new parent in Supabase Auth
      console.log('Creating new parent account...');
      
      // First create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: parentPassword,
        options: {
          data: {
            first_name: parentName,
            role: 'parent'
          }
        }
      });

      if (authError) {
        console.error('Parent auth creation error:', authError);
        if (authError.message?.includes('already registered')) {
          return res.status(400).json({ 
            error: 'This email is already registered. Please sign in to your existing account.' 
          });
        }
        return res.status(400).json({ error: authError.message });
      }

      parentId = authData.user.id;
      console.log('Parent auth created:', parentId);

      // Create parent user record
      const { error: parentInsertError } = await supabase
        .from('users')
        .insert({
          id: parentId,
          email: email.toLowerCase(),
          role: 'parent',
          account_type: 'parent',
          first_name: parentName,
          consent_date: new Date().toISOString()
        });

      if (parentInsertError) {
        console.error('Parent user insert error:', parentInsertError);
        throw parentInsertError;
      }
      
      console.log('Parent user record created');
    }

    // Create student record
    const studentId = crypto.randomUUID();
    console.log('Creating student record...');
    
    const studentData = {
      id: studentId,
      email: `${studentName.toLowerCase().replace(/\s/g, '')}_${Date.now()}@student.local`,
      first_name: studentName,
      grade: parseInt(studentGrade),
      role: 'student',
      account_type: 'student',
      parent_id: parentId,
      passcode: passcode,
      consent_date: new Date().toISOString(),
      added_by_parent: true,
      subscription_status: 'free'
    };

    const { error: studentError } = await supabase
      .from('users')
      .insert(studentData);

    if (studentError) {
      console.error('Student creation error:', studentError);
      throw studentError;
    }

    console.log('Student created successfully');

    // Update parent_consents record
    const { error: consentUpdateError } = await supabase
      .from('parent_consents')
      .update({
        parent_id: parentId,
        child_id: studentId
      })
      .eq('id', consentId);

    if (consentUpdateError) {
      console.error('Consent update error:', consentUpdateError);
      // Don't throw, this is not critical
    }

    console.log('=== VERIFICATION COMPLETE ===');
    
    return res.status(200).json({
      success: true,
      parentId,
      studentId,
      passcode
    });

  } catch (error) {
    console.error('=== COMPLETE VERIFICATION ERROR ===');
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to complete verification' 
    });
  }
}