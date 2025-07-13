import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  console.log('=== VERIFY PAYMENT API START ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, consentId } = req.body;

    if (!sessionId || !consentId) {
      console.error('Missing required fields:', { sessionId: !!sessionId, consentId: !!consentId });
      return res.status(400).json({ error: 'Missing session ID or consent ID' });
    }

    console.log('Retrieving Stripe session:', sessionId);
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('Stripe session payment status:', session.payment_status);
    console.log('Stripe session metadata:', JSON.stringify(session.metadata, null, 2));

    // Verify the session is paid and matches our consent ID
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ 
        error: 'Payment not completed', 
        paid: false 
      });
    }

    // Verify the consent ID matches what we stored in metadata
    if (session.metadata.consent_id !== consentId) {
      return res.status(400).json({ 
        error: 'Invalid consent ID', 
        paid: false 
      });
    }

    // Log what we're returning
    const responseData = { 
      paid: true,
      sessionId: session.id,
      consentId: consentId,
      parentEmail: session.metadata.parent_email,
      parentName: session.metadata.parent_name,
      parentPassword: session.metadata.parent_password,
      studentName: session.metadata.student_name,
      studentGrade: session.metadata.student_grade
    };
    
    console.log('=== VERIFY PAYMENT SUCCESS ===');
    console.log('Returning data:', JSON.stringify(responseData, null, 2));
    
    // Return success with session details
    return res.status(200).json(responseData);

  } catch (error) {
    console.error('=== VERIFY PAYMENT ERROR ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to verify payment',
      paid: false 
    });
  }
}