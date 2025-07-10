import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { onAuthChange } from '../lib/firebase';

// Initialize Supabase client only if environment variables are available
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  : null;

export default function Landing() {
  const router = useRouter();
  const [heroContent, setHeroContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch hero content from database
    const fetchContent = async () => {
      try {
        if (!supabase) {
          console.warn('Supabase client not initialized');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('admin_content')
          .select('content')
          .eq('content_key', 'landing_hero_story')
          .eq('is_active', true)
          .single();

        if (error) throw error;
        setHeroContent(data?.content);
      } catch (error) {
        console.error('Error fetching content:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

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
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-content">
            <h1 className="hero-title">
              Socratic Learning
            </h1>
            <p className="hero-subtitle-main">
              <span className="gradient-text">Adaptive. Infinite. Personalized.</span>
            </p>
            <p className="hero-subtitle">
              Master English and Math with unlimited AI-powered questions that adjust to your pace.
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
          <div className="hero-story">
            {loading ? (
              <div className="story-loading">Loading...</div>
            ) : (
              <div className="story-content">
                {heroContent ? (
                  heroContent.split('\n\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))
                ) : (
                  <p>Welcome to Socratic Learning - where education meets innovation.</p>
                )}
              </div>
            )}
          </div>
        </section>

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
          font-size: 4rem;
          font-weight: 800;
          line-height: 1.2;
          margin-bottom: 16px;
          color: var(--text-primary);
        }

        .hero-subtitle-main {
          font-size: 1.5rem;
          margin-bottom: 16px;
          font-weight: 600;
          letter-spacing: 0.05em;
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

        /* Hero Story */
        .hero-story {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 32px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          max-height: 600px;
          overflow-y: auto;
        }

        .story-loading {
          text-align: center;
          color: var(--text-secondary);
          padding: 40px;
        }

        .story-content {
          font-size: 1rem;
          line-height: 1.8;
          color: var(--text-secondary);
        }

        .story-content p {
          margin-bottom: 16px;
        }

        .story-content p:last-child {
          margin-bottom: 0;
        }

        /* Custom scrollbar for story */
        .hero-story::-webkit-scrollbar {
          width: 8px;
        }

        .hero-story::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }

        .hero-story::-webkit-scrollbar-thumb {
          background: var(--glass-border);
          border-radius: 4px;
        }

        .hero-story::-webkit-scrollbar-thumb:hover {
          background: var(--accent-primary);
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

          .hero-story {
            max-height: 400px;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}