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
import { MOOD_TOPICS, formatTopicName, getCachedProficiency, setCachedProficiency } from '../lib/utils';
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
  const [questionBatch, setQuestionBatch] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [batchId, setBatchId] = useState(null);

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
    console.log('Topic selected:', topic);
    console.log('Available topics for mood:', selectedMood, MOOD_TOPICS[selectedMood]);
    
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
    setQuestionBatch([]); // Clear previous batch
    setCurrentQuestionIndex(0);

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
      
      // Generate first question immediately for better UX
      const firstResponse = await fetch('/api/generate-stream', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          userId: user.id,
          topic: topic,
          mood: selectedMood,
          position: 1,
          existingQuestions: []
        })
      });

      if (firstResponse.ok) {
        const firstData = await firstResponse.json();
        
        // Set first question immediately so user can start
        setCurrentQuestion({
          ...firstData.question,
          topic: topic,
          difficulty: firstData.question.difficulty,
          proficiency: firstData.currentProficiency
        });
        setQuestionBatch([firstData.question]);
        setCurrentQuestionIndex(0);
        setGenerating(false); // Stop loading indicator - user sees first question
        
        console.log('First question loaded - single question mode for testing');
      } else {
        // Fallback: Try batch generation
        console.log('First question generation failed, trying batch generation');
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            action: 'generate-batch',
            userId: user.id,
            topic: topic,
            mood: selectedMood
          })
        });

        const data = await response.json();
        
        if (response.ok && data.questions && data.questions.length > 0) {
          setQuestionBatch(data.questions);
          setBatchId(data.batchId);
          setCurrentQuestionIndex(0);
          setCurrentQuestion({
            ...data.questions[0],
            topic: topic,
            difficulty: data.questions[0].difficulty,
            proficiency: data.currentProficiency
          });
          
          if (data.questions.length < 5) {
            generateRemainingQuestions(data.questions, topic, selectedMood, authHeader, data.currentProficiency);
          }
        } else {
          // Final fallback: Generate questions one by one
          console.log('Batch generation also failed, falling back to individual streaming');
          generateQuestionsIndividually(topic, selectedMood, authHeader);
        }
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      // Fallback to individual generation
      generateQuestionsIndividually(topic, selectedMood, authHeader);
    } finally {
      setGenerating(false);
    }
  };
  
  // Generate remaining questions in parallel for speed
  const generateRemainingQuestions = async (existingQuestions, topic, mood, authHeader, proficiency) => {
    const existingCount = existingQuestions.length;
    const needed = 5 - existingCount;
    
    console.log(`Generating ${needed} more questions in parallel`);
    
    // Create promises for all remaining questions
    const promises = [];
    for (let i = 0; i < needed; i++) {
      const promise = fetch('/api/generate-stream', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          userId: user.id,
          topic: topic,
          mood: mood,
          position: existingCount + i + 1,
          existingQuestions: existingQuestions.map(q => q.question)
        })
      })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (data) {
          return {
            ...data.question,
            topic: topic,
            difficulty: data.question.difficulty,
            proficiency: proficiency
          };
        }
        return null;
      })
      .catch(error => {
        console.error(`Error generating question ${existingCount + i + 1}:`, error);
        return null;
      });
      
      promises.push(promise);
    }
    
    // Wait for all to complete and update batch
    const results = await Promise.all(promises);
    const validQuestions = results.filter(q => q !== null);
    
    if (validQuestions.length > 0) {
      setQuestionBatch(prev => [...prev, ...validQuestions]);
      console.log(`Successfully generated ${validQuestions.length} additional questions`);
    }
    
    // Generate batch ID if we have all 5 questions
    if (existingQuestions.length + validQuestions.length >= 5) {
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setBatchId(batchId);
    }
  };
  
  // Generate all questions individually (streaming)
  const generateQuestionsIndividually = async (topic, mood, authHeader) => {
    const questions = [];
    
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch('/api/generate-stream', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            userId: user.id,
            topic: topic,
            mood: mood,
            position: i + 1,
            existingQuestions: questions.map(q => q.question)
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          const newQuestion = {
            ...data.question,
            topic: topic,
            difficulty: data.question.difficulty,
            proficiency: data.currentProficiency
          };
          
          questions.push(newQuestion);
          
          // Update batch in real-time
          setQuestionBatch([...questions]);
          
          // Set first question as current
          if (i === 0) {
            setCurrentQuestion(newQuestion);
            setGenerating(false); // Stop showing loading after first question
          }
        }
      } catch (error) {
        console.error(`Error generating question ${i + 1}:`, error);
      }
    }
    
    // Generate batch ID
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setBatchId(batchId);
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
        
        // Update cached proficiency immediately
        setCachedProficiency(selectedTopic, data.newProficiency);

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
    // Check if we have more questions in the batch
    if (currentQuestionIndex < questionBatch.length - 1) {
      // Move to next question in batch
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      
      const nextQuestion = questionBatch[nextIndex];
      setCurrentQuestion({
        ...nextQuestion,
        topic: selectedTopic,
        difficulty: nextQuestion.difficulty,
        proficiency: nextQuestion.proficiency || getProficiency(selectedTopic)
      });
      
      console.log(`Moving to question ${nextIndex + 1}/5`);
    } else {
      // Completed all 5 questions - show completion or generate new batch
      console.log('Completed all 5 questions in batch');
      alert('Great job! You\'ve completed all 5 questions. Select a new topic to continue.');
      handleBack();
    }
  };

  const handleBack = () => {
    setSelectedTopic(null);
    setCurrentQuestion(null);
    setQuestionBatch([]);
    setCurrentQuestionIndex(0);
    setBatchId(null);
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
              {sessionStats.totalQuestions > 0 && (
                <div className="user-info">
                  <p className="session-stats">
                    Today: {sessionStats.correctAnswers}/{sessionStats.totalQuestions} correct
                  </p>
                </div>
              )}

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
                            <div 
                              className={`progress-fill ${proficiency >= 9 ? 'progress-max' : ''}`} 
                              style={{ width: `${progressPercentage}%` }}
                            ></div>
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
                  <div className="question-count">
                    Question {currentQuestionIndex + 1} of {Math.max(questionBatch.length, 5)} • Grade {user?.grade || '8'}
                    {generating && (
                      <span className="loading-indicator"> (Generating...)</span>
                    )}
                  </div>
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
                  <div className="generating-text">
                    Loading your personalized questions in real-time, please do not refresh...
                  </div>
                  <div className="generating-subtext">
                    Preparing 5 unique questions for your learning session
                  </div>
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
              background: linear-gradient(135deg, #fdfcfa 0%, #f9f7f4 100%);
            }

            .logo {
              font-size: 3rem;
              font-weight: 800;
              color: #1a1a1a;
              margin-bottom: 8px;
            }

            .loading-text {
              color: #1a1a1a;
              font-size: 1.4rem;
              animation: pulse 2s ease-in-out infinite;
            }

            /* User Info */
            .user-info {
              text-align: center;
              margin-bottom: 2rem;
            }

            .subtitle {
              color: #1a1a1a;
              font-size: 1.3rem;
              font-weight: 500;
            }

            .session-stats {
              color: #1a1a1a;
              font-size: 1.1rem;
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
              font-size: clamp(2.5rem, 4vw, 3.5rem);
              font-weight: 800;
              color: #1a1a1a;
              text-align: center;
              position: relative;
            }

            .adventure-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
              gap: 2rem;
            }

            .adventure-card {
              background: rgba(255, 255, 255, 0.85);
              backdrop-filter: blur(10px);
              border: 1px solid rgba(0, 0, 0, 0.08);
              border-radius: 20px;
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
              box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
            }

            .adventure-card:hover {
              transform: translateY(-10px) scale(1.02);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
              background: rgba(255, 255, 255, 0.95);
            }

            .adventure-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 2rem;
            }

            .adventure-details h3 {
              font-size: clamp(1.5rem, 2.5vw, 1.8rem);
              font-weight: 800;
              color: #1a1a1a;
              margin-bottom: 0;
              line-height: 1.2;
            }

            @keyframes gradient-shift {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }

            .level-badge {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 0.4rem 0.8rem;
              border-radius: 12px;
              font-weight: 500;
              font-size: 0.9rem;
              font-style: italic;
              border: none;
              box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
            }

            /* Progress Bar */
            .progress-bar {
              width: 100%;
              height: 12px;
              background: rgba(0, 0, 0, 0.08);
              border-radius: 6px;
              overflow: hidden;
              position: relative;
              margin-top: 0.5rem;
              border: 1px solid rgba(0, 0, 0, 0.05);
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
              transition: width 0.3s ease, background 0.5s ease;
            }
            
            .progress-fill.progress-max {
              background: 
                linear-gradient(90deg, 
                  #10b981 0%, 
                  #059669 50%, 
                  #047857 100%);
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
              border-radius: 16px;
              font-size: clamp(1.4rem, 2.5vw, 1.7rem);
              font-weight: 700;
              cursor: pointer;
              transition: all 0.3s ease;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              position: relative;
              z-index: 2;
              box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
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
              background: rgba(255, 255, 255, 0.85);
              backdrop-filter: blur(10px);
              border: 1px solid rgba(0, 0, 0, 0.08);
              border-radius: 20px;
              padding: 20px 28px;
              box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
            }

            .back-btn {
              background: none;
              border: none;
              color: #1a1a1a;
              font-size: 1.8rem;
              cursor: pointer;
              transition: all 0.3s ease;
              padding: 0.5rem;
              border-radius: 8px;
            }

            .back-btn:hover {
              color: #1a1a1a;
              background: rgba(0, 0, 0, 0.05);
            }

            .topic-info {
              text-align: center;
            }

            .topic-title {
              font-size: 1.6rem;
              font-weight: 700;
              color: #1a1a1a;
            }

            .question-count {
              font-size: 1.1rem;
              color: #666666;
              margin-top: 0.25rem;
              font-style: italic;
            }
            
            .loading-indicator {
              color: #667eea;
              font-weight: normal;
              animation: pulse 1.5s ease-in-out infinite;
            }

            .progress-section {
              margin-bottom: 32px;
            }

            .generating {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 300px;
            }

            .generating-text {
              font-size: 1.5rem;
              color: #1a1a1a;
              animation: pulse 2s ease-in-out infinite;
              margin-bottom: 0.5rem;
            }
            
            .generating-subtext {
              font-size: 1.1rem;
              color: #666666;
              font-style: italic;
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
            /* Paper texture background */
            .bg-morphing {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-image: 
                repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 1px,
                  rgba(0, 0, 0, 0.03) 1px,
                  rgba(0, 0, 0, 0.03) 2px
                ),
                repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 1px,
                  rgba(0, 0, 0, 0.02) 1px,
                  rgba(0, 0, 0, 0.02) 2px
                );
              pointer-events: none;
              z-index: 1;
              opacity: 0.4;
            }


            /* Base styles */
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: 
                radial-gradient(circle at 20% 50%, rgba(120, 119, 116, 0.02) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(120, 119, 116, 0.02) 0%, transparent 50%),
                radial-gradient(circle at 40% 80%, rgba(120, 119, 116, 0.01) 0%, transparent 50%),
                linear-gradient(135deg, #fdfcfa 0%, #f9f7f4 100%);
              min-height: 100vh;
              color: #1a1a1a;
              overflow-x: hidden;
            }

            .page-wrapper {
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              position: relative;
              background: transparent;
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
            
            /* Override QuestionCard styles for dashboard */
            .question-card {
              background: rgba(255, 255, 255, 0.85) !important;
              backdrop-filter: blur(10px) !important;
              border: 1px solid rgba(0, 0, 0, 0.08) !important;
              color: #1a1a1a !important;
            }
            
            .question-card h2,
            .question-card p,
            .question-card .question-type,
            .question-card .hint-text,
            .question-card .explanation-text {
              color: #1a1a1a !important;
            }
            
            .question-card .btn-secondary {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
              color: white !important;
              border: none !important;
              font-size: 1.1rem !important;
              font-weight: 600 !important;
            }
            
            .question-card .btn-primary {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
              border: none !important;
              font-size: 1.2rem !important;
            }
            
            .question-card .answer-option {
              background: transparent !important;
              border: 2px solid transparent !important;
              cursor: pointer !important;
              pointer-events: auto !important;
              padding: 16px !important;
              transition: all 0.2s ease !important;
            }
            
            .question-card .answer-option span:not(.answer-letter) {
              color: #1a1a1a !important;
              font-size: 1.1rem !important;
              font-weight: 500 !important;
              font-style: italic !important;
              pointer-events: none !important;
            }
            
            .question-card .answer-option:hover {
              background: rgba(102, 126, 234, 0.1) !important;
              border-color: #667eea !important;
            }
            
            .question-card .answer-option.selected {
              background: rgba(102, 126, 234, 0.2) !important;
              border-color: #667eea !important;
            }
            
            .question-card .answer-option.selected span:not(.answer-letter) {
              font-style: normal !important;
              font-weight: 600 !important;
            }
            
            .question-card .answer-letter {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
              pointer-events: none !important;
              color: white !important;
              font-weight: 700 !important;
            }
            
            .question-card .answer-option.correct {
              background: rgba(16, 185, 129, 0.2) !important;
              border-color: #10b981 !important;
            }
            
            .question-card .answer-option.incorrect {
              background: rgba(239, 68, 68, 0.2) !important;
              border-color: #ef4444 !important;
            }
            
            .question-card .hint-section,
            .question-card .explanation-section {
              background: rgba(255, 255, 255, 0.7) !important;
              border: 1px solid rgba(0, 0, 0, 0.08) !important;
            }
            
            .question-card .hint-title,
            .question-card .explanation-title {
              color: #1a1a1a !important;
            }
            
            .question-card .question-context {
              color: #1a1a1a !important;
              background: rgba(255, 255, 255, 0.95) !important;
              border: 1px solid rgba(0, 0, 0, 0.1) !important;
              border-radius: 12px !important;
              padding: 20px !important;
              margin-bottom: 20px !important;
              font-size: 1.1rem !important;
              line-height: 1.6 !important;
              font-style: normal !important;
              display: block !important;
              visibility: visible !important;
              opacity: 1 !important;
              max-height: none !important;
              overflow: visible !important;
              white-space: normal !important;
              word-wrap: break-word !important;
            }
          `}</style>
        </div>
        <Footer />
      </div>
    </>
  );
}