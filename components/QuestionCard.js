import { useState, useEffect } from 'react';
import { setCachedProficiency } from '../lib/utils';
import { retrieveSessionData } from '../lib/studentSession';

export default function QuestionCard({ 
  question, 
  topic, 
  difficulty,
  onAnswer, 
  onNext,
  proficiency,
  userId,
  getSession 
}) {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hints, setHints] = useState([]);
  const [currentHintLevel, setCurrentHintLevel] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [startTime] = useState(Date.now());
  const MAX_HINTS = 4;

  const handleAnswerSelect = (option) => {
    if (!showResult) {
      setSelectedAnswer(option);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAnswer) return;
    
    const correct = selectedAnswer === question.correct;
    setIsCorrect(correct);
    setShowResult(true);
    
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    
    // Update local cache immediately
    if (correct) {
      const newProficiency = Math.min(9, proficiency + 0.2);
      setCachedProficiency(topic, newProficiency);
    }
    
    // Notify parent
    onAnswer(correct, timeSpent, hintsUsed, selectedAnswer);
  };

  const handleHint = async () => {
    if (!showResult && currentHintLevel < MAX_HINTS) {
      const nextLevel = currentHintLevel + 1;
      
      // If we already have this hint level, just show it
      if (hints[nextLevel - 1]) {
        setCurrentHintLevel(nextLevel);
        if (nextLevel === 1) {
          setHintsUsed(1);
        }
        return;
      }
      
      // Otherwise, fetch a new hint
      try {
        // Get appropriate auth token
        let authHeader = '';
        
        // Check if this is a student user
        const studentData = retrieveSessionData();
        if (studentData) {
          const { sessionToken } = studentData;
          authHeader = `Student ${sessionToken}`;
        } else {
          // Get Supabase session token for parents/teachers
          const session = await getSession();
          if (session?.access_token) {
            authHeader = `Bearer ${session.access_token}`;
          }
        }
        
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            action: 'socratic',
            userId,
            topic,
            question: question.question,
            wrongAnswer: selectedAnswer || 'not selected',
            difficulty,
            hintLevel: nextLevel
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          const newHints = [...hints];
          newHints[nextLevel - 1] = data.hint;
          setHints(newHints);
          setCurrentHintLevel(nextLevel);
          if (nextLevel === 1) {
            setHintsUsed(1);
          }
        } else {
          console.error('Failed to get hint:', data.error);
        }
      } catch (error) {
        console.error('Error getting hint:', error);
      }
    }
  };

  const handleNext = () => {
    onNext();
  };

  const getQuestionType = () => {
    if (topic.includes('comprehension')) return 'Reading Passage 📚';
    if (topic.includes('grammar')) return 'Grammar Rules ✍️';
    if (topic.includes('vocabulary')) return 'Word Power 🎯';
    if (topic.includes('math')) return 'Math Problem 🔢';
    return 'Question';
  };

  return (
    <div className="question-card">
      <div className="question-type">{getQuestionType()}</div>
      
      <div className="question-text">{question.question}</div>
      
      {question.context && (
        <div className="question-context">{question.context}</div>
      )}
      
      <div className="answers-grid">
        {Object.entries(question.options).map(([key, value]) => (
          <div
            key={key}
            className={`answer-option ${
              selectedAnswer === key ? 'selected' : ''
            } ${
              showResult && key === question.correct ? 'correct' : ''
            } ${
              showResult && selectedAnswer === key && !isCorrect ? 'incorrect' : ''
            }`}
            onClick={() => handleAnswerSelect(key)}
          >
            <div className="answer-label">
              <span className="answer-letter">{key}</span>
              <span>{value}</span>
            </div>
          </div>
        ))}
      </div>

      {currentHintLevel > 0 && hints.length > 0 && (
        <div className="hint-section">
          <div className="hint-title">
            💡 {currentHintLevel === 1 ? 'Think about it...' : 
                currentHintLevel === 2 ? 'Getting warmer...' :
                currentHintLevel === 3 ? 'Almost there...' :
                'Final clue...'}
            <span className="hint-level">({currentHintLevel}/{MAX_HINTS})</span>
          </div>
          <div className="hint-text">{hints[currentHintLevel - 1]}</div>
        </div>
      )}

      {showResult && (
        <div className="explanation-section">
          <div className="explanation-title">
            {isCorrect ? '✨ Excellent!' : '💪 Learning moment!'}
          </div>
          <div className="explanation-text">{question.explanation}</div>
        </div>
      )}

      <div className="action-buttons">
        {!showResult && (
          <>
            <button 
              className="btn btn-secondary" 
              onClick={handleHint}
              disabled={currentHintLevel >= MAX_HINTS}
            >
              {currentHintLevel === 0 ? 'Need a hint? 💭' : 
               currentHintLevel < MAX_HINTS ? 'Need more help? 🤔' : 
               'No more hints available'}
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={!selectedAnswer}
            >
              Submit Answer ✨
            </button>
          </>
        )}
        {showResult && (
          <button 
            className="btn btn-primary" 
            onClick={handleNext}
          >
            {isCorrect ? 'Next Question 🚀' : 'Try Another 💪'}
          </button>
        )}
      </div>

      <style jsx>{`
        .question-card {
          background: rgba(30, 30, 30, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 24px;
          padding: 32px;
          margin-bottom: 24px;
          animation: slideIn 0.5s ease-out;
          color: #ffffff;
        }
        
        .question-type {
          display: inline-block;
          background: linear-gradient(135deg, var(--accent-pink), var(--accent-orange));
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 20px;
        }
        
        .question-text {
          font-size: 1.3rem;
          font-weight: 600;
          line-height: 1.5;
          margin-bottom: 8px;
        }
        
        .question-context {
          color: #e0e0e0;
          font-size: 1rem;
          margin-bottom: 28px;
          line-height: 1.6;
          padding: 16px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
        }
        
        .answers-grid {
          display: grid;
          gap: 16px;
          margin-bottom: 24px;
        }
        
        .answer-option {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(15px);
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          color: #ffffff;
        }
        
        .answer-option::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, var(--accent-blue), var(--accent-neon));
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
        }
        
        .answer-option:hover {
          transform: translateY(-4px);
          border-color: var(--accent-neon);
          box-shadow: 0 8px 32px rgba(0, 255, 136, 0.2);
        }
        
        .answer-option:hover::before {
          opacity: 0.1;
        }
        
        .answer-option.selected {
          border-color: var(--accent-neon);
          background: rgba(0, 255, 136, 0.1);
        }
        
        .answer-option.correct {
          border-color: var(--correct);
          background: rgba(0, 255, 136, 0.2);
          animation: correctPulse 0.6s ease-out;
        }
        
        .answer-option.incorrect {
          border-color: var(--incorrect);
          background: rgba(255, 71, 87, 0.2);
          animation: shake 0.5s ease-out;
        }
        
        .answer-label {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .answer-letter {
          background: linear-gradient(135deg, var(--accent-neon), var(--accent-blue));
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.9rem;
          flex-shrink: 0;
        }
        
        .hint-section, .explanation-section {
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.3);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
          animation: fadeIn 0.5s ease-out;
        }
        
        .explanation-section {
          background: ${isCorrect ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 107, 53, 0.1)'};
          border-color: ${isCorrect ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 107, 53, 0.3)'};
        }
        
        .hint-title, .explanation-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--accent-neon);
        }
        
        .hint-level {
          margin-left: auto;
          font-size: 0.875rem;
          opacity: 0.7;
          font-weight: normal;
        }
        
        .hint-text, .explanation-text {
          color: var(--text-secondary);
          line-height: 1.5;
        }
        
        .action-buttons {
          display: flex;
          gap: 16px;
        }
        
        .btn {
          flex: 1;
          border: none;
          border-radius: 16px;
          padding: 16px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, var(--accent-neon), var(--accent-blue));
          color: white;
        }
        
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.4);
        }
        
        .btn-secondary {
          background: var(--glass-bg);
          backdrop-filter: blur(15px);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
        }
        
        .btn-secondary:hover {
          border-color: var(--accent-neon);
          transform: translateY(-2px);
        }
        
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes correctPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        @media (max-width: 768px) {
          .question-card { padding: 24px; }
          .action-buttons { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}