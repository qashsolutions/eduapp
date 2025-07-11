import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/db';
import { useAuth } from '../../lib/AuthContext';

/**
 * Teacher authentication page combining both login and signup flows
 * Provides a seamless experience for educators with toggle between modes
 */
export default function TeacherAuth() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  
  // Form state management
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form field states
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    school: ''
  });

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
   * Handle teacher signup
   * Creates new teacher account with proper role and metadata
   */
  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate required fields
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.school) {
        throw new Error('Please fill in all fields');
      }

      // Create auth user with Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName
          }
        }
      });

      if (authError) throw authError;

      // Create user profile with teacher-specific data
      if (authData.user) {
        // Insert the user record (since we removed the trigger)
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: formData.email.toLowerCase(),
            role: 'teacher',
            first_name: formData.firstName,
            account_type: 'teacher',
            school: formData.school,
            subscription_status: 'teacher',
            trial_started_at: new Date().toISOString(),
            trial_expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() // 15 days trial
          });

        if (insertError) {
          console.error('Error creating user profile:', insertError);
          throw new Error('Failed to create user profile. Please try again.');
        }

        // Refresh user context and redirect
        await refreshUser();
        router.push('/');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle teacher login
   * Authenticates existing teacher accounts
   */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate required fields
      if (!formData.email || !formData.password) {
        throw new Error('Please enter your email and password');
      }

      // Sign in with Supabase auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (authError) throw authError;

      // Verify user is a teacher
      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileError) throw profileError;

        if (profile.role !== 'teacher') {
          await supabase.auth.signOut();
          throw new Error('This login is for teachers only. Students should use their passcode to login.');
        }

        // Refresh user context and redirect
        await refreshUser();
        router.push('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        {/* SEO and bot-friendly meta tags */}
        <title>{isLogin ? 'Teacher Login' : 'Teacher Sign Up'} - Socratic AI Tutor</title>
        <meta name="description" content="Teacher portal for Socratic AI Tutor. Access student progress tracking, curriculum tools, and teaching resources." />
        <meta name="keywords" content="teacher login, educator portal, teaching tools, student progress tracking" />
        <meta property="og:title" content={`Teacher ${isLogin ? 'Login' : 'Sign Up'} - Socratic AI Tutor`} />
        <meta property="og:description" content="Educator access to personalized learning tools" />
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
              <span className="glow-icon glow-achievement">🎓</span>
            </div>
            <h1 className="form-title">
              {isLogin ? 'Teacher Login' : 'Teacher Registration'}
            </h1>
            <p className="form-subtitle">
              {isLogin ? '' : 'Join our educator community'}
            </p>
          </div>

          {/* Error display */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Authentication form */}
          <form onSubmit={isLogin ? handleLogin : handleSignup}>
            {/* Signup-only fields */}
            {!isLogin && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="firstName">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      className="form-input"
                      placeholder="Enter your first name"
                      value={formData.firstName}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="lastName">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      className="form-input"
                      placeholder="Enter your last name"
                      value={formData.lastName}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Common fields */}
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-input"
                placeholder="your.email@school.edu"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="form-input"
                placeholder={isLogin ? 'Enter your password' : 'Create a secure password'}
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            {/* School field for signup only */}
            {!isLogin && (
              <div className="form-group">
                <label className="form-label" htmlFor="school">
                  School/Institution (or type 'Freelancer')
                </label>
                <input
                  type="text"
                  id="school"
                  name="school"
                  className="form-input"
                  placeholder="Enter school name or 'Freelancer'"
                  value={formData.school}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            )}

            {/* Remove info box per requirements */}

            {/* Submit button */}
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Please wait...' : (isLogin ? 'Login to Dashboard' : 'Create Teacher Account')}
            </button>
          </form>

          {/* Toggle between login/signup */}
          <div className="auth-toggle">
            <p>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setFormData({ firstName: '', lastName: '', email: '', password: '', school: '' });
                }}
                className="toggle-link"
              >
                {isLogin ? 'Sign up here' : 'Login here'}
              </button>
            </p>
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
          background: rgba(147, 51, 234, 0.2);
          border-radius: 20px;
          margin-bottom: 1rem;
          font-size: 2.5rem;
        }

        /* Glow effects for icons */
        .glow-icon {
          filter: drop-shadow(0 0 8px currentColor);
          animation: pulse-glow 3s ease-in-out infinite;
        }

        .glow-achievement {
          color: #f59e0b;
          filter: drop-shadow(0 0 12px #f59e0b);
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

        /* Form row for side-by-side fields */
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        @media (max-width: 500px) {
          .form-row {
            grid-template-columns: 1fr;
          }
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
          border-color: rgba(147, 51, 234, 0.6);
          background: rgba(255,255,255,0.15);
          box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.2);
        }

        .form-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
          background: rgba(147, 51, 234, 0.8);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: rgba(147, 51, 234, 1);
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(147, 51, 234, 0.3);
        }

        .btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        /* Auth toggle section */
        .auth-toggle {
          text-align: center;
          margin-top: 2rem;
          color: rgba(255,255,255,0.8);
          font-size: 1.1rem;
        }

        .toggle-link {
          background: none;
          border: none;
          color: #c084fc;
          text-decoration: underline;
          cursor: pointer;
          font-size: 1.1rem;
          font-weight: 600;
          transition: color 0.3s ease;
        }

        .toggle-link:hover {
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
      `}</style>
    </>
  );
}