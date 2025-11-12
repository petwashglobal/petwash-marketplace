import { useEffect, useState, useRef } from 'react';
import { logger } from '@/lib/logger';

interface Kenzo3DRealisticProps {
  isVisible: boolean;
  isSpeaking: boolean;
  emotion?: 'happy' | 'thinking' | 'excited' | 'helpful' | 'playful';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Kenzo3DRealistic({ 
  isVisible, 
  isSpeaking, 
  emotion = 'happy',
  size = 'lg'
}: Kenzo3DRealisticProps) {
  const [time, setTime] = useState(0);
  const [gazeRotation, setGazeRotation] = useState({ x: 0, y: 0 });
  const [blinkState, setBlinkState] = useState(false);
  const [tailWag, setTailWag] = useState(0);
  const [breathingPhase, setBreathingPhase] = useState(0);
  const [earTwitch, setEarTwitch] = useState({ left: false, right: false });
  const avatarRef = useRef<HTMLDivElement>(null);

  // Size configurations
  const sizeConfigs = {
    sm: { container: 'w-32 h-32', scale: 0.5 },
    md: { container: 'w-48 h-48', scale: 0.75 },
    lg: { container: 'w-64 h-64', scale: 1 },
    xl: { container: 'w-96 h-96', scale: 1.5 },
  };

  const config = sizeConfigs[size];

  // Main animation loop (realistic breathing, tail wag, ear movement)
  useEffect(() => {
    if (!isVisible) return;

    const animationInterval = setInterval(() => {
      setTime(prev => prev + 0.05);
      
      // Breathing animation (1.5s cycle)
      const breathPhase = Math.sin(time * 2);
      setBreathingPhase(breathPhase);
      
      // Tail wagging (faster when speaking/excited)
      const wagSpeed = isSpeaking || emotion === 'excited' ? 5 : 2;
      setTailWag(Math.sin(time * wagSpeed) * 30);
      
      // Random ear twitches
      if (Math.random() < 0.02) {
        setEarTwitch({ 
          left: Math.random() > 0.5, 
          right: Math.random() > 0.5 
        });
        setTimeout(() => setEarTwitch({ left: false, right: false }), 200);
      }
    }, 50);

    logger.info('[Kenzo 3D Realistic] Animation started', { emotion, size });

    return () => clearInterval(animationInterval);
  }, [isVisible, isSpeaking, emotion, time, size]);

  // Realistic eye blinking (random intervals)
  useEffect(() => {
    if (!isVisible) return;

    const blinkInterval = setInterval(() => {
      if (Math.random() < 0.1) { // 10% chance per second
        setBlinkState(true);
        setTimeout(() => setBlinkState(false), 150);
      }
    }, 1000);

    return () => clearInterval(blinkInterval);
  }, [isVisible]);

  // Mouse tracking for realistic eye gaze
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!avatarRef.current) return;
      
      const container = avatarRef.current.getBoundingClientRect();
      const centerX = container.left + container.width / 2;
      const centerY = container.top + container.height / 2;

      // Calculate gaze direction (limited range for realism)
      const maxGaze = 15; // degrees
      const rotY = Math.max(-maxGaze, Math.min(maxGaze, (event.clientX - centerX) * 0.03));
      const rotX = Math.max(-maxGaze, Math.min(maxGaze, (event.clientY - centerY) * -0.03));

      setGazeRotation({ x: rotX, y: rotY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (!isVisible) return null;

  // Emotion-based color schemes (pure white/black luxury aesthetic)
  const emotionStyles = {
    happy: { 
      primary: 'from-gray-800 to-black dark:from-gray-200 dark:to-white',
      accent: 'from-gray-600 to-gray-800 dark:from-gray-300 dark:to-gray-100',
      glow: 'shadow-[0_0_30px_rgba(0,0,0,0.3)] dark:shadow-[0_0_30px_rgba(255,255,255,0.3)]'
    },
    thinking: { 
      primary: 'from-gray-700 to-black dark:from-gray-300 dark:to-white',
      accent: 'from-gray-500 to-gray-700 dark:from-gray-400 dark:to-gray-200',
      glow: 'shadow-[0_0_25px_rgba(0,0,0,0.25)] dark:shadow-[0_0_25px_rgba(255,255,255,0.25)]'
    },
    excited: { 
      primary: 'from-black to-gray-900 dark:from-white dark:to-gray-100',
      accent: 'from-gray-800 to-black dark:from-gray-200 dark:to-white',
      glow: 'shadow-[0_0_40px_rgba(0,0,0,0.4)] dark:shadow-[0_0_40px_rgba(255,255,255,0.4)]'
    },
    helpful: { 
      primary: 'from-gray-800 to-black dark:from-gray-200 dark:to-white',
      accent: 'from-gray-600 to-gray-800 dark:from-gray-300 dark:to-gray-100',
      glow: 'shadow-[0_0_35px_rgba(0,0,0,0.35)] dark:shadow-[0_0_35px_rgba(255,255,255,0.35)]'
    },
    playful: { 
      primary: 'from-gray-900 to-black dark:from-gray-100 dark:to-white',
      accent: 'from-gray-700 to-gray-900 dark:from-gray-200 dark:to-white',
      glow: 'shadow-[0_0_35px_rgba(0,0,0,0.35)] dark:shadow-[0_0_35px_rgba(255,255,255,0.35)]'
    },
  };

  const style = emotionStyles[emotion];
  const breathScale = 1 + (breathingPhase * 0.03); // Subtle breathing

  return (
    <div className={`${config.container} flex items-center justify-center`}>
      <div 
        ref={avatarRef} 
        className="relative w-full h-full"
        style={{ 
          perspective: '800px',
          transform: `scale(${config.scale})`
        }}
      >
        {/* 3D Container */}
        <div 
          className="w-full h-full relative"
          style={{
            transform: `
              rotateY(${gazeRotation.y}deg) 
              rotateX(${gazeRotation.x}deg)
              scale(${breathScale})
            `,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* === HEAD === */}
          <div 
            className={`absolute top-12 left-1/2 -translate-x-1/2 w-32 h-32 bg-gradient-to-br ${style.primary} ${style.glow} rounded-full`}
            style={{
              transform: `translateZ(30px) scale(${isSpeaking ? 1 + Math.abs(Math.sin(time * 10)) * 0.05 : 1})`,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Eyes */}
            <div 
              className="absolute top-12 left-8 w-6 h-6 bg-white dark:bg-black rounded-full"
              style={{ 
                transform: `translateZ(18px) scaleY(${blinkState ? 0.1 : 1})`,
                transition: 'transform 0.1s'
              }}
            >
              <div className="absolute top-1 left-1 w-4 h-4 bg-black dark:bg-white rounded-full" />
            </div>
            <div 
              className="absolute top-12 right-8 w-6 h-6 bg-white dark:bg-black rounded-full"
              style={{ 
                transform: `translateZ(18px) scaleY(${blinkState ? 0.1 : 1})`,
                transition: 'transform 0.1s'
              }}
            >
              <div className="absolute top-1 left-1 w-4 h-4 bg-black dark:bg-white rounded-full" />
            </div>
            
            {/* Nose */}
            <div 
              className="absolute bottom-10 left-1/2 -translate-x-1/2 w-5 h-4 bg-gray-900 dark:bg-gray-100 rounded-full"
              style={{ transform: 'translateZ(20px)' }}
            />
            
            {/* Mouth */}
            <div 
              className="absolute bottom-6 left-1/2 -translate-x-1/2 w-8 h-3 border-2 border-gray-900 dark:border-gray-100 rounded-b-full"
              style={{ 
                transform: `translateZ(18px) scaleY(${isSpeaking ? 1.5 + Math.sin(time * 15) * 0.3 : 1})`,
                transition: 'transform 0.05s'
              }}
            />
            
            {/* Left Ear */}
            <div 
              className={`absolute -top-3 -left-8 w-10 h-16 bg-gradient-to-br ${style.accent} rounded-full ${style.glow}`}
              style={{ 
                transform: `rotateZ(-25deg) translateZ(8px) ${earTwitch.left ? 'rotateZ(-5deg)' : ''}`,
                animation: isSpeaking ? 'earWiggle 0.6s ease-in-out infinite' : 'none'
              }}
            />
            
            {/* Right Ear */}
            <div 
              className={`absolute -top-3 -right-8 w-10 h-16 bg-gradient-to-br ${style.accent} rounded-full ${style.glow}`}
              style={{ 
                transform: `rotateZ(25deg) translateZ(8px) ${earTwitch.right ? 'rotateZ(5deg)' : ''}`,
                animation: isSpeaking ? 'earWiggle 0.6s ease-in-out infinite reverse' : 'none'
              }}
            />
          </div>
          
          {/* === BODY === */}
          <div 
            className={`absolute bottom-8 left-1/2 -translate-x-1/2 w-28 h-36 bg-gradient-to-br ${style.primary} ${style.glow} rounded-3xl`}
            style={{
              transform: 'translateZ(0px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Premium Collar */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-4 bg-gradient-to-r from-gray-800 to-black dark:from-gray-200 dark:to-white rounded-full shadow-lg border border-white dark:border-black" />
            
            {/* PetWash™ Tag */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-6 h-6 bg-white dark:bg-black rounded-full shadow-xl flex items-center justify-center text-[10px] font-bold border-2 border-black dark:border-white">
              <span className="text-black dark:text-white">K</span>
            </div>
          </div>
          
          {/* === ANIMATED TAIL === */}
          <div 
            className={`absolute bottom-16 right-6 w-3 h-20 bg-gradient-to-b ${style.accent} rounded-full origin-top ${style.glow}`}
            style={{
              transform: `translateZ(-10px) rotateZ(${tailWag}deg)`,
              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>
        
        {/* Status Indicator */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium tracking-wide uppercase bg-white dark:bg-black shadow-lg border border-gray-200 dark:border-gray-800 ${
            isSpeaking ? 'text-black dark:text-white' : 'text-gray-600 dark:text-gray-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isSpeaking ? 'bg-black dark:bg-white animate-pulse' : 'bg-gray-400 dark:bg-gray-600'
            }`} />
            {isSpeaking ? 'Speaking' : 'Listening'}
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes earWiggle {
          0%, 100% { transform: rotateZ(-25deg) translateZ(8px); }
          50% { transform: rotateZ(-30deg) translateZ(8px); }
        }
      `}</style>
    </div>
  );
}
