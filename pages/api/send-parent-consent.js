/**
 * API endpoint to send parent consent email for COPPA compliance
 * Sends a verification link to parent's email with student information
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract and validate request data
    const { studentName, grade, parentEmail } = req.body;

    if (!studentName || !grade || !parentEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parentEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate grade range
    const gradeNum = parseInt(grade);
    if (isNaN(gradeNum) || gradeNum < 5 || gradeNum > 11) {
      return res.status(400).json({ error: 'Grade must be between 5 and 11' });
    }

    // Create a secure token with student information
    const tokenData = {
      studentName: studentName.trim(),
      grade: gradeNum,
      parentEmail: parentEmail.toLowerCase().trim(),
      timestamp: Date.now()
    };

    // Encode token for URL
    const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');

    // Build verification URL
    const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/parent-verify?token=${encodeURIComponent(token)}`;

    // Use Resend API directly for email sending
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('Resend API key not configured');
      return res.status(500).json({ error: 'Email service not configured. Please contact support.' });
    }

    // Send email via Resend API
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Socratic AI Tutor <noreply@socratic-thinking.com>',
        to: parentEmail,
        subject: `Parent Consent Required for ${studentName}'s Account`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #374151; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f3f4f6; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #34d399; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .info { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Parent Consent Required</h1>
              </div>
              <div class="content">
                <h2>Hello!</h2>
                <p>${studentName} (Grade ${gradeNum}) wants to join Socratic AI Tutor, our adaptive learning platform.</p>
                
                <div class="info">
                  <h3>What happens next?</h3>
                  <ul>
                    <li>Click the button below to review your child's registration</li>
                    <li>Complete a $1 verification payment (COPPA compliance)</li>
                    <li>Receive a secure passcode for your child to login</li>
                  </ul>
                </div>
                
                <p><strong>This link expires in 24 hours for security.</strong></p>
                
                <div style="text-align: center;">
                  <a href="${verificationUrl}" class="button">Approve Registration</a>
                </div>
                
                <p>If you did not expect this email, please ignore it.</p>
              </div>
              <div class="footer">
                <p>© 2024 Socratic AI Tutor | Questions? Contact support@socratic-thinking.com</p>
              </div>
            </div>
          </body>
          </html>
        `
      })
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error('Resend API error:', errorData);
      return res.status(500).json({ error: 'Failed to send parent consent email. Please try again.' });
    }

    // Log success for monitoring (no PII in logs)
    console.log('Parent consent email sent successfully');

    return res.status(200).json({ 
      success: true, 
      message: 'Parent consent email sent successfully. Please check your email.'
    });

  } catch (error) {
    console.error('Send parent consent error:', error);
    return res.status(500).json({ error: 'An error occurred. Please try again later.' });
  }
}