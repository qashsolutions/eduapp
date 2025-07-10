import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { auth } from '../lib/firebase';
import { supabase } from '../lib/db';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function ParentVerify() {
  const router = useRouter();
  const { token, consent_id } = router.query;
  const [consent, setConsent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (consent_id) {
      fetchConsentDetails();
    }
  }, [consent_id]);

  const fetchConsentDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('parent_consents')
        .select('*')
        .eq('id', consent_id)
        .single();

      if (error) throw error;
      
      if (data.consent_given_at) {
        router.push('/parent-dashboard');
        return;
      }
      
      setConsent(data);
    } catch (error) {
      console.error('Error fetching consent:', error);
      setError('Invalid or expired consent link');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    setProcessing(true);
    setError('');

    try {
      // Create Stripe checkout session
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentId: consent_id,
          childName: consent.child_first_name,
          childGrade: consent.child_grade
        })
      });

      const { sessionId, error: sessionError } = await response.json();
      
      if (sessionError) throw new Error(sessionError);

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
      
      if (stripeError) throw stripeError;
    } catch (error) {
      console.error('Payment error:', error);
      setError(error.message);
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  if (error && !consent) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => router.push('/login')}>Go to Login</button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Parent Verification - Socratic Learning</title>
      </Head>
      
      <div className="verify-container">
        <div className="verify-card">
          <h1>Parent Verification Required</h1>
          
          <div className="student-info">
            <h2>Student Information</h2>
            <p><strong>Name:</strong> {consent?.child_first_name}</p>
            <p><strong>Grade:</strong> {consent?.child_grade}</p>
          </div>

          <div className="verification-info">
            <h3>Why verification is needed:</h3>
            <p>As per COPPA regulations, we need to verify that you are the parent/guardian before {consent?.child_first_name} can use our AI tutoring platform.</p>
            
            <div className="payment-notice">
              <h3>$1 Verification Charge</h3>
              <p>This $1 charge verifies you're the parent and gives {consent?.child_first_name} access to our AI tutoring platform.</p>
            </div>
          </div>

          <button 
            className="verify-btn"
            onClick={handlePayment}
            disabled={processing}
          >
            {processing ? 'Processing...' : 'Verify & Pay $1'}
          </button>

          {error && <div className="error-message">{error}</div>}
        </div>
      </div>

      <style jsx>{`
        .verify-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #2d2d4e 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .verify-card {
          background: rgba(30, 30, 30, 0.4);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          padding: 48px;
          max-width: 600px;
          width: 100%;
        }

        h1 {
          color: #ffffff;
          font-size: 2rem;
          margin-bottom: 32px;
          text-align: center;
        }

        .student-info {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .student-info h2 {
          color: #00ff88;
          font-size: 1.3rem;
          margin-bottom: 16px;
        }

        .student-info p {
          color: #ffffff;
          font-size: 1.1rem;
          margin-bottom: 8px;
        }

        .verification-info h3 {
          color: #ffffff;
          font-size: 1.2rem;
          margin-bottom: 12px;
        }

        .verification-info p {
          color: #e0e0e0;
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .payment-notice {
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 12px;
          padding: 20px;
          margin: 24px 0;
        }

        .payment-notice h3 {
          color: #ffd700;
        }

        .verify-btn {
          width: 100%;
          padding: 20px;
          background: linear-gradient(135deg, #00ff88, #0088ff);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 1.2rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .verify-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.4);
        }

        .verify-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .error-message {
          background: rgba(255, 71, 87, 0.1);
          border: 1px solid rgba(255, 71, 87, 0.3);
          color: #ff4757;
          padding: 12px;
          border-radius: 8px;
          margin-top: 20px;
          text-align: center;
        }

        .loading-container,
        .error-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #2d2d4e 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        .error-container button {
          margin-top: 20px;
          padding: 12px 24px;
          background: #00ff88;
          border: none;
          border-radius: 8px;
          color: #000;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>
    </>
  );
}