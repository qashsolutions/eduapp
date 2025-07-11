import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Use service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Disable body parsing, need raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

async function handleCheckoutCompleted(session) {
  console.log('Processing checkout.session.completed:', session.id);
  
  // Handle one-time parent verification payment
  if (session.metadata?.consent_id) {
    // This is handled by our verify-payment flow
    console.log('Parent verification payment completed');
    return;
  }

  // Handle subscription checkout (teacher/parent signup)
  if (session.subscription) {
    const customerId = session.customer;
    const subscriptionId = session.subscription;
    const userEmail = session.customer_email;
    
    // Update user subscription status
    const { error } = await supabase
      .from('users')
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_status: 'active',
        payment_status: 'paid'
      })
      .eq('email', userEmail);

    if (error) {
      console.error('Error updating user subscription:', error);
    }
  }
}

async function handleSubscriptionCreated(subscription) {
  console.log('Processing customer.subscription.created:', subscription.id);
  
  // Get user by stripe customer ID
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('stripe_customer_id', subscription.customer)
    .single();

  if (error || !user) {
    console.error('User not found for customer:', subscription.customer);
    return;
  }

  // Update subscription details
  const updates = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    trial_started_at: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
    trial_expires_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
  };

  const { error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id);

  if (updateError) {
    console.error('Error updating subscription:', updateError);
  }
}

async function handleSubscriptionUpdated(subscription) {
  console.log('Processing customer.subscription.updated:', subscription.id);
  
  // Get user by subscription ID
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (error || !user) {
    console.error('User not found for subscription:', subscription.id);
    return;
  }

  // Update subscription status
  const updates = {
    subscription_status: subscription.status,
    trial_expires_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
  };

  // If subscription is active and was trialing, clear trial dates
  if (subscription.status === 'active' && user.subscription_status === 'trialing') {
    updates.trial_expires_at = null;
  }

  const { error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id);

  if (updateError) {
    console.error('Error updating subscription:', updateError);
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Processing customer.subscription.deleted:', subscription.id);
  
  // Update user to free tier
  const { error } = await supabase
    .from('users')
    .update({
      subscription_status: 'free',
      payment_status: 'cancelled'
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error cancelling subscription:', error);
  }
}

async function handleTrialWillEnd(subscription) {
  console.log('Processing customer.subscription.trial_will_end:', subscription.id);
  
  // This fires 3 days before trial ends
  // Could send reminder email here
  const { data: user } = await supabase
    .from('users')
    .select('email, first_name')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (user) {
    console.log(`Trial ending soon for ${user.email}`);
    // TODO: Send reminder email via Resend
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  console.log('Processing invoice.payment_succeeded:', invoice.id);
  
  // Update payment status
  const { error } = await supabase
    .from('users')
    .update({
      payment_status: 'paid',
      last_payment_date: new Date().toISOString()
    })
    .eq('stripe_customer_id', invoice.customer);

  if (error) {
    console.error('Error updating payment status:', error);
  }
}

async function handleInvoicePaymentFailed(invoice) {
  console.log('Processing invoice.payment_failed:', invoice.id);
  
  // Update payment status
  const { error } = await supabase
    .from('users')
    .update({
      payment_status: 'failed',
      subscription_status: 'past_due'
    })
    .eq('stripe_customer_id', invoice.customer);

  if (error) {
    console.error('Error updating payment failure:', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
        // These are handled by invoice events for subscriptions
        console.log(`Received ${event.type}`);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}