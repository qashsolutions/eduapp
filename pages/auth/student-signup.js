import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

/**
 * Student signup page - First step in COPPA-compliant registration
 * Collects basic student info and parent email for consent process
 */
export default function StudentSignup() {
  const router = useRouter();
  
  // Form state management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  
  // Form field states
  const [formData, setFormData] = useState({
    studentName: '',
    grade: '',
    parentEmail: ''
  });

  // Grade options for dropdown
  const gradeOptions = [
    { value: '5', label: '5th Grade' },
    { value: '6', label: '6th Grade' },
    { value: '7', label: '7th Grade' },
    { value: '8', label: '8th Grade' },
    { value: '9', label: '9th Grade' },
    { value: '10', label: '10th Grade' },
    { value: '11', label: '11th Grade' }
  ];

  /**
   * Handle form field changes
   * @param {Event} e - Input change event
   */
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  /**
   * Send parent consent email
   * Initiates COPPA-compliant registration process
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate all fields are filled
      if (!formData.studentName || !formData.grade || !formData.parentEmail) {
        throw new Error('Please fill in all fields');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.parentEmail)) {
        throw new Error('Please enter a valid email address');
      }

      // Send parent consent email via API
      const response = await fetch('/api/send-parent-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: formData.studentName.trim(),
          grade: parseInt(formData.grade),
          parentEmail: formData.parentEmail.toLowerCase().trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      // Show success state
      setEmailSent(true);
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show success message after email sent
  if (emailSent) {
    return (
      <>
        <Head>
          <title>Email Sent - Socratic AI Tutor</title>
          <meta name="description" content="Parent consent email sent successfully" />
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
                <span className="glow-icon glow-white">📧</span>
              </div>
              <h1 className="form-title">Email Sent!</h1>
              <p className="form-subtitle">Check your parent's inbox</p>
            </div>

            <div className="info-box success-box">
              <p className="info-text">
                We've sent an email to <strong>{formData.parentEmail}</strong> with a secure link.
              </p>
              <p className="info-text" style={{ marginTop: '1rem' }}>
                Your parent will need to:
              </p>
              <ul className="checklist">
                <li>✅ Click the link in the email</li>
                <li>✅ Confirm your account details</li>
                <li>✅ Complete a $1 verification payment</li>
                <li>✅ Generate your secure passcode</li>
              </ul>
            </div>

            <Link href="/auth/student-login" className="btn btn-primary">
              I got my passcode! →
            </Link>

            <div className="redirect-section">
              <p>
                Didn't receive the email? 
                <button
                  type="button"
                  onClick={() => {
                    setEmailSent(false);
                    setFormData({ studentName: '', grade: '', parentEmail: '' });
                  }}
                  className="resend-link"
                >
                  Try again
                </button>
              </p>
            </div>
          </div>
        </div>

        <style jsx>{`
          ${getStyles()}
          
          /* Success-specific styles */
          .success-container {
            text-align: center;
          }

          .success-box {
            background: rgba(52, 211, 153, 0.1);
            border-color: rgba(52, 211, 153, 0.3);
          }

          .checklist {
            list-style: none;
            padding: 0;
            margin: 1rem 0 0 0;
            text-align: left;
          }

          .checklist li {
            padding: 0.5rem 0;
            color: white;
            font-size: 1rem;
          }

          .resend-link {
            background: none;
            border: none;
            color: #34d399;
            text-decoration: underline;
            cursor: pointer;
            font-size: 1rem;
            margin-left: 0.5rem;
            transition: color 0.3s ease;
          }

          .resend-link:hover {
            color: #6ee7b7;
          }
        `}</style>
      </>
    );
  }

  // Main signup form
  return (
    <>
      <Head>
        {/* SEO and bot-friendly meta tags */}
        <title>Student Registration - Socratic AI Tutor</title>
        <meta name="description" content="Start your personalized learning journey with Socratic AI Tutor. COPPA-compliant registration with parent approval." />
        <meta name="keywords" content="student registration, adaptive learning, personalized education, COPPA compliant" />
        <meta property="og:title" content="Student Registration - Socratic AI Tutor" />
        <meta property="og:description" content="Begin your adaptive learning journey" />
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
              <span className="glow-icon glow-progress">🎯</span>
            </div>
            <h1 className="form-title">Student Registration</h1>
            <p className="form-subtitle">Let's get you started! 🚀</p>
          </div>

          {/* Error display */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Registration form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="studentName">
                What's your first name?
              </label>
              <input
                type="text"
                id="studentName"
                name="studentName"
                className="form-input"
                placeholder="Enter your first name"
                value={formData.studentName}
                onChange={handleChange}
                disabled={loading}
                autoComplete="given-name"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="grade">
                What grade are you in?
              </label>
              <div className="select-wrapper">
                <select
                  id="grade"
                  name="grade"
                  className="form-select"
                  value={formData.grade}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="">Select your grade</option>
                  {gradeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="select-arrow">▼</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="parentEmail">
                Your parent's email address
              </label>
              <input
                type="email"
                id="parentEmail"
                name="parentEmail"
                className="form-input"
                placeholder="parent@example.com"
                value={formData.parentEmail}
                onChange={handleChange}
                disabled={loading}
                autoComplete="email"
              />
            </div>

            {/* Information box */}
            <div className="info-box">
              <p className="info-text">
                📧 We'll send your parent a special link to approve your account and set up your learning profile safely.
              </p>
              <p className="info-text" style={{ marginTop: '0.5rem' }}>
                🔒 Your information is kept secure and private. We follow COPPA guidelines to protect young learners.
              </p>
            </div>

            {/* Submit button */}
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Sending email...' : 'Send Parent Approval Email'}
            </button>
          </form>

          {/* Alternative options */}
          <div className="redirect-section">
            <p>
              Already have a passcode? 
              <Link href="/auth/student-login" className="redirect-link">
                Login here
              </Link>
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              Are you a teacher? 
              <Link href="/auth/teacher-auth" className="redirect-link teacher-link">
                Teacher portal
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        ${getStyles()}
      `}</style>
    </>
  );
}

/**
 * Get common styles for the component
 * Extracted to function to share between success and form views
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
      background: rgba(52, 211, 153, 0.2);
      border-radius: 20px;
      margin-bottom: 1rem;
      font-size: 2.5rem;
    }

    /* Glow effects for icons */
    .glow-icon {
      filter: drop-shadow(0 0 8px currentColor);
      animation: pulse-glow 3s ease-in-out infinite;
    }

    .glow-progress {
      color: #8b5cf6;
      filter: drop-shadow(0 0 12px #8b5cf6);
    }

    .glow-white {
      color: white;
      filter: drop-shadow(0 0 10px rgba(255,255,255,0.6));
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

    /* Select dropdown styling */
    .select-wrapper {
      position: relative;
    }

    .form-select {
      width: 100%;
      padding: 1rem 1.5rem;
      padding-right: 3rem;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 12px;
      background: rgba(255,255,255,0.1);
      color: white;
      font-size: 1.1rem;
      backdrop-filter: blur(10px);
      appearance: none;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .form-select:focus {
      outline: none;
      border-color: rgba(52, 211, 153, 0.6);
      background: rgba(255,255,255,0.15);
      box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.2);
    }

    .form-select:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .form-select option {
      background: #374151;
      color: white;
    }

    .select-arrow {
      position: absolute;
      right: 1.5rem;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(255,255,255,0.6);
      pointer-events: none;
      font-size: 0.8rem;
    }

    /* Info box styling */
    .info-box {
      background: rgba(52, 211, 153, 0.1);
      border: 1px solid rgba(52, 211, 153, 0.3);
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