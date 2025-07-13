import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MoodSelector from '../components/MoodSelector';
import ProgressBar from '../components/ProgressBar';
import QuestionCard from '../components/QuestionCard';
import { useAuth } from '../lib/AuthContext';
import { getUser, getSessionStats } from '../lib/db';
import { MOOD_TOPICS, formatTopicName, getCachedProficiency } from '../lib/utils';
import { retrieveSessionData, storeSessionData, checkSessionExpiry } from '../lib/studentSession';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated, getSession } = useAuth();
  const [selectedMood, setSelectedMood] = useState('creative');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sessionStats, setSessionStats] = useState({ totalQuestions: 0, correctAnswers: 0 });
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      // Load session stats when user is available
      getSessionStats(user.id).then(stats => {
        setSessionStats(stats);
      }).catch(error => {
        console.error('Error loading session stats:', error);
      });
      
      // Check session expiry for students
      if (user.role === 'student') {
        const studentData = retrieveSessionData();
        if (studentData && studentData.expiresAt) {
          const expiryStatus = checkSessionExpiry(studentData.expiresAt);
          
          // Refresh session if less than 2 days until expiry
          if (expiryStatus.shouldRefresh) {
            fetch('/api/refresh-student-session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Student ${studentData.sessionToken}`
              }
            })
            .then(res => res.json())
            .then(result => {
              if (result.success) {
                // Update stored session with new expiry
                const updatedData = { ...studentData, expiresAt: result.expiresAt };
                const keepSignedIn = localStorage.getItem('studentData') !== null;
                storeSessionData(updatedData, keepSignedIn);
              }
            })
            .catch(err => console.error('Failed to refresh session:', err));
          }
          
          // Show warning if less than 5 minutes until expiry
          if (expiryStatus.isExpiring) {
            setShowExpiryWarning(true);
          }
        }
      }
    }
  }, [user, authLoading, isAuthenticated]);

  const handleTopicSelect = async (topic) => {
    if (!user || !user.id) {
      console.error('No user data available');
      setGenerating(false);
      return;
    }
    
    // Check if account is pending parent approval
    if (user.account_type === 'pending') {
      alert('Your account is pending parent approval. Please ask your parent to check their email.');
      setGenerating(false);
      return;
    }
    
    setSelectedTopic(topic);
    setGenerating(true);

    try {
      // Get appropriate auth token
      let authHeader = '';
      if (user.role === 'student') {
        // Get student session token from storage
        const studentData = retrieveSessionData();
        if (studentData) {
          const { sessionToken } = studentData;
          authHeader = `Student ${sessionToken}`;
        }
      } else {
        // Get Supabase session token for parents/teachers
        const session = await getSession();
        if (session?.access_token) {
          authHeader = `Bearer ${session.access_token}`;
        }
      }
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          action: 'generate',
          userId: user.id,
          topic: topic,
          mood: selectedMood
        })
      });

      const data = await response.json();
      if (response.ok) {
        setCurrentQuestion({
          ...data.question,
          topic: topic,
          difficulty: data.difficulty,
          proficiency: data.currentProficiency
        });
      }
    } catch (error) {
      console.error('Error generating question:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleAnswer = async (correct, timeSpent, hintsUsed, selectedAnswer) => {
    try {
      // Get appropriate auth token (same logic as handleTopicSelect)
      let authHeader = '';
      if (user.role === 'student') {
        const studentData = retrieveSessionData();
        if (studentData) {
          const { sessionToken } = studentData;
          authHeader = `Student ${sessionToken}`;
        }
      } else {
        const session = await getSession();
        if (session?.access_token) {
          authHeader = `Bearer ${session.access_token}`;
        }
      }
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          action: 'submit',
          userId: user.id,
          topic: selectedTopic,
          answer: selectedAnswer,
          correct: correct,
          timeSpent: timeSpent,
          hintsUsed: hintsUsed,
          questionHash: currentQuestion?.questionHash || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update local user state with new proficiency
        setUser(prev => ({
          ...prev,
          [selectedTopic]: data.newProficiency
        }));

        // Update session stats
        setSessionStats(prev => ({
          totalQuestions: prev.totalQuestions + 1,
          correctAnswers: prev.correctAnswers + (correct ? 1 : 0)
        }));
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  };

  const handleNext = () => {
    // Clear current question before fetching new one
    setCurrentQuestion(null);
    // Small delay to ensure state update
    setTimeout(() => {
      handleTopicSelect(selectedTopic);
    }, 50);
  };

  const handleBack = () => {
    setSelectedTopic(null);
    setCurrentQuestion(null);
  };

  const getAvailableTopics = () => {
    return MOOD_TOPICS[selectedMood] || [];
  };

  const getProficiency = (topic) => {
    // Check cache first
    const cached = getCachedProficiency(topic);
    if (cached !== null) return cached;
    
    // Fall back to user data
    return user?.[topic] || 5;
  };

  if (authLoading || loading) {
    return (
      <div className="loading-container">
        <div className="logo">Socratic Learning ✨</div>
        <div className="loading-text">Loading your learning journey...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Socratic Learning - Learn English & Math, Unlimited Dynamic Questions</title>
        <meta charSet="utf-8" />
        <meta name="description" content="Learn English & Math, unlimited dynamic questions. AI-powered adaptive learning that adjusts to your skill level. Personalized education for grades 5-11." />
        <meta name="keywords" content="learn English, learn Math, unlimited questions, dynamic questions, adaptive learning, AI education, personalized tutoring" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="theme-color" content="#f7f5f3" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://learnai.com/" />
        <meta property="og:title" content="LearnAI - Learn English & Math, Unlimited Dynamic Questions" />
        <meta property="og:description" content="Learn English & Math with unlimited AI-generated questions that adapt to your level. Perfect for students grades 5-11." />
        <meta property="og:image" content="https://learnai.com/og-image.png" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://learnai.com/" />
        <meta property="twitter:title" content="LearnAI - Learn English & Math, Unlimited Dynamic Questions" />
        <meta property="twitter:description" content="Learn English & Math with unlimited AI-generated questions. Adaptive learning for grades 5-11." />
        <meta property="twitter:image" content="https://learnai.com/twitter-image.png" />
        
        {/* Additional SEO */}
        <link rel="canonical" href="https://learnai.com/" />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="LearnAI" />
        
        {/* JSON-LD Structured Data */}
        <script 
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EducationalApplication",
            "name": "LearnAI",
            "description": "Learn English & Math with unlimited dynamic questions",
            "url": "https://learnai.com",
            "applicationCategory": "EducationalApplication",
            "operatingSystem": "Web",
            "offers": [{
              "@type": "Offer",
              "name": "Student Plan",
              "price": "70",
              "priceCurrency": "USD",
              "priceSpecification": {
                "@type": "UnitPriceSpecification",
                "price": "70",
                "priceCurrency": "USD",
                "unitText": "YEAR"
              }
            }],
            "featureList": [
              "Adaptive Learning",
              "13 Topics",
              "Unlimited Questions", 
              "AI-Powered",
              "Grades 5-11"
            ],
            "screenshot": "https://learnai.com/screenshot.png",
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "ratingCount": "1250"
            }
          })}}
        />
      </Head>
      
      {/* Dynamic meta tags for when user is in a topic */}
      {selectedTopic && (
        <Head>
          <title>Socratic Learning - Learning {formatTopicName(selectedTopic)} | Level {getProficiency(selectedTopic)}</title>
          <meta name="description" content={`Practice ${formatTopicName(selectedTopic)} with AI-generated questions. Currently at level ${getProficiency(selectedTopic)}/9.`} />
        </Head>
      )}
      
      <div className="page-wrapper">
        {/* Morphing Background */}
        <div className="bg-morphing"></div>
        
        <Header />
        
        {/* Session expiry warning for students */}
        {showExpiryWarning && user?.role === 'student' && (
          <div className="expiry-warning">
            <p>⚠️ Your session will expire in less than 5 minutes. Please save your work!</p>
            <button onClick={() => setShowExpiryWarning(false)} className="dismiss-btn">Dismiss</button>
          </div>
        )}
        
        <div className="container">
          {!selectedTopic ? (
            <>
              <div className="user-info">
                <p className="subtitle">
                  {user?.role === 'student' ? 'Student' : 'Teacher'} | 
                  Grade {user?.grade || '8'} | 
                  ${user?.subscription_status === 'student' ? '70' : user?.subscription_status === 'teacher' ? '120' : '0'}/year
                </p>
                {sessionStats.totalQuestions > 0 && (
                  <p className="session-stats">
                    Today: {sessionStats.correctAnswers}/{sessionStats.totalQuestions} correct
                  </p>
                )}
              </div>

              <MoodSelector 
                selectedMood={selectedMood} 
                onMoodSelect={setSelectedMood} 
              />

              <section className="adventure-section">
                <h2 className="adventure-title">Pick your adventure</h2>
                <div className="adventure-grid">
                  {getAvailableTopics().map((topic) => {
                    const proficiency = getProficiency(topic);
                    const progressPercentage = (proficiency / 9) * 100;
                    return (
                      <div 
                        key={topic} 
                        className="adventure-card"
                        onClick={() => handleTopicSelect(topic)}
                      >
                        <div className="adventure-header">
                          <div className="adventure-details">
                            <h3>{formatTopicName(topic)}</h3>
                          </div>
                          <div className="level-badge">Level {proficiency}</div>
                        </div>
                        
                        <div className="level-info">
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${progressPercentage}%` }}></div>
                          </div>
                        </div>
                        
                        <button className="start-btn" onClick={(e) => {
                          e.stopPropagation();
                          handleTopicSelect(topic);
                        }}>
                          Start Learning
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            <div className="question-view">
              <header className="question-header">
                <button className="back-btn" onClick={handleBack}>←</button>
                <div className="topic-info">
                  <div className="topic-title">{formatTopicName(selectedTopic)}</div>
                  <div className="question-count">Grade {user?.grade || '8'} Student</div>
                </div>
                <div className="level-badge">Level {getProficiency(selectedTopic)}</div>
              </header>

              <div className="progress-section">
                <ProgressBar 
                  proficiency={getProficiency(selectedTopic)} 
                  topic={formatTopicName(selectedTopic)}
                />
              </div>

              {generating ? (
                <div className="generating">
                  <div className="generating-text">Creating your question... ✨</div>
                </div>
              ) : currentQuestion && (
                <QuestionCard 
                  question={currentQuestion}
                  topic={selectedTopic}
                  difficulty={currentQuestion.difficulty}
                  proficiency={currentQuestion.proficiency}
                  onAnswer={handleAnswer}
                  onNext={handleNext}
                  userId={user.id}
                  getSession={getSession}
                />
              )}
            </div>
          )}

          <style jsx>{`
            /* Container and Layout */
            .container {
              container-type: inline-size;
              width: 100%;
              margin: 0 auto;
              padding: 2rem 3rem;
              position: relative;
              z-index: 10;
            }

            .loading-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              gap: 20px;
              background: linear-gradient(135deg, #f7f5f3 0%, #e8e2db 100%);
            }

            .logo {
              font-size: 2.5rem;
              font-weight: 800;
              background: linear-gradient(135deg, #374151 0%, #6b7280 50%, #9ca3af 100%);
              background-clip: text;
              -webkit-background-clip: text;
              color: transparent;
              margin-bottom: 8px;
            }

            .loading-text {
              color: #6b7280;
              animation: pulse 2s ease-in-out infinite;
            }

            /* User Info */
            .user-info {
              text-align: center;
              margin-bottom: 2rem;
            }

            .subtitle {
              color: #4b5563;
              font-size: 1.1rem;
              font-weight: 500;
            }

            .session-stats {
              color: #10b981;
              font-size: 0.9rem;
              margin-top: 8px;
              font-weight: 600;
            }

            /* Adventure Section */
            .adventure-section {
              margin-top: 4rem;
              display: grid;
              grid-template-rows: auto 1fr;
              gap: 3rem;
              width: 100%;
              max-width: 1400px;
              margin-left: auto;
              margin-right: auto;
            }

            .adventure-title {
              font-size: clamp(2rem, 4vw, 3rem);
              font-weight: 800;
              background: linear-gradient(135deg, #374151 0%, #6b7280 50%, #9ca3af 100%);
              background-clip: text;
              -webkit-background-clip: text;
              color: transparent;
              text-align: center;
              position: relative;
            }

            .adventure-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
              gap: 2rem;
            }

            .adventure-card {
              background: 
                linear-gradient(145deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.3)),
                rgba(255, 255, 255, 0.2);
              backdrop-filter: blur(30px) saturate(150%);
              border: 1px solid rgba(255, 255, 255, 0.5);
              border-radius: 28px;
              padding: 2.5rem;
              cursor: pointer;
              transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
              position: relative;
              overflow: hidden;
              transform-style: preserve-3d;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              min-height: 300px;
              box-shadow: 
                0 15px 35px rgba(31, 38, 135, 0.12),
                inset 0 2px 0 rgba(255, 255, 255, 0.9),
                inset 0 -2px 0 rgba(255, 255, 255, 0.3);
            }

            .adventure-card:hover {
              transform: translateY(-15px) rotateX(5deg) rotateY(2deg) scale(1.03);
              box-shadow: 
                0 25px 50px rgba(31, 38, 135, 0.2),
                0 0 30px rgba(59, 130, 246, 0.1),
                inset 0 2px 0 rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(40px) saturate(180%);
            }

            .adventure-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 2rem;
            }

            .adventure-details h3 {
              font-size: clamp(1.4rem, 3vw, 1.8rem);
              font-weight: 800;
              background: linear-gradient(45deg, #374151, #6b7280, #374151);
              background-size: 200% 200%;
              background-clip: text;
              -webkit-background-clip: text;
              color: transparent;
              animation: gradient-shift 4s ease infinite;
              margin-bottom: 0;
            }

            @keyframes gradient-shift {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }

            .level-badge {
              background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
              color: #374151;
              padding: 0.5rem 1rem;
              border-radius: 12px;
              font-weight: 700;
              font-size: 0.9rem;
              box-shadow: 
                0 2px 4px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.8);
            }

            /* Progress Bar */
            .progress-bar {
              width: 100%;
              height: 10px;
              background: rgba(0, 0, 0, 0.1);
              border-radius: 5px;
              overflow: hidden;
              position: relative;
              margin-top: 0.5rem;
            }

            .progress-fill {
              height: 100%;
              background: 
                linear-gradient(90deg, 
                  #ef4444 0%, 
                  #f97316 50%, 
                  #eab308 100%);
              border-radius: 5px;
              position: relative;
              animation: progress-glow 2s ease-in-out infinite;
              transition: width 0.3s ease;
            }

            @keyframes progress-glow {
              0%, 100% { 
                filter: brightness(1) saturate(1);
                box-shadow: 0 0 0 rgba(239, 68, 68, 0);
              }
              50% { 
                filter: brightness(1.2) saturate(1.3);
                box-shadow: 0 0 15px rgba(239, 68, 68, 0.5);
              }
            }

            /* Start Button */
            .start-btn {
              width: 100%;
              padding: 1.2rem 2.5rem;
              border: none;
              border-radius: 20px;
              font-size: clamp(1.2rem, 2.5vw, 1.5rem);
              font-weight: 700;
              cursor: pointer;
              transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
              background: 
                linear-gradient(135deg, 
                  #10b981 0%, 
                  #3b82f6 100%);
              color: white;
              position: relative;
              z-index: 2;
              box-shadow: 
                0 8px 25px rgba(16, 185, 129, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.3);
              transform-style: preserve-3d;
            }

            .start-btn:hover {
              transform: translateY(-4px) scale(1.02);
              box-shadow: 
                0 15px 35px rgba(16, 185, 129, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.4);
            }

            .start-btn:active {
              transform: translateY(-1px) scale(0.98);
            }

            /* Question View */
            .question-view {
              width: 100%;
              max-width: 1400px;
              margin: 0 auto;
              animation: fadeIn 0.6s ease-out;
            }

            .question-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 32px;
              background: 
                linear-gradient(145deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.2)),
                rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(30px) saturate(150%);
              border: 1px solid rgba(255, 255, 255, 0.4);
              border-radius: 20px;
              padding: 16px 24px;
              box-shadow: 
                0 6px 20px rgba(31, 38, 135, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.8);
            }

            .back-btn {
              background: none;
              border: none;
              color: #6b7280;
              font-size: 1.5rem;
              cursor: pointer;
              transition: all 0.3s ease;
              padding: 0.5rem;
              border-radius: 8px;
            }

            .back-btn:hover {
              color: #374151;
              background: rgba(0, 0, 0, 0.05);
            }

            .topic-info {
              text-align: center;
            }

            .topic-title {
              font-size: 1.3rem;
              font-weight: 700;
              color: #374151;
            }

            .question-count {
              font-size: 0.9rem;
              color: #6b7280;
              margin-top: 0.25rem;
            }

            .progress-section {
              margin-bottom: 32px;
            }

            .generating {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 300px;
            }

            .generating-text {
              font-size: 1.2rem;
              color: #6b7280;
              animation: pulse 2s ease-in-out infinite;
            }

            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(30px); }
              to { opacity: 1; transform: translateY(0); }
            }

            @keyframes pulse {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }

            /* Responsive */
            @media (max-width: 768px) {
              .container { 
                padding: 1rem 1.5rem;
              }
              .adventure-grid { 
                grid-template-columns: 1fr; 
              }
              .adventure-card {
                padding: 2rem;
                min-height: 250px;
              }
              .question-view {
                padding: 0 1rem;
              }
            }

            @container (max-width: 768px) {
              .adventure-grid {
                gap: 1.5rem;
              }
            }

            @container (max-width: 480px) {
              .adventure-grid {
                gap: 1rem;
              }
            }
            
            /* Session expiry warning */
            .expiry-warning {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%);
              color: white;
              padding: 1rem 2rem;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
              z-index: 1000;
              display: flex;
              align-items: center;
              justify-content: space-between;
              animation: slideDown 0.3s ease;
            }
            
            @keyframes slideDown {
              from {
                transform: translateY(-100%);
              }
              to {
                transform: translateY(0);
              }
            }
            
            .expiry-warning p {
              margin: 0;
              font-size: 1rem;
              font-weight: 500;
            }
            
            .dismiss-btn {
              background: rgba(255, 255, 255, 0.2);
              border: 1px solid rgba(255, 255, 255, 0.3);
              color: white;
              padding: 0.5rem 1rem;
              border-radius: 8px;
              cursor: pointer;
              font-size: 0.9rem;
              transition: all 0.2s ease;
            }
            
            .dismiss-btn:hover {
              background: rgba(255, 255, 255, 0.3);
              transform: translateY(-1px);
            }
          `}</style>

          <style jsx global>{`
            /* Morphing Background */
            .bg-morphing {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: 
                radial-gradient(circle at 20% 20%, rgba(156, 163, 175, 0.08) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(209, 213, 219, 0.08) 0%, transparent 50%),
                radial-gradient(circle at 60% 40%, rgba(243, 244, 246, 0.08) 0%, transparent 50%);
              animation: morph-bg 25s ease-in-out infinite;
              pointer-events: none;
              z-index: 1;
            }

            @keyframes morph-bg {
              0%, 100% {
                background: 
                  radial-gradient(circle at 20% 20%, rgba(156, 163, 175, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 80% 80%, rgba(209, 213, 219, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 60% 40%, rgba(243, 244, 246, 0.08) 0%, transparent 50%);
              }
              33% {
                background: 
                  radial-gradient(circle at 70% 30%, rgba(107, 114, 128, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 30% 70%, rgba(229, 231, 235, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 90% 10%, rgba(249, 250, 251, 0.08) 0%, transparent 50%);
              }
              66% {
                background: 
                  radial-gradient(circle at 10% 80%, rgba(75, 85, 99, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 90% 20%, rgba(156, 163, 175, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 50% 90%, rgba(229, 231, 235, 0.08) 0%, transparent 50%);
              }
            }

            /* Base styles */
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #f7f5f3 0%, #e8e2db 100%);
              min-height: 100vh;
              color: #374151;
              overflow-x: hidden;
            }

            .page-wrapper {
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              position: relative;
            }

            .container {
              flex: 1;
              display: flex;
              flex-direction: column;
            }

            /* Support for reduced motion */
            @media (prefers-reduced-motion: reduce) {
              * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
              }
            }
          `}</style>
        </div>
        <Footer />
      </div>
    </>
  );
}