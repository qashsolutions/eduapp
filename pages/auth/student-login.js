import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/db';

/**
 * Student login page - Simple passcode-based authentication
 * Students login with their first name and 6-digit passcode
 */
export default function StudentLogin() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  
  // Form state management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form field states
  const [firstName, setFirstName] = useState('');
  const [passcode, setPasscode] = useState('');

  /**
   * Handle passcode input with auto-formatting
   * @param {Event} e - Input change event
   */
  const handlePasscodeChange = (e) => {
    // Only allow digits and limit to 6 characters
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPasscode(value);
    
    // Clear error when user starts typing
    if (error) setError('');
  };

  /**
   * Handle student login
   * Authenticates using first name and passcode
   */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate inputs
      if (!firstName.trim()) {
        throw new Error('Please enter your first name');
      }

      if (passcode.length !== 6) {
        throw new Error('Please enter your 6-digit passcode');
      }

      // Authenticate via API
      const response = await fetch('/api/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          passcode: passcode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Students don't use Supabase Auth - API already verified their credentials
      // For now, we'll just redirect to dashboard
      // TODO: Implement proper session management for students
      
      console.log('Student login successful:', data);
      
      // Store student data temporarily (dashboard will need to handle student sessions differently)
      sessionStorage.setItem('studentData', JSON.stringify({
        id: data.studentId,
        email: data.email,
        firstName: firstName.trim(),
        role: 'student'
      }));

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        {/* SEO and bot-friendly meta tags */}
        <title>Student Login - Socratic AI Tutor</title>
        <meta name="description" content="Student login portal for Socratic AI Tutor. Access your personalized learning dashboard with your passcode." />
        <meta name="keywords" content="student login, learning portal, education platform, adaptive learning" />
        <meta property="og:title" content="Student Login - Socratic AI Tutor" />
        <meta property="og:description" content="Access your personalized learning journey" />
        <meta name="robots" content="index, follow" />
      </Head>

      <div className="auth-container">
        {/* Background elements */}
        <div className="bg-element"></div>
        <div className="bg-element"></div>
        <div className="bg-element"></div>
        <div className="bg-element"></div>

        <div className="form-container">
          {/* Back navigation */}
          <Link href="/signup" className="back-btn">
            ← Back to Selection
          </Link>

          {/* Form header with icon */}
          <div className="form-header">
            <div className="icon-container">
              <span className="glow-icon glow-math">🎓</span>
            </div>
            <h1 className="form-title">Student Login</h1>
            <p className="form-subtitle">Enter your details to start learning!</p>
          </div>

          {/* Error display */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="firstName">
                First Name
              </label>
              <input
                type="text"
                id="firstName"
                className="form-input"
                placeholder="Enter your first name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={loading}
                autoComplete="given-name"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="passcode">
                Passcode
              </label>
              <input
                type="text"
                id="passcode"
                className="form-input passcode-input"
                placeholder="Enter your 6-digit passcode"
                value={passcode}
                onChange={handlePasscodeChange}
                disabled={loading}
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength="6"
              />
              <p className="input-hint">
                Your parent gave you this 6-digit code
              </p>
            </div>

            {/* Information box */}
            <div className="info-box">
              <p className="info-text">
                🔒 Your passcode keeps your learning progress safe and private. 
                Don't share it with anyone except your parents!
              </p>
            </div>

            {/* Submit button */}
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Start Learning! 🚀'}
            </button>
          </form>

          {/* Alternative options */}
          <div className="redirect-section">
            <p>
              Don't have a passcode yet? 
              <Link href="/auth/student-signup" className="redirect-link">
                Sign up here
              </Link>
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              Are you a teacher? 
              <Link href="/auth/teacher-auth" className="redirect-link teacher-link">
                Teacher portal
              </Link>
            </p>
          </div>

          {/* Help section */}
          <div className="help-section">
            <details className="help-details">
              <summary className="help-summary">Need help logging in?</summary>
              <div className="help-content">
                <p><strong>Forgot your passcode?</strong></p>
                <p>Ask your parent to check their email for your passcode, or they can log into their parent dashboard to view it.</p>
                
                <p style={{ marginTop: '1rem' }}><strong>First time here?</strong></p>
                <p>You'll need to sign up first with your parent's email. They'll receive a link to create your account and passcode.</p>
              </div>
            </details>
          </div>
        </div>
      </div>

      <style jsx>{`
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

        /* Back button styling */
        .back-btn {
          display: inline-flex;
          align-items: center;
          background: rgba(255,255,255,0.1);
          color: white;
          padding: 0.75rem 1.5rem;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 12px;
          text-decoration: none;
          margin-bottom: 1.5rem;
          transition: all 0.3s ease;
          font-size: 1rem;
        }

        .back-btn:hover {
          background: rgba(255,255,255,0.2);
          transform: translateX(-5px);
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
          background: rgba(59, 130, 246, 0.2);
          border-radius: 20px;
          margin-bottom: 1rem;
          font-size: 2.5rem;
        }

        /* Glow effects for icons */
        .glow-icon {
          filter: drop-shadow(0 0 8px currentColor);
          animation: pulse-glow 3s ease-in-out infinite;
        }

        .glow-math {
          color: #3b82f6;
          filter: drop-shadow(0 0 12px #3b82f6);
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
          border-color: rgba(59, 130, 246, 0.6);
          background: rgba(255,255,255,0.15);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }

        .form-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Passcode input specific styling */
        .passcode-input {
          font-family: monospace;
          font-size: 1.5rem;
          letter-spacing: 0.5rem;
          text-align: center;
        }

        .input-hint {
          font-size: 0.9rem;
          color: rgba(255,255,255,0.6);
          margin-top: 0.5rem;
        }

        /* Info box styling */
        .info-box {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
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
        }

        .btn-primary {
          background: rgba(59, 130, 246, 0.8);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: rgba(59, 130, 246, 1);
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
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

        .redirect-link {
          color: #34d399;
          text-decoration: none;
          margin-left: 0.5rem;
          transition: color 0.3s ease;
        }

        .redirect-link:hover {
          color: #6ee7b7;
          text-decoration: underline;
        }

        .teacher-link {
          color: #c084fc;
        }

        .teacher-link:hover {
          color: #e9d5ff;
        }

        /* Help section */
        .help-section {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid rgba(255,255,255,0.1);
        }

        .help-details {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          overflow: hidden;
        }

        .help-summary {
          padding: 1rem;
          cursor: pointer;
          color: rgba(255,255,255,0.8);
          font-size: 1rem;
          list-style: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: color 0.3s ease;
        }

        .help-summary:hover {
          color: white;
        }

        .help-summary::after {
          content: '▼';
          font-size: 0.8rem;
          transition: transform 0.3s ease;
        }

        .help-details[open] .help-summary::after {
          transform: rotate(180deg);
        }

        .help-content {
          padding: 0 1rem 1rem;
          color: rgba(255,255,255,0.8);
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .help-content strong {
          color: white;
          display: block;
          margin-bottom: 0.5rem;
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

          .passcode-input {
            font-size: 1.3rem;
            letter-spacing: 0.3rem;
          }
        }
      `}</style>
    </>
  );
}