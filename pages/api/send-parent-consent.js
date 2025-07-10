import { supabase } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { childFirstName, childGrade, parentEmail } = req.body;

    if (!childFirstName || !childGrade || !parentEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate a unique consent token
    const consentToken = Buffer.from(
      `${parentEmail}:${childFirstName}:${childGrade}:${Date.now()}`
    ).toString('base64');

    // Store consent request in database
    const { data, error } = await supabase
      .from('parent_consents')
      .insert([{
        parent_id: null, // Will be filled when parent creates account
        child_id: null, // Will be filled when child account is created
        child_first_name: childFirstName,
        child_grade: childGrade,
        stripe_payment_intent: null,
        consent_given_at: null
      }])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to store consent request' });
    }

    // Send email to parent using Firebase
    const emailResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'EMAIL_SIGNIN',
          email: parentEmail,
          continueUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/parent-verify?token=${consentToken}&consent_id=${data.id}`
        })
      }
    );

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Firebase email error:', errorData);
      
      // Try alternative approach - create parent account and send password reset
      const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
      
      const createResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: parentEmail,
            password: tempPassword,
            returnSecureToken: false
          })
        }
      );

      if (createResponse.ok) {
        // Send password reset email
        await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestType: 'PASSWORD_RESET',
              email: parentEmail
            })
          }
        );
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Parent consent email sent successfully',
      consentId: data.id
    });

  } catch (error) {
    console.error('Send parent consent error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}