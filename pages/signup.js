import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import HeaderSignup from '../components/Header_signup';
import Footer from '../components/Footer';

/**
 * Main signup landing page for EduApp
 * Provides user type selection and routing to appropriate auth flows
 * Implements glass morphism design with floating background elements
 */
export default function Signup() {
  const router = useRouter();
  const [selectedCard, setSelectedCard] = useState(null);

  /**
   * Handle card selection and navigation
   * @param {string} type - User type selected (studentParent or teacher)
   */
  const handleCardSelect = (type) => {
    setSelectedCard(type);
    
    // Navigate to appropriate auth flow after visual feedback
    setTimeout(() => {
      if (type === 'studentParent') {
        router.push('/auth/student-signup');
      } else if (type === 'teacher') {
        router.push('/auth/teacher-auth');
      }
    }, 300);
  };

  return (
    <>
      <Head>
        {/* SEO and bot-friendly meta tags */}
        <title>Sign Up - Socratic AI Tutor | Adaptive Learning Platform</title>
        <meta name="description" content="Join Socratic AI Tutor - Personalized adaptive learning for students grades 5-11. COPPA-compliant registration with parent oversight." />
        <meta name="keywords" content="adaptive learning, AI tutor, education platform, student learning, teacher tools, parent oversight" />
        <meta property="og:title" content="Sign Up - Socratic AI Tutor" />
        <meta property="og:description" content="Personalized AI-powered education for every student" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${process.env.NEXT_PUBLIC_BASE_URL}/signup`} />
        <meta name="robots" content="index, follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="canonical" href={`${process.env.NEXT_PUBLIC_BASE_URL}/signup`} />
      </Head>

      <div className="page-wrapper">
        <HeaderSignup />
        
        <div className="signup-container">
          <div className="container">
          {/* Page header with branding */}
          {/* Removed duplicate header - using Header component instead */}

          {/* User type selection cards */}
          <div className="user-selection">
            {/* Student & Parent card */}
            <div 
              className={`user-card student-parent-card ${selectedCard === 'studentParent' ? 'selected' : ''}`}
              onClick={() => handleCardSelect('studentParent')}
            >
              <div className="card-header">
                <div className="card-icon student-parent-icon">
                  <span className="glow-icon glow-english">👨‍👩‍👧‍👦</span>
                </div>
                <div>
                  <h2 className="card-title">Student & Parent</h2>
                  <p className="card-subtitle">Learning together, safely</p>
                </div>
              </div>
              <p className="card-description">
                Students start their learning journey while parents maintain full control and oversight. COPPA-compliant registration ensures safety and parental consent.
              </p>
              <div className="user-types">
                <span className="user-type-badge">Student</span>
                <span className="user-type-badge">Parent</span>
              </div>
              {/* Removed How it works text */}
            </div>

            {/* Teacher card */}
            <div 
              className={`user-card teacher-card ${selectedCard === 'teacher' ? 'selected' : ''}`}
              onClick={() => handleCardSelect('teacher')}
            >
              <div className="card-header">
                <div className="card-icon teacher-icon">
                  <span className="glow-icon glow-achievement">🎓</span>
                </div>
                <div>
                  <h2 className="card-title">Teacher</h2>
                  <p className="card-subtitle">Educator access</p>
                </div>
              </div>
              <p className="card-description">
                Direct access for educators to monitor student progress, assign learning paths, and access teaching resources.
              </p>
              <div className="user-types">
                <span className="user-type-badge">Educator</span>
              </div>
            </div>
          </div>
        </div>
      </div>
        
      <Footer />
      </div>

      <style jsx>{`
        /* Root variables to match index.js */
        :root {
          --bg-primary: #fdfcfa;
          --bg-secondary: #f9f7f4;
          --accent-primary: #5a67d8;
          --accent-secondary: #6b46c1;
          --text-primary: #1a1a1a;
          --text-secondary: #333333;
          --glass-bg: rgba(255, 255, 255, 0.7);
          --glass-border: rgba(0, 0, 0, 0.1);
        }
        
        /* Reset and base styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        /* Page wrapper with same background as index */
        .page-wrapper {
          min-height: 100vh;
          background: 
            radial-gradient(circle at 20% 50%, rgba(120, 119, 116, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(120, 119, 116, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(120, 119, 116, 0.01) 0%, transparent 50%),
            linear-gradient(135deg, #fdfcfa 0%, #f9f7f4 100%);
          position: relative;
          display: flex;
          flex-direction: column;
        }
        
        .page-wrapper::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: 
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 1px,
              rgba(0, 0, 0, 0.03) 1px,
              rgba(0, 0, 0, 0.03) 2px
            ),
            repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 1px,
              rgba(0, 0, 0, 0.02) 1px,
              rgba(0, 0, 0, 0.02) 2px
            ),
            radial-gradient(ellipse at top, transparent, rgba(0, 0, 0, 0.01));
          pointer-events: none;
          z-index: 1;
          opacity: 0.5;
          mix-blend-mode: multiply;
        }

        /* Main container */
        .signup-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          flex: 1;
          position: relative;
          overflow-x: hidden;
          padding: 2rem 0;
          z-index: 2;
          min-height: calc(100vh - 200px);
          display: flex;
          align-items: center;
        }

        /* Removed floating elements - using clean design */

        /* Content container */
        .container {
          width: 100%;
          margin: 0 auto;
          padding: 2rem 5%;
          position: relative;
          z-index: 10;
        }

        /* Header section */
        .header {
          text-align: center;
          margin-bottom: 3rem;
          padding-top: 2rem;
        }

        .logo {
          font-size: clamp(2.5rem, 5vw, 3.5rem);
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 1rem;
        }

        .subtitle {
          font-size: clamp(1.3rem, 3vw, 1.6rem);
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        .grade-info {
          font-size: clamp(1.2rem, 2.5vw, 1.4rem);
          color: var(--text-secondary);
          margin-bottom: 2rem;
        }

        /* User selection grid */
        .user-selection {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          margin: 4rem 0;
          width: 100%;
        }

        /* Responsive grid for mobile */
        @media (max-width: 768px) {
          .user-selection {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
        }

        /* User type cards with glass morphism */
        .user-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 25px;
          padding: 3rem;
          padding-bottom: 8rem;
          cursor: pointer;
          transition: all 0.4s ease;
          position: relative;
          overflow: hidden;
          min-height: 400px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
          display: flex;
          flex-direction: column;
        }

        /* Card hover effects */
        .user-card:hover {
          transform: translateY(-8px);
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
          border-color: rgba(0, 0, 0, 0.12);
        }

        /* Selected card state */
        .user-card.selected {
          background: rgba(255, 255, 255, 0.95);
          border-color: var(--accent-primary);
          box-shadow: 0 8px 32px rgba(90, 103, 216, 0.2);
          transform: translateY(-5px);
        }

        /* Student/Parent card specific styling */
        .student-parent-card {
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(0, 0, 0, 0.08);
        }

        .student-parent-card:hover {
          background: rgba(255, 255, 255, 0.9);
          border-color: rgba(52, 211, 153, 0.3);
        }

        .student-parent-card.selected {
          background: rgba(255, 255, 255, 0.95);
          border-color: rgba(52, 211, 153, 0.5);
          box-shadow: 0 8px 32px rgba(52, 211, 153, 0.15);
        }

        /* Teacher card specific styling */
        .teacher-card {
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(0, 0, 0, 0.08);
        }

        .teacher-card:hover {
          background: rgba(255, 255, 255, 0.9);
          border-color: rgba(147, 51, 234, 0.3);
        }

        .teacher-card.selected {
          background: rgba(255, 255, 255, 0.95);
          border-color: rgba(147, 51, 234, 0.5);
          box-shadow: 0 8px 32px rgba(147, 51, 234, 0.15);
        }

        /* Card header section */
        .card-header {
          display: flex;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        /* Card icon container */
        .card-icon {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 1.5rem;
          font-size: 2.5rem;
          position: relative;
        }

        /* Icon background colors */
        .student-parent-icon {
          background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
          box-shadow: 0 4px 20px rgba(90, 103, 216, 0.3);
        }

        .teacher-icon {
          background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
          box-shadow: 0 4px 20px rgba(90, 103, 216, 0.3);
        }

        /* Glow icon base styles */
        .glow-icon {
          filter: drop-shadow(0 0 8px currentColor);
          animation: pulse-glow 3s ease-in-out infinite;
        }

        /* Subject-specific glow colors */
        .glow-english {
          color: #10b981;
          filter: drop-shadow(0 0 12px #10b981);
        }

        .glow-achievement {
          color: #f59e0b;
          filter: drop-shadow(0 0 12px #f59e0b);
        }

        /* Glow pulse animation */
        @keyframes pulse-glow {
          0%, 100% { filter: drop-shadow(0 0 8px currentColor); }
          50% { filter: drop-shadow(0 0 16px currentColor); }
        }

        /* Card text content */
        .card-title {
          font-size: clamp(2.5rem, 4vw, 3rem);
          font-weight: 700;
          color: #1a1a1a !important;
          margin-bottom: 0.5rem;
        }

        .card-subtitle {
          font-size: clamp(1.4rem, 2.5vw, 1.6rem);
          color: #1a1a1a !important;
        }

        .card-description {
          font-size: clamp(1.3rem, 2.5vw, 1.5rem);
          color: #1a1a1a !important;
          line-height: 1.7;
          margin-bottom: 1.5rem;
        }

        /* User type badges */
        .user-types {
          display: flex;
          gap: 1.5rem;
          margin-top: auto;
          justify-content: center;
          align-items: center;
          position: absolute;
          bottom: 3rem;
          left: 3rem;
          right: 3rem;
        }

        .user-type-badge {
          background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
          color: white !important;
          padding: 1.8rem 2rem;
          border: none;
          border-radius: 30px;
          font-size: 2.5rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          box-shadow: 0 4px 20px rgba(90, 103, 216, 0.4);
          text-align: center;
          width: 280px;
          max-width: 100%;
        }
        
        .user-type-badge:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 25px rgba(90, 103, 216, 0.6);
        }

        /* Info box for additional information */
        .info-box {
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          padding: 1.5rem;
          margin: 1rem 0;
        }

        .info-text {
          color: var(--text-secondary);
          font-size: clamp(1.2rem, 2vw, 1.4rem);
          line-height: 1.7;
        }

        /* Mobile optimizations */
        @media (max-width: 768px) {
          .container {
            padding: 1rem;
          }

          .user-card {
            padding: 2rem;
            min-height: auto;
          }

          .card-header {
            flex-direction: column;
            text-align: center;
          }

          .card-icon {
            margin-right: 0;
            margin-bottom: 1rem;
          }

          .user-types {
            flex-direction: column;
          }

          .user-type-badge {
            width: 220px;
            font-size: 2rem;
            padding: 1.5rem 1rem;
          }
        }
      `}</style>
    </>
  );
}