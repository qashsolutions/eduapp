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
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          padding: 24px 0;
          margin-top: 0;
          box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.03);
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
          color: #ffffff !important;
          font-size: 1.2rem !important;
          line-height: 1.6;
          margin: 0;
          font-weight: 700;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .footer-left a {
          color: #ffffff !important;
          text-decoration: none;
          transition: color 0.3s ease;
          font-weight: 700;
        }

        .footer-left a:hover {
          color: #00ff88;
          text-decoration: underline;
          text-shadow: 0 2px 8px rgba(0, 255, 136, 0.3);
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