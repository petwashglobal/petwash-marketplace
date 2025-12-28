import { useEffect, useState } from "react";

export function LuxuryAwardBadge2025() {
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // Pre-check if image exists before showing component
    const img = new Image();
    img.onload = () => {
      setImageLoaded(true);
      setTimeout(() => setIsVisible(true), 800);
    };
    img.onerror = () => {
      setImageError(true);
      setIsVisible(false);
    };
    img.src = "/award-medallion-2025.png";
  }, []);

  // Don't render if image failed to load or hasn't loaded yet
  if (!isVisible || imageError || !imageLoaded) return null;

  return (
    <>
      <style>{`
        .luxury-medallion-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 80px;
          height: 80px;
          z-index: 9999;
          pointer-events: none;
        }

        .luxury-medallion {
          pointer-events: auto;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          overflow: hidden;
          cursor: pointer;
          opacity: 0;
          animation: medallionReveal 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 0.3s;
          box-shadow: 
            0 4px 20px rgba(197, 160, 89, 0.4),
            0 8px 40px rgba(0, 0, 0, 0.15),
            inset 0 0 20px rgba(255, 255, 255, 0.1);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), 
                      box-shadow 0.4s ease;
        }

        .luxury-medallion:hover {
          transform: scale(1.1) rotate(5deg);
          box-shadow: 
            0 8px 30px rgba(197, 160, 89, 0.5),
            0 12px 50px rgba(0, 0, 0, 0.2),
            inset 0 0 30px rgba(255, 255, 255, 0.15);
        }

        .luxury-medallion img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        @keyframes medallionReveal {
          0% { 
            opacity: 0; 
            transform: scale(0.3) rotate(-180deg);
          }
          60% {
            transform: scale(1.1) rotate(10deg);
          }
          100% { 
            opacity: 1; 
            transform: scale(1) rotate(0deg);
          }
        }

        @media (max-width: 600px) {
          .luxury-medallion-container {
            bottom: 16px;
            right: 16px;
            width: 60px;
            height: 60px;
          }
          .luxury-medallion {
            width: 60px;
            height: 60px;
          }
        }
      `}</style>

      <div className="luxury-medallion-container" data-testid="luxury-award-badge">
        <div className="luxury-medallion">
          <img 
            src="/award-medallion-2025.png" 
            alt="Pet Wash™ LTD - 2025 Award Winner - Best Pet Hub Platforms"
            loading="eager"
          />
        </div>
      </div>
    </>
  );
}

export default LuxuryAwardBadge2025;
