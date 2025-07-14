export default function ProgressBar({ proficiency, topic, showLevel = true }) {
  const percentage = Math.round((proficiency / 9) * 100);
  const isHighLevel = proficiency >= 7;
  
  return (
    <div className="progress-container">
      {showLevel && (
        <div className="progress-label">
          <span>Level: <strong>{proficiency.toFixed(1)}</strong></span>
        </div>
      )}
      <div className="progress-bar">
        <div 
          className={`progress-fill ${isHighLevel ? 'neon' : 'pink'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <style jsx>{`
        .progress-container {
          margin-bottom: 16px;
        }
        
        .progress-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }
        
        .topic-label {
          color: var(--text-secondary);
          font-size: 0.85rem;
        }
        
        .progress-bar {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          height: 8px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          border-radius: 12px;
          transition: width 0.6s ease;
          position: relative;
        }
        
        .progress-fill.neon {
          background: linear-gradient(90deg, var(--accent-neon), var(--accent-blue));
          box-shadow: 0 0 16px rgba(0, 255, 136, 0.4);
        }
        
        .progress-fill.pink {
          background: linear-gradient(90deg, var(--accent-pink), var(--accent-orange));
          box-shadow: 0 0 16px rgba(255, 0, 128, 0.4);
        }
        
        .progress-fill.neon.glow {
          animation: glow 2s ease-in-out infinite;
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.3); }
          50% { box-shadow: 0 0 30px rgba(0, 255, 136, 0.6); }
        }
      `}</style>
    </div>
  );
}