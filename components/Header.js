import { useState } from 'react';
import { useRouter } from 'next/router';
import { logOut } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

export default function Header() {
  const router = useRouter();
  const { firebaseUser: user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await logOut();
      router.push('/landing');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const isLandingPage = router.pathname === '/landing';
  const isAuthPage = router.pathname === '/login';

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo-section">
          <div onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
            <h1 className="logo">
              Socratic Learning ✨
            </h1>
            <p className="logo-subheader">
              <span className="gradient-text">Adaptive. Infinite. Personalized.</span>
            </p>
          </div>
        </div>
        
        <nav className="nav-section">
          {!user && !isAuthPage && (
            <>
              <button 
                className="btn btn-secondary"
                onClick={() => router.push('/login')}
              >
                Sign In
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => router.push('/login?signup=true')}
              >
                Get Started
              </button>
            </>
          )}
          
          {user && (
            <>
              <span className="user-email">{user.email}</span>
              <button 
                className="btn btn-secondary"
                onClick={handleSignOut}
                disabled={loading}
              >
                {loading ? 'Signing out...' : 'Sign Out'}
              </button>
            </>
          )}
        </nav>
      </div>

      <style jsx>{`
        .header {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--glass-border);
          position: sticky;
          top: 0;
          z-index: 1000;
          padding: 16px 0;
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          transition: transform 0.2s ease;
        }

        .logo-subheader {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin: 0;
          margin-top: -4px;
          letter-spacing: 0.05em;
        }

        .logo-section > div:hover .logo {
          transform: scale(1.05);
        }

        .gradient-text {
          background: linear-gradient(135deg, #00ff88, #0088ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 600;
        }

        .nav-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .user-email {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .btn {
          padding: 8px 20px;
          border-radius: 24px;
          font-weight: 500;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
          text-decoration: none;
          display: inline-block;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.3);
        }

        .btn-secondary {
          background: var(--glass-bg);
          color: var(--text-primary);
          border: 1px solid var(--glass-border);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--accent-neon);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .user-email {
            display: none;
          }
          
          .nav-section {
            gap: 8px;
          }
          
          .btn {
            padding: 6px 16px;
            font-size: 0.85rem;
          }
        }
      `}</style>
    </header>
  );
}