import { useEffect, useState, useRef } from 'react';
import './NewHumanAvatar.css';

interface NewHumanAvatarProps {
  rotateY: number;
  emotionColor: string;
  isTalking: boolean;
}

const NewHumanAvatar: React.FC<NewHumanAvatarProps> = ({ 
    rotateY, 
    emotionColor, 
    isTalking 
}) => {
  const talkingClass = isTalking ? 'is-talking' : '';
  const [gazeRotation, setGazeRotation] = useState({ x: 0, y: 0 });
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!avatarRef.current) return;
      
      // Calculate center of the avatar container
      const container = avatarRef.current.getBoundingClientRect();
      const centerX = container.left + container.width / 2;
      const centerY = container.top + container.height / 2;

      // Map mouse position to small rotation values (-5 to 5 degrees)
      const rotY = (event.clientX - centerX) * 0.05; // Horizontal look
      const rotX = (event.clientY - centerY) * -0.05; // Vertical look

      setGazeRotation({ x: rotX, y: rotY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div 
      ref={avatarRef}
      className="human-stage" 
      style={{ 
        transform: `rotateY(${rotateY + gazeRotation.y}deg) rotateX(${gazeRotation.x}deg)`,
        transition: 'transform 0.5s cubic-bezier(0.19, 1, 0.22, 1)'
      }}
    >
      <div className="human-head-container">
        
        {/* Face - Receives Emotion Gradient */}
        <div 
          className="face" 
          style={{ 
            backgroundColor: emotionColor,
            transform: isTalking ? 'scaleY(0.95)' : 'scaleY(1)'
          }}
        >
          {/* The Plush Lab Visor - Glassmorphism Accessory */}
          <div className="plush-lab-visor"></div>
          
          {/* Eyes & Other features */}
          <div className="eye left"></div>
          <div className="eye right"></div>
          <div className={`mouth ${talkingClass}`}></div>
        </div>
        
        {/* Right Side - Rotated 90 degrees */}
        <div className="side right-side"></div>
        
        {/* Left Side - Rotated -90 degrees */}
        <div className="side left-side"></div>
        
        {/* Top/Hair */}
        <div className="top-side" style={{ background: 'var(--hair-color)' }}></div>
        
        {/* Back */}
        <div className="back-side"></div>
      </div>
    </div>
  );
};

export default NewHumanAvatar;
