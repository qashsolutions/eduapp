import Stripe from 'stripe';

// Initialize Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Subscription price IDs (configure in Stripe Dashboard)
export const PRICE_IDS = {
  student: process.env.STRIPE_STUDENT_PRICE_ID || 'price_student_yearly',
  teacher: process.env.STRIPE_TEACHER_PRICE_ID || 'price_teacher_yearly'
};

// Create checkout session
export const createCheckoutSession = async (userId, email, priceId, successUrl, cancelUrl) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      metadata: {
        userId: userId
      },
      subscription_data: {
        metadata: {
          userId: userId
        }
      }
    });
    
    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// Get customer portal session
export const createPortalSession = async (customerId, returnUrl) => {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    
    return session;
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw error;
  }
};

// Webhook signature verification
export const constructWebhookEvent = (payload, signature) => {
  try {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    throw error;
  }
};