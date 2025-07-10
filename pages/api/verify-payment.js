import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing session ID' });
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Get customer email
    const customerEmail = session.customer_details?.email || session.customer_email;

    return res.status(200).json({
      success: true,
      customerEmail: customerEmail,
      metadata: session.metadata
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
}