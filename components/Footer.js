export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-left">
          <p>© 2025 <a href="https://www.socratic-thinking.com" target="_blank" rel="noopener noreferrer">socratic-thinking.com</a><br/>
          A unit of Qash Solutions Inc.<br/>
          D-U-N-S® Number: 119536275</p>
        </div>
        <div className="footer-right">
          <p>USA • India</p>
        </div>
      </div>

      <style jsx>{`
        .footer {
          background: rgba(10, 10, 15, 0.8);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 20px 0;
          margin-top: 0;
        }

        .footer-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer-left p,
        .footer-right p {
          color: var(--text-secondary);
          font-size: 0.85rem;
          line-height: 1.6;
          margin: 0;
        }

        .footer-left a {
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.3s ease;
        }

        .footer-left a:hover {
          color: var(--accent-primary);
          text-decoration: underline;
        }

        .footer-right {
          text-align: right;
        }

        @media (max-width: 768px) {
          .footer-content {
            flex-direction: column;
            text-align: center;
            gap: 10px;
          }

          .footer-right {
            text-align: center;
          }
        }
      `}</style>
    </footer>
  );
}