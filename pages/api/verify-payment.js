import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, consentId } = req.body;

    if (!sessionId || !consentId) {
      return res.status(400).json({ error: 'Missing session ID or consent ID' });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

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

    // Return success with session details
    return res.status(200).json({ 
      paid: true,
      sessionId: session.id,
      consentId: consentId,
      parentEmail: session.metadata.parent_email,
      parentName: session.metadata.parent_name,
      parentPassword: session.metadata.parent_password,
      studentName: session.metadata.student_name,
      studentGrade: session.metadata.student_grade
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ 
      error: 'Failed to verify payment',
      paid: false 
    });
  }
}