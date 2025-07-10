import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
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
        <title>Socratic Learning - Adaptive Learning Powered by AI | English & Math</title>
        <meta name="description" content="Personalized AI-powered learning platform for students. Master English and Math with unlimited dynamic questions that adapt to your level." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <Header />
      
      <main className="landing-container">
        {/* Features Section */}
        <section className="features">
          <h2 className="section-title">Why Choose Socratic Learning?</h2>
          
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

        <Footer />
      </main>

      <style jsx>{`
        .landing-container {
          min-height: 100vh;
          overflow-x: hidden;
        }




        /* Features Section */
        .features {
          padding: 80px 20px;
          background: rgba(0, 0, 0, 0.3);
          margin-top: 40px;
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
          padding: 20px;
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



        /* Responsive */
        @media (max-width: 768px) {
          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}