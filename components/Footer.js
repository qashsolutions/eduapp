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
          <p>USA</p>
          <div className="footer-links">
            <a href="#">Privacy Policy</a>
            <span className="separator">•</span>
            <a href="#">Terms & Conditions</a>
          </div>
        </div>
      </div>

      <style jsx>{`
        .footer {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(0, 0, 0, 0.08);
          padding: 24px 0;
          margin-top: 0;
          box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12);
        }

        .footer-content {
          width: 100%;
          margin: 0 auto;
          padding: 0 5%;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer-left p,
        .footer-right p {
          color: #4a5568 !important;
          font-size: 1.2rem !important;
          line-height: 1.6;
          margin: 0;
          font-weight: 600;
        }

        .footer-left a,
        .footer-links a {
          color: #4a5568 !important;
          text-decoration: none;
          transition: color 0.3s ease;
          font-weight: 600;
        }

        .footer-left a:hover,
        .footer-links a:hover {
          color: #5a67d8;
          text-decoration: underline;
        }

        .footer-right {
          text-align: right;
        }
        
        .footer-links {
          margin-top: 8px;
          font-size: 1.1rem;
        }
        
        .footer-links .separator {
          color: #4a5568;
          margin: 0 8px;
          font-weight: 600;
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