import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/db';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with publishable key from environment
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/**
 * Parent verification page - Handles COPPA consent flow
 * Processes magic link, collects payment, and generates student passcode
 */
export default function ParentVerify() {
  const router = useRouter();
  const { token } = router.query;
  
  // State management
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [studentInfo, setStudentInfo] = useState(null);
  const [parentName, setParentName] = useState('');
  const [parentPassword, setParentPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [verificationComplete, setVerificationComplete] = useState(false);

  /**
   * Verify token and load student information on mount
   */
  useEffect(() => {
    // Check if returning from successful payment first
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success') === 'true';
    
    if (paymentSuccess) {
      // Handle payment success case
      handlePaymentReturn();
    } else if (token) {
      // Normal flow - verify token
      verifyToken();
    } else {
      // No token and no payment success
      setError('Invalid verification link');
      setLoading(false);
    }
  }, [token, router.query]);

  /**
   * Handle return from Stripe payment
   */
  const handlePaymentReturn = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      const consentId = urlParams.get('consent_id');
      
      if (!sessionId || !consentId) {
        throw new Error('Missing payment information');
      }
      
      // Verify payment and get student info from API
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, consentId })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.paid) {
        throw new Error(data.error || 'Payment verification failed');
      }
      
      // Pass data directly to completeVerification
      const verificationData = {
        email: data.parentEmail,
        parentName: data.parentName,
        parentPassword: data.parentPassword,
        studentName: data.studentName,
        studentGrade: data.studentGrade,
        consentId: consentId
      };
      
      await completeVerification(verificationData);
      
    } catch (err) {
      console.error('Payment return error:', err);
      setError(err.message || 'Failed to process payment. Please contact support.');
      setLoading(false);
    }
  };

  /**
   * Verify the magic link token and retrieve student data
   */
  const verifyToken = async () => {
    try {
      // Decode the base64 token
      const decodedData = JSON.parse(atob(token));
      
      // Validate token hasn't expired (24 hour expiry)
      const tokenAge = Date.now() - decodedData.timestamp;
      if (tokenAge > 24 * 60 * 60 * 1000) {
        throw new Error('This verification link has expired. Please request a new one.');
      }

      // Set student information from token
      setStudentInfo({
        name: decodedData.studentName,
        grade: decodedData.grade,
        email: decodedData.parentEmail
      });
    } catch (err) {
      console.error('Token verification error:', err);
      setError('Invalid or expired verification link. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generate a secure 6-digit passcode for student login
   * @returns {string} 6-digit passcode
   */
  const generatePasscode = () => {
    // Generate cryptographically secure random 6-digit code
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const code = (array[0] % 900000) + 100000; // Ensures 6 digits
    return code.toString();
  };

  /**
   * Process Stripe payment and create accounts
   */
  const handlePayment = async (e) => {
    e.preventDefault();
    
    if (!parentName.trim()) {
      setError('Please enter your full name');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      // Create Stripe checkout session
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'parent_verification',
          parentEmail: studentInfo.email,
          studentName: studentInfo.name,
          studentGrade: studentInfo.grade,
          parentName: parentName.trim(),
          parentPassword: parentPassword
        })
      });

      const { sessionId, error: sessionError } = await response.json();
      
      if (sessionError) {
        throw new Error(sessionError);
      }

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      
      if (!stripe) {
        throw new Error('Stripe failed to initialize. Check your publishable key.');
      }
      
      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });

      if (stripeError) {
        throw new Error(stripeError.message);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment processing failed. Please try again.');
      setProcessing(false);
    }
  };



  /**
   * Complete the verification process after payment
   */
  const completeVerification = async (verificationData) => {
    try {
      // Extract data from parameter
      const { email, parentName, parentPassword, studentName, studentGrade, consentId } = verificationData;
      
      // Validate required data
      if (!email || !parentName || !studentName || !parentPassword) {
        throw new Error('Missing required information. Please try again.');
      }
      
      // Generate student passcode
      const newPasscode = generatePasscode();
      // Check if parent already exists
      const { data: existingParent, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .eq('role', 'parent')
        .single();

      let parentId;
      
      if (existingParent) {
        // Parent exists - check how many children they have
        const { count, error: countError } = await supabase
          .from('parent_consents')
          .select('*', { count: 'exact', head: true })
          .eq('parent_id', existingParent.id);
          
        if (count >= 2) {
          throw new Error('You have reached the maximum limit of 2 children per parent account. Please contact support if you need assistance.');
        }
        
        parentId = existingParent.id;
        console.log('Parent already exists, using existing account');
      } else {
        // Create new parent account
        const { data: parentAuth, error: parentError } = await supabase.auth.signUp({
          email: email,
          password: parentPassword,
          options: {
            data: {
              first_name: parentName,
              role: 'parent'
            }
          }
        });

        if (parentError) {
          if (parentError.message.includes('already registered')) {
            throw new Error('This email is already registered. Please sign in to your existing account to add another child.');
          }
          throw parentError;
        }

        parentId = parentAuth.user.id;

        // Create parent user record (since we removed the trigger)
        const { error: parentInsertError } = await supabase
          .from('users')
          .insert({
            id: parentAuth.user.id,
            email: email.toLowerCase(),
            role: 'parent',
            account_type: 'parent',
            first_name: parentName,
            consent_date: new Date().toISOString()
          });

        if (parentInsertError) throw parentInsertError;
      }

      // Generate student ID to use in both places
      const studentId = crypto.randomUUID();

      // Create student record linked to parent
      const { error: studentError } = await supabase
        .from('users')
        .insert({
          id: studentId,
          email: `${studentName.toLowerCase().replace(/\s/g, '')}_${Date.now()}@student.local`, // Create a unique email for student
          first_name: studentName,
          grade: parseInt(studentGrade),
          role: 'student',
          account_type: 'student',
          parent_id: parentId,
          passcode: newPasscode,
          consent_date: new Date().toISOString(),
          added_by_parent: true,
          subscription_status: 'free' // Students start with free tier
        });

      if (studentError) throw studentError;

      // Update parent_consents record with parent_id and child_id
      const { error: consentUpdateError } = await supabase
        .from('parent_consents')
        .update({
          parent_id: parentId,
          child_id: studentId
        })
        .eq('id', consentId);

      if (consentUpdateError) {
        console.error('Error updating consent record:', consentUpdateError);
      }

      // Set state for success display
      setStudentInfo({
        name: studentName,
        grade: studentGrade,
        email: email
      });
      setParentName(parentName);
      
      // Show success with passcode
      setPasscode(newPasscode);
      setVerificationComplete(true);
    } catch (err) {
      console.error('Verification completion error:', err);
      // Show user-friendly error messages
      if (err.message.includes('maximum limit of 2 children')) {
        setError(err.message);
      } else if (err.message.includes('already registered')) {
        setError(err.message);
      } else if (err.message.includes('duplicate key')) {
        setError('This account already exists. Please sign in to continue.');
      } else {
        setError(err.message || 'Failed to complete verification. Please contact support.');
      }
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="auth-container">
        <div className="loading-spinner">Loading...</div>
        <style jsx>{`
          .auth-container {
            min-height: calc(100vh - 140px);
            background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 3rem 1rem;
          }
          .loading-spinner {
            color: white;
            font-size: 1.2rem;
          }
        `}</style>
      </div>
    );
  }

  // Error state - invalid token
  if (!studentInfo) {
    return (
      <div className="auth-container">
        <div className="error-container">
          <h2>Verification Error</h2>
          <p>{error}</p>
          <button onClick={() => router.push('/auth/student-signup')} className="btn">
            Back to Registration
          </button>
        </div>
        <style jsx>{`
          .auth-container {
            min-height: calc(100vh - 140px);
            background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 3rem 2rem;
          }
          .error-container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 24px;
            padding: 2.5rem;
            text-align: center;
            max-width: 500px;
          }
          h2 {
            color: white;
            margin-bottom: 1rem;
          }
          p {
            color: #fca5a5;
            margin-bottom: 2rem;
          }
          .btn {
            background: rgba(52, 211, 153, 0.8);
            color: white;
            padding: 1rem 2rem;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-size: 1.1rem;
            transition: all 0.3s ease;
          }
          .btn:hover {
            background: rgba(52, 211, 153, 1);
            transform: translateY(-2px);
          }
        `}</style>
      </div>
    );
  }

  // Success state - show passcode
  if (verificationComplete) {
    return (
      <>
        <Head>
          <title>Verification Complete - Socratic AI Tutor</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>

        <div className="auth-container">
          <div className="bg-element"></div>
          <div className="bg-element"></div>
          <div className="bg-element"></div>
          <div className="bg-element"></div>

          <div className="form-container success-container">
            <div className="form-header">
              <div className="icon-container">
                <span className="glow-icon glow-complete">✅</span>
              </div>
              <h1 className="form-title">Verification Complete!</h1>
              <p className="form-subtitle">Your child's account is ready</p>
            </div>

            <div className="passcode-display">
              <p className="passcode-label">Student Login Passcode:</p>
              <div className="passcode-box">
                {passcode}
              </div>
              <p className="passcode-hint">
                Write this down! Your child will need this code along with their first name to login.
              </p>
            </div>

            <div className="info-box success-box">
              <p className="info-text">
                <strong>What's next?</strong>
              </p>
              <ul className="next-steps">
                <li>Give this passcode to {studentInfo.name}</li>
                <li>They can login with their first name and this code</li>
                <li>You'll receive email updates about their progress</li>
                <li>Access your parent dashboard anytime</li>
              </ul>
            </div>

            <button 
              onClick={() => router.push('/auth/student-login')} 
              className="btn btn-primary"
            >
              Go to Student Login
            </button>
          </div>
        </div>

        <style jsx>{`
          ${getStyles()}
          
          /* Success-specific styles */
          .success-container {
            text-align: center;
          }

          .passcode-display {
            background: rgba(52, 211, 153, 0.1);
            border: 2px solid rgba(52, 211, 153, 0.3);
            border-radius: 16px;
            padding: 2rem;
            margin: 2rem 0;
          }

          .passcode-label {
            color: rgba(255,255,255,0.8);
            font-size: 1.1rem;
            margin-bottom: 1rem;
          }

          .passcode-box {
            background: rgba(255,255,255,0.15);
            border: 2px solid rgba(52, 211, 153, 0.5);
            border-radius: 12px;
            padding: 1.5rem;
            font-size: 2.5rem;
            font-weight: 700;
            color: #34d399;
            letter-spacing: 0.5rem;
            font-family: monospace;
            margin-bottom: 1rem;
          }

          .passcode-hint {
            color: #fbbf24;
            font-size: 1rem;
            font-weight: 600;
          }

          .success-box {
            background: rgba(52, 211, 153, 0.1);
            border-color: rgba(52, 211, 153, 0.3);
            text-align: left;
          }

          .next-steps {
            list-style: none;
            padding: 0;
            margin: 1rem 0 0 0;
          }

          .next-steps li {
            padding: 0.5rem 0;
            color: white;
            font-size: 1rem;
            position: relative;
            padding-left: 1.5rem;
          }

          .next-steps li:before {
            content: "→";
            position: absolute;
            left: 0;
            color: #34d399;
          }

          .glow-complete {
            color: #34d399;
            filter: drop-shadow(0 0 12px #34d399);
          }
        `}</style>
      </>
    );
  }

  // Main verification form
  return (
    <>
      <Head>
        <title>Parent Verification - Socratic AI Tutor</title>
        <meta name="description" content="Complete your child's registration for Socratic AI Tutor" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="auth-container">
        {/* Background elements */}
        <div className="bg-element"></div>
        <div className="bg-element"></div>
        <div className="bg-element"></div>
        <div className="bg-element"></div>

        <div className="form-container">
          {/* Form header with icon */}
          <div className="form-header">
            <div className="icon-container">
              <span className="glow-icon glow-security">🔒</span>
            </div>
            <h1 className="form-title">Parent Verification</h1>
            <p className="form-subtitle">Approve your child's learning account</p>
          </div>

          {/* Student information display */}
          <div className="info-box payment-info">
            <p className="info-text">
              <strong>Child Information:</strong><br />
              Name: <span className="highlight">{studentInfo.name}</span><br />
              Grade: <span className="highlight">{studentInfo.grade}th Grade</span>
            </p>
          </div>

          {/* Error display */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Verification form */}
          <form onSubmit={handlePayment}>
            <div className="form-group">
              <label className="form-label" htmlFor="parentName">
                Your full name
              </label>
              <input
                type="text"
                id="parentName"
                className="form-input"
                placeholder="Enter your full name"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                disabled={processing}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="parentPassword">
                Create a password
              </label>
              <input
                type="password"
                id="parentPassword"
                className="form-input"
                placeholder="8+ chars: a-z, A-Z, 0-9, special char"
                value={parentPassword}
                onChange={(e) => setParentPassword(e.target.value)}
                disabled={processing}
                required
                minLength={8}
              />
            </div>

            <div className="info-box payment-info">
              <p className="info-text">
                <strong>$1 Verification Payment Required</strong><br />
                This small payment helps us verify parental consent and prevents unauthorized signups. 
                You'll be charged $1 via Stripe to confirm you're the parent.
              </p>
              <p className="info-text" style={{ marginTop: '1rem' }}>
                🔒 Your payment information is secure and processed by Stripe. 
                We never store credit card details.
              </p>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={processing}
            >
              {processing ? 'Processing...' : 'Verify & Pay $1'}
            </button>
          </form>

          {/* Additional information */}
          <div className="redirect-section">
            <p>
              Questions? Contact us at{' '}
              <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`} className="support-link">
                support@socratic-thinking.com
              </a>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        ${getStyles()}
        
        /* Payment-specific styles */
        .payment-info {
          background: rgba(52, 211, 153, 0.1);
          border-color: rgba(52, 211, 153, 0.3);
        }

        .highlight {
          color: #34d399;
          font-weight: 600;
        }

        .glow-security {
          color: #60a5fa;
          filter: drop-shadow(0 0 12px #60a5fa);
        }

        .support-link {
          color: #34d399;
          text-decoration: none;
          transition: color 0.3s ease;
        }

        .support-link:hover {
          color: #6ee7b7;
          text-decoration: underline;
        }
      `}</style>
    </>
  );
}

/**
 * Get common styles for the component
 */
function getStyles() {
  return `
    /* Base container styles */
    .auth-container {
      min-height: calc(100vh - 140px); /* Account for header and footer */
      background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      position: relative;
      overflow: hidden;
    }

    /* Floating background elements */
    .bg-element {
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 70%, transparent 100%);
      animation: float 8s ease-in-out infinite;
      pointer-events: none;
    }

    .bg-element:nth-child(1) {
      width: 300px;
      height: 300px;
      top: 10%;
      left: -5%;
      animation-delay: 0s;
    }

    .bg-element:nth-child(2) {
      width: 200px;
      height: 200px;
      top: 60%;
      right: -5%;
      animation-delay: 2s;
    }

    .bg-element:nth-child(3) {
      width: 150px;
      height: 150px;
      top: 30%;
      right: 20%;
      animation-delay: 4s;
    }

    .bg-element:nth-child(4) {
      width: 250px;
      height: 250px;
      bottom: 10%;
      left: 15%;
      animation-delay: 1s;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      50% { transform: translateY(-20px) rotate(180deg); }
    }

    /* Form container with glass morphism */
    .form-container {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 24px;
      padding: 2.5rem;
      width: 100%;
      max-width: 500px;
      position: relative;
      z-index: 10;
      animation: fadeInUp 0.5s ease;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Form header section */
    .form-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .icon-container {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 80px;
      background: rgba(96, 165, 250, 0.2);
      border-radius: 20px;
      margin-bottom: 1rem;
      font-size: 2.5rem;
    }

    /* Glow effects for icons */
    .glow-icon {
      filter: drop-shadow(0 0 8px currentColor);
      animation: pulse-glow 3s ease-in-out infinite;
    }

    @keyframes pulse-glow {
      0%, 100% { filter: drop-shadow(0 0 8px currentColor); }
      50% { filter: drop-shadow(0 0 16px currentColor); }
    }

    /* Form titles */
    .form-title {
      font-size: 2rem;
      font-weight: 700;
      color: white;
      margin-bottom: 0.5rem;
    }

    .form-subtitle {
      font-size: 1.2rem;
      color: rgba(255,255,255,0.8);
    }

    /* Error message styling */
    .error-message {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.5);
      border-radius: 12px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      color: #fca5a5;
      font-size: 1rem;
      text-align: center;
    }

    /* Form group styling */
    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-label {
      display: block;
      font-size: 1.1rem;
      font-weight: 600;
      color: white;
      margin-bottom: 0.5rem;
    }

    .form-input {
      width: 100%;
      padding: 1rem 1.5rem;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 12px;
      background: rgba(255,255,255,0.1);
      color: white;
      font-size: 1.1rem;
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
    }

    .form-input::placeholder {
      color: rgba(255,255,255,0.6);
    }

    .form-input:focus {
      outline: none;
      border-color: rgba(52, 211, 153, 0.6);
      background: rgba(255,255,255,0.15);
      box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.2);
    }

    .form-input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Info box styling */
    .info-box {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      padding: 1rem;
      margin: 1.5rem 0;
    }

    .info-text {
      color: white;
      font-size: 1rem;
      line-height: 1.6;
      margin: 0;
    }

    /* Button styling */
    .btn {
      width: 100%;
      padding: 1rem 2rem;
      border: none;
      border-radius: 12px;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      display: block;
      text-align: center;
    }

    .btn-primary {
      background: rgba(52, 211, 153, 0.8);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: rgba(52, 211, 153, 1);
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(52, 211, 153, 0.3);
    }

    .btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }

    /* Redirect section */
    .redirect-section {
      text-align: center;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.8);
      font-size: 1rem;
    }

    /* Mobile optimizations */
    @media (max-width: 500px) {
      .form-container {
        padding: 2rem 1.5rem;
      }

      .form-title {
        font-size: 1.75rem;
      }

      .form-subtitle {
        font-size: 1.1rem;
      }

      .icon-container {
        width: 60px;
        height: 60px;
        font-size: 2rem;
      }
    }
  `;
}