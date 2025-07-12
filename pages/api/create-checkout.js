import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Use service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Debug: Check if environment variable is loaded
  console.log('Environment check:', {
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    nodeEnv: process.env.NODE_ENV
  });

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe configuration error - secret key not found' });
  }

  try {
    const { type, parentEmail, studentName, studentGrade, parentName } = req.body;

    // Validate required fields
    if (!parentEmail || !studentName || !studentGrade || !parentName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create parent consent record before payment
    const { data: consentData, error: consentError } = await supabase
      .from('parent_consents')
      .insert({
        child_first_name: studentName,
        child_grade: parseInt(studentGrade),
        // parent_id and child_id will be updated after payment success
      })
      .select()
      .single();

    if (consentError) {
      console.error('Error creating consent record:', consentError);
      return res.status(500).json({ error: 'Failed to create consent record' });
    }

    // Create Stripe checkout session for $1 verification
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Parent Verification',
            description: `Verify parent consent for ${studentName} (Grade ${studentGrade})`,
          },
          unit_amount: 100, // $1.00 in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/parent-verify?payment_success=true&session_id={CHECKOUT_SESSION_ID}&consent_id=${consentData.id}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/parent-verify?consent_id=${consentData.id}&error=payment_cancelled`,
      metadata: {
        consent_id: consentData.id,
        parent_email: parentEmail,
        parent_name: parentName,
        student_name: studentName,
        student_grade: studentGrade,
      },
    });

    // Store session ID in consent record
    const { error: updateError } = await supabase
      .from('parent_consents')
      .update({ stripe_payment_intent: session.id })
      .eq('id', consentData.id);

    if (updateError) {
      console.error('Error updating consent record:', updateError);
    }

    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}