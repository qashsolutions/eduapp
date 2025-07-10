import Stripe from 'stripe';
import { supabase } from '../../lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { consentId, childName, childGrade } = req.body;

    if (!consentId || !childName || !childGrade) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create Stripe checkout session for $1 verification
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Parent Verification',
            description: `Verify parent consent for ${childName} (Grade ${childGrade})`,
          },
          unit_amount: 100, // $1.00 in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/parent-setup?session_id={CHECKOUT_SESSION_ID}&consent_id=${consentId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/parent-verify?consent_id=${consentId}`,
      metadata: {
        consent_id: consentId,
        child_name: childName,
        child_grade: childGrade,
      },
    });

    // Store session ID in consent record
    await supabase
      .from('parent_consents')
      .update({ stripe_payment_intent: session.id })
      .eq('id', consentId);

    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}