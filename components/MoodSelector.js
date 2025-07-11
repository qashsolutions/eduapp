import { useState } from 'react';

const MOODS = [
  { id: 'creative', emoji: '🎨', label: 'Creative', color: '#6b7280' },
  { id: 'analytical', emoji: '🧠', label: 'Analytical', color: '#374151' },
  { id: 'competitive', emoji: '🏆', label: 'Competitive', color: '#eab308' },
  { id: 'relaxed', emoji: '😌', label: 'Chill', color: '#10b981' },
  { id: 'curious', emoji: '🔍', label: 'Curious', color: '#3b82f6' },
  { id: 'social', emoji: '👥', label: 'Social', color: '#3b82f6' },
  { id: 'adventurous', emoji: '🚀', label: 'Adventurous', color: '#dc2626' },
  { id: 'practical', emoji: '💡', label: 'Practical', color: '#7c3aed' }
];

export default function MoodSelector({ selectedMood, onMoodSelect }) {
  return (
    <div className="mood-section">
      <h1 className="mood-title">How is your mood today?</h1>
      <div className="mood-grid">
        {MOODS.map((mood) => (
          <div
            key={mood.id}
            className={`mood-card ${selectedMood === mood.id ? 'selected' : ''}`}
            onClick={() => onMoodSelect(mood.id)}
          >
            <div className="mood-icon" style={{ color: mood.color }}>{mood.emoji}</div>
            <div className="mood-label">{mood.label}</div>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .mood-section {
          text-align: center;
          margin-bottom: 4rem;
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 3rem;
        }

        .mood-title {
          font-size: clamp(2.5rem, 5vw, 4rem);
          font-weight: 800;
          background: linear-gradient(135deg, #374151 0%, #6b7280 50%, #9ca3af 100%);
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          margin-bottom: 1rem;
          position: relative;
          text-shadow: none;
        }

        .mood-grid {
          display: flex;
          gap: 1rem;
          max-width: 100%;
          margin: 0 auto;
          overflow-x: auto;
          padding: 1rem 0;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .mood-grid::-webkit-scrollbar {
          display: none;
        }

        .mood-card {
          background: 
            linear-gradient(145deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.2)),
            rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(30px) saturate(150%);
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 20px;
          padding: 1rem 0.75rem;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          position: relative;
          overflow: hidden;
          text-align: center;
          min-height: 100px;
          min-width: 110px;
          flex: 0 0 110px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          scroll-snap-align: center;
          box-shadow: 
            0 6px 20px rgba(31, 38, 135, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.8),
            inset 0 -1px 0 rgba(255, 255, 255, 0.2);
        }

        .mood-card:hover {
          transform: translateY(-12px) scale(1.08) rotateX(5deg);
          background: rgba(255, 255, 255, 0.8);
          box-shadow: 
            0 20px 40px rgba(31, 38, 135, 0.2),
            0 0 20px rgba(59, 130, 246, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(40px) saturate(180%);
        }

        .mood-card.selected {
          transform: translateY(-8px) scale(1.05);
          background: 
            linear-gradient(145deg, rgba(59, 130, 246, 0.25), rgba(59, 130, 246, 0.1)),
            rgba(59, 130, 246, 0.05);
          border-color: rgba(59, 130, 246, 0.6);
          box-shadow: 
            0 0 40px rgba(59, 130, 246, 0.4),
            0 15px 30px rgba(31, 38, 135, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }

        .mood-card.selected .mood-icon {
          animation: selected-bounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          filter: 
            drop-shadow(0 0 20px currentColor) 
            drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
        }

        @keyframes selected-bounce {
          0% { transform: scale(1); }
          50% { transform: scale(1.2) rotateY(180deg); }
          100% { transform: scale(1) rotateY(360deg); }
        }

        .mood-icon {
          font-size: clamp(2.2rem, 4vw, 2.8rem);
          margin-bottom: 0.5rem;
          position: relative;
          z-index: 2;
          filter: 
            drop-shadow(0 0 8px currentColor) 
            drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
          transform-style: preserve-3d;
          transition: all 0.3s ease;
        }

        .mood-label {
          font-size: clamp(0.8rem, 1.8vw, 1rem);
          font-weight: 700;
          background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          position: relative;
          z-index: 2;
          letter-spacing: 0.3px;
          line-height: 1.2;
        }

        /* CSS Scroll-Driven Animations - if supported */
        @supports (animation-timeline: scroll()) {
          .mood-card {
            animation: reveal-on-scroll linear both;
            animation-timeline: view();
            animation-range: entry 0% cover 30%;
          }
          
          @keyframes reveal-on-scroll {
            from {
              opacity: 0;
              transform: translateY(100px) scale(0.8);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
        }

        /* Has selector support */
        @supports (selector(:has(+ *))) {
          .mood-card:has(+ .mood-card:hover) {
            transform: translateX(-5px) scale(0.95);
            opacity: 0.7;
          }
        }

        /* Container queries */
        @container (max-width: 768px) {
          .mood-grid {
            gap: 0.75rem;
          }
        }

        @container (max-width: 480px) {
          .mood-grid {
            gap: 0.5rem;
          }
        }

        @media (max-width: 768px) {
          .mood-grid {
            justify-content: flex-start;
            padding: 0.5rem 0;
          }
          
          .mood-card {
            min-width: 90px;
            flex: 0 0 90px;
            padding: 0.75rem 0.5rem;
          }
          
          .mood-icon {
            font-size: 2rem;
          }
          
          .mood-label {
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
}