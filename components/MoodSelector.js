import { useState } from 'react';

const MOODS = [
  { id: 'creative', emoji: '🎨', label: 'Creative' },
  { id: 'analytical', emoji: '🧠', label: 'Analytical' },
  { id: 'competitive', emoji: '🏆', label: 'Competitive' },
  { id: 'relaxed', emoji: '😌', label: 'Chill' },
  { id: 'curious', emoji: '🔍', label: 'Curious' },
  { id: 'social', emoji: '👥', label: 'Social' },
  { id: 'adventurous', emoji: '🚀', label: 'Adventurous' },
  { id: 'practical', emoji: '💡', label: 'Practical' }
];

export default function MoodSelector({ selectedMood, onMoodSelect }) {
  return (
    <div className="mood-section">
      <h2 className="section-title">How're you feeling today? 🎯</h2>
      <div className="mood-grid">
        {MOODS.map((mood) => (
          <div
            key={mood.id}
            className={`mood-card ${selectedMood === mood.id ? 'active' : ''}`}
            onClick={() => onMoodSelect(mood.id)}
          >
            <span className="mood-emoji">{mood.emoji}</span>
            <div className="mood-label">{mood.label}</div>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .mood-section {
          margin-bottom: 40px;
          animation: fadeIn 0.8s ease-out 0.2s both;
        }
        
        .section-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 20px;
          text-align: center;
        }
        
        .mood-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }
        
        .mood-card {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 2px solid transparent;
          border-radius: 20px;
          padding: 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .mood-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, var(--accent-neon), var(--accent-blue));
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
        }
        
        .mood-card:hover {
          transform: translateY(-8px);
          border-color: var(--accent-neon);
          box-shadow: 0 12px 40px rgba(0, 255, 136, 0.3);
        }
        
        .mood-card.active::before {
          opacity: 0.2;
        }
        
        .mood-card.active {
          border-color: var(--accent-neon);
        }
        
        .mood-emoji {
          font-size: 2.5rem;
          margin-bottom: 8px;
          display: block;
        }
        
        .mood-label {
          font-weight: 600;
          font-size: 0.9rem;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @media (max-width: 768px) {
          .mood-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </div>
  );
}