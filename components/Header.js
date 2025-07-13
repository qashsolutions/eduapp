import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/AuthContext';

export default function Header() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(null);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      router.push('/landing');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const isLandingPage = router.pathname === '/landing';
  const isAuthPage = router.pathname.startsWith('/auth/') || router.pathname === '/signup';
  
  // Calculate trial days left or show pending status
  useEffect(() => {
    if (user?.account_type === 'pending') {
      setTrialDaysLeft('pending');
    } else if (user?.trial_started_at && user?.account_type === 'trial') {
      const trialStart = new Date(user.trial_started_at);
      const now = new Date();
      const daysUsed = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
      const daysLeft = Math.max(0, 15 - daysUsed);
      setTrialDaysLeft(daysLeft);
    }
  }, [user]);

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo-section">
          <div onClick={() => router.push(user ? '/dashboard' : '/')} style={{ cursor: 'pointer' }}>
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
            <button 
              className="btn btn-primary"
              onClick={() => router.push('/signup')}
            >
              Sign In
            </button>
          )}
          
          {user && (
            <>
              <div className="user-info">
                <span className="user-email">
                  {(() => {
                    if (user.role === 'student') {
                      // If we have first_name and it doesn't look like an email
                      if (user.first_name && !user.first_name.includes('@')) {
                        return user.first_name;
                      }
                      // Otherwise extract from email
                      return user.email.split('_')[0];
                    }
                    return user.email;
                  })()}
                </span>
                {trialDaysLeft === 'pending' && (
                  <span className="pending-badge">
                    Pending
                  </span>
                )}
                {typeof trialDaysLeft === 'number' && (
                  <span className="trial-badge">
                    Trial: Day {15 - trialDaysLeft} of 15
                  </span>
                )}
              </div>
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
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          position: sticky;
          top: 0;
          z-index: 1000;
          padding: 20px 0;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        }

        .header-container {
          width: 100%;
          margin: 0 auto;
          padding: 0 5%;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo {
          font-size: 2.2rem !important;
          font-weight: 800;
          color: #2d3748 !important;
          margin: 0;
          transition: transform 0.2s ease;
        }

        .logo-subheader {
          font-size: 1.1rem !important;
          color: #4a5568 !important;
          margin: 0;
          margin-top: -4px;
          letter-spacing: 0.05em;
          font-weight: 600;
          opacity: 1;
        }

        .logo-section > div:hover .logo {
          transform: scale(1.05);
        }

        .gradient-text {
          background: linear-gradient(135deg, #5a67d8, #6b46c1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 700;
          font-size: 1rem;
        }

        .nav-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .user-email {
          color: #4a5568;
          font-size: 1rem;
          font-weight: 600;
        }
        
        .trial-badge {
          background: linear-gradient(135deg, #ffd700, #ff8c00);
          color: #000;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 600;
          animation: pulse 2s ease-in-out infinite;
        }
        
        .pending-badge {
          background: linear-gradient(135deg, #ff6b6b, #ee5a6f);
          color: #fff;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 600;
          animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .btn {
          padding: 10px 24px;
          border-radius: 24px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
          text-decoration: none;
          display: inline-block;
        }

        .btn-primary {
          background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
          color: white;
          padding: 1rem 2.5rem;
          border: none;
          border-radius: 25px;
          font-size: 1.2rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          box-shadow: 0 4px 20px rgba(90, 103, 216, 0.4);
        }

        .btn-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 25px rgba(90, 103, 216, 0.6);
        }

        .btn-secondary {
          background: rgba(0, 0, 0, 0.05);
          color: #4a5568;
          border: 1px solid rgba(0, 0, 0, 0.1);
          font-weight: 600;
        }

        .btn-secondary:hover {
          background: rgba(0, 0, 0, 0.08);
          border-color: rgba(0, 0, 0, 0.2);
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