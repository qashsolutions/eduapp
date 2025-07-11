/**
 * Test endpoint to verify email service is working
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Test Resend directly
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return res.status(500).json({ error: 'Resend API key not configured' });
    }

    console.log('Testing email to:', email);
    const startTime = Date.now();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Socratic AI Tutor <noreply@socratic-thinking.com>',
        to: email,
        subject: 'Test Email - Socratic AI',
        html: '<p>This is a test email to verify email service is working.</p>'
      })
    });

    const duration = Date.now() - startTime;
    console.log(`Email request took: ${duration}ms`);

    if (!response.ok) {
      const error = await response.json();
      console.error('Resend error:', error);
      return res.status(500).json({ error: 'Email failed', details: error });
    }

    const data = await response.json();
    return res.status(200).json({ 
      success: true, 
      duration: duration,
      data: data 
    });

  } catch (error) {
    console.error('Test email error:', error);
    return res.status(500).json({ error: error.message });
  }
}