import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { signIn, signUp } from '../lib/firebase';
import { createUser } from '../lib/db';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const router = useRouter();
  const { authChecked, refreshUser } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [grade, setGrade] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    
    // Grade validation for student signup
    if (!isLogin && role === 'student' && !grade) {
      setError('Please select your grade');
      return;
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
        // Sign up with Firebase
        console.log('Signing up with Firebase...');
        authResult = await signUp(email, password);
        
        if (authResult.error) {
          throw new Error(authResult.error);
        }
        
        // Create user profile in Supabase
        if (authResult.user) {
          console.log('Creating user profile in Supabase...');
          const userProfile = await createUser(
            email, 
            authResult.user.uid, 
            role,
            role === 'student' ? parseInt(grade) : null
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
      router.replace('/');
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
        <meta name="description" content="Sign in to LearnAI to access unlimited dynamic questions for English and Math. Personalized AI-powered learning that adapts to your level." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="login-container">
      <div className="login-card">
        <h1 className="logo">Socratic Learning ✨</h1>
        <p className="tagline">Adaptive learning powered by AI</p>

        <form onSubmit={handleSubmit} className="login-form">
          <h2>{isLogin ? 'Welcome back!' : 'Create your account'}</h2>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

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

          {!isLogin && (
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
                <div className="form-group">
                  <label style={{ fontSize: '0.9rem', marginBottom: '8px', display: 'block', color: 'var(--text-secondary)' }}>
                    Select Your Grade
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="form-input"
                    style={{ cursor: 'pointer' }}
                    required
                  >
                    <option value="">Select your grade</option>
                    {[5, 6, 7, 8, 9, 10, 11].map(g => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
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
            {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="switch-mode">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="switch-btn"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, #2a1a4a 100%);
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 40px;
          animation: fadeIn 0.6s ease-out;
        }

        .logo {
          font-size: 2.5rem;
          font-weight: 800;
          background: linear-gradient(90deg, var(--accent-neon), var(--accent-blue));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-align: center;
          margin-bottom: 8px;
        }

        .tagline {
          color: var(--text-secondary);
          text-align: center;
          margin-bottom: 32px;
        }

        .login-form {
          margin-bottom: 24px;
        }

        .login-form h2 {
          font-size: 1.5rem;
          margin-bottom: 24px;
          text-align: center;
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
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: var(--text-primary);
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--accent-neon);
          box-shadow: 0 0 0 3px rgba(0, 255, 136, 0.1);
        }

        .form-input::placeholder {
          color: var(--text-secondary);
        }

        .submit-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, var(--accent-neon), var(--accent-blue));
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          font-size: 1rem;
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
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .checkbox-input {
          margin-right: 8px;
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--accent-neon);
        }

        .switch-mode {
          text-align: center;
          color: var(--text-secondary);
        }

        .switch-btn {
          background: none;
          border: none;
          color: var(--accent-neon);
          font-weight: 600;
          cursor: pointer;
          transition: color 0.3s ease;
        }

        .switch-btn:hover {
          color: var(--accent-blue);
        }

        .role-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 8px;
        }

        .role-card {
          padding: 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid var(--glass-border);
          border-radius: 12px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .role-card h3 {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0;
        }

        .role-card.active {
          border-color: var(--accent-neon);
          background: rgba(0, 255, 136, 0.1);
        }

        .role-card:hover {
          border-color: var(--accent-blue);
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
            padding: 30px 20px;
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
    </>
  );
}