import { useEffect, useState } from "react";

export function LuxuryAwardBadge2025() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&display=swap');

        .luxury-2025-container {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999999;
          width: auto;
          max-width: 90%;
          pointer-events: none;
        }

        .luxury-badge-pill {
          pointer-events: auto;
          background-color: #ffffff;
          border: 1px solid rgba(0,0,0,0.05);
          border-bottom: 2px solid #C5A059;
          padding: 12px 28px;
          border-radius: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08), 
                      0 2px 10px rgba(197, 160, 89, 0.2);
          opacity: 0;
          animation: luxurySlideUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 0.5s;
        }

        .badge-icon svg {
          width: 24px;
          height: 24px;
          display: block;
          filter: drop-shadow(0 2px 4px rgba(197, 160, 89, 0.3));
        }

        .badge-text-group {
          display: flex;
          flex-direction: column;
          text-align: left;
          line-height: 1.1;
        }

        .brand-name {
          font-family: 'Cinzel', serif;
          font-size: 9px;
          color: #888888;
          letter-spacing: 2px;
          text-transform: uppercase;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .award-title {
          font-family: 'Cinzel', serif;
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: linear-gradient(
            90deg, 
            #bf953f 0%, 
            #fcf6ba 40%, 
            #b38728 70%, 
            #fbf5b7 100%
          );
          background-size: 200% auto;
          color: #bf953f;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: goldShimmer 4s linear infinite;
        }

        @keyframes luxurySlideUp {
          0% { opacity: 0; transform: translateY(40px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes goldShimmer {
          to { background-position: 200% center; }
        }

        @media (max-width: 600px) {
          .luxury-badge-pill { padding: 10px 20px; gap: 12px; }
          .brand-name { font-size: 8px; letter-spacing: 1.5px; }
          .award-title { font-size: 11px; }
          .badge-icon svg { width: 20px; height: 20px; }
        }
      `}</style>

      <div className="luxury-2025-container" data-testid="luxury-award-badge">
        <div className="luxury-badge-pill">
          <div className="badge-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5ZM19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" 
                fill="#C5A059"
              />
            </svg>
          </div>

          <div className="badge-text-group">
            <span className="brand-name">PET WASH™ LTD</span>
            <span className="award-title">BEST PET HUB PLATFORMS 2025</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default LuxuryAwardBadge2025;
