import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
// Removed Firebase import - now using Supabase through AuthContext
import { createUser, supabase } from '../lib/db';
import { useAuth } from '../lib/AuthContext';

export default function ParentSetup() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { session_id, consent_id } = router.query;
  const [consent, setConsent] = useState(null);
  const [parentEmail, setParentEmail] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [childPasscode, setChildPasscode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: parent account, 2: child passcode

  useEffect(() => {
    if (session_id && consent_id) {
      verifyPaymentAndFetchConsent();
    }
  }, [session_id, consent_id]);

  const verifyPaymentAndFetchConsent = async () => {
    try {
      // Verify payment with Stripe
      const paymentResponse = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session_id })
      });

      const paymentData = await paymentResponse.json();
      if (!paymentData.success) throw new Error('Payment verification failed');

      // Fetch consent details
      const { data, error } = await supabase
        .from('parent_consents')
        .select('*')
        .eq('id', consent_id)
        .single();

      if (error) throw error;
      
      setConsent(data);
      setParentEmail(paymentData.customerEmail || '');
    } catch (error) {
      console.error('Setup error:', error);
      setError('Invalid setup link');
    } finally {
      setLoading(false);
    }
  };

  const handleParentAccountCreation = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Create parent account in Firebase
      const authResult = await signUp(parentEmail, parentPassword);
      if (authResult.error) throw new Error(authResult.error);

      // Create parent profile in Supabase
      const parentProfile = await createUser(
        parentEmail,
        authResult.user.id,
        'parent',
        null,
        true
      );

      if (!parentProfile) throw new Error('Failed to create parent profile');

      // Update consent with parent ID
      await supabase
        .from('parent_consents')
        .update({ 
          parent_id: authResult.user.id,
          consent_given_at: new Date().toISOString()
        })
        .eq('id', consent_id);

      setStep(2);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChildAccountSetup = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Generate a unique email for the child (not used for login)
      const childEmail = `${consent.child_first_name.toLowerCase()}_${Date.now()}@student.socraticlearning.com`;
      
      // Create child account in Firebase
      const tempPassword = childPasscode + 'Aa1!';
      const authResult = await signUp(childEmail, tempPassword);
      if (authResult.error) throw new Error(authResult.error);

      // Get parent ID
      const { data: parentData } = await supabase
        .from('parent_consents')
        .select('parent_id')
        .eq('id', consent_id)
        .single();

      // Create child profile in Supabase
      const { data: childProfile, error: childError } = await supabase
        .from('users')
        .insert([{
          id: authResult.user.id,
          email: childEmail,
          first_name: consent.child_first_name.toLowerCase(),
          passcode: childPasscode,
          role: 'student',
          grade: consent.child_grade,
          parent_id: parentData.parent_id,
          account_type: 'trial',
          trial_started_at: new Date().toISOString(),
          trial_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          subscription_status: 'trial',
          stripe_payment_id: session_id,
          consent_date: new Date().toISOString(),
          // Proficiency fields
          english_comprehension: 5,
          english_grammar: 5,
          english_vocabulary: 5,
          english_sentences: 5,
          english_synonyms: 5,
          english_antonyms: 5,
          english_fill_blanks: 5,
          math_number_theory: 5,
          math_algebra: 5,
          math_geometry: 5,
          math_statistics: 5,
          math_precalculus: 5,
          math_calculus: 5
        }])
        .select()
        .single();

      if (childError) throw childError;

      // Update consent with child ID
      await supabase
        .from('parent_consents')
        .update({ child_id: authResult.user.id })
        .eq('id', consent_id);

      // Success - redirect to parent dashboard
      alert(`Success! ${consent.child_first_name} can now login with:\n\nFirst Name: ${consent.child_first_name}\nPasscode: ${childPasscode}\n\nPlease save this information!`);
      router.push('/parent-dashboard');
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading-container">Verifying payment...</div>;
  }

  return (
    <>
      <Head>
        <title>Account Setup - Socratic Learning</title>
      </Head>
      
      <div className="setup-container">
        <div className="setup-card">
          <h1>Account Setup</h1>
          
          {step === 1 ? (
            <>
              <h2>Step 1: Create Your Parent Account</h2>
              <form onSubmit={handleParentAccountCreation}>
                <div className="form-group">
                  <input
                    type="email"
                    placeholder="Your Email"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <input
                    type="password"
                    placeholder="Create Password (min 6 characters)"
                    value={parentPassword}
                    onChange={(e) => setParentPassword(e.target.value)}
                    minLength={6}
                    required
                    className="form-input"
                  />
                </div>

                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? 'Creating Account...' : 'Create Parent Account'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2>Step 2: Create Passcode for {consent?.child_first_name}</h2>
              <p className="instruction">Create a simple passcode that {consent?.child_first_name} will use to login.</p>
              
              <form onSubmit={handleChildAccountSetup}>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Create a 4-6 digit passcode"
                    value={childPasscode}
                    onChange={(e) => setChildPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    pattern="[0-9]{4,6}"
                    minLength={4}
                    maxLength={6}
                    required
                    className="form-input"
                  />
                  <p className="helper-text">Numbers only, 4-6 digits</p>
                </div>

                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? 'Setting Up...' : 'Complete Setup'}
                </button>
              </form>
            </>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>
      </div>

      <style jsx>{`
        .setup-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #2d2d4e 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .setup-card {
          background: rgba(30, 30, 30, 0.4);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          padding: 48px;
          max-width: 500px;
          width: 100%;
        }

        h1 {
          color: #ffffff;
          font-size: 2rem;
          margin-bottom: 32px;
          text-align: center;
        }

        h2 {
          color: #00ff88;
          font-size: 1.3rem;
          margin-bottom: 24px;
        }

        .instruction {
          color: #e0e0e0;
          margin-bottom: 24px;
          line-height: 1.6;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-input {
          width: 100%;
          padding: 16px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          color: #ffffff;
          font-size: 1.1rem;
          transition: all 0.3s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: #00ff88;
          box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.1);
        }

        .helper-text {
          color: #b0b0b0;
          font-size: 0.9rem;
          margin-top: 8px;
        }

        .submit-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #00ff88, #0088ff);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 1.2rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.4);
        }

        .submit-btn:disabled {
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

        .loading-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #2d2d4e 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-size: 1.2rem;
        }
      `}</style>
    </>
  );
}