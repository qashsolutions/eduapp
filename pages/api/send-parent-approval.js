export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { parentEmail, parentName, childEmail, approvalToken } = req.body;

    if (!parentEmail || !childEmail || !approvalToken) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use Firebase Auth to send a custom email
    // Firebase Auth doesn't directly support custom approval emails,
    // so we'll use the password reset flow with a custom link
    
    // First, check if parent already has an account
    const checkUserResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: [parentEmail] })
      }
    );

    const userData = await checkUserResponse.json();
    const parentExists = userData.users && userData.users.length > 0;

    if (!parentExists) {
      // Create parent account with temporary password
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

      if (!createResponse.ok) {
        const error = await createResponse.json();
        console.error('Failed to create parent account:', error);
        return res.status(400).json({ error: 'Failed to create parent account' });
      }
    }

    // Send custom email using Firebase's email action
    // Since Firebase doesn't support custom approval emails directly,
    // we'll use the password reset email as a workaround
    const emailResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email: parentEmail,
          // Firebase will send their standard password reset email
          // We'll need to customize the message in Firebase Console
        })
      }
    );

    if (!emailResponse.ok) {
      const error = await emailResponse.json();
      console.error('Failed to send email:', error);
      return res.status(500).json({ error: 'Failed to send approval email' });
    }

    // Note: In a production app, you would use a proper email service like:
    // - SendGrid
    // - AWS SES
    // - Resend
    // - Postmark
    // To send a custom HTML email with the approval link

    return res.status(200).json({ 
      success: true, 
      message: 'Parent approval email sent',
      note: 'Parent will receive a Firebase password reset email. For production, implement custom email service.'
    });

  } catch (error) {
    console.error('Send parent approval error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}