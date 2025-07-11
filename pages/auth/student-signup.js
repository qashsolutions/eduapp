import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

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
          <title>Email Sent - Socratic Learning</title>
          <meta name="description" content="Parent consent email sent successfully" />
          <meta name="robots" content="noindex, nofollow" />
        </Head>

        <div className="page-wrapper">
          <Header />
          
          <div className="success-container">
            <div className="success-card">
              <div className="icon-container">
                <svg width="80" height="80" viewBox="0 0 24 24" className="email-icon">
                  <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z"/>
                </svg>
              </div>
              <h1 className="success-title">Email Sent!</h1>
              <p className="success-subtitle">Check your parent's inbox</p>

              <div className="success-content">
                <p>We've sent an email to <strong>{formData.parentEmail}</strong> with a secure link.</p>
                <p style={{ marginTop: '1rem' }}>Your parent will need to:</p>
                <ul className="checklist">
                  <li>Click the link in the email</li>
                  <li>Confirm your account details</li>
                  <li>Complete a $1 verification payment</li>
                  <li>Generate your secure passcode</li>
                </ul>
              </div>

              <Link href="/auth/student-login" className="success-btn">
                I got my passcode! →
              </Link>

              <div className="success-footer">
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
          
          <Footer />
        </div>

        <style jsx>{`
          ${getSuccessStyles()}
        `}</style>
        
        <style jsx global>{`
          body {
            background: linear-gradient(135deg, #f9f7f2 0%, #f0ebe0 100%) !important;
            color: #2d3748 !important;
          }
          body::before {
            display: none !important;
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
        <title>Student Registration - Socratic Learning</title>
        <meta name="description" content="Start your personalized learning journey with Socratic Learning. COPPA-compliant registration with parent approval." />
        <meta name="keywords" content="student registration, adaptive learning, personalized education, COPPA compliant" />
        <meta property="og:title" content="Student Registration - Socratic Learning" />
        <meta property="og:description" content="Begin your adaptive learning journey" />
        <meta name="robots" content="index, follow" />
      </Head>

      <div className="page-wrapper">
        <Header />
        
        <div className="auth-container">
          {/* Left Side - Features */}
          <div className="left-side">
            <div className="icon-container">
              <svg width="120" height="120" viewBox="0 0 24 24" className="family-icon">
                <path d="M16 4C17.11 4 18 4.89 18 6C18 7.11 17.11 8 16 8C14.89 8 14 7.11 14 6C14 4.89 14.89 4 16 4M8 4C9.11 4 10 4.89 10 6C10 7.11 9.11 8 8 8C6.89 8 6 7.11 6 6C6 4.89 6.89 4 8 4M16 10C18.67 10 24 11.33 24 14V16H16V14C16 13.5 15.89 13 15.71 12.5C14.53 11.5 12.92 10.76 11.25 10.36C12.5 10.13 14.03 10 16 10M8 10C10.67 10 16 11.33 16 14V16H0V14C0 11.33 5.33 10 8 10M8 18C6.89 18 6 18.89 6 20C6 21.11 6.89 22 8 22C9.11 22 10 21.11 10 20C10 18.89 9.11 18 8 18M16 18C14.89 18 14 18.89 14 20C14 21.11 14.89 22 16 22C17.11 22 18 21.11 18 20C18 18.89 17.11 18 16 18Z"/>
              </svg>
            </div>
            
            <div className="features-list">
              <div className="feature-item">
                <span className="feature-bullet">•</span>
                <span className="feature-text">Socratic methods of teaching</span>
              </div>
              <div className="feature-item">
                <span className="feature-bullet">•</span>
                <span className="feature-text">Choose your mood to get appropriate content</span>
              </div>
              <div className="feature-item">
                <span className="feature-bullet">•</span>
                <span className="feature-text">One flat fee for math and english</span>
              </div>
              <div className="feature-item">
                <span className="feature-bullet">•</span>
                <span className="feature-text">75 Million + combination of questions - will likely never see the same question again</span>
              </div>
              <div className="feature-item">
                <span className="feature-bullet">•</span>
                <span className="feature-text">Dynamic progression from simple to complex questions</span>
              </div>
            </div>
            
            <div className="coppa-notice">
              <p>We'll send your parent a special link to approve your account and set up your learning profile safely.</p>
              <p>🔒 Your information is kept secure and private. We follow COPPA guidelines to protect young learners.</p>
            </div>
          </div>
          
          {/* Right Side - Form */}
          <div className="right-side">
            <h1 className="auth-title">Student Registration</h1>
            <p className="auth-subtitle">Let's get you started!</p>
            
            {/* Error display */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            {/* Registration form */}
            <form onSubmit={handleSubmit} className="auth-form">
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

              {/* Submit button */}
              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading}
              >
                {loading ? 'Sending email...' : 'Send Parent Approval Email'}
              </button>
              
              {/* Alternative options */}
              <div className="form-footer">
                <p>
                  Already have a passcode? 
                  <Link href="/auth/student-login" className="link">
                    Login here
                  </Link>
                </p>
                <p>
                  Are you a teacher? 
                  <Link href="/auth/teacher-auth" className="link">
                    Teacher portal
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
        
        <Footer />
      </div>

      <style jsx>{`
        ${getStyles()}
      `}</style>
      
      <style jsx global>{`
        /* Override global dark theme for this page */
        body {
          background: linear-gradient(135deg, #f9f7f2 0%, #f0ebe0 100%) !important;
          color: #2d3748 !important;
        }
        
        body::before {
          display: none !important;
        }
        
        /* Ensure all text uses dark colors */
        * {
          color: inherit;
        }
      `}</style>
    </>
  );
}

/**
 * Get common styles for the component
 * Matching teacher-auth sandy white theme
 */
function getStyles() {
  return `
    /* Page wrapper to match teacher-auth sandy white theme */
    .page-wrapper {
      min-height: 100vh;
      background: linear-gradient(135deg, #f9f7f2 0%, #f0ebe0 100%);
      position: relative;
      display: flex;
      flex-direction: column;
      color: #2d3748;
    }
    
    /* Main auth container with 2-column layout */
    .auth-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
      margin: 1rem 0;
      padding: 0 5%;
      width: 100%;
      min-height: calc(100vh - 250px);
    }
    
    /* Left side - Features */
    .left-side {
      background: white;
      padding: 3rem 4rem;
      border-radius: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      min-height: 550px;
    }
    
    /* Right side - Form */
    .right-side {
      background: white;
      padding: 3rem 4rem;
      border-radius: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      min-height: 550px;
    }
    
    /* Icon container */
    .icon-container {
      margin-bottom: 2.5rem;
    }
    
    .family-icon {
      fill: #5a67d8;
    }
    
    /* Features list */
    .features-list {
      flex: 1;
      width: 100%;
      margin-bottom: 2rem;
    }
    
    .feature-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 1.5rem;
      text-align: left;
    }
    
    .feature-bullet {
      color: #5a67d8;
      font-size: 1.5rem;
      margin-right: 1rem;
      flex-shrink: 0;
    }
    
    .feature-text {
      font-size: 1.1rem;
      line-height: 1.6;
      color: #4a5568;
    }
    
    /* COPPA notice at bottom */
    .coppa-notice {
      width: 100%;
      padding-top: 2rem;
      border-top: 1px solid #e2e8f0;
      margin-top: auto;
    }
    
    .coppa-notice p {
      font-size: 0.95rem;
      line-height: 1.5;
      color: #718096;
      font-style: italic;
      margin-bottom: 0.75rem;
    }
    
    .coppa-notice p:last-child {
      margin-bottom: 0;
    }
    
    /* Auth form styling */
    .auth-title {
      font-size: 1.8rem;
      font-weight: 700;
      color: #2d3748;
      text-align: center;
      margin-bottom: 0.5rem;
    }
    
    .auth-subtitle {
      text-align: center;
      font-size: 1.2rem;
      color: #4a5568;
      margin-bottom: 2rem;
    }
    
    /* Error message */
    .error-message {
      background: #fee;
      border: 1px solid #fcc;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      color: #c53030;
      font-size: 0.95rem;
      text-align: center;
    }
    
    /* Form styling */
    .auth-form {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    .form-group {
      margin-bottom: 1.5rem;
    }
    
    .form-label {
      display: block;
      font-size: 1rem;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 0.5rem;
    }
    
    .form-input,
    .form-select {
      width: 100%;
      padding: 1rem 1.25rem;
      border: 1px solid #cbd5e0;
      border-radius: 8px;
      font-size: 1.1rem;
      background: white;
      color: #2d3748;
      transition: all 0.3s ease;
    }
    
    .form-input:focus,
    .form-select:focus {
      outline: none;
      border-color: #5a67d8;
      box-shadow: 0 0 0 3px rgba(90, 103, 216, 0.1);
    }
    
    .form-input::placeholder {
      color: #a0aec0;
    }
    
    .form-input:disabled,
    .form-select:disabled {
      background: #f7fafc;
      cursor: not-allowed;
    }
    
    /* Select wrapper and arrow */
    .select-wrapper {
      position: relative;
    }
    
    .form-select {
      appearance: none;
      padding-right: 3rem;
      cursor: pointer;
    }
    
    .select-arrow {
      position: absolute;
      right: 1.25rem;
      top: 50%;
      transform: translateY(-50%);
      color: #a0aec0;
      pointer-events: none;
      font-size: 0.8rem;
    }
    
    /* Submit button */
    .submit-btn {
      width: 100%;
      padding: 1.25rem 2rem;
      border: 1px solid #cbd5e0;
      border-radius: 8px;
      background: white;
      color: #2d3748;
      font-size: 1.2rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-top: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .submit-btn:hover:not(:disabled) {
      background: #5a67d8;
      color: white;
      border-color: #5a67d8;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(90, 103, 216, 0.3);
    }
    
    .submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    /* Form footer */
    .form-footer {
      text-align: center;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      margin-top: auto;
    }
    
    .form-footer p {
      color: #4a5568;
      font-size: 1rem;
      margin-bottom: 0.5rem;
    }
    
    .link {
      color: #5a67d8;
      text-decoration: none;
      margin-left: 0.5rem;
      transition: color 0.3s ease;
    }
    
    .link:hover {
      color: #6b46c1;
      text-decoration: underline;
    }
    
    /* Tablet responsiveness */
    @media (max-width: 1200px) {
      .auth-container {
        grid-template-columns: 1fr;
        gap: 2rem;
        margin: 1rem 0;
        padding: 0 3%;
      }
      
      .left-side,
      .right-side {
        min-height: 450px;
        padding: 3rem;
      }
      
      .left-side {
        display: none; /* Hide features on tablet for cleaner mobile experience */
      }
    }
    
    /* Mobile responsiveness */
    @media (max-width: 768px) {
      .auth-container {
        padding: 0 2%;
      }
      
      .right-side {
        padding: 2rem 1.5rem;
        min-height: auto;
      }
      
      .auth-title {
        font-size: 1.5rem;
      }
      
      .auth-subtitle {
        font-size: 1.1rem;
      }
      
      .form-input,
      .form-select {
        font-size: 1rem;
        padding: 0.75rem 1rem;
      }
      
      .submit-btn {
        padding: 0.75rem 1.5rem;
      }
    }
  `;
}

/**
 * Get success page styles
 */
function getSuccessStyles() {
  return `
    .page-wrapper {
      min-height: 100vh;
      background: linear-gradient(135deg, #f9f7f2 0%, #f0ebe0 100%);
      position: relative;
      display: flex;
      flex-direction: column;
      color: #2d3748;
    }
    
    .success-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    
    .success-card {
      background: white;
      padding: 3rem 4rem;
      border-radius: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      max-width: 600px;
      width: 100%;
      text-align: center;
    }
    
    .icon-container {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100px;
      height: 100px;
      background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
      border-radius: 25px;
      margin-bottom: 2rem;
    }
    
    .email-icon {
      fill: white;
    }
    
    .success-title {
      font-size: 2rem;
      font-weight: 700;
      color: #2d3748;
      margin-bottom: 0.5rem;
    }
    
    .success-subtitle {
      font-size: 1.2rem;
      color: #4a5568;
      margin-bottom: 2rem;
    }
    
    .success-content {
      text-align: left;
      background: #f7fafc;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
    }
    
    .success-content p {
      color: #4a5568;
      font-size: 1rem;
      line-height: 1.6;
    }
    
    .success-content strong {
      color: #2d3748;
      font-weight: 600;
    }
    
    .checklist {
      list-style: none;
      padding: 0;
      margin: 1rem 0 0 0;
    }
    
    .checklist li {
      padding: 0.5rem 0;
      color: #4a5568;
      font-size: 1rem;
      position: relative;
      padding-left: 2rem;
    }
    
    .checklist li::before {
      content: '✓';
      position: absolute;
      left: 0;
      color: #48bb78;
      font-weight: bold;
      font-size: 1.2rem;
    }
    
    .success-btn {
      width: 100%;
      padding: 1.25rem 2rem;
      border: 1px solid #cbd5e0;
      border-radius: 8px;
      background: white;
      color: #2d3748;
      font-size: 1.2rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
      text-align: center;
      margin-bottom: 2rem;
    }
    
    .success-btn:hover {
      background: #5a67d8;
      color: white;
      border-color: #5a67d8;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(90, 103, 216, 0.3);
    }
    
    .success-footer {
      text-align: center;
    }
    
    .success-footer p {
      color: #4a5568;
      font-size: 1rem;
    }
    
    .resend-link {
      background: none;
      border: none;
      color: #5a67d8;
      text-decoration: underline;
      cursor: pointer;
      font-size: 1rem;
      margin-left: 0.5rem;
      transition: color 0.3s ease;
    }
    
    .resend-link:hover {
      color: #6b46c1;
    }
    
    @media (max-width: 768px) {
      .success-card {
        padding: 2rem 1.5rem;
      }
      
      .success-title {
        font-size: 1.5rem;
      }
      
      .icon-container {
        width: 80px;
        height: 80px;
      }
    }
  `;
}