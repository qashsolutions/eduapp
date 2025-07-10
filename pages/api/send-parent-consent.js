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

    // Send magic link email to parent using Supabase Auth
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: parentEmail,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/parent-verify?consent_id=${data.id}`,
        data: {
          childName: childFirstName,
          childGrade: childGrade,
          consentId: data.id
        }
      }
    });

    if (authError) {
      console.error('Supabase auth error:', authError);
      return res.status(500).json({ error: 'Failed to send parent consent email' });
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