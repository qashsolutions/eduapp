import { buffer } from 'micro';
import { stripe, constructWebhookEvent, PRICE_IDS } from '../../lib/stripe';
import { updateSubscriptionStatus } from '../../lib/db';

// Disable body parsing, we need raw body for webhook
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const { method } = req;

  try {
    if (method === 'POST') {
      // Handle webhook events
      const buf = await buffer(req);
      const sig = req.headers['stripe-signature'];
      
      if (!sig) {
        return res.status(400).json({ error: 'No stripe signature' });
      }

      let event;
      try {
        event = constructWebhookEvent(buf.toString(), sig);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: 'Invalid signature' });
      }

      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object;
          const userId = session.metadata.userId;
          
          if (userId) {
            // Determine subscription type based on price
            let subscriptionType = 'student';
            if (session.amount_total === 12000) { // $120 for teacher
              subscriptionType = 'teacher';
            }
            
            await updateSubscriptionStatus(userId, subscriptionType);
          }
          break;

        case 'customer.subscription.deleted':
          const subscription = event.data.object;
          const deletedUserId = subscription.metadata.userId;
          
          if (deletedUserId) {
            await updateSubscriptionStatus(deletedUserId, 'free');
          }
          break;

        case 'customer.subscription.updated':
          const updatedSub = event.data.object;
          const updatedUserId = updatedSub.metadata.userId;
          
          if (updatedUserId && updatedSub.status === 'active') {
            // Check price to determine type
            const priceId = updatedSub.items.data[0].price.id;
            let subType = 'student';
            if (priceId === PRICE_IDS.teacher) {
              subType = 'teacher';
            }
            await updateSubscriptionStatus(updatedUserId, subType);
          }
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return res.status(200).json({ received: true });
    }

    if (method === 'GET') {
      // Create checkout session
      const { userId, email, type = 'student' } = req.query;
      
      if (!userId || !email) {
        return res.status(400).json({ error: 'Missing userId or email' });
      }

      const priceId = type === 'teacher' ? PRICE_IDS.teacher : PRICE_IDS.student;
      const successUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/dashboard?payment=success`;
      const cancelUrl = `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/dashboard?payment=cancelled`;

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

      return res.status(200).json({ sessionId: session.id, url: session.url });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${method} not allowed` });

  } catch (error) {
    console.error('Payment API error:', error);
    return res.status(500).json({ error: 'Payment processing failed' });
  }
}