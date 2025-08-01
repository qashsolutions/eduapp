import { useState, useEffect } from 'react';
import { setCachedProficiency } from '../lib/utils';
import { retrieveSessionData } from '../lib/studentSession';

export default function QuestionCard({ 
  question, 
  topic, 
  difficulty,
  onAnswer, 
  onNext,
  onHintUsed,
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
  const [startTime, setStartTime] = useState(Date.now());
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const MAX_HINTS = 4;
  
  // Reset state when question changes
  useEffect(() => {
    setSelectedAnswer(null);
    setShowResult(false);
    setIsCorrect(false);
    setHints([]);
    setCurrentHintLevel(0);
    setHintsUsed(0);
    setIsLoadingHint(false);
    setStartTime(Date.now()); // Reset timer for new question
  }, [question]);


  const handleAnswerSelect = (option) => {
    console.log('Answer clicked:', option);
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
    if (!showResult && currentHintLevel < MAX_HINTS && !isLoadingHint) {
      const nextLevel = currentHintLevel + 1;
      
      // Generate progressive hints based on the question and answer
      const progressiveHints = generateProgressiveHints(question, selectedAnswer);
      
      if (progressiveHints[nextLevel - 1]) {
        const newHints = [...hints];
        newHints[nextLevel - 1] = progressiveHints[nextLevel - 1];
        setHints(newHints);
        setCurrentHintLevel(nextLevel);
        setHintsUsed(nextLevel);  // Update hints used to current level
        if (onHintUsed) {
          onHintUsed(nextLevel);  // Notify parent of hint usage
        }
      }
    }
  };
  
  // Generate hints progressively
  const generateProgressiveHints = (q, selected) => {
    const hints = [];
    
    // Hint 1: General guidance
    if (q.question.toLowerCase().includes('main idea') || q.question.toLowerCase().includes('central theme')) {
      hints.push('Look for the topic that is discussed throughout the entire passage, not just in one part.');
    } else if (q.question.toLowerCase().includes('inference') || q.question.toLowerCase().includes('implies')) {
      hints.push('Think about what the passage suggests but doesn\'t directly state. Look for clues in the context.');
    } else if (q.question.toLowerCase().includes('purpose') || q.question.toLowerCase().includes('why')) {
      hints.push('Consider the author\'s intent. What are they trying to achieve or communicate?');
    } else {
      hints.push('Read the question carefully and look for key words that match information in the passage.');
    }
    
    // Hint 2: Eliminate wrong answers
    if (selected && q.correct && selected !== q.correct) {
      hints.push(`The answer "${q.options[selected]}" might be too specific or not fully supported by the passage. Try eliminating obviously incorrect options first.`);
    } else {
      hints.push('Try to eliminate options that are clearly wrong or not mentioned in the passage.');
    }
    
    // Hint 3: More specific guidance
    hints.push('Focus on the part of the passage that directly relates to the question. The answer should be supported by evidence from the text.');
    
    // Hint 4: Show explanation
    if (q.explanation) {
      hints.push(q.explanation);
    } else {
      hints.push('Take your time and re-read the relevant section of the passage. The answer is there!');
    }
    
    return hints;
  };

  const handleNext = () => {
    onNext();
  };

  const getQuestionType = () => {
    return '';
  };

  
  return (
    <div className="question-card">
      {getQuestionType() && <div className="question-type">{getQuestionType()}</div>}
      
      
      {question.context && question.context.trim().length > 0 && (
        <div className="question-context" style={{ 
          fontSize: '1.1rem', 
          fontWeight: 'normal',
          lineHeight: '1.8',
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px'
        }}>
          {question.context}
          <div className="word-count">
            <em>({question.context.trim().split(/\s+/).length} words)</em>
          </div>
        </div>
      )}
      
      <div className="question-text">{question.question}</div>
      
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
            style={selectedAnswer === key && !showResult ? {
              background: 'rgba(102, 126, 234, 0.4)',
              borderColor: '#667eea',
              borderWidth: '3px',
              boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.2)'
            } : {}}
          >
            <div className="answer-label">
              <span className="answer-letter">{key}</span>
              <span style={selectedAnswer === key ? {fontStyle: 'normal', fontWeight: '700'} : {}}>{value}</span>
            </div>
          </div>
        ))}
      </div>

      {currentHintLevel > 0 && hints.length > 0 && (
        <div className="hint-section" style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: 'rgba(255, 215, 0, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 215, 0, 0.3)'
        }}>
          <div className="hint-title" style={{
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            color: '#ffd700'
          }}>
            💡 {currentHintLevel === 1 ? 'Think about it...' : 
                currentHintLevel === 2 ? 'Getting warmer...' :
                currentHintLevel === 3 ? 'Almost there...' :
                'Final clue...'}
            <span className="hint-level" style={{ fontSize: '0.9rem', marginLeft: '0.5rem' }}>({currentHintLevel}/{MAX_HINTS})</span>
          </div>
          <div className="hint-text" style={{ fontSize: '1rem', lineHeight: '1.6' }}>{hints[currentHintLevel - 1]}</div>
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
              disabled={currentHintLevel >= MAX_HINTS || isLoadingHint}
              style={{ position: 'relative', zIndex: 1 }}
            >
              {isLoadingHint ? 'Getting hint...' :
               currentHintLevel === 0 ? 'Need a hint?' : 
               currentHintLevel < MAX_HINTS ? 'Need more help?' : 
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
          margin-bottom: 20px;
          line-height: 1.6;
          padding: 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          font-style: italic;
        }
        
        .word-count {
          margin-top: 10px;
          text-align: right;
          opacity: 0.7;
          font-size: 0.9rem;
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
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1.2rem;
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
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
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
          background: linear-gradient(135deg, var(--accent-neon), var(--accent-blue));
          color: white;
        }
        
        .btn-secondary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 255, 136, 0.4);
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