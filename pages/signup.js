import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

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

      <div className="signup-container">
        {/* Floating background elements for visual depth */}
        <div className="bg-element"></div>
        <div className="bg-element"></div>
        <div className="bg-element"></div>
        <div className="bg-element"></div>

        <div className="container">
          {/* Page header with branding */}
          <div className="header">
            <h1 className="logo">Socratic AI Tutor</h1>
            <p className="subtitle">Personalized Learning That Adapts to You</p>
            <p className="grade-info">For Students in Grades 5-11</p>
          </div>

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
              <div className="info-box">
                <p className="info-text">
                  <strong>How it works:</strong> Student provides name & grade → Parent receives email → Parent verifies with $1 payment → Student gets secure passcode
                </p>
              </div>
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

      <style jsx>{`
        /* Reset and base styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        /* Main container with gradient background */
        .signup-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: linear-gradient(135deg, #374151 0%, #1f2937 100%);
          min-height: calc(100vh - 140px); /* Account for header and footer */
          position: relative;
          overflow-x: hidden;
          padding: 2rem 0;
        }

        /* Floating background elements for depth */
        .bg-element {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 70%, transparent 100%);
          animation: float 8s ease-in-out infinite;
          pointer-events: none;
        }

        /* Individual background element positioning */
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

        /* Floating animation for background elements */
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }

        /* Content container */
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1rem;
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
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 700;
          color: white;
          margin-bottom: 1rem;
          text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .subtitle {
          font-size: clamp(1.1rem, 3vw, 1.3rem);
          color: rgba(255,255,255,0.9);
          margin-bottom: 0.5rem;
        }

        .grade-info {
          font-size: clamp(1rem, 2.5vw, 1.1rem);
          color: rgba(255,255,255,0.8);
          margin-bottom: 2rem;
        }

        /* User selection grid */
        .user-selection {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 3rem;
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
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
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(20px);
          border: 2px solid rgba(255, 255, 255, 0.15);
          border-radius: 24px;
          padding: 2.5rem;
          cursor: pointer;
          transition: all 0.4s ease;
          position: relative;
          overflow: hidden;
          min-height: 320px;
        }

        /* Card hover effects */
        .user-card:hover {
          transform: translateY(-8px);
          background: rgba(255, 255, 255, 0.18);
          box-shadow: 0 25px 50px rgba(0,0,0,0.2);
          border-color: rgba(255, 255, 255, 0.25);
        }

        /* Selected card state */
        .user-card.selected {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.4);
          box-shadow: 0 0 30px rgba(255, 255, 255, 0.1);
          transform: translateY(-5px);
        }

        /* Student/Parent card specific styling */
        .student-parent-card {
          background: rgba(52, 211, 153, 0.12);
          border: 2px solid rgba(52, 211, 153, 0.25);
        }

        .student-parent-card:hover {
          background: rgba(52, 211, 153, 0.18);
          border-color: rgba(52, 211, 153, 0.4);
        }

        .student-parent-card.selected {
          background: rgba(52, 211, 153, 0.25);
          border-color: rgba(52, 211, 153, 0.6);
          box-shadow: 0 0 40px rgba(52, 211, 153, 0.3);
        }

        /* Teacher card specific styling */
        .teacher-card {
          background: rgba(147, 51, 234, 0.12);
          border: 2px solid rgba(147, 51, 234, 0.25);
        }

        .teacher-card:hover {
          background: rgba(147, 51, 234, 0.18);
          border-color: rgba(147, 51, 234, 0.4);
        }

        .teacher-card.selected {
          background: rgba(147, 51, 234, 0.25);
          border-color: rgba(147, 51, 234, 0.6);
          box-shadow: 0 0 40px rgba(147, 51, 234, 0.3);
        }

        /* Card header section */
        .card-header {
          display: flex;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        /* Card icon container */
        .card-icon {
          width: 60px;
          height: 60px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 1rem;
          font-size: 1.8rem;
          position: relative;
        }

        /* Icon background colors */
        .student-parent-icon {
          background: rgba(52, 211, 153, 0.2);
        }

        .teacher-icon {
          background: rgba(147, 51, 234, 0.2);
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
          font-size: clamp(1.8rem, 4vw, 2.2rem);
          font-weight: 700;
          color: white;
          margin-bottom: 0.5rem;
        }

        .card-subtitle {
          font-size: clamp(1.2rem, 2.5vw, 1.4rem);
          color: rgba(255,255,255,0.9);
        }

        .card-description {
          font-size: clamp(1.1rem, 2.5vw, 1.3rem);
          color: white;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        /* User type badges */
        .user-types {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          justify-content: center;
        }

        .user-type-badge {
          background: rgba(255,255,255,0.15);
          padding: 1rem 2rem;
          border-radius: 12px;
          font-size: clamp(1.1rem, 2vw, 1.3rem);
          font-weight: 600;
          color: white;
          border: 1px solid rgba(255,255,255,0.2);
          flex: 1;
          text-align: center;
          min-width: 120px;
        }

        /* Info box for additional information */
        .info-box {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 12px;
          padding: 1rem;
          margin: 1rem 0;
        }

        .info-text {
          color: white;
          font-size: clamp(1rem, 2vw, 1.2rem);
          line-height: 1.6;
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
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}