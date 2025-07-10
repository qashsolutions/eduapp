import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
// Removed Firebase import - now using Supabase through AuthContext

// Import singleton Supabase client
import { supabase } from '../lib/db';

export default function Landing() {
  const router = useRouter();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState('');
  const [season, setSeason] = useState('');

  useEffect(() => {
    // Set time and season for theming
    const updateTimeAndSeason = () => {
      const now = new Date();
      const hour = now.getHours();
      const month = now.getMonth();
      
      // Determine time of day
      if (hour >= 5 && hour < 12) setTimeOfDay('morning');
      else if (hour >= 12 && hour < 17) setTimeOfDay('noon');
      else if (hour >= 17 && hour < 20) setTimeOfDay('evening');
      else setTimeOfDay('night');
      
      // Determine season
      if (month >= 2 && month <= 4) setSeason('spring');
      else if (month >= 5 && month <= 7) setSeason('summer');
      else if (month >= 8 && month <= 10) setSeason('fall');
      else setSeason('winter');
    };
    
    updateTimeAndSeason();
    const interval = setInterval(updateTimeAndSeason, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fetch content from database
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
        
        // Process content to ensure proper paragraph structure
        if (data?.content) {
          // Split by double newlines to preserve paragraph structure
          const paragraphs = data.content.split('\n\n').filter(p => p.trim());
          setContent(paragraphs);
        }
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
      if (user && router.isReady) {
        setTimeout(() => {
          router.push('/');
        }, 100);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Split content into sections for better visual organization
  const getContentSections = () => {
    if (!content || content.length === 0) return { intro: [], problem: [], solution: [], benefits: [] };
    
    return {
      intro: content.slice(0, 2),      // First 2 paragraphs
      problem: content.slice(2, 5),    // Next 3 paragraphs
      solution: content.slice(5, 8),   // Next 3 paragraphs
      benefits: content.slice(8)       // Remaining paragraphs
    };
  };

  const sections = getContentSections();

  return (
    <>
      <Head>
        <title>Socratic Learning - AI Tutoring for Students | Personalized English & Math</title>
        <meta name="description" content="AI-powered Socratic tutoring for students. Personalized learning in English & Math with unlimited practice questions. 14-day trial for $1." />
        <meta name="keywords" content="AI tutor, Socratic method, personalized learning, English tutoring, Math tutoring, adaptive learning, student education" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://socraticlearning.com/" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Socratic Learning - AI Tutoring for Students" />
        <meta property="og:description" content="Personalized AI tutoring using the Socratic method. Help your child excel in English & Math with adaptive learning." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://socraticlearning.com/" />
        <meta property="og:image" content="https://socraticlearning.com/og-image.png" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Socratic Learning - AI Tutoring for Students" />
        <meta name="twitter:description" content="Personalized AI tutoring using the Socratic method. Excel in English & Math." />
        <meta name="twitter:image" content="https://socraticlearning.com/twitter-image.png" />
        
        {/* Schema.org */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "EducationalApplication",
              "name": "Socratic Learning",
              "description": "AI-powered tutoring platform using the Socratic method",
              "applicationCategory": "EducationalApplication",
              "offers": {
                "@type": "Offer",
                "price": "1.00",
                "priceCurrency": "USD",
                "description": "14-day trial"
              }
            })
          }}
        />
      </Head>
      
      <div className="page-wrapper" data-time={timeOfDay} data-season={season}>
        <Header />
        
        <main className="landing-container">
          {loading ? (
            <div className="loading-container">
              <div className="loading-text">Loading...</div>
            </div>
          ) : (
            <>
              {/* Hero Section */}
              <section className="hero-section">
                <div className="content-grid">
                  <div className="hero-content">
                    <h1 className="hero-title">Personalized Learning Revolution</h1>
                    <div className="hero-text">
                      {sections.intro.map((paragraph, index) => (
                        <p key={index} className="hero-paragraph">{paragraph}</p>
                      ))}
                    </div>
                    
                  </div>
                  
                  <div className="feature-cards-container">
                    <div className="feature-card glass">
                      <div className="card-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" opacity="0.8"/>
                        </svg>
                      </div>
                      <h3>Adaptive Content</h3>
                      <p>77 million unique combinations ensure your child never sees the same content twice. Every session feels fresh and purposeful.</p>
                    </div>
                    
                    <div className="feature-card glass">
                      <div className="card-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 11H7V13H9V11ZM13 11H11V13H13V11ZM17 11H15V13H17V11ZM19 4H18V2H16V4H8V2H6V4H5C3.89 4 3.01 4.9 3.01 6L3 20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V9H19V20Z" fill="currentColor" opacity="0.8"/>
                        </svg>
                      </div>
                      <h3>Socratic Method</h3>
                      <p>We don't lecture at students - we guide them to discover answers themselves, building confidence and critical thinking.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Problem Section */}
              <section className="problem-section">
                <div className="content-wrapper">
                  <div className="problem-grid">
                    <div className="problem-cards-stack">
                      <div className="problem-card glass">
                        <div className="card-icon">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor" opacity="0.8"/>
                          </svg>
                        </div>
                        <h3>The Reality Check</h3>
                        <p>What's really happening in today's classrooms - and why it's not working.</p>
                      </div>
                      
                      <div className="problem-card glass">
                        <div className="card-icon">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" opacity="0.8"/>
                          </svg>
                        </div>
                        <h3>Learning tailored to your mood & interests</h3>
                        <p>Personalized education that adapts to how you feel and what excites you.</p>
                      </div>
                    </div>
                    <div className="section-content glass">
                      {sections.problem.map((paragraph, index) => (
                        <p key={index} className="content-paragraph">{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Solution Section */}
              <section className="solution-section">
                <div className="content-grid reverse">
                  <div className="feature-cards-container">
                    <div className="feature-card glass">
                      <div className="card-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.89 20.1 3 19 3ZM19 19H5V5H19V19ZM12 12C10.34 12 9 13.34 9 15S10.34 18 12 18S15 16.66 15 15S13.66 12 12 12ZM12 10C13.66 10 15 8.66 15 7S13.66 4 12 4S9 5.34 9 7S10.34 10 12 10Z" fill="currentColor" opacity="0.8"/>
                        </svg>
                      </div>
                      <h3>Parent Dashboard</h3>
                      <p>Finally get real insights into what your child is learning. Track progress, identify strengths, and spot areas needing support.</p>
                    </div>
                    
                    <div className="feature-card glass">
                      <div className="card-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22S22 17.52 22 12S17.52 2 12 2ZM13 17H11V11H13V17ZM13 9H11V7H13V9Z" fill="currentColor" opacity="0.8"/>
                        </svg>
                      </div>
                      <h3>Unlimited Growth</h3>
                      <p>No time limits, no content restrictions. Let your child explore and learn at their own pace, as much as they want.</p>
                    </div>
                  </div>
                  
                  <div className="solution-content">
                    <h2 className="section-title">Real Results for Real Families</h2>
                    <div className="solution-text">
                      {sections.solution.map((paragraph, index) => (
                        <p key={index} className="content-paragraph">{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Benefits Section */}
              <section className="benefits-section">
                <div className="content-wrapper">
                  <h2 className="section-title">Built by Educators, for Families</h2>
                  <div className="benefits-grid">
                    <div className="benefit-card glass">
                      <div className="card-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2L2 7L12 12L22 7L12 2ZM2 17L12 22L22 17V7L12 12L2 7V17Z" fill="currentColor" opacity="0.8"/>
                        </svg>
                      </div>
                      <h3>20+ Years Teaching</h3>
                      <p>Built with deep understanding of how students actually learn, not how we think they should learn.</p>
                    </div>
                    
                    <div className="benefits-content">
                      {sections.benefits.map((paragraph, index) => (
                        <p key={index} className="content-paragraph">{paragraph}</p>
                      ))}
                    </div>
                  </div>
                  
                  <div className="cta-container">
                    <button 
                      className="cta-button glass"
                      onClick={() => router.push('/login?signup=true')}
                    >
                      Start Learning Free
                    </button>
                    <p className="cta-subtitle">All features free for two weeks • $8/month or $70*/year</p>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
        
        <Footer />
      </div>

      <style jsx>{`
        :root {
          /* Default colors */
          --bg-primary: #1a1a2e;
          --bg-secondary: #2d2d4e;
          --accent-primary: #00ff88;
          --accent-secondary: #0088ff;
          --text-primary: #ffffff;
          --text-secondary: #e0e0e0;
          --glass-bg: rgba(0, 0, 0, 0.3);
          --glass-border: rgba(255, 255, 255, 0.2);
        }

        /* Time-based themes */
        [data-time="morning"] {
          --bg-primary: #2d3561;
          --bg-secondary: #3d4571;
          --accent-primary: #ffd700;
          --accent-secondary: #ff6b6b;
        }

        [data-time="noon"] {
          --bg-primary: #1a2332;
          --bg-secondary: #2a3342;
          --accent-primary: #00d4ff;
          --accent-secondary: #0099cc;
        }

        [data-time="evening"] {
          --bg-primary: #2d1b4e;
          --bg-secondary: #3d2b5e;
          --accent-primary: #ff6b9d;
          --accent-secondary: #c44569;
        }

        [data-time="night"] {
          --bg-primary: #1a1a2e;
          --bg-secondary: #2d2d4e;
          --accent-primary: #00ff88;
          --accent-secondary: #0088ff;
        }

        /* Seasonal modifiers */
        [data-season="spring"] {
          --accent-primary: #88ff00;
          --accent-secondary: #00ff88;
        }

        [data-season="summer"] {
          --accent-primary: #ffd700;
          --accent-secondary: #ff8c00;
        }

        [data-season="fall"] {
          --accent-primary: #ff6b35;
          --accent-secondary: #d35400;
        }

        [data-season="winter"] {
          --accent-primary: #00d4ff;
          --accent-secondary: #0066cc;
        }

        .page-wrapper {
          min-height: 100vh;
          background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
          transition: background 1s ease;
        }

        .landing-container {
          overflow-x: hidden;
        }

        .loading-container {
          min-height: 80vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-text {
          color: var(--text-secondary);
          font-size: 1.2rem;
        }

        /* Glass morphism effect */
        .glass {
          background: rgba(30, 30, 30, 0.4);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 20px;
        }

        /* Floating shapes */
        .floating-shapes {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          pointer-events: none;
          z-index: 1;
        }

        .shape {
          position: absolute;
          background: radial-gradient(circle at center, var(--accent-primary), var(--accent-secondary));
          opacity: 0.5;
          filter: blur(30px);
          animation: float 20s infinite ease-in-out;
          box-shadow: 0 0 120px var(--accent-primary), 0 0 60px var(--accent-secondary);
          mix-blend-mode: screen;
        }

        .shape.circle {
          border-radius: 50%;
        }

        .shape.square {
          border-radius: 20%;
        }

        .shape-1 {
          width: 300px;
          height: 300px;
          top: 10%;
          left: 10%;
          animation-duration: 25s;
        }

        .shape-2 {
          width: 200px;
          height: 200px;
          top: 60%;
          right: 15%;
          animation-duration: 30s;
          animation-delay: -5s;
        }

        .shape-3 {
          width: 250px;
          height: 250px;
          bottom: 20%;
          left: 30%;
          animation-duration: 35s;
          animation-delay: -10s;
        }

        .shape-4 {
          width: 150px;
          height: 150px;
          top: 30%;
          right: 30%;
          animation-duration: 20s;
          animation-delay: -15s;
        }

        .shape-5 {
          width: 350px;
          height: 350px;
          bottom: 10%;
          right: 5%;
          animation-duration: 40s;
          animation-delay: -20s;
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(30px, -30px) rotate(120deg);
          }
          66% {
            transform: translate(-20px, 20px) rotate(240deg);
          }
        }

        /* Interactive particles */
        .particles-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          pointer-events: none;
          z-index: 1;
        }

        .particle {
          position: absolute;
          width: 10px;
          height: 10px;
          background: radial-gradient(circle, var(--accent-primary), transparent);
          border-radius: 50%;
          opacity: 1;
          transition: transform 0.3s ease-out;
          box-shadow: 0 0 20px var(--accent-primary), 0 0 40px var(--accent-primary);
          mix-blend-mode: screen;
          transform: translate(
            calc(var(--mouse-x) * 0.15 * calc(var(--index) - 10) * 0.15),
            calc(var(--mouse-y) * 0.15 * calc(var(--index) - 10) * 0.15)
          );
        }

        .particle:nth-child(even) {
          background: radial-gradient(circle, var(--accent-secondary), transparent);
          width: 8px;
          height: 8px;
          box-shadow: 0 0 20px var(--accent-secondary), 0 0 40px var(--accent-secondary);
        }

        .particle:nth-child(3n) {
          opacity: 0.7;
          width: 6px;
          height: 6px;
        }

        /* Hero Section */
        .hero-section {
          padding: 80px 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 60px;
          align-items: start;
        }

        .hero-title {
          font-size: 2.5rem;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 32px;
          line-height: 1.2;
        }

        .hero-text {
          margin-bottom: 32px;
        }

        .hero-paragraph {
          font-size: 1.5rem;
          line-height: 1.8;
          color: #ffffff;
          margin-bottom: 20px;
          text-align: left;
          font-weight: 400;
        }


        .feature-cards-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .feature-card {
          padding: 32px;
          transition: transform 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-4px);
        }

        .card-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          color: white;
        }

        .feature-card h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 12px;
        }

        .feature-card p {
          font-size: 1.1rem;
          line-height: 1.6;
          color: #e0e0e0;
        }

        /* Problem Section */
        .problem-section {
          padding: 80px 20px;
          background: rgba(0, 0, 0, 0.3);
        }

        .content-wrapper {
          max-width: 1400px;
          margin: 0 auto;
        }

        .problem-grid {
          display: grid;
          grid-template-columns: 400px 1fr;
          gap: 60px;
          align-items: start;
        }

        .problem-cards-stack {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .problem-card {
          padding: 32px;
          height: fit-content;
        }

        .problem-card h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 12px;
        }

        .problem-card p {
          font-size: 1.1rem;
          line-height: 1.6;
          color: #e0e0e0;
        }

        .section-content {
          padding: 48px;
        }

        .content-paragraph {
          font-size: 1.5rem;
          line-height: 1.8;
          color: #ffffff;
          margin-bottom: 24px;
        }

        .content-paragraph:last-child {
          margin-bottom: 0;
        }

        /* Solution Section */
        .solution-section {
          padding: 80px 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .content-grid.reverse {
          grid-template-columns: 1fr 1fr;
        }

        .section-title {
          font-size: 2.5rem;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 32px;
          line-height: 1.2;
        }

        .solution-text {
          margin-bottom: 32px;
        }

        /* Benefits Section */
        .benefits-section {
          padding: 80px 20px;
          background: rgba(0, 0, 0, 0.3);
        }

        .benefits-grid {
          display: grid;
          grid-template-columns: 350px 1fr;
          gap: 48px;
          margin-bottom: 48px;
        }

        .benefit-card {
          padding: 32px;
          height: fit-content;
        }

        .benefits-content {
          padding: 0 24px;
        }

        /* CTA */
        .cta-container {
          text-align: center;
          margin-top: 60px;
        }

        .cta-button {
          padding: 20px 48px;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.3s ease;
          border: 2px solid var(--accent-primary);
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 40px rgba(0, 255, 136, 0.3);
          background: rgba(0, 255, 136, 0.1);
        }

        .cta-subtitle {
          margin-top: 16px;
          color: var(--text-secondary);
          font-size: 1rem;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .content-grid,
          .content-grid.reverse,
          .problem-grid {
            grid-template-columns: 1fr;
            gap: 40px;
          }

          .benefits-grid {
            grid-template-columns: 1fr;
          }

          .hero-title {
            font-size: 2.5rem;
          }

          .section-title {
            font-size: 2rem;
          }
        }

        @media (max-width: 768px) {
          .hero-section,
          .problem-section,
          .solution-section,
          .benefits-section {
            padding: 40px 20px;
          }

          .section-content {
            padding: 32px 24px;
          }

          .hero-title {
            font-size: 2rem;
          }

          .hero-paragraph,
          .content-paragraph {
            font-size: 1.1rem;
          }

          .feature-card,
          .benefit-card {
            padding: 24px;
          }

          .cta-button {
            padding: 16px 32px;
            font-size: 1.1rem;
          }
        }
      `}</style>
    </>
  );
}