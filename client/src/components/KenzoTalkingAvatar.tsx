import { useEffect, useState, useRef } from 'react';
import { logger } from '@/lib/logger';

interface KenzoAvatarProps {
  isVisible: boolean;
  isSpeaking: boolean;
  emotion?: 'happy' | 'thinking' | 'excited' | 'helpful' | 'playful' | 'kiss' | 'wink' | 'smile' | 'love';
}

export function KenzoTalkingAvatar({ isVisible, isSpeaking, emotion = 'happy' }: KenzoAvatarProps) {
  const [rotation, setRotation] = useState(0);
  const [gazeRotation, setGazeRotation] = useState({ x: 0, y: 0 });
  const [breathingScale, setBreathingScale] = useState(1);
  const [tailWag, setTailWag] = useState(0);
  const [blinkState, setBlinkState] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setRotation(prev => (prev + (isSpeaking ? 2 : 0.5)) % 360);
    }, 50);

    logger.info('[Kenzo CSS 3D Avatar] Initialized', { emotion });

    return () => clearInterval(interval);
  }, [isVisible, isSpeaking, emotion]);

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

  if (!isVisible) return null;

  const emotionColors: Record<string, string> = {
    happy: 'from-blue-400 to-blue-600',
    thinking: 'from-purple-400 to-purple-600',
    excited: 'from-orange-400 to-orange-600',
    helpful: 'from-green-400 to-green-600',
    playful: 'from-pink-400 to-pink-600',
    kiss: 'from-pink-500 to-rose-600',
    wink: 'from-amber-400 to-yellow-600',
    smile: 'from-emerald-400 to-teal-600',
    love: 'from-red-400 to-pink-600',
  };

  const gradientClass = emotionColors[emotion] || emotionColors.happy;

  return (
    <div className="w-full h-64 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-300">
      <div ref={avatarRef} className="relative w-48 h-48" style={{ perspective: '500px' }}>
        {/* 3D CSS Dog Container */}
        <div 
          className="w-full h-full relative"
          style={{
            transform: `rotateY(${rotation + gazeRotation.y}deg) rotateX(${(isSpeaking ? Math.sin(rotation / 20) * 5 : 0) + gazeRotation.x}deg)`,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.5s cubic-bezier(0.19, 1, 0.22, 1)'
          }}
        >
          {/* Head */}
          <div 
            className={`absolute top-8 left-1/2 -translate-x-1/2 w-24 h-24 bg-gradient-to-br ${gradientClass} rounded-full shadow-xl`}
            style={{
              transform: isSpeaking ? `translateZ(20px) scale(${1 + Math.sin(rotation / 10) * 0.1})` : 'translateZ(20px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Eyes - Dynamic based on emotion */}
            <div className={`absolute top-8 left-4 w-3 bg-gray-900 rounded-full shadow-lg transition-all duration-200 ${
              emotion === 'wink' ? 'h-1' : 'h-3'
            }`} 
              style={{ transform: 'translateZ(12px)' }} 
            />
            <div className={`absolute top-8 right-4 w-3 bg-gray-900 rounded-full shadow-lg transition-all duration-200 ${
              emotion === 'wink' ? 'h-3' : emotion === 'kiss' || emotion === 'love' ? 'h-2' : 'h-3'
            }`} 
              style={{ transform: 'translateZ(12px)' }} 
            />
            
            {/* Love hearts effect */}
            {(emotion === 'love' || emotion === 'kiss') && (
              <>
                <div className="absolute -top-4 -right-2 text-red-500 text-xl animate-float">❤️</div>
                <div className="absolute -top-6 left-0 text-pink-500 text-sm animate-float-delayed">💕</div>
              </>
            )}
            
            {/* Nose */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-4 h-3 bg-gray-800 rounded-full shadow-lg"
              style={{ transform: 'translateZ(15px)' }}
            />
            
            {/* Mouth (animated when speaking or showing emotion) */}
            {emotion === 'kiss' ? (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-2xl animate-pulse" style={{ transform: 'translateZ(16px)' }}>
                😘
              </div>
            ) : emotion === 'smile' ? (
              <div 
                className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-3 border-2 border-gray-800 rounded-full"
                style={{ transform: 'translateZ(14px)', borderTopColor: 'transparent' }}
              />
            ) : (
              <div 
                className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-2 border-2 border-gray-800 rounded-b-full"
                style={{ 
                  transform: `translateZ(14px) ${isSpeaking ? 'scaleY(1.5)' : 'scaleY(1)'}`,
                  transition: 'transform 0.1s'
                }}
              />
            )}
            
            {/* Left Ear */}
            <div 
              className={`absolute -top-2 -left-6 w-8 h-12 bg-gradient-to-br ${gradientClass} rounded-full shadow-lg`}
              style={{ 
                transform: 'rotateZ(-20deg) translateZ(5px)',
                animation: isSpeaking ? 'wiggle 0.3s ease-in-out infinite' : 'none'
              }}
            />
            
            {/* Right Ear */}
            <div 
              className={`absolute -top-2 -right-6 w-8 h-12 bg-gradient-to-br ${gradientClass} rounded-full shadow-lg`}
              style={{ 
                transform: 'rotateZ(20deg) translateZ(5px)',
                animation: isSpeaking ? 'wiggle 0.3s ease-in-out infinite reverse' : 'none'
              }}
            />
          </div>
          
          {/* Body */}
          <div 
            className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-20 h-24 bg-gradient-to-br ${gradientClass} rounded-2xl shadow-xl`}
            style={{
              transform: 'translateZ(0px)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Collar */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full shadow-lg" />
            
            {/* Tag */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-500 rounded-full shadow-lg flex items-center justify-center text-[8px] font-bold">
              K
            </div>
          </div>
        </div>
        
        {/* Status Indicator */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-white shadow-lg ${
            isSpeaking ? 'text-blue-600' : 'text-gray-600'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isSpeaking ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
            }`} />
            {isSpeaking ? 'Speaking...' : 'Listening'}
          </div>
        </div>
      </div>

      {/* Animated CSS keyframes */}
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotateZ(-20deg) translateZ(5px); }
          50% { transform: rotateZ(-25deg) translateZ(5px); }
        }
        @keyframes float {
          0% { transform: translateY(0px); opacity: 1; }
          100% { transform: translateY(-30px); opacity: 0; }
        }
        @keyframes float-delayed {
          0% { transform: translateY(0px); opacity: 1; }
          100% { transform: translateY(-35px); opacity: 0; }
        }
        .animate-float {
          animation: float 2s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 2.5s ease-in-out infinite 0.5s;
        }
      `}</style>
    </div>
  );
}
