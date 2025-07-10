import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import { onAuthChange } from '../lib/firebase';

export default function Landing() {
  const router = useRouter();

  useEffect(() => {
    // Redirect if already logged in
    const unsubscribe = onAuthChange((user) => {
      if (user) {
        router.push('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  return (
    <>
      <Head>
        <title>LearnAI - Adaptive Learning Powered by AI | English & Math</title>
        <meta name="description" content="Personalized AI-powered learning platform for students. Master English and Math with unlimited dynamic questions that adapt to your level." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <Header />
      
      <main className="landing-container">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-content">
            <h1 className="hero-title">
              Learn Smarter with <span className="gradient-text">AI-Powered</span> Education
            </h1>
            <p className="hero-subtitle">
              Adaptive learning that adjusts to your pace. Master English and Math with unlimited personalized questions.
            </p>
            <div className="hero-buttons">
              <button 
                className="btn btn-primary btn-large"
                onClick={() => router.push('/login?signup=true')}
              >
                Start Learning Free
              </button>
              <button 
                className="btn btn-secondary btn-large"
                onClick={() => router.push('/login')}
              >
                Sign In
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="floating-card">
              <div className="question-preview">
                <span className="subject-tag">Math</span>
                <p>If x + 5 = 12, what is x?</p>
                <div className="options-preview">
                  <div className="option">A) 5</div>
                  <div className="option correct">B) 7</div>
                  <div className="option">C) 9</div>
                  <div className="option">D) 11</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features">
          <h2 className="section-title">Why Choose LearnAI?</h2>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Adaptive Learning</h3>
              <p>Questions automatically adjust to your skill level, ensuring optimal challenge and growth.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">∞</div>
              <h3>Unlimited Questions</h3>
              <p>77 million+ unique question combinations. Never see the same question twice in 150 days.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">💡</div>
              <h3>Socratic Method</h3>
              <p>Get progressive hints that guide your thinking without giving away the answer.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Real-time Progress</h3>
              <p>Track your proficiency in real-time as you answer questions and improve.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🎭</div>
              <h3>Mood-based Learning</h3>
              <p>Choose topics based on how you feel - analytical, creative, competitive, or curious.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🚀</div>
              <h3>Instant Feedback</h3>
              <p>Get detailed explanations for every answer to understand concepts deeply.</p>
            </div>
          </div>
        </section>

        {/* For Different Users */}
        <section className="user-types">
          <h2 className="section-title">Perfect For Everyone</h2>
          
          <div className="user-cards">
            <div className="user-card">
              <h3>👩‍🎓 Students</h3>
              <ul>
                <li>Practice at your own pace</li>
                <li>Build confidence with adaptive difficulty</li>
                <li>Master concepts with unlimited practice</li>
                <li>Get help when stuck with smart hints</li>
              </ul>
            </div>
            
            <div className="user-card">
              <h3>👨‍🏫 Teachers</h3>
              <ul>
                <li>Track student progress in real-time</li>
                <li>Assign practice based on proficiency</li>
                <li>Save time with AI-generated questions</li>
                <li>Focus on teaching, not test creation</li>
              </ul>
            </div>
            
            <div className="user-card">
              <h3>👪 Parents</h3>
              <ul>
                <li>Monitor your child's progress</li>
                <li>Affordable alternative to tutoring</li>
                <li>Safe, ad-free learning environment</li>
                <li>Available 24/7 for practice</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta">
          <div className="cta-content">
            <h2>Ready to Transform Your Learning?</h2>
            <p>Join thousands of students improving every day with AI-powered education.</p>
            <button 
              className="btn btn-primary btn-large"
              onClick={() => router.push('/login?signup=true')}
            >
              Get Started Free
            </button>
          </div>
        </section>
      </main>

      <style jsx>{`
        .landing-container {
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* Hero Section */
        .hero {
          padding: 80px 20px;
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: center;
        }

        .hero-title {
          font-size: 3.5rem;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 24px;
          color: var(--text-primary);
        }

        .gradient-text {
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 1.25rem;
          color: var(--text-secondary);
          margin-bottom: 32px;
          line-height: 1.6;
        }

        .hero-buttons {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .btn {
          padding: 12px 28px;
          border-radius: 28px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          border: none;
          font-size: 1rem;
        }

        .btn-large {
          padding: 16px 32px;
          font-size: 1.1rem;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          color: white;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0, 255, 136, 0.3);
        }

        .btn-secondary {
          background: var(--glass-bg);
          color: var(--text-primary);
          border: 2px solid var(--glass-border);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--accent-neon);
        }

        /* Hero Visual */
        .floating-card {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: float 6s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        .question-preview {
          font-size: 1.1rem;
        }

        .subject-tag {
          display: inline-block;
          background: rgba(0, 255, 136, 0.2);
          color: var(--accent-neon);
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .options-preview {
          margin-top: 20px;
          display: grid;
          gap: 12px;
        }

        .option {
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          border: 1px solid var(--glass-border);
          transition: all 0.3s ease;
        }

        .option.correct {
          background: rgba(0, 255, 136, 0.1);
          border-color: var(--accent-neon);
        }

        /* Features Section */
        .features {
          padding: 80px 20px;
          background: rgba(0, 0, 0, 0.3);
        }

        .section-title {
          font-size: 2.5rem;
          text-align: center;
          margin-bottom: 60px;
          color: var(--text-primary);
        }

        .features-grid {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 32px;
        }

        .feature-card {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          padding: 32px;
          text-align: center;
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-4px);
          border-color: var(--accent-neon);
          box-shadow: 0 12px 40px rgba(0, 255, 136, 0.1);
        }

        .feature-icon {
          font-size: 3rem;
          margin-bottom: 16px;
        }

        .feature-card h3 {
          font-size: 1.25rem;
          margin-bottom: 12px;
          color: var(--text-primary);
        }

        .feature-card p {
          color: var(--text-secondary);
          line-height: 1.6;
        }

        /* User Types Section */
        .user-types {
          padding: 80px 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .user-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 32px;
        }

        .user-card {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          padding: 32px;
        }

        .user-card h3 {
          font-size: 1.5rem;
          margin-bottom: 20px;
          color: var(--text-primary);
        }

        .user-card ul {
          list-style: none;
          padding: 0;
        }

        .user-card li {
          padding: 8px 0;
          color: var(--text-secondary);
          position: relative;
          padding-left: 24px;
        }

        .user-card li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: var(--accent-neon);
          font-weight: bold;
        }

        /* CTA Section */
        .cta {
          padding: 80px 20px;
          background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 136, 255, 0.1));
        }

        .cta-content {
          max-width: 600px;
          margin: 0 auto;
          text-align: center;
        }

        .cta h2 {
          font-size: 2.5rem;
          margin-bottom: 16px;
          color: var(--text-primary);
        }

        .cta p {
          font-size: 1.25rem;
          color: var(--text-secondary);
          margin-bottom: 32px;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .hero {
            grid-template-columns: 1fr;
            padding: 40px 20px;
            text-align: center;
          }

          .hero-title {
            font-size: 2.5rem;
          }

          .hero-buttons {
            justify-content: center;
          }

          .hero-visual {
            display: none;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }

          .user-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}