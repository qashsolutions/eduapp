import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ProgressBar from '../components/ProgressBar';
import QuestionCard from '../components/QuestionCard';
import { useAuth } from '../lib/AuthContext';
import { getUser, getSessionStats } from '../lib/db';
import { formatTopicName, getCachedProficiency, setCachedProficiency, mapProficiencyToDifficulty } from '../lib/utils';
import { retrieveSessionData, storeSessionData, checkSessionExpiry } from '../lib/studentSession';
import { questionRateLimiter } from '../lib/rateLimiter';

// Enable comprehensive logging for debugging cache-based system
const DEBUG = true;
const log = (category, message, data = null) => {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${category}] ${message}`, data ? data : '');
  }
};

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated, getSession } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState('mixed_session');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sessionStats, setSessionStats] = useState({ totalQuestions: 0, correctAnswers: 0 });
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [questionBatch, setQuestionBatch] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [batchId, setBatchId] = useState(null);
  const [sessionQuestionCount, setSessionQuestionCount] = useState(0);
  const [totalSessionQuestions, setTotalSessionQuestions] = useState(30);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(1800); // 30 minutes
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentHintsUsed, setCurrentHintsUsed] = useState(0);
  
  // NEW: Track learning flow state
  const [comprehensionPassagesCompleted, setComprehensionPassagesCompleted] = useState(0);
  const [grammarQuestionsCompleted, setGrammarQuestionsCompleted] = useState(0);
  const [isInGrammarMode, setIsInGrammarMode] = useState(false);
  const [topicRotationIndex, setTopicRotationIndex] = useState(0);
  
  // NEW: Timer state for cache-based system
  const [timerDuration, setTimerDuration] = useState(60); // Default 60 seconds
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  
  // Topic rotation order (after grammar questions)
  const ENGLISH_TOPICS = [
    'english_vocabulary',
    'english_synonyms', 
    'english_antonyms',
    'english_sentences',
    'english_comprehension'
  ];

  // Timer effect for individual questions
  useEffect(() => {
    let interval;
    
    if (timerActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            log('TIMER', 'Time expired - auto-submitting answer');
            // Auto-submit when timer expires
            handleTimerExpired();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [timerActive, timeRemaining]);

  // Session timer effect
  useEffect(() => {
    let interval;
    
    if (sessionStartTime && sessionTimeRemaining > 0 && currentQuestion) {
      interval = setInterval(() => {
        setSessionTimeRemaining(prev => {
          if (prev <= 1) {
            log('SESSION', 'Session time expired - ending session');
            handleSessionTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [sessionStartTime, sessionTimeRemaining, currentQuestion]);

  // Handle timer expiration
  const handleTimerExpired = () => {
    log('TIMER', 'Timer expired, forcing answer submission');
    // Force submit with no answer selected
    if (currentQuestion) {
      // This will be handled by QuestionCard component
      const event = new CustomEvent('forceSubmit');
      window.dispatchEvent(event);
    }
  };

  // Handle session time up
  const handleSessionTimeUp = () => {
    log('SESSION', 'Session time expired, showing analytics');
    // End session and show analytics
    handleShowAnalytics();
  };

  // Show analytics screen
  const handleShowAnalytics = () => {
    setSelectedTopic('analytics');
    // Analytics will be implemented next
  };

  useEffect(() => {
    log('AUTH', 'Auth state changed', { authLoading, isAuthenticated, userId: user?.id });
    
    if (!authLoading && isAuthenticated && user) {
      // Auto-start mixed session for students
      if (user.role === 'student' && selectedTopic === 'mixed_session' && !currentQuestion && !generating) {
        handleAutoStartSession();
      }
      
      // Load session stats when user is available
      getSessionStats(user.id).then(stats => {
        log('SESSION', 'Session stats loaded', stats);
        setSessionStats(stats);
      }).catch(error => {
        log('ERROR', 'Failed to load session stats', error);
        console.error('Error loading session stats:', error);
      });
      
      // Check session expiry for students
      if (user.role === 'student') {
        const studentData = retrieveSessionData();
        log('STUDENT', 'Student session data', { hasData: !!studentData, expiresAt: studentData?.expiresAt });
        
        if (studentData && studentData.expiresAt) {
          const expiryStatus = checkSessionExpiry(studentData.expiresAt);
          log('SESSION', 'Session expiry status', expiryStatus);
          
          // Refresh session if less than 2 days until expiry
          if (expiryStatus.shouldRefresh) {
            log('SESSION', 'Refreshing student session');
            fetch('/api/refresh-student-session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Student ${studentData.sessionToken}`
              }
            })
            .then(res => res.json())
            .then(result => {
              log('SESSION', 'Session refresh result', result);
              if (result.success) {
                // Update stored session with new expiry
                const updatedData = { ...studentData, expiresAt: result.expiresAt };
                const keepSignedIn = localStorage.getItem('studentData') !== null;
                storeSessionData(updatedData, keepSignedIn);
              }
            })
            .catch(err => {
              log('ERROR', 'Failed to refresh session', err);
              console.error('Failed to refresh session:', err);
            });
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
    log('TOPIC', 'Session started', { topic, userId: user?.id });
    
    // For mixed session, reset all counters
    if (topic === 'mixed_session') {
      setSessionQuestionCount(0);
      setSessionStartTime(Date.now());
      setSessionTimeRemaining(1800); // 30 minutes
    }
    
    // Reset learning flow state when starting a new session
    setComprehensionPassagesCompleted(0);
    setGrammarQuestionsCompleted(0);
    setIsInGrammarMode(false);
    setTopicRotationIndex(0);
    setCurrentHintsUsed(0);
    
    if (!user || !user.id) {
      log('ERROR', 'No user data available');
      console.error('No user data available');
      setGenerating(false);
      return;
    }
    
    // Check if account is pending parent approval
    if (user.account_type === 'pending') {
      log('AUTH', 'Account pending parent approval');
      alert('Your account is pending parent approval. Please ask your parent to check their email.');
      setGenerating(false);
      return;
    }
    
    // Check rate limit before proceeding
    if (!questionRateLimiter.canMakeRequest()) {
      const waitTime = questionRateLimiter.getWaitTime();
      log('RATE_LIMIT', 'Rate limit exceeded', { waitTime });
      alert(`Please wait ${waitTime} seconds before generating new questions. This helps ensure quality responses.`);
      return;
    }
    
    // Get appropriate auth token
    let authHeader = '';
    try {
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
    } catch (error) {
      log('ERROR', 'Failed to get auth token', error);
    }
    
    // Create new study session through API
    try {
      log('SESSION', 'Creating new study session via API', { topic, userId: user.id });
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          action: 'start-session',
          userId: user.id,
          topic: topic,
          grade: user.grade
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        log('SESSION', 'Study session created', { sessionId: data.sessionId });
        setCurrentSessionId(data.sessionId);
      } else {
        const error = await response.json();
        log('ERROR', 'Failed to create study session', error);
        console.error('Failed to create study session:', error);
      }
    } catch (error) {
      log('ERROR', 'Error creating study session', error);
      console.error('Error creating study session:', error);
    }
    
    setSelectedTopic(topic);
    setGenerating(true);
    setQuestionBatch([]); // Clear previous batch
    setCurrentQuestionIndex(0);
    setTopicQuestionCount(0); // Reset question count for new topic

    // Reuse authHeader from above
    try {
      if (user.role === 'student') {
        // Get student session token from storage
        const studentData = retrieveSessionData();
        if (studentData) {
          const { sessionToken } = studentData;
          authHeader = `Student ${sessionToken}`;
          log('AUTH', 'Using student session token');
        }
      } else {
        // Get Supabase session token for parents/teachers
        const session = await getSession();
        if (session?.access_token) {
          authHeader = `Bearer ${session.access_token}`;
          log('AUTH', 'Using Supabase bearer token');
        }
      }
      
      log('API', 'Calling generate API', { 
        endpoint: '/api/generate',
        action: 'generate-batch',
        topic
      });
      
      // UPDATED: Use cache-based API endpoint
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          action: topic === 'english_comprehension' ? 'generate-batch' : 'generate', // Only use batch for comprehension
          userId: user.id,
          topic: topic,
          sessionId: currentSessionId
        })
      });

      log('API', 'Generate API response', { 
        status: response.status, 
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      // Handle rate limiting (429 error)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        log('RATE_LIMIT', 'API rate limited', { retryAfter });
        console.log(`Rate limited. Retry after ${retryAfter} seconds`);
        setGenerating(false);
        alert(`Too many requests. Please wait ${retryAfter} seconds before trying again.`);
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        log('API', 'Generate API success', {
          questionsCount: data.questions?.length || 1,
          batchId: data.batchId,
          timerDuration: data.timerDuration,
          fromCache: data.fromCache,
          currentProficiency: data.currentProficiency
        });
        
        // UPDATED: Handle cache-based response
        if (data.questions && data.questions.length > 0) {
          // Multiple questions (mixed session or reading comprehension)
          log('QUESTIONS', 'Setting session questions', { count: data.questions.length });
          
          setQuestionBatch(data.questions);
          setBatchId(data.batchId);
          setCurrentQuestionIndex(0);
          
          // For mixed session, update total questions
          if (data.sessionType === 'mixed') {
            setTotalSessionQuestions(data.questions.length);
            setSessionQuestionCount(0);
          }
          
          // Set timer duration from API response
          setTimerDuration(data.timerDuration || 45);
          setTimeRemaining(data.timerDuration || 45);
          
          // Set first question as current
          setCurrentQuestion({
            ...data.questions[0],
            topic: data.questions[0].topic || topic,
            difficulty: data.questions[0].difficulty,
            proficiency: data.currentProficiency,
            fromCache: data.fromCache,
            questionHash: data.questions[0].questionHash || data.questions[0].hash // Handle both property names
          });
          
          // Start timer
          setTimerActive(true);
          
          // Reset hints tracking
          setCurrentHintsUsed(0);
        } else if (data.question) {
          // Single question fallback
          log('QUESTIONS', 'Setting single question');
          
          setCurrentQuestion({
            ...data.question,
            questionHash: data.questionHash,
            topic: topic,
            difficulty: data.difficulty,
            proficiency: data.currentProficiency,
            fromCache: data.fromCache
          });
          
          setQuestionBatch([{...data.question, questionHash: data.questionHash}]);
          setCurrentQuestionIndex(0);
          
          // Set timer
          setTimerDuration(data.timerDuration || 60);
          setTimeRemaining(data.timerDuration || 60);
          setTimerActive(true);
          
          // Reset hints tracking
          setCurrentHintsUsed(0);
        }
        
        setGenerating(false);
        log('SUCCESS', 'Questions loaded successfully');
      } else {
        // Try single question if batch fails
        log('API', 'Batch failed, trying single question');
        
        const singleResponse = await fetch('/api/generate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            action: 'generate', // Single question
            userId: user.id,
            topic: topic,
              sessionId: currentSessionId
          })
        });
        
        const singleData = await singleResponse.json();
        log('API', 'Single question response', singleData);
        
        if (singleResponse.ok && singleData.question) {
          setCurrentQuestion({
            ...singleData.question,
            topic: topic,
            difficulty: singleData.difficulty,
            proficiency: singleData.currentProficiency,
            fromCache: singleData.fromCache
          });
          
          setQuestionBatch([singleData.question]);
          setCurrentQuestionIndex(0);
          
          // Set timer
          setTimerDuration(singleData.timerDuration || 60);
          setTimeRemaining(singleData.timerDuration || 60);
          setTimerActive(true);
          
          // Reset hints tracking
          setCurrentHintsUsed(0);
          
          setGenerating(false);
        } else {
          throw new Error(singleData.error || 'Failed to generate questions');
        }
      }
    } catch (error) {
      log('ERROR', 'Failed to generate questions', { 
        message: error.message,
        stack: error.stack 
      });
      console.error('Error generating questions:', error);
      setGenerating(false);
      
      // Handle network errors gracefully
      if (error.message === 'Failed to fetch' || error.name === 'NetworkError') {
        alert('Network connection issue. Please check your internet connection and try again.');
      } else {
        alert(error.message || 'Failed to generate questions. Please try again.');
      }
    }
  };

  const handleAnswer = async (correct, timeSpent, hintsUsed, selectedAnswer) => {
    log('ANSWER', 'Answer submitted', { 
      correct, 
      timeSpent, 
      hintsUsed, 
      selectedAnswer,
      questionHash: currentQuestion?.questionHash 
    });
    
    // Update hints used tracking
    setCurrentHintsUsed(hintsUsed);
    
    // Stop timer
    setTimerActive(false);
    
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
      
      log('API', 'Submitting answer', { userId: user.id, topic: selectedTopic });
      
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
          questionHash: currentQuestion?.questionHash || null,
          sessionId: currentSessionId
        })
      });

      if (response.ok) {
        const data = await response.json();
        log('API', 'Answer submitted successfully', data);
        
        // Update cached proficiency immediately
        setCachedProficiency(selectedTopic, data.newProficiency);

        // Update session stats
        setSessionStats(prev => ({
          totalQuestions: prev.totalQuestions + 1,
          correctAnswers: prev.correctAnswers + (correct ? 1 : 0)
        }));
      } else {
        log('ERROR', 'Failed to submit answer', { status: response.status });
      }
    } catch (error) {
      log('ERROR', 'Error submitting answer', error);
      console.error('Error submitting answer:', error);
    }
  };

  const handleNext = async () => {
    log('NAVIGATION', 'Next button clicked', { 
      currentIndex: currentQuestionIndex,
      batchLength: questionBatch.length,
      sessionCount: sessionQuestionCount 
    });
    
    // Update session question count
    setSessionQuestionCount(prev => prev + 1);
    
    // Check if we have more questions in the current batch
    if (currentQuestionIndex < questionBatch.length - 1) {
      // Move to next question in batch
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      
      const nextQuestion = questionBatch[nextIndex];
      setCurrentQuestion({
        ...nextQuestion,
        topic: nextQuestion.topic || selectedTopic,
        difficulty: nextQuestion.difficulty,
        proficiency: nextQuestion.proficiency || 5,
        questionHash: nextQuestion.questionHash || nextQuestion.hash // Handle both property names
      });
      
      // Reset timer for next question
      setTimeRemaining(timerDuration);
      setTimerActive(true);
      
      log('NAVIGATION', 'Moved to next question in session', { nextIndex, sessionCount: sessionQuestionCount + 1 });
      return;
    }
    
    // Check if session is complete (30 questions or time up)
    if (sessionQuestionCount + 1 >= totalSessionQuestions) {
      log('SESSION', 'Session completed - showing analytics');
      handleShowAnalytics();
      return;
    }
    
    // All questions in current batch completed
    const totalQuestionsCompleted = topicQuestionCount + 1;
    log('PROGRESS', 'Batch completed', { totalQuestionsCompleted });
    
    // Check if we just completed a comprehension passage
    if (selectedTopic === 'english_comprehension' && !isInGrammarMode) {
      const newPassagesCompleted = comprehensionPassagesCompleted + 1;
      setComprehensionPassagesCompleted(newPassagesCompleted);
      
      // After 2 comprehension passages, switch to grammar
      if (newPassagesCompleted >= 2) {
        log('FLOW', 'Switching to grammar mode after 2 comprehension passages');
        setIsInGrammarMode(true);
        setGrammarQuestionsCompleted(0);
        // Will generate grammar questions below
      }
    }
    
    // Check if we're in grammar mode
    if (isInGrammarMode) {
      const newGrammarCount = grammarQuestionsCompleted + 1;
      setGrammarQuestionsCompleted(newGrammarCount);
      
      if (newGrammarCount >= 3) {
        // Completed 3 grammar questions, move to topic rotation
        log('FLOW', 'Completed 3 grammar questions, starting topic rotation');
        setIsInGrammarMode(false);
        setComprehensionPassagesCompleted(0); // Reset for next cycle
        setGrammarQuestionsCompleted(0);
        setTopicRotationIndex(0); // Start rotation from beginning
      }
    }
    
    // Determine next topic
    let nextTopic;
    if (isInGrammarMode) {
      // Continue with grammar until we complete 3 questions
      nextTopic = 'english_grammar';
    } else if (comprehensionPassagesCompleted >= 2 && grammarQuestionsCompleted === 0) {
      // Just finished 2 comprehension passages, start grammar
      nextTopic = 'english_grammar';
    } else if (!isInGrammarMode && comprehensionPassagesCompleted === 0 && topicRotationIndex > 0) {
      // We're in topic rotation mode (after completing grammar)
      const currentRotationIndex = topicRotationIndex;
      nextTopic = ENGLISH_TOPICS[currentRotationIndex % ENGLISH_TOPICS.length];
      setTopicRotationIndex(currentRotationIndex + 1);
      
      // If we've completed all topics in rotation, reset to comprehension
      if (currentRotationIndex >= ENGLISH_TOPICS.length) {
        setTopicRotationIndex(0);
        // The cycle will restart with comprehension
      }
    } else if (selectedTopic === 'english_comprehension') {
      // Continue with comprehension until we have 2 passages
      nextTopic = 'english_comprehension';
    } else {
      // Default: continue with current topic
      nextTopic = selectedTopic;
    }
    
    log('NAVIGATION', 'Generating next questions', { 
      nextTopic, 
      isInGrammarMode,
      grammarQuestionsCompleted,
      comprehensionPassagesCompleted,
      topicRotationIndex 
    });
    setGenerating(true);
    
    try {
      // Get auth token
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
      
      // Generate next batch from cache
      log('API', 'Requesting next batch');
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          action: nextTopic === 'english_comprehension' ? 'generate-batch' : 'generate',
          userId: user.id,
          topic: nextTopic,
          sessionId: currentSessionId
        })
      });

      if (response.ok) {
        const data = await response.json();
        log('API', 'Next batch received', { count: data.questions?.length });
        
        if (data.questions && data.questions.length > 0) {
          // Reset batch with new questions
          setQuestionBatch(data.questions);
          setCurrentQuestionIndex(0);
          setBatchId(data.batchId);
          
          // Set timer duration
          setTimerDuration(data.timerDuration || 60);
          setTimeRemaining(data.timerDuration || 60);
          setTimerActive(true);
          
          // Set first question of new batch
          setCurrentQuestion({
            ...data.questions[0],
            topic: nextTopic,
            difficulty: data.questions[0].difficulty,
            proficiency: data.currentProficiency,
            fromCache: data.fromCache
          });
          
          // Update selected topic if it changed
          if (nextTopic !== selectedTopic) {
            setSelectedTopic(nextTopic);
          }
        } else if (data.question) {
          // Single question response
          setQuestionBatch([{...data.question, questionHash: data.questionHash}]);
          setCurrentQuestionIndex(0);
          
          setCurrentQuestion({
            ...data.question,
            questionHash: data.questionHash,
            topic: nextTopic,
            difficulty: data.difficulty,
            proficiency: data.currentProficiency,
            fromCache: data.fromCache
          });
          
          // Set timer
          setTimerDuration(data.timerDuration || 60);
          setTimeRemaining(data.timerDuration || 60);
          setTimerActive(true);
          
          // Reset hints
          setCurrentHintsUsed(0);
          
          // Grammar question tracking is now handled at the beginning of handleNext
          
          // Update selected topic if it changed
          if (nextTopic !== selectedTopic) {
            setSelectedTopic(nextTopic);
          }
        } else {
          // No questions returned
          log('ERROR', 'No questions returned from API', data);
          alert('No more questions available. Great job on your practice session!');
          handleBack();
        }
      } else {
        // Handle error response
        const errorData = await response.json();
        log('ERROR', 'API error response', errorData);
        alert('Unable to load more questions. Please try a different topic.');
        handleBack();
      }
    } catch (error) {
      log('ERROR', 'Failed to generate next batch', error);
      console.error('Error generating next question:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleBack = async () => {
    log('NAVIGATION', 'Back button clicked');
    
    // Check if there's an unanswered question to record as abandoned
    if (currentQuestion && user) {
      const timeSpent = timerDuration - timeRemaining;
      log('ABANDON', 'Recording abandoned question', { 
        topic: selectedTopic, 
        timeSpent,
        questionHash: currentQuestion.questionHash 
      });
      
      // Get auth token
      let authHeader = '';
      try {
        if (user.role === 'student') {
          const studentData = retrieveSessionData();
          if (studentData) {
            authHeader = `Student ${studentData.sessionToken}`;
          }
        } else {
          const session = await getSession();
          if (session?.access_token) {
            authHeader = `Bearer ${session.access_token}`;
          }
        }
        
        // Record abandoned question
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            action: 'abandon',
            userId: user.id,
            topic: selectedTopic,
            timeSpent: timeSpent,
            hintsUsed: currentHintsUsed,
            questionHash: currentQuestion?.questionHash || null,
            sessionId: currentSessionId
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          log('ERROR', 'Failed to record abandoned question', error);
        }
      } catch (error) {
        log('ERROR', 'Error recording abandoned question', error);
      }
    }
    
    // Close current session if exists
    if (currentSessionId && user) {
      log('SESSION', 'Closing session on back', { sessionId: currentSessionId });
      
      // Get auth token
      let authHeader = '';
      try {
        if (user.role === 'student') {
          const studentData = retrieveSessionData();
          if (studentData) {
            authHeader = `Student ${studentData.sessionToken}`;
          }
        } else {
          const session = await getSession();
          if (session?.access_token) {
            authHeader = `Bearer ${session.access_token}`;
          }
        }
        
        // Close session through API
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            action: 'end-session',
            userId: user.id,
            sessionId: currentSessionId,
            reason: 'user_back'
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          log('SESSION', 'Session closed', data.sessionStats);
        } else {
          const error = await response.json();
          log('ERROR', 'Failed to close session', error);
        }
      } catch (error) {
        log('ERROR', 'Error closing session', error);
      }
      
      setCurrentSessionId(null);
    }
    
    setSelectedTopic(null);
    setCurrentQuestion(null);
    setQuestionBatch([]);
    setCurrentQuestionIndex(0);
    setBatchId(null);
    setTopicQuestionCount(0);
    setTimerActive(false);
  };

  // Auto-start mixed session - no topic selection needed
  const handleAutoStartSession = async () => {
    if (!user || !user.id || selectedTopic !== 'mixed_session') return;
    
    log('SESSION', 'Auto-starting mixed session for student');
    setSessionStartTime(Date.now());
    setGenerating(true);
    
    try {
      // Start mixed session
      await handleTopicSelect('mixed_session');
    } catch (error) {
      log('ERROR', 'Failed to auto-start session', error);
    }
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
      <div className="flex flex-col items-center justify-center gap-lg" style={{ minHeight: '100vh' }}>
        <h1 className="text-center">Socratic Learning ✨</h1>
        <p className="text-secondary text-center animate-fadeIn">Loading your learning journey...</p>
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
      {selectedTopic && selectedTopic !== 'mixed_session' && selectedTopic !== 'analytics' && (
        <Head>
          <title>Socratic Learning - Learning {formatTopicName(selectedTopic)} | Level {getProficiency(selectedTopic).toFixed(1)}</title>
          <meta name="description" content={`Practice ${formatTopicName(selectedTopic)} with AI-generated questions. Currently at level ${getProficiency(selectedTopic).toFixed(1)}/9.`} />
        </Head>
      )}
      
      {selectedTopic === 'mixed_session' && (
        <Head>
          <title>Socratic Learning - Mixed Learning Session</title>
          <meta name="description" content="Practice with a mix of reading comprehension, vocabulary, grammar, and more in a 30-minute session." />
        </Head>
      )}
      
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Paper texture background */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: `
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
            )
          `,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.4
        }}></div>
        
        <Header />
        
        {/* Session expiry warning for students */}
        {showExpiryWarning && user?.role === 'student' && (
          <div className="animate-slideIn" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%)',
            color: 'white',
            padding: '1rem 2rem',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <p className="font-medium">⚠️ Your session will expire in less than 5 minutes. Please save your work!</p>
            <button 
              onClick={() => setShowExpiryWarning(false)} 
              className="btn-secondary"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem'
              }}
            >Dismiss</button>
          </div>
        )}
        
        <div className="container">
          {selectedTopic === 'mixed_session' && !currentQuestion && !generating ? (
            <div className="flex justify-center items-center" style={{ minHeight: '400px', padding: '2rem' }}>
              <div className="glass card" style={{ maxWidth: '500px' }}>
                <h2 className="text-center mb-xl">Starting Your Learning Session</h2>
                <div className="flex flex-col gap-md mb-xl">
                  <div className="flex items-center gap-md">
                    <span style={{ fontSize: '1.5rem' }}>📚</span>
                    <span className="text-secondary">~30 Questions Mixed Topics</span>
                  </div>
                  <div className="flex items-center gap-md">
                    <span style={{ fontSize: '1.5rem' }}>⏱️</span>
                    <span className="text-secondary">45 Seconds Per Question</span>
                  </div>
                  <div className="flex items-center gap-md">
                    <span style={{ fontSize: '1.5rem' }}>🎯</span>
                    <span className="text-secondary">Reading, Grammar, Vocabulary</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-muted animate-fadeIn">Preparing your questions...</p>
                </div>
              </div>
            </div>
          ) : selectedTopic === 'analytics' ? (
            <div className="flex justify-center items-center" style={{ minHeight: '500px', padding: '2rem' }}>
              <div className="glass card text-center" style={{ maxWidth: '600px' }}>
                <h2 className="mb-xl">Session Complete! 🎉</h2>
                <div className="grid grid-cols-3 gap-lg mb-xl">
                  <div className="flex flex-col items-center gap-sm">
                    <span className="font-extrabold" style={{ fontSize: '2.5rem', color: 'var(--accent-success)' }}>{sessionQuestionCount}</span>
                    <span className="text-muted font-semibold" style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Questions Answered</span>
                  </div>
                  <div className="flex flex-col items-center gap-sm">
                    <span className="font-extrabold" style={{ fontSize: '2.5rem', color: 'var(--accent-success)' }}>{Math.floor((1800 - sessionTimeRemaining) / 60)}m {((1800 - sessionTimeRemaining) % 60)}s</span>
                    <span className="text-muted font-semibold" style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Spent</span>
                  </div>
                  <div className="flex flex-col items-center gap-sm">
                    <span className="font-extrabold" style={{ fontSize: '2.5rem', color: 'var(--accent-success)' }}>{Math.round((sessionStats.correctAnswers / sessionStats.totalQuestions) * 100) || 0}%</span>
                    <span className="text-muted font-semibold" style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accuracy</span>
                  </div>
                </div>
                <button 
                  className="btn-success"
                  onClick={() => {
                    setSelectedTopic('mixed_session');
                    setCurrentQuestion(null);
                    setSessionQuestionCount(0);
                    setSessionTimeRemaining(1800);
                    handleAutoStartSession();
                  }}
                  style={{ fontSize: '1.25rem' }}
                >
                  Start New Session
                </button>
              </div>
            </div>
          ) : currentQuestion ? (
            <div className="animate-fadeIn" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
              <header className="glass flex justify-between items-center mb-lg" style={{ borderRadius: '20px', padding: '20px 28px' }}>
                <button 
                  className="btn-secondary" 
                  onClick={handleBack}
                  style={{ padding: '0.5rem 1rem', fontSize: '1.5rem' }}
                >←</button>
                <div className="text-center">
                  <div className="font-bold" style={{ fontSize: '1.25rem' }}>Learning Session</div>
                  <div className="text-secondary">
                    Question {sessionQuestionCount + 1} of {totalSessionQuestions}
                    {generating && (
                      <span className="text-primary animate-fadeIn"> (Loading...)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-md flex-wrap">
                  {currentQuestion && (
                    <div className={`glass flex items-center gap-sm ${timeRemaining <= 10 ? 'animate-slideIn' : ''}`} 
                         style={{ 
                           padding: '0.5rem 1rem', 
                           borderRadius: '12px',
                           backgroundColor: timeRemaining <= 10 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.9)',
                           borderColor: timeRemaining <= 10 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 0, 0, 0.1)'
                         }}>
                      <span style={{ fontSize: '1.2rem' }}>⏱️</span>
                      <span className="font-semibold" style={{ color: timeRemaining <= 10 ? 'var(--accent-error)' : 'var(--text-primary)' }}>{timeRemaining}s</span>
                    </div>
                  )}
                  <div className="glass flex items-center gap-sm" style={{ padding: '0.5rem 1rem', borderRadius: '12px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🕐</span>
                    <span className="font-semibold text-primary">
                      {Math.floor(sessionTimeRemaining / 60)}:{(sessionTimeRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </header>

              {/* Session Progress Bar */}
              <div className="glass mb-xl" style={{ borderRadius: '16px', padding: '1.5rem' }}>
                <div style={{ 
                  width: '100%', 
                  height: '16px', 
                  backgroundColor: 'var(--tertiary-bg)', 
                  borderRadius: '8px', 
                  overflow: 'hidden',
                  marginBottom: '0.75rem'
                }}>
                  <div 
                    style={{ 
                      height: '100%',
                      borderRadius: '8px',
                      transition: 'width 0.3s ease, background 0.3s ease',
                      width: `${Math.min((sessionQuestionCount / totalSessionQuestions) * 100, 100)}%`,
                      background: sessionQuestionCount === 0 ? '#cbd5e0' : 
                                 sessionQuestionCount >= totalSessionQuestions ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' : 
                                 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)'
                    }}
                  ></div>
                </div>
                <div className="text-center font-semibold text-secondary">
                  {sessionQuestionCount} / {totalSessionQuestions} Questions Complete
                </div>
              </div>

              <div className="mb-lg">
                <ProgressBar 
                  proficiency={getProficiency(selectedTopic)} 
                  showLevel={false}
                />
              </div>

              {generating ? (
                <div className="flex flex-col items-center justify-center" style={{ minHeight: '300px' }}>
                  <p className="text-primary font-semibold animate-fadeIn mb-sm" style={{ fontSize: '1.5rem' }}>
                    Loading questions from cache...
                  </p>
                  <p className="text-muted">
                    {currentQuestion?.fromCache ? 'Serving from pre-generated pool' : 'Please wait...'}
                  </p>
                </div>
              ) : currentQuestion && (
                <QuestionCard 
                  key={currentQuestion.hash || `${currentQuestionIndex}-${currentQuestion.question}`}
                  question={currentQuestion}
                  topic={selectedTopic}
                  difficulty={currentQuestion.difficulty}
                  proficiency={currentQuestion.proficiency}
                  onAnswer={handleAnswer}
                  onNext={handleNext}
                  onHintUsed={(count) => setCurrentHintsUsed(count)}
                  userId={user.id}
                  getSession={getSession}
                  timerDuration={timerDuration}
                  timeRemaining={timeRemaining}
                />
              )}
            </div>
          ) : null}
        </div>
        <Footer />
      </div>
    </>
  );
}