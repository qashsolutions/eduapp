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
        <title>Socratic Learning - Smart English Tutoring for Grades 5-9 | AI-Powered Learning</title>
        <meta name="description" content="Smart English tutoring that adapts to your child's learning style. AI-powered Socratic method for grades 5-9. Built by teachers, loved by students. Just $6/month." />
        <meta name="keywords" content="English tutoring grades 5-9, AI English tutor, Socratic method learning, middle school English help, personalized English learning, adaptive English tutoring, online English tutor" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://socratic-thinking.com/" />
        
        {/* Open Graph */}
        <meta property="og:title" content="Socratic Learning - Smart English Tutoring That Actually Works" />
        <meta property="og:description" content="AI-powered English tutoring for grades 5-9. Personalized learning that adapts to every student. Built by real teachers. Start today for $6/month." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://socratic-thinking.com/" />
        <meta property="og:image" content="https://socratic-thinking.com/og-image.png" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Smart English Tutoring for Grades 5-9 | Socratic Learning" />
        <meta name="twitter:description" content="AI meets Socratic method. Personalized English tutoring that adapts to your child. Built by teachers. $6/month." />
        <meta name="twitter:image" content="https://socratic-thinking.com/twitter-image.png" />
        
        {/* Schema.org */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "EducationalApplication",
              "name": "Socratic Learning",
              "description": "Smart English tutoring platform for grades 5-9 using AI and Socratic method",
              "applicationCategory": "EducationalApplication",
              "educationalLevel": "Middle School (Grades 5-9)",
              "teaches": "English Language Arts",
              "offers": {
                "@type": "Offer",
                "price": "6.00",
                "priceCurrency": "USD",
                "description": "Monthly subscription"
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
                <div className="hero-grid">
                  <div className="hero-content">
                    <h1 className="hero-title">
                      <span className="gradient-text">Smart English Tutoring</span>
                      <br />
                      That Actually Works
                    </h1>
                    <p className="hero-subtitle">
                      AI meets Socratic method to help grades 5-9 students master English.
                      Personalized learning that adapts to every child.
                    </p>
                    <button 
                      className="hero-cta"
                      onClick={() => router.push('/signup')}
                    >
                      Get Started Today
                    </button>
                  </div>
                  
                  <div className="hero-visual">
                    <div className="visual-container">
                      <div className="floating-element element-1">Personalized</div>
                      <div className="floating-element element-2">Smart AI</div>
                      <div className="floating-element element-3">Results</div>
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
                            <h3>Learning tailored to your progress</h3>
                            <p>Personalized education that adapts to your proficiency level and learning needs.</p>
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
          /* Off-white background with accent colors */
          --bg-primary: #fafafa;
          --bg-secondary: #f5f5f5;
          --accent-primary: #667eea;
          --accent-secondary: #764ba2;
          --text-primary: #1a1a1a;
          --text-secondary: #4a4a4a;
          --glass-bg: rgba(255, 255, 255, 0.25);
          --glass-border: rgba(255, 255, 255, 0.3);
        }

        .page-wrapper {
          min-height: 100vh;
          background: #fafafa;
          position: relative;
        }
        
        /* Removed page wrapper pattern for cleaner design */

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

        /* Glass morphism effect */
        .glass {
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        /* Removed floating shapes and particles for cleaner light design */

        /* Hero Section */
        .hero-section {
          padding: 80px 5%;
          width: 100%;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4rem;
          align-items: center;
          max-width: 1200px;
          margin: 0 auto;
        }

        .hero-content {
          padding-right: 2rem;
        }

        .hero-title {
          font-size: 3.5rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 1.5rem;
          line-height: 1.2;
        }

        .gradient-text {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 1.25rem;
          line-height: 1.6;
          color: #4a4a4a;
          margin-bottom: 2rem;
        }

        .hero-cta {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1rem 2.5rem;
          border: none;
          border-radius: 30px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
        }

        .hero-cta:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 30px rgba(102, 126, 234, 0.6);
        }

        .hero-visual {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
        }

        .visual-container {
          width: 300px;
          height: 300px;
          position: relative;
        }

        .floating-element {
          position: absolute;
          padding: 1rem 1.5rem;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 20px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          font-weight: 600;
          color: #667eea;
        }

        .element-1 {
          top: 20%;
          left: 10%;
          animation: float 3s ease-in-out infinite;
        }

        .element-2 {
          top: 50%;
          right: 10%;
          animation: float 3s ease-in-out infinite 1s;
        }

        .element-3 {
          bottom: 20%;
          left: 30%;
          animation: float 3s ease-in-out infinite 2s;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }


        /* Removed old feature card styles as they're not used in new design */
        
        /* Problem Section */
        .problem-section {
          padding: 80px 5%;
          background: #fef3c7;
        }

        .problem-container {
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }

        .educator-quote {
          font-size: 1.5rem;
          line-height: 1.8;
          font-style: italic;
          color: #1a1a1a;
          margin-bottom: 1.5rem;
        }

        .quote-author {
          font-size: 1rem;
          color: #4a4a4a;
          font-style: normal;
        }

        /* Removed old content paragraph styles */

        /* Solution Section */
        .solution-section {
          padding: 80px 5%;
        }

        .solution-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .solution-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
        }

        .solution-card {
          padding: 2rem;
          text-align: center;
          transition: all 0.3s ease;
        }

        .solution-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 12px 40px rgba(102, 126, 234, 0.3);
        }

        .solution-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          color: white;
        }

        .solution-card h3 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 0.75rem;
        }

        .solution-card p {
          font-size: 0.95rem;
          line-height: 1.6;
          color: #4a4a4a;
        }

        /* Testimonial Section */
        .testimonial-section {
          padding: 80px 5%;
          background: #f5f5f5;
        }

        .testimonial-container {
          max-width: 900px;
          margin: 0 auto;
        }

        .testimonial-card {
          padding: 3rem;
        }

        .testimonial-content blockquote {
          font-size: 1.3rem;
          line-height: 1.8;
          color: #1a1a1a;
          margin-bottom: 2rem;
          font-style: italic;
        }

        .testimonial-author {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .author-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 1.2rem;
        }

        .author-info {
          text-align: left;
        }

        .author-name {
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 0.25rem;
        }

        .author-title {
          font-size: 0.9rem;
          color: #4a4a4a;
        }

        /* CTA Section */
        .cta-section {
          padding: 80px 5%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          text-align: center;
        }

        .cta-content {
          max-width: 600px;
          margin: 0 auto;
        }

        .cta-content h2 {
          font-size: 2.5rem;
          font-weight: 700;
          color: white;
          margin-bottom: 1rem;
        }

        .cta-content p {
          font-size: 1.2rem;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 2rem;
        }

        .cta-button-final {
          background: white;
          color: #667eea;
          padding: 1rem 2.5rem;
          border: none;
          border-radius: 30px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        .cta-button-final:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 30px rgba(0, 0, 0, 0.3);
        }

        /* Responsive */
        @media (max-width: 1200px) {
          .hero-section,
          .problem-section,
          .solution-section,
          .testimonial-section,
          .cta-section {
            padding: 60px 4%;
          }
        }
        
        @media (max-width: 1024px) {
          .hero-grid {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .hero-visual {
            display: none;
          }

          .hero-title {
            font-size: 2.5rem;
          }

          .cta-content h2 {
            font-size: 2rem;
          }
        }

        @media (max-width: 768px) {
          .hero-section,
          .problem-section,
          .solution-section,
          .testimonial-section,
          .cta-section {
            padding: 40px 20px;
          }

          .hero-title {
            font-size: 2rem;
          }

          .hero-subtitle {
            font-size: 1.1rem;
          }

          .solution-grid {
            grid-template-columns: 1fr;
          }

          .solution-card {
            padding: 1.5rem;
          }

          .educator-quote {
            font-size: 1.2rem;
          }

          .testimonial-content blockquote {
            font-size: 1.1rem;
          }

          .cta-content h2 {
            font-size: 1.8rem;
          }

          .cta-content p {
            font-size: 1rem;
          }
        }
      `}</style>
    </>
  );
}