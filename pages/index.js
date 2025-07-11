import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && router.isReady) {
        setTimeout(() => {
          router.push('/dashboard');
        }, 100);
      }
    });
    
    return () => subscription.unsubscribe();
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
      
      <div className="page-wrapper">
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
                  <div className="content-section glass">
                    <h1 className="hero-title">Personalized Learning Revolution</h1>
                    <div className="hero-text">
                      {sections.intro.map((paragraph, index) => (
                        <p key={index} className="hero-paragraph">{paragraph}</p>
                      ))}
                    </div>
                  </div>
                  
                  <div className="feature-cards-container">
                    <div className="feature-card glass">
                      <div className="feature-content">
                        <div className="card-icon">
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z" fill="currentColor"/>
                          </svg>
                        </div>
                        <div className="feature-text">
                          <h3>Socratic Method</h3>
                          <p>We don't lecture at students - we guide them to discover answers themselves, building confidence and critical thinking.</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="feature-card glass">
                      <div className="feature-content">
                        <div className="card-icon">
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L2 7V10C2 16 6 20.5 12 22C18 20.5 22 16 22 10V7L12 2M12 4.14L20 8.35V10C20 15.26 16.67 19.1 12 20C7.33 19.1 4 15.26 4 10V8.35L12 4.14Z" fill="currentColor"/>
                          </svg>
                        </div>
                        <div className="feature-text">
                          <h3>Adaptive Content</h3>
                          <p>77 million unique combinations ensure your child never sees the same content twice. Every session feels fresh and purposeful.</p>
                        </div>
                      </div>
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
                        <div className="feature-content">
                          <div className="card-icon">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z" fill="currentColor"/>
                            </svg>
                          </div>
                          <div className="feature-text">
                            <h3>The Reality Check</h3>
                            <p>What's really happening in today's classrooms...and why it's not working.</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="problem-card glass">
                        <div className="feature-content">
                          <div className="card-icon">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12,3L1,9L12,15L21,9V16H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z" fill="currentColor"/>
                            </svg>
                          </div>
                          <div className="feature-text">
                            <h3>Learning tailored to your mood & interests</h3>
                            <p>Personalized education that adapts to how you feel and what excites you.</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="problem-card glass">
                        <div className="feature-content">
                          <div className="card-icon">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12 2L2 7V10C2 16 6 20.5 12 22C18 20.5 22 16 22 10V7L12 2M12 4.14L20 8.35V10C20 15.26 16.67 19.1 12 20C7.33 19.1 4 15.26 4 10V8.35L12 4.14Z" fill="currentColor"/>
                            </svg>
                          </div>
                          <div className="feature-text">
                            <h3>Adaptive Content</h3>
                            <p>77 million unique combinations ensure your child never sees the same content twice. Every session feels fresh and purposeful.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="content-section glass">
                      <h2 className="section-title">Real Results for Real Families</h2>
                      {sections.problem.map((paragraph, index) => (
                        <p key={index} className="content-paragraph">{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Solution Section - this section has been merged with benefits */}

              {/* Benefits Section */}
              <section className="benefits-section">
                <div className="content-wrapper">
                  <div className="benefits-grid">
                    <div className="content-section glass">
                      <h2 className="section-title">Built by Educators, for Families</h2>
                      <div className="solution-text">
                        {sections.solution.map((paragraph, index) => (
                          <p key={index} className="content-paragraph">{paragraph}</p>
                        ))}
                      </div>
                      <div className="benefits-content" style={{ marginTop: '2rem' }}>
                        {sections.benefits.map((paragraph, index) => (
                          <p key={index} className="content-paragraph">{paragraph}</p>
                        ))}
                      </div>
                    </div>
                    
                    <div className="feature-cards-container">
                      <div className="feature-card glass">
                        <div className="feature-content">
                          <div className="card-icon">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M16,4C18.21,4 20,5.79 20,8C20,10.21 18.21,12 16,12C13.79,12 12,10.21 12,8C12,5.79 13.79,4 16,4M16,14C18.67,14 24,15.33 24,18V20H8V18C8,15.33 13.33,14 16,14M8,4C10.21,4 12,5.79 12,8C12,10.21 10.21,12 8,12C5.79,12 4,10.21 4,8C4,5.79 5.79,4 8,4M8,14C10.67,14 16,15.33 16,18V20H0V18C0,15.33 5.33,14 8,14Z" fill="currentColor"/>
                            </svg>
                          </div>
                          <div className="feature-text">
                            <h3>Parent Dashboard</h3>
                            <p>Finally get real insights into what your child is learning, track progress, identify strengths, and spot areas needing support.</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="feature-card glass">
                        <div className="feature-content">
                          <div className="card-icon">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M16,6L18.29,8.29L13.41,13.17L9.41,9.17L2,16.59L3.41,18L9.41,12L13.41,16L19.71,9.71L22,12V6H16Z" fill="currentColor"/>
                            </svg>
                          </div>
                          <div className="feature-text">
                            <h3>Unlimited Growth</h3>
                            <p>No time limits, no content restrictions. Let your child explore and learn at their own pace, as much as they want.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="cta-container">
                    <button 
                      className="cta-button"
                      onClick={() => router.push('/signup')}
                    >
                      Start Learning
                    </button>
                    <p className="cta-subtitle">All features at $1 for first two weeks • $8/month or $70*/year</p>
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
          /* Sandy white colors with better contrast */
          --bg-primary: #fdfcfa;
          --bg-secondary: #f9f7f4;
          --accent-primary: #667eea;
          --accent-secondary: #764ba2;
          --text-primary: #1a1a1a;
          --text-secondary: #333333;
          --glass-bg: rgba(255, 255, 255, 0.7);
          --glass-border: rgba(0, 0, 0, 0.1);
        }

        .page-wrapper {
          min-height: 100vh;
          background: 
            radial-gradient(circle at 20% 50%, rgba(120, 119, 116, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(120, 119, 116, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(120, 119, 116, 0.01) 0%, transparent 50%),
            linear-gradient(135deg, #fdfcfa 0%, #f9f7f4 100%);
          position: relative;
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

        .landing-container {
          overflow-x: hidden;
          position: relative;
          z-index: 2;
        }

        .loading-container {
          min-height: 80vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
        }

        .loading-text {
          color: var(--text-primary);
          font-size: 1.3rem;
          font-weight: 500;
        }

        /* Glass morphism effect - off-white version */
        .glass {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 20px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
        }

        /* Removed floating shapes and particles for cleaner light design */

        /* Hero Section */
        .hero-section {
          padding: 60px 5%;
          width: 100%;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          align-items: start;
          width: 100%;
        }

        .hero-title {
          font-size: 3rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 2rem;
          line-height: 1.2;
        }

        .hero-text {
          margin-bottom: 32px;
        }

        .hero-paragraph {
          font-size: 3.2rem;
          line-height: 1.8;
          color: #1a1a1a !important;
          margin-bottom: 2rem;
          text-align: left;
          font-weight: 400;
        }


        .feature-cards-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .feature-card {
          padding: 2rem;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
        }

        .feature-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
        }
        
        .feature-content {
          display: flex;
          align-items: flex-start;
          gap: 1.5rem;
        }
        
        .feature-text {
          flex: 1;
        }

        .card-icon {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
          animation: glow 2s ease-in-out infinite alternate;
          flex-shrink: 0;
          color: white;
        }
        
        @keyframes glow {
          from { box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4); }
          to { box-shadow: 0 4px 30px rgba(102, 126, 234, 0.6), 0 0 40px rgba(102, 126, 234, 0.3); }
        }

        .feature-card h3 {
          font-size: 3.6rem;
          font-weight: 700;
          color: #1a1a1a !important;
          margin-bottom: 1.5rem;
        }

        .feature-card p {
          font-size: 2.8rem;
          line-height: 1.7;
          color: #1a1a1a !important;
        }

        /* Content Section */
        .content-section {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 0, 0, 0.06);
          border-radius: 25px;
          padding: 3rem;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);
        }
        
        /* Problem Section */
        .problem-section {
          padding: 60px 5%;
        }

        .content-wrapper {
          width: 100%;
          padding: 0;
        }

        .problem-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          align-items: start;
          width: 100%;
        }

        .problem-cards-stack {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .problem-card {
          padding: 2rem;
          height: fit-content;
        }

        .problem-card h3 {
          font-size: 3.6rem;
          font-weight: 700;
          color: #1a1a1a !important;
          margin-bottom: 1.5rem;
        }

        .problem-card p {
          font-size: 2.8rem;
          line-height: 1.7;
          color: #1a1a1a !important;
        }

        .section-content {
          padding: 3rem;
        }

        .content-paragraph {
          font-size: 3.2rem;
          line-height: 1.8;
          color: #1a1a1a !important;
          margin-bottom: 2rem;
        }

        .content-paragraph:last-child {
          margin-bottom: 0;
        }

        /* Solution Section */
        .solution-section {
          padding: 60px 5%;
          width: 100%;
        }

        .content-grid.reverse {
          grid-template-columns: 1fr 1fr;
        }

        .section-title {
          font-size: 3rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 2rem;
          line-height: 1.2;
        }

        .solution-text {
          margin-bottom: 32px;
        }

        /* Benefits Section */
        .benefits-section {
          padding: 60px 5%;
        }

        .benefits-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          margin-bottom: 48px;
          width: 100%;
        }

        .benefit-card {
          padding: 2rem;
          height: fit-content;
        }

        .benefits-content {
          padding: 0;
        }

        /* CTA */
        .cta-container {
          text-align: center;
          margin-top: 3rem;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 25px;
          padding: 3rem;
        }

        .cta-button {
          background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
          color: white;
          padding: 1rem 2.5rem;
          border: none;
          border-radius: 25px;
          font-size: 1.2rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
        }

        .cta-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 25px rgba(102, 126, 234, 0.6);
        }

        .cta-subtitle {
          margin-top: 1rem;
          color: var(--text-secondary);
          font-size: 1rem;
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .hero-section,
          .problem-section,
          .solution-section,
          .benefits-section {
            padding: 60px 4%;
          }
        }
        
        @media (max-width: 1024px) {
          .content-grid,
          .content-grid.reverse,
          .problem-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .benefits-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .hero-title {
            font-size: 2.5rem;
          }

          .section-title {
            font-size: 2.5rem;
          }
        }

        @media (max-width: 768px) {
          .hero-section,
          .problem-section,
          .solution-section,
          .benefits-section {
            padding: 40px 20px;
          }
          
          .content-wrapper {
            padding: 0 20px;
          }

          .content-section,
          .section-content {
            padding: 2rem;
          }

          .hero-title {
            font-size: 2.2rem;
          }

          .section-title {
            font-size: 2.2rem;
          }

          .hero-paragraph,
          .content-paragraph {
            font-size: 2.6rem;
          }

          .feature-card,
          .problem-card,
          .benefit-card {
            padding: 1.5rem;
          }
          
          .feature-card h3,
          .problem-card h3 {
            font-size: 3rem;
          }
          
          .feature-card p,
          .problem-card p {
            font-size: 2.4rem;
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