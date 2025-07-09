import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import MoodSelector from '../components/MoodSelector';
import ProgressBar from '../components/ProgressBar';
import QuestionCard from '../components/QuestionCard';
import { onAuthChange } from '../lib/firebase';
import { getUser, getSessionStats } from '../lib/db';
import { MOOD_TOPICS, formatTopicName, getCachedProficiency } from '../lib/utils';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [selectedMood, setSelectedMood] = useState('creative');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sessionStats, setSessionStats] = useState({ totalQuestions: 0, correctAnswers: 0 });

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/login');
        return;
      }

      try {
        // Get user data from Supabase using Firebase UID
        const userData = await getUser(firebaseUser.uid);
        if (userData) {
          setUser(userData);
          
          // Load session stats
          const stats = await getSessionStats(firebaseUser.uid);
          setSessionStats(stats);
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, [router]);

  const handleTopicSelect = async (topic) => {
    setSelectedTopic(topic);
    setGenerating(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          userId: user.id,
          topic: topic
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

  const handleAnswer = async (correct, timeSpent, hintsUsed) => {
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          userId: user.id,
          topic: selectedTopic,
          correct: correct,
          timeSpent: timeSpent,
          hintsUsed: hintsUsed
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
    handleTopicSelect(selectedTopic);
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="logo">LearnAI ✨</div>
        <div className="loading-text">Loading your learning journey...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>LearnAI - Learn English & Math, Unlimited Dynamic Questions</title>
        <meta charSet="utf-8" />
        <meta name="description" content="Learn English & Math, unlimited dynamic questions. AI-powered adaptive learning that adjusts to your skill level. Personalized education for grades 5-11." />
        <meta name="keywords" content="learn English, learn Math, unlimited questions, dynamic questions, adaptive learning, AI education, personalized tutoring" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="theme-color" content="#0a0a0f" />
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
          <title>LearnAI - Learning {formatTopicName(selectedTopic)} | Level {getProficiency(selectedTopic)}</title>
          <meta name="description" content={`Practice ${formatTopicName(selectedTopic)} with AI-generated questions. Currently at level ${getProficiency(selectedTopic)}/9.`} />
        </Head>
      )}
      
      <div className="container">
      {!selectedTopic ? (
        <>
          <header className="header">
            <h1 className="logo">LearnAI ✨</h1>
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
          </header>

          <MoodSelector 
            selectedMood={selectedMood} 
            onMoodSelect={setSelectedMood} 
          />

          <section className="topics-section">
            <h2 className="section-title">Pick your adventure 🎮</h2>
            <div className="topics-grid">
              {getAvailableTopics().map((topic) => {
                const proficiency = getProficiency(topic);
                return (
                  <div 
                    key={topic} 
                    className="topic-card"
                    onClick={() => handleTopicSelect(topic)}
                  >
                    <div className="topic-header">
                      <span className="topic-icon">
                        {topic.includes('comprehension') && '📚'}
                        {topic.includes('grammar') && '✍️'}
                        {topic.includes('vocabulary') && '🎯'}
                        {topic.includes('sentences') && '📝'}
                        {topic.includes('synonyms') && '🔄'}
                        {topic.includes('antonyms') && '↔️'}
                        {topic.includes('fill') && '📋'}
                        {topic.includes('number') && '🔢'}
                        {topic.includes('algebra') && '🧮'}
                        {topic.includes('geometry') && '📐'}
                        {topic.includes('statistics') && '📊'}
                        {topic.includes('precalculus') && '📈'}
                        {topic.includes('calculus') && '∫'}
                      </span>
                      <div>
                        <div className="topic-title">{formatTopicName(topic)}</div>
                        <div className="topic-subtitle">
                          {topic.includes('english') ? 'English' : 'Mathematics'}
                        </div>
                      </div>
                    </div>
                    <ProgressBar proficiency={proficiency} />
                    <button className="start-btn">Start Learning</button>
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
            <div className="streak-badge">Level {getProficiency(selectedTopic)}</div>
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
            />
          )}
        </div>
      )}

      <style jsx>{`
        .container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
          min-height: 100vh;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          gap: 20px;
        }

        .loading-text {
          color: var(--text-secondary);
          animation: pulse 2s ease-in-out infinite;
        }

        .header {
          text-align: center;
          margin-bottom: 40px;
          animation: fadeIn 0.8s ease-out;
        }

        .logo {
          font-size: 2.5rem;
          font-weight: 800;
          background: linear-gradient(90deg, var(--accent-neon), var(--accent-blue));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
        }

        .subtitle {
          color: var(--text-secondary);
          font-size: 1.1rem;
          font-weight: 300;
        }

        .session-stats {
          color: var(--accent-neon);
          font-size: 0.9rem;
          margin-top: 8px;
        }

        .topics-section {
          animation: fadeIn 0.8s ease-out 0.4s both;
        }

        .section-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 20px;
          text-align: center;
        }

        .topics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
        }

        .topic-card {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .topic-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, var(--accent-blue), var(--accent-pink));
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
        }

        .topic-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 48px rgba(0, 127, 255, 0.2);
        }

        .topic-card:hover::before {
          opacity: 0.1;
        }

        .topic-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .topic-icon {
          font-size: 2rem;
        }

        .topic-title {
          font-size: 1.3rem;
          font-weight: 700;
        }

        .topic-subtitle {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .start-btn {
          background: linear-gradient(135deg, var(--accent-neon), var(--accent-blue));
          border: none;
          border-radius: 16px;
          padding: 12px 24px;
          color: white;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.3s ease;
          width: 100%;
          margin-top: 16px;
        }

        .start-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.4);
        }

        .question-view {
          max-width: 800px;
          margin: 0 auto;
          animation: fadeIn 0.6s ease-out;
        }

        .question-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          padding: 16px 24px;
        }

        .back-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 1.5rem;
          cursor: pointer;
          transition: color 0.3s ease;
        }

        .back-btn:hover {
          color: var(--accent-neon);
        }

        .topic-info {
          text-align: center;
        }

        .question-count {
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .streak-badge {
          background: linear-gradient(135deg, var(--accent-neon), var(--accent-blue));
          border-radius: 12px;
          padding: 8px 16px;
          font-weight: 600;
          font-size: 0.9rem;
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
          color: var(--text-secondary);
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

        @media (max-width: 768px) {
          .container { padding: 16px; }
          .logo { font-size: 2rem; }
          .topics-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <style jsx global>{`
        :root {
          --bg-primary: #0a0a0f;
          --bg-secondary: #1a1a2e;
          --bg-card: rgba(30, 30, 60, 0.6);
          --accent-neon: #00ff88;
          --accent-blue: #007fff;
          --accent-pink: #ff0080;
          --accent-orange: #ff6b35;
          --glass-bg: rgba(255, 255, 255, 0.1);
          --glass-border: rgba(255, 255, 255, 0.2);
          --text-primary: #ffffff;
          --text-secondary: #b0b0b0;
          --correct: #00ff88;
          --incorrect: #ff4757;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, #2a1a4a 100%);
          min-height: 100vh;
          color: var(--text-primary);
          overflow-x: hidden;
        }
      `}</style>
    </div>
    </>
  );
}