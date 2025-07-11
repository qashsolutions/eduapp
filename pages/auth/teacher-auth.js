import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
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
  const [isLogin, setIsLogin] = useState(false); // Default to signup
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
      console.log('=== TEACHER SIGNUP ATTEMPT ===');
      console.log('Email:', formData.email);
      console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('Timestamp:', new Date().toISOString());
      
      const signupStart = Date.now();
      
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
      
      const signupDuration = Date.now() - signupStart;
      console.log(`Signup request took: ${signupDuration}ms`);
      console.log('Auth response:', { authData, authError });

      if (authError) {
        console.error('=== SIGNUP ERROR ===');
        console.error('Error type:', authError.name);
        console.error('Error message:', authError.message);
        console.error('Error status:', authError.status);
        console.error('Full error:', authError);
        throw authError;
      }

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
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('=== CATCH BLOCK ERROR ===');
      console.error('Error caught:', err);
      console.error('Error stack:', err.stack);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
      console.log('=== SIGNUP PROCESS COMPLETE ===');
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
        router.push('/dashboard');
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
        <title>{isLogin ? 'Teacher Login' : 'Teacher Sign Up'} - Socratic Learning</title>
        <meta name="description" content="Teacher portal for Socratic Learning. Access student progress tracking, curriculum tools, and teaching resources." />
        <meta name="keywords" content="teacher login, educator portal, teaching tools, student progress tracking" />
        <meta property="og:title" content={`Teacher ${isLogin ? 'Login' : 'Sign Up'} - Socratic Learning`} />
        <meta property="og:description" content="Educator access to personalized learning tools" />
        <meta name="robots" content="index, follow" />
      </Head>

      <div className="page-wrapper">
        <Header />
        
        <div className="auth-container">
          {/* Left Side - Features */}
          <div className="left-side">
            <div className="icon-container">
              <svg width="120" height="120" viewBox="0 0 24 24" className="grad-cap-icon">
                <path d="M12,3L1,9L12,15L21,9V16H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z"/>
              </svg>
            </div>
            
            <div className="feature-item">
              <h3 className="feature-title">Always On</h3>
              <p className="feature-text">24 X 7 access to limitless variations in content.</p>
            </div>
            
            <div className="feature-item">
              <h3 className="feature-title">Back to basics</h3>
              <p className="feature-text">Review concepts, get answers to your questions.</p>
            </div>
            
            <div className="feature-item">
              <h3 className="feature-title">Transparent pricing</h3>
              <p className="feature-text">Bring all your students for one flat monthly fee.</p>
            </div>
          </div>
          
          {/* Right Side - Auth Form */}
          <div className="right-side">
            <h1 className="auth-title">{isLogin ? 'Login' : 'Sign up'}</h1>
            <p className="auth-subtitle">Join as a Teacher/Educator</p>
            {!isLogin && (
              <p className="auth-note">$1 for 14 days trial period for COPPA compliance</p>
            )}
            
            {/* Error display */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            {/* Authentication form */}
            <form onSubmit={isLogin ? handleLogin : handleSignup} className="auth-form">
              {/* Signup-only fields */}
              {!isLogin && (
                <div className="form-row">
                  <input
                    type="text"
                    name="firstName"
                    className="form-input half-width"
                    placeholder="First Name"
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <input
                    type="text"
                    name="lastName"
                    className="form-input half-width"
                    placeholder="Last Name"
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              )}
              
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
              
              <input
                type="password"
                name="password"
                className="form-input"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
              />
              
              {!isLogin && (
                <input
                  type="text"
                  name="school"
                  className="form-input"
                  placeholder="School/Institution (or type 'Freelancer')"
                  value={formData.school}
                  onChange={handleChange}
                  disabled={loading}
                />
              )}
              
              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading}
              >
                {loading ? 'Please wait...' : (isLogin ? 'Login with Email' : 'Sign up with Email')}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setFormData({ firstName: '', lastName: '', email: '', password: '', school: '' });
                }}
                className="toggle-link"
              >
                {isLogin ? "Don't have an account?" : "Already have an account?"}
              </button>
            </form>
          </div>
        </div>
        
        <Footer />
      </div>

      <style jsx>{`
        /* Page wrapper to match index.js sandy white theme */
        .page-wrapper {
          min-height: 100vh;
          background: linear-gradient(135deg, #f9f7f2 0%, #f0ebe0 100%);
          position: relative;
          display: flex;
          flex-direction: column;
          /* Override global dark background */
          color: #2d3748;
        }
        
        /* Main auth container with 2-column layout */
        .auth-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          max-width: 1400px;
          margin: 3rem auto;
          padding: 0 3rem;
          width: 100%;
          min-height: calc(100vh - 300px);
        }
        
        /* Left side - Features */
        .left-side {
          background: white;
          padding: 4rem;
          border-radius: 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          min-height: 650px;
        }
        
        /* Right side - Form */
        .right-side {
          background: white;
          padding: 4rem;
          border-radius: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 650px;
        }
        
        /* Icon container */
        .icon-container {
          margin-bottom: 2.5rem;
        }
        
        .grad-cap-icon {
          fill: #5a67d8;
        }
        
        /* Feature items */
        .feature-item {
          text-align: left;
          margin-bottom: 3rem;
          width: 100%;
          max-width: 400px;
        }
        
        .feature-title {
          font-size: 1.4rem;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 0.5rem;
        }
        
        .feature-text {
          font-size: 1.1rem;
          line-height: 1.6;
          color: #4a5568;
        }
        
        /* Auth form styling */
        .auth-title {
          font-size: 1.8rem;
          font-weight: 700;
          color: #5a67d8;
          text-align: center;
          margin-bottom: 0.5rem;
        }
        
        .auth-subtitle {
          text-align: center;
          font-size: 1.2rem;
          color: #2d3748;
          margin-bottom: 0.3rem;
        }
        
        .auth-note {
          text-align: center;
          color: #666;
          font-size: 0.9rem;
          font-style: italic;
          margin-bottom: 1.5rem;
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
          margin-top: 2rem;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .form-input {
          width: 100%;
          padding: 1rem 1.25rem;
          margin-bottom: 1.25rem;
          border: 1px solid #cbd5e0;
          border-radius: 8px;
          font-size: 1.1rem;
          background: white;
          color: #2d3748;
          transition: all 0.3s ease;
        }
        
        .form-input:focus {
          outline: none;
          border-color: #5a67d8;
          box-shadow: 0 0 0 3px rgba(90, 103, 216, 0.1);
        }
        
        .form-input::placeholder {
          color: #a0aec0;
        }
        
        .form-input:disabled {
          background: #f7fafc;
          cursor: not-allowed;
        }
        
        .half-width {
          margin-bottom: 0;
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
        
        /* Toggle link */
        .toggle-link {
          display: block;
          width: 100%;
          background: none;
          border: none;
          color: #5a67d8;
          font-size: 1.1rem;
          text-align: center;
          cursor: pointer;
          transition: color 0.3s ease;
          padding: 0.5rem;
        }
        
        .toggle-link:hover {
          color: #6b46c1;
          text-decoration: underline;
        }
        
        /* Tablet responsiveness */
        @media (max-width: 1024px) {
          .auth-container {
            grid-template-columns: 1fr;
            max-width: 700px;
            gap: 2rem;
            margin: 2rem auto;
            min-height: auto;
          }
          
          .left-side,
          .right-side {
            min-height: 500px;
          }
        }
        
        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .auth-container {
            padding: 0 1rem;
            margin: 1rem auto;
          }
          
          .left-side {
            display: none; /* Hide features on mobile for cleaner UI */
          }
          
          .right-side {
            padding: 2rem 1.5rem;
          }
          
          .auth-title {
            font-size: 1.5rem;
          }
          
          .auth-subtitle {
            font-size: 1.1rem;
          }
          
          .form-row {
            grid-template-columns: 1fr;
          }
          
          .form-input {
            font-size: 1rem;
            padding: 0.75rem 1rem;
          }
          
          .submit-btn {
            padding: 0.75rem 1.5rem;
          }
        }
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