import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../lib/AuthContext';
// Removed Firebase import - now using Supabase through AuthContext
import { supabase } from '../lib/db';

export default function ParentDashboard() {
  const router = useRouter();
  const { user, loading: authLoading, getSession } = useAuth();
  const [children, setChildren] = useState([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [childEmail, setChildEmail] = useState('');
  const [childName, setChildName] = useState('');
  const [childGrade, setChildGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'parent')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.id) {
      fetchChildren();
    }
  }, [user]);

  const fetchChildren = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('parent_id', user.id)
        .eq('role', 'student');
      
      if (error) throw error;
      setChildren(data || []);
    } catch (error) {
      console.error('Error fetching children:', error);
    }
  };

  const handleAddChild = async (e) => {
    e.preventDefault();
    if (children.length >= 5) {
      setError('You can only add up to 5 children');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Create child account using Supabase Auth (through API)
      const session = await getSession();
      const token = session?.access_token;
      
      const response = await fetch('/api/parent/add-child', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          parentId: user.id,
          childEmail,
          childName,
          childGrade: parseInt(childGrade)
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add child');
      }

      setSuccess(`Invitation sent to ${childEmail}!`);
      setChildEmail('');
      setChildName('');
      setChildGrade('');
      setShowAddChild(false);
      fetchChildren();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Head>
        <title>Parent Dashboard - Socratic Learning</title>
      </Head>
      
      <div className="page-wrapper">
        <Header />
        
        <main className="dashboard-container">
          <div className="content-wrapper">
            <h1>Parent Dashboard</h1>
            <p className="welcome-text">Welcome, {user.email}</p>
            
            <div className="children-section">
              <div className="section-header">
                <h2>Your Children ({children.length}/5)</h2>
                <button 
                  className="add-child-btn"
                  onClick={() => setShowAddChild(true)}
                  disabled={children.length >= 5}
                >
                  + Add Child
                </button>
              </div>

              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}

              <div className="children-grid">
                {children.map((child) => (
                  <div key={child.id} className="child-card">
                    <h3>{child.email}</h3>
                    <p>Grade {child.grade}</p>
                    <p className="status">
                      Status: {child.account_type === 'trial' ? 'Active' : 'Pending'}
                    </p>
                    {child.trial_started_at && (
                      <p className="trial-info">
                        Trial Day {Math.ceil((Date.now() - new Date(child.trial_started_at).getTime()) / (1000 * 60 * 60 * 24))} of 15
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {showAddChild && (
                <div className="modal-overlay" onClick={() => setShowAddChild(false)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <h2>Add Your Child</h2>
                    <form onSubmit={handleAddChild}>
                      <div className="form-group">
                        <input
                          type="text"
                          placeholder="Child's Full Name"
                          value={childName}
                          onChange={(e) => setChildName(e.target.value)}
                          required
                          className="form-input"
                        />
                      </div>
                      
                      <div className="form-group">
                        <input
                          type="email"
                          placeholder="Child's Email"
                          value={childEmail}
                          onChange={(e) => setChildEmail(e.target.value)}
                          required
                          className="form-input"
                        />
                      </div>
                      
                      <div className="form-group">
                        <select
                          value={childGrade}
                          onChange={(e) => setChildGrade(e.target.value)}
                          required
                          className="form-input"
                        >
                          <option value="">Select Grade</option>
                          {[5, 6, 7, 8, 9, 10, 11].map(g => (
                            <option key={g} value={g}>Grade {g}</option>
                          ))}
                        </select>
                      </div>

                      <div className="modal-actions">
                        <button type="submit" className="submit-btn" disabled={loading}>
                          {loading ? 'Sending...' : 'Send Invitation'}
                        </button>
                        <button type="button" className="cancel-btn" onClick={() => setShowAddChild(false)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
        
        <Footer />
      </div>

      <style jsx>{`
        .page-wrapper {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #2d2d4e 100%);
        }

        .dashboard-container {
          flex: 1;
          padding: 40px 20px;
        }

        .content-wrapper {
          max-width: 1200px;
          margin: 0 auto;
        }

        h1 {
          color: #ffffff;
          font-size: 2.5rem;
          margin-bottom: 8px;
        }

        .welcome-text {
          color: #e0e0e0;
          font-size: 1.2rem;
          margin-bottom: 40px;
        }

        .children-section {
          background: rgba(30, 30, 30, 0.4);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          padding: 32px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .section-header h2 {
          color: #ffffff;
          font-size: 1.8rem;
        }

        .add-child-btn {
          background: linear-gradient(135deg, #00ff88, #0088ff);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .add-child-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.4);
        }

        .add-child-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .children-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px;
        }

        .child-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 24px;
          transition: all 0.3s ease;
        }

        .child-card:hover {
          transform: translateY(-4px);
          border-color: #00ff88;
        }

        .child-card h3 {
          color: #ffffff;
          font-size: 1.2rem;
          margin-bottom: 12px;
        }

        .child-card p {
          color: #e0e0e0;
          margin-bottom: 8px;
        }

        .status {
          color: #00ff88;
        }

        .trial-info {
          color: #ffd700;
          font-size: 0.9rem;
        }

        .error-message, .success-message {
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .error-message {
          background: rgba(255, 71, 87, 0.1);
          border: 1px solid rgba(255, 71, 87, 0.3);
          color: #ff4757;
        }

        .success-message {
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.3);
          color: #00ff88;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: #1a1a2e;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          padding: 40px;
          max-width: 500px;
          width: 90%;
        }

        .modal-content h2 {
          color: #ffffff;
          margin-bottom: 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-input {
          width: 100%;
          padding: 16px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          color: #ffffff;
          font-size: 1rem;
        }

        .form-input:focus {
          outline: none;
          border-color: #00ff88;
        }

        .modal-actions {
          display: flex;
          gap: 16px;
          margin-top: 24px;
        }

        .submit-btn, .cancel-btn {
          flex: 1;
          padding: 16px;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .submit-btn {
          background: linear-gradient(135deg, #00ff88, #0088ff);
          color: white;
        }

        .cancel-btn {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.4);
        }

        .cancel-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        @media (max-width: 768px) {
          .children-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}