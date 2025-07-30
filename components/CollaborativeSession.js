import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/db';
import { retrieveSessionData } from '../lib/studentSession';
import QuestionCard from './QuestionCard';

/**
 * Collaborative Session Component
 * 
 * Handles real-time collaborative learning sessions between tutor/parent and student.
 * Supports session creation, joining, and real-time synchronization.
 */
export default function CollaborativeSession({ onBack }) {
  const { user, getSession } = useAuth();
  const [sessionState, setSessionState] = useState('idle'); // idle, creating, waiting, joining, active, completed
  const [sessionCode, setSessionCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [collaborativeActions, setCollaborativeActions] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState('');
  
  const channelRef = useRef(null);

  // Load children for parent users
  useEffect(() => {
    if (user?.role === 'parent') {
      loadChildren();
    }
  }, [user]);

  const loadChildren = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, grade')
        .eq('parent_id', user.id)
        .eq('role', 'student');
      
      if (error) throw error;
      setChildren(data || []);
    } catch (error) {
      console.error('Error loading children:', error);
    }
  };

  // Set up real-time subscription for collaborative session
  useEffect(() => {
    if (sessionData?.id) {
      setupRealtimeSubscription(sessionData.id);
    }
    
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [sessionData?.id]);

  const setupRealtimeSubscription = (sessionId) => {
    // Subscribe to collaborative actions
    const channel = supabase
      .channel(`collaborative_session_${sessionId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'collaborative_actions',
          filter: `session_id=eq.${sessionId}`
        }, 
        (payload) => {
          const newAction = payload.new;
          setCollaborativeActions(prev => [...prev, newAction]);
          
          // Handle different action types
          if (newAction.action_type === 'answer_select' && newAction.user_id !== user.id) {
            // Show real-time answer selection to observer
            handleRealtimeAnswerSelect(newAction);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
  };

  const handleRealtimeAnswerSelect = (action) => {
    // This would update the UI to show the participant's selection in real-time
    console.log('Real-time answer selection:', action);
  };

  const createSession = async () => {
    if (!selectedChild) {
      setError('Please select a student');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get auth token
      let authHeader = '';
      if (user.role === 'parent') {
        const session = await getSession();
        if (session?.access_token) {
          authHeader = `Bearer ${session.access_token}`;
        }
      }

      const response = await fetch('/api/collaborative-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          action: 'create',
          participantId: selectedChild
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSessionData(data.session);
        setSessionCode(data.session.sessionCode);
        setSessionState('waiting');
      } else {
        setError(data.error || 'Failed to create session');
      }
    } catch (error) {
      console.error('Create session error:', error);
      setError('Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async () => {
    if (!inputCode.trim()) {
      setError('Please enter a session code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get auth token for student
      let authHeader = '';
      if (user.role === 'student') {
        const studentData = retrieveSessionData();
        if (studentData?.sessionToken) {
          authHeader = `Student ${studentData.sessionToken}`;
        }
      } else {
        const session = await getSession();
        if (session?.access_token) {
          authHeader = `Bearer ${session.access_token}`;
        }
      }
      
      const response = await fetch('/api/collaborative-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          action: 'join',
          sessionCode: inputCode.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSessionData(data.session);
        setQuestions(data.session.questions);
        setCurrentQuestionIndex(0);
        setCurrentQuestion(data.session.questions[0]);
        setSessionState('active');
      } else {
        if (response.status === 503) {
          setError(data.userMessage || 'Service temporarily unavailable');
        } else {
          setError(data.error || 'Failed to join session');
        }
      }
    } catch (error) {
      console.error('Join session error:', error);
      setError('Failed to join session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (!sessionCode) return;

    try {
      const response = await fetch('/api/collaborative-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getSession()?.access_token}`
        },
        body: JSON.stringify({
          action: 'end',
          sessionCode: sessionCode
        })
      });

      if (response.ok) {
        setSessionState('completed');
      }
    } catch (error) {
      console.error('End session error:', error);
    }
  };

  const handleAnswer = async (correct, timeSpent, hintsUsed, selectedAnswer) => {
    // Log the answer selection action
    try {
      // Get auth token
      let authHeader = '';
      if (user.role === 'student') {
        const studentData = retrieveSessionData();
        if (studentData?.sessionToken) {
          authHeader = `Student ${studentData.sessionToken}`;
        }
      } else {
        const session = await getSession();
        if (session?.access_token) {
          authHeader = `Bearer ${session.access_token}`;
        }
      }

      // Log action via API
      await fetch('/api/collaborative-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          sessionId: sessionData.id,
          actionType: 'answer_submit',
          actionData: {
            correct,
            timeSpent,
            hintsUsed,
            selectedAnswer
          },
          questionHash: currentQuestion.questionHash
        })
      });
    } catch (error) {
      console.error('Error logging answer:', error);
    }
  };

  const handleNext = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      setCurrentQuestion(questions[nextIndex]);
      
      // Log the next question action
      try {
        let authHeader = '';
        if (user.role === 'student') {
          const studentData = retrieveSessionData();
          if (studentData?.sessionToken) {
            authHeader = `Student ${studentData.sessionToken}`;
          }
        } else {
          const session = await getSession();
          if (session?.access_token) {
            authHeader = `Bearer ${session.access_token}`;
          }
        }

        await fetch('/api/collaborative-actions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            sessionId: sessionData.id,
            actionType: 'question_next',
            actionData: {
              nextIndex: nextIndex,
              nextQuestionHash: questions[nextIndex].questionHash
            },
            questionHash: questions[nextIndex].questionHash
          })
        });
      } catch (error) {
        console.error('Error logging next question:', error);
      }
    } else {
      endSession();
    }
  };

  // Render different states
  if (sessionState === 'idle') {
    return (
      <div className="flex justify-center items-center min-h-500 p-xl">
        <div className="glass card text-center max-w-600">
          <h2 className="mb-xl">Collaborative Learning</h2>
          
          {user?.role === 'parent' && (
            <div className="mb-xl">
              <h3 className="text-lg mb-md">Start Session with Your Child</h3>
              <div className="mb-md">
                <label className="block text-sm font-medium mb-sm">Select Student:</label>
                <select 
                  value={selectedChild} 
                  onChange={(e) => setSelectedChild(e.target.value)}
                  className="w-full"
                >
                  <option value="">Choose a student...</option>
                  {children.map(child => (
                    <option key={child.id} value={child.id}>
                      {child.first_name} (Grade {child.grade})
                    </option>
                  ))}
                </select>
              </div>
              <button 
                onClick={createSession}
                disabled={loading || !selectedChild}
                className="btn-primary"
              >
                {loading ? 'Creating...' : 'Create Session'}
              </button>
            </div>
          )}

          {user?.role === 'student' && (
            <div className="mb-xl">
              <h3 className="text-lg mb-md">Join a Session</h3>
              <div className="mb-md">
                <label className="block text-sm font-medium mb-sm">Session Code:</label>
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full text-center text-lg"
                  maxLength={6}
                />
              </div>
              <button 
                onClick={joinSession}
                disabled={loading || !inputCode.trim()}
                className="btn-primary"
              >
                {loading ? 'Joining...' : 'Join Session'}
              </button>
            </div>
          )}

          {error && (
            <div className="bg-error-light border-error-light p-md" style={{ borderRadius: 'var(--radius-lg)' }}>
              <p className="text-error">{error}</p>
            </div>
          )}
          
          {onBack && (
            <button onClick={onBack} className="btn-secondary mt-md">
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  if (sessionState === 'waiting') {
    return (
      <div className="flex justify-center items-center min-h-500 p-xl">
        <div className="glass card text-center max-w-600">
          <h2 className="mb-xl">Session Created!</h2>
          <div className="mb-xl">
            <p className="text-lg mb-md">Share this code with your student:</p>
            <div className="text-4xl font-bold text-primary mb-md">{sessionCode}</div>
            <p className="text-secondary">Waiting for {sessionData?.participantName} to join...</p>
          </div>
          
          <div className="flex gap-md justify-center">
            <button 
              onClick={endSession}
              className="btn-secondary"
            >
              Cancel Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sessionState === 'active') {
    return (
      <div className="w-full max-w-1400 mx-auto">
        <div className="glass mb-lg" style={{ borderRadius: '20px', padding: '20px 28px' }}>
          <div className="flex justify-between items-center">
            <div>
              <h2>Collaborative Session</h2>
              <p className="text-secondary">
                {user.role === 'parent' ? `Observing ${sessionData.participantName || 'Student'}` : 
                 `Session with ${sessionData.initiatorName || 'Tutor'}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-secondary">Question {currentQuestionIndex + 1} of {questions.length}</p>
              <button onClick={endSession} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                End Session
              </button>
            </div>
          </div>
        </div>

        {currentQuestion && (
          <QuestionCard
            question={currentQuestion}
            topic={currentQuestion.topic}
            difficulty={currentQuestion.difficulty}
            proficiency={currentQuestion.proficiency || 5}
            onAnswer={handleAnswer}
            onNext={handleNext}
            userId={user.id}
            getSession={getSession}
            timerDuration={45}
            timeRemaining={45}
            isCollaborative={true}
            isObserver={user.role === 'parent'}
          />
        )}

        {user.role === 'parent' && (
          <div className="glass card mt-lg">
            <h3 className="text-lg mb-md">Real-time Activity</h3>
            <div>
              {collaborativeActions.slice(-5).map((action, index) => (
                <div key={index} className="text-sm text-secondary mb-sm">
                  {action.action_type === 'answer_select' && 
                    `Student selected answer: ${action.action_data.selectedAnswer}`}
                  {action.action_type === 'hint_request' && 
                    `Student requested a hint`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (sessionState === 'completed') {
    return (
      <div className="flex justify-center items-center min-h-500 p-xl">
        <div className="glass card text-center max-w-600">
          <h2 className="mb-xl">Session Complete!</h2>
          <p className="text-lg mb-xl">Great job working together!</p>
          <button 
            onClick={() => setSessionState('idle')}
            className="btn-primary"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  return null;
}