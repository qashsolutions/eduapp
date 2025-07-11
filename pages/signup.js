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
                  <svg width="60" height="60" viewBox="0 0 24 24" className="family-icon">
                    <path d="M16 4C17.11 4 18 4.89 18 6C18 7.11 17.11 8 16 8C14.89 8 14 7.11 14 6C14 4.89 14.89 4 16 4M8 4C9.11 4 10 4.89 10 6C10 7.11 9.11 8 8 8C6.89 8 6 7.11 6 6C6 4.89 6.89 4 8 4M16 10C18.67 10 24 11.33 24 14V16H16V14C16 13.5 15.89 13 15.71 12.5C14.53 11.5 12.92 10.76 11.25 10.36C12.5 10.13 14.03 10 16 10M8 10C10.67 10 16 11.33 16 14V16H0V14C0 11.33 5.33 10 8 10M8 18C6.89 18 6 18.89 6 20C6 21.11 6.89 22 8 22C9.11 22 10 21.11 10 20C10 18.89 9.11 18 8 18M16 18C14.89 18 14 18.89 14 20C14 21.11 14.89 22 16 22C17.11 22 18 21.11 18 20C18 18.89 17.11 18 16 18Z"/>
                  </svg>
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
                  <svg width="60" height="60" viewBox="0 0 24 24" className="grad-cap-icon">
                    <path d="M12,3L1,9L12,15L21,9V16H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z"/>
                  </svg>
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
        /* Page wrapper to match teacher-auth sandy white theme */
        .page-wrapper {
          min-height: 100vh;
          background: linear-gradient(135deg, #f9f7f2 0%, #f0ebe0 100%);
          position: relative;
          display: flex;
          flex-direction: column;
          color: #2d3748;
        }

        /* Main container */
        .signup-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 5%;
          margin: 1rem 0;
        }

        /* Content container */
        .container {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          min-height: calc(100vh - 250px);
        }

        /* Remove header section - not needed with new layout */

        /* User selection - full container grid layout */
        .user-selection {
          display: contents; /* Use CSS Grid from parent */
        }

        /* User type cards - matching teacher-auth style */
        .user-card {
          background: white;
          padding: 3rem 4rem;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.4s ease;
          position: relative;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          min-height: 550px;
        }

        /* Card hover effects */
        .user-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
        }

        /* Selected card state */
        .user-card.selected {
          transform: translateY(-3px);
          box-shadow: 0 6px 16px rgba(90, 103, 216, 0.15);
        }

        /* Card header section */
        .card-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 2rem;
        }

        /* Card icon container */
        .card-icon {
          width: 120px;
          height: 120px;
          border-radius: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2rem;
          font-size: 3.5rem;
          position: relative;
          background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
          box-shadow: 0 4px 20px rgba(90, 103, 216, 0.3);
        }

        /* SVG icon styling */
        .grad-cap-icon,
        .family-icon {
          fill: white;
        }
        
        /* Glow icon base styles */
        .glow-icon {
          filter: drop-shadow(0 0 8px currentColor);
          animation: pulse-glow 3s ease-in-out infinite;
        }

        /* Subject-specific glow colors */
        .glow-english {
          color: white;
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
          font-size: 2rem;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 0.5rem;
        }

        .card-subtitle {
          font-size: 1.3rem;
          color: #4a5568;
          margin-bottom: 2rem;
        }

        .card-description {
          font-size: 1.15rem;
          color: #4a5568;
          line-height: 1.6;
          margin-bottom: 3rem;
          max-width: 500px;
        }

        /* User type badges */
        .user-types {
          display: flex;
          gap: 1.5rem;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
        }

        .user-type-badge {
          background: white;
          color: #2d3748;
          padding: 1.25rem 2.5rem;
          border: 1px solid #cbd5e0;
          border-radius: 8px;
          font-size: 1.2rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          min-width: 200px;
          text-align: center;
        }
        
        .user-type-badge:hover {
          background: #5a67d8;
          color: white;
          border-color: #5a67d8;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(90, 103, 216, 0.3);
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

        /* Tablet responsiveness */
        @media (max-width: 1200px) {
          .container {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
        }

        /* Mobile optimizations */
        @media (max-width: 768px) {
          .signup-container {
            padding: 0 2%;
          }

          .user-card {
            padding: 2rem 1.5rem;
            min-height: auto;
          }

          .card-icon {
            width: 80px;
            height: 80px;
            font-size: 2.5rem;
            margin-bottom: 1.5rem;
          }

          .card-title {
            font-size: 1.5rem;
          }

          .card-subtitle {
            font-size: 1.1rem;
          }

          .card-description {
            font-size: 1rem;
          }

          .user-types {
            flex-direction: column;
            gap: 1rem;
          }

          .user-type-badge {
            min-width: 100%;
            font-size: 1.1rem;
            padding: 1rem 2rem;
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