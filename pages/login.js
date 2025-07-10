import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { signIn, signUp } from '../lib/firebase';
import { createUser } from '../lib/db';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const router = useRouter();
  const { authChecked, refreshUser } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [role, setRole] = useState('student');
  const [grade, setGrade] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isParentSignup, setIsParentSignup] = useState(false);
  const [parentEmail, setParentEmail] = useState('');
  const [isStudentLogin, setIsStudentLogin] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent submission if already loading
    if (loading) {
      console.log('Already processing auth, ignoring submission');
      return;
    }
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    // Student login validation
    if (isStudentLogin) {
      if (!firstName || !passcode) {
        setError('Please enter your first name and passcode');
        return;
      }
      // Handle student login with passcode
      try {
        const response = await fetch('/api/student-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstName, passcode })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        
        // Sign in with Firebase using the returned credentials
        const authResult = await signIn(data.email, data.tempPassword);
        if (authResult.error) throw new Error(authResult.error);
        
        localStorage.setItem('userId', authResult.user.uid);
        await refreshUser();
        router.replace('/');
        return;
      } catch (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }
    
    // Student signup validation
    if (!isLogin && role === 'student' && !isParentSignup) {
      if (!firstName || !grade || !parentEmail) {
        setError('Please fill in all fields');
        return;
      }
    }
    
    setError('');
    setLoading(true);

    console.log('Auth submission:', { isLogin, email, role, grade });

    try {
      let authResult;
      
      if (isLogin) {
        // Sign in with Firebase
        console.log('Signing in with Firebase...');
        authResult = await signIn(email, password);
        
        if (authResult.error) {
          throw new Error(authResult.error);
        }
      } else {
        // For student signup, just store parent consent request
        if (!isLogin && role === 'student' && !isParentSignup) {
          // Send parent consent email
          const response = await fetch('/api/send-parent-consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              childFirstName: firstName,
              childGrade: parseInt(grade),
              parentEmail: parentEmail
            })
          });
          
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to send parent consent email');
          }
          
          // Show success message
          setError('');
          alert('Success! We\'ve sent an email to your parent/guardian for approval.');
          setIsLogin(true);
          return;
        }
        
        // Sign up with Firebase (for parents/teachers only)
        console.log('Signing up with Firebase...');
        authResult = await signUp(email, password);
        
        if (authResult.error) {
          throw new Error(authResult.error);
        }
        
        // Create user profile in Supabase for parents/teachers
        if (authResult.user && (isParentSignup || role === 'teacher')) {
          console.log('Creating user profile in Supabase...');
          const userProfile = await createUser(
            email, 
            authResult.user.uid, 
            isParentSignup ? 'parent' : role,
            null,
            isParentSignup ? true : false
          );
          
          if (!userProfile) {
            console.error('Failed to create user profile in Supabase');
            // Continue anyway - user can still use the app
          } else {
            console.log('User profile created successfully');
          }
        }
      }

      // Store user ID in localStorage for quick access
      if (authResult.user) {
        localStorage.setItem('userId', authResult.user.uid);
        console.log('User authenticated:', authResult.user.uid);
      }
      
      // Refresh user data in context and redirect
      console.log('Auth complete, refreshing user data...');
      await refreshUser();
      
      // Redirect parents to add children page
      if (isParentSignup) {
        router.replace('/parent-dashboard');
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth state
  if (!authChecked) {
    return (
      <div className="login-container">
        <div className="loading-text">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Socratic Learning - Login | Learn English & Math, Unlimited Dynamic Questions</title>
        <meta name="description" content="Sign in to Socratic Learning to access unlimited dynamic questions for English and Math. Personalized AI-powered learning that adapts to your level." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="page-wrapper">
        <Header />
        <div className="login-container">
          {/* Floating radial gradients */}
          <div className="gradient-orbs">
            <div className="orb orb-1"></div>
            <div className="orb orb-2"></div>
            <div className="orb orb-3"></div>
            <div className="orb orb-4"></div>
          </div>
      <div className="login-card">
        <p className="tagline">Adaptive learning powered by AI</p>

        <form onSubmit={handleSubmit} className="login-form">
          <h2>
            {isStudentLogin ? 'Student Login' : 
             isLogin ? 'Parent/Teacher Login' : 
             (isParentSignup ? 'Parent Account Setup' : 'Student Registration')}
          </h2>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {isStudentLogin ? (
            <>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Your First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <input
                  type="password"
                  placeholder="Your Passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  required
                  className="form-input"
                />
              </div>
            </>
          ) : (
            <>
              {!isLogin && role === 'student' && !isParentSignup ? (
                <>
                  <div className="form-group">
                    <input
                      type="text"
                      placeholder="Student's First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="form-input"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="form-input"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {!isLogin && !isParentSignup && (
            <>
              <div className="form-group">
                <div className="role-selector">
                  <div
                    className={`role-card ${role === 'student' ? 'active' : ''}`}
                    onClick={() => setRole('student')}
                  >
                    <h3>Student</h3>
                  </div>
                  <div
                    className={`role-card ${role === 'teacher' ? 'active' : ''}`}
                    onClick={() => setRole('teacher')}
                  >
                    <h3>Teacher</h3>
                  </div>
                </div>
              </div>

              {role === 'student' && (
                <>
                  <div className="form-group">
                    <label style={{ fontSize: '1.125rem', marginBottom: '12px', display: 'block', color: '#ffffff' }}>
                      Select Grade Level
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="form-input"
                      style={{ cursor: 'pointer' }}
                      required
                    >
                      <option value="">Select grade</option>
                      {[5, 6, 7, 8, 9, 10, 11].map(g => (
                        <option key={g} value={g}>Grade {g}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="coppa-notice">
                    <h3>Parent/Guardian Email Required</h3>
                    <p>We'll send your parent an email to set up your account.</p>
                  </div>
                  
                  <div className="form-group">
                    <input
                      type="email"
                      placeholder="Parent/Guardian Email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      required
                      className="form-input"
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="form-group remember-me">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="checkbox-input"
              />
              <span>Remember me</span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="submit-btn"
          >
            {loading ? 'Loading...' : 
             (isStudentLogin ? 'Login' :
              isLogin ? 'Sign In' : 
              (role === 'student' && !isParentSignup ? 'Send Parent Request' : 'Create Account'))}
          </button>
        </form>

        {!isStudentLogin && (
          <>
            <button 
              onClick={() => {
                setIsLogin(!isLogin);
                setIsParentSignup(false);
                setRole('student');
              }}
              className="switch-btn-full"
            >
              {isLogin ? 'Student Registration' : 'Parent/Teacher Sign In'}
            </button>
            
            {isLogin && (
              <button 
                onClick={() => {
                  setIsLogin(false);
                  setIsParentSignup(true);
                  setRole('parent');
                }}
                className="parent-signup-btn"
              >
                I'm a Parent - Sign Up Here
              </button>
            )}
          </>
        )}
        
        <button 
          onClick={() => {
            setIsStudentLogin(!isStudentLogin);
            setIsLogin(true);
            setError('');
          }}
          className="student-login-btn"
        >
          {isStudentLogin ? 'Back to Parent/Teacher Login' : 'Student Login →'}
        </button>
      </div>

      <style jsx>{`
        .page-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, #2a1a4a 100%);
          position: relative;
          overflow: hidden;
        }
        
        /* Floating radial gradients */
        .gradient-orbs {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 0;
        }
        
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.6;
          animation: float-orb 20s infinite ease-in-out;
        }
        
        .orb-1 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle at center, var(--accent-neon), transparent);
          top: -200px;
          left: -200px;
          animation-duration: 25s;
        }
        
        .orb-2 {
          width: 300px;
          height: 300px;
          background: radial-gradient(circle at center, var(--accent-blue), transparent);
          bottom: -150px;
          right: -150px;
          animation-duration: 30s;
          animation-delay: -5s;
        }
        
        .orb-3 {
          width: 350px;
          height: 350px;
          background: radial-gradient(circle at center, #ff6b9d, transparent);
          top: 50%;
          left: -175px;
          animation-duration: 35s;
          animation-delay: -10s;
        }
        
        .orb-4 {
          width: 250px;
          height: 250px;
          background: radial-gradient(circle at center, #feca57, transparent);
          top: 20%;
          right: -125px;
          animation-duration: 20s;
          animation-delay: -15s;
        }
        
        @keyframes float-orb {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
          33% {
            transform: translate(50px, -50px) rotate(120deg) scale(1.1);
          }
          66% {
            transform: translate(-30px, 30px) rotate(240deg) scale(0.9);
          }
        }

        .login-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          min-height: calc(100vh - 160px); /* Ensures footer stays at bottom */
          position: relative;
          z-index: 1;
        }

        .login-card {
          width: 100%;
          max-width: 480px;
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 48px;
          animation: fadeIn 0.6s ease-out;
        }

        .tagline {
          color: #ffffff;
          text-align: center;
          margin-bottom: 32px;
          font-size: 1.5rem;
          font-weight: 400;
          letter-spacing: 0.5px;
        }

        .login-form {
          margin-bottom: 24px;
        }

        .login-form h2 {
          font-size: 1.75rem;
          margin-bottom: 32px;
          text-align: center;
          color: #ffffff;
        }

        .error-message {
          background: rgba(255, 71, 87, 0.1);
          border: 1px solid rgba(255, 71, 87, 0.3);
          color: #ff4757;
          padding: 12px;
          border-radius: 12px;
          margin-bottom: 20px;
          font-size: 0.9rem;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-input {
          width: 100%;
          padding: 20px 24px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: #ffffff;
          font-size: 1.25rem;
          font-weight: 400;
          transition: all 0.3s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--accent-neon);
          box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.1);
        }

        .form-input::placeholder {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 300;
        }
        
        /* Style select dropdown */
        select.form-input {
          color: #ffffff;
          cursor: pointer;
        }
        
        select.form-input option {
          color: #000000;
          background: #ffffff;
        }

        .submit-btn {
          width: 100%;
          padding: 20px;
          background: linear-gradient(135deg, var(--accent-neon), var(--accent-blue));
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          font-size: 1.25rem;
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

        .remember-me {
          margin-top: 16px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          font-size: 1rem;
          color: #ffffff;
        }

        .checkbox-input {
          margin-right: 10px;
          width: 20px;
          height: 20px;
          cursor: pointer;
          accent-color: var(--accent-neon);
        }

        .switch-btn-full {
          width: 100%;
          padding: 20px;
          background: linear-gradient(135deg, var(--accent-neon), var(--accent-blue));
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          font-size: 1.25rem;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 20px;
        }

        .switch-btn-full:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.4);
        }
        
        .switch-btn-full:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none !important;
        }

        .role-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 8px;
        }

        .role-card {
          padding: 24px;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid var(--glass-border);
          border-radius: 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .role-card h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0;
          color: #ffffff;
        }

        .role-card.active {
          border-color: var(--accent-neon);
          background: rgba(0, 255, 136, 0.1);
        }

        .role-card:hover {
          border-color: var(--accent-blue);
        }
        
        .coppa-notice {
          background: rgba(255, 204, 0, 0.1);
          border: 1px solid rgba(255, 204, 0, 0.3);
          border-radius: 12px;
          padding: 16px;
          margin: 20px 0;
        }
        
        .coppa-notice h3 {
          color: #ffcc00;
          font-size: 1.1rem;
          margin-bottom: 8px;
        }
        
        .coppa-notice p {
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.9rem;
          line-height: 1.5;
        }
        
        .parent-signup-btn {
          width: 100%;
          padding: 16px;
          background: transparent;
          border: 2px solid var(--accent-neon);
          border-radius: 12px;
          color: var(--accent-neon);
          font-weight: 600;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 16px;
        }
        
        .parent-signup-btn:hover {
          background: rgba(0, 255, 136, 0.1);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 255, 136, 0.3);
        }
        
        .student-login-btn {
          width: 100%;
          padding: 16px;
          background: transparent;
          border: 2px solid var(--accent-blue);
          border-radius: 12px;
          color: var(--accent-blue);
          font-weight: 600;
          font-size: 1.1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 16px;
        }
        
        .student-login-btn:hover {
          background: rgba(0, 127, 255, 0.1);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0, 127, 255, 0.3);
        }

        @keyframes fadeIn {
          from { 
            opacity: 0; 
            transform: translateY(20px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }

        .loading-text {
          color: var(--accent-neon);
          font-size: 1.2rem;
          text-align: center;
          animation: pulse 2s ease-in-out infinite;
        }

        @media (max-width: 768px) {
          .login-card {
            padding: 32px 24px;
            max-width: 100%;
          }
          
          .form-input {
            font-size: 1rem;
            padding: 16px;
          }
          
          .submit-btn {
            font-size: 1rem;
          }
        }
      `}</style>

      <style jsx global>{`
        :root {
          --bg-primary: #0a0a0f;
          --bg-secondary: #1a1a2e;
          --accent-neon: #00ff88;
          --accent-blue: #007fff;
          --glass-bg: rgba(255, 255, 255, 0.1);
          --glass-border: rgba(255, 255, 255, 0.2);
          --text-primary: #ffffff;
          --text-secondary: #b0b0b0;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: var(--bg-primary);
          color: var(--text-primary);
        }
      `}</style>
        </div>
        <Footer />
      </div>
    </>
  );
}