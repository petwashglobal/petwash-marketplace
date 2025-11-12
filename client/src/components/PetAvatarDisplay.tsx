import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import type { AvatarState } from '@/services/KenzoAvatarChatService';

interface PetAvatar {
  id: number;
  userId: string;
  petName: string;
  photoUrl: string;
  thumbnailUrl: string | null;
  animationProfile: {
    style: 'playful' | 'calm' | 'energetic';
    intensity: 'low' | 'medium' | 'high';
    blinkRate: number;
  };
  ttsVoice: string;
  status: string;
  isDefault: boolean;
}

interface PetAvatarDisplayProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  animated?: boolean;
  greeting?: string;
  className?: string;
}

export function PetAvatarDisplay({
  size = 'md',
  showName = false,
  animated = true,
  greeting,
  className = '',
}: PetAvatarDisplayProps) {
  const { user: firebaseUser } = useFirebaseAuth();
  const [avatarState, setAvatarState] = useState<AvatarState>({
    expression: 'happy',
    animation: 'idle',
    emotion: 'joy',
  });
  const [isAnimating, setIsAnimating] = useState(false);

  // Fetch user's default pet avatar
  const { data: avatarsData } = useQuery({
    queryKey: ['/api/avatars'],
    enabled: !!firebaseUser,
  });

  const defaultAvatar = avatarsData?.avatars?.find((a: PetAvatar) => a.isDefault) || avatarsData?.avatars?.[0];

  // Listen to Kenzo avatar state changes
  useEffect(() => {
    if (!animated) return;

    const handleStateChange = (event: CustomEvent<AvatarState>) => {
      setAvatarState(event.detail);
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 2000);
    };

    window.addEventListener('kenzo-avatar-state-change', handleStateChange as EventListener);
    return () => {
      window.removeEventListener('kenzo-avatar-state-change', handleStateChange as EventListener);
    };
  }, [animated]);

  // Size mappings
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48',
  };

  // Animation classes based on avatar state
  const getAnimationClasses = () => {
    if (!animated || !isAnimating) return '';
    
    const style = defaultAvatar?.animationProfile?.style || 'playful';
    
    switch (avatarState.animation) {
      case 'speaking':
        return style === 'energetic' 
          ? 'animate-bounce' 
          : style === 'calm' 
          ? 'animate-pulse' 
          : 'animate-wiggle';
      case 'nodding':
        return 'animate-bounce';
      case 'wagging':
        return 'animate-wiggle';
      default:
        return '';
    }
  };

  if (!defaultAvatar) {
    // Show default Kenzo if no custom avatar
    return (
      <div className={`${sizeClasses[size]} ${className}`}>
        <div className="relative w-full h-full">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400 rounded-full animate-pulse" />
          <div className="absolute inset-2 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-4xl">
            🐾
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div 
        className={`${sizeClasses[size]} relative ${getAnimationClasses()}`}
        data-testid="pet-avatar-display"
      >
        <img
          src={defaultAvatar.thumbnailUrl || defaultAvatar.photoUrl}
          alt={defaultAvatar.petName}
          className="w-full h-full object-cover rounded-full border-4 border-purple-300 dark:border-purple-700 shadow-xl"
        />
        
        {/* Emotion indicator */}
        {animated && isAnimating && (
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center shadow-lg animate-bounce">
            {avatarState.emotion === 'joy' && '😊'}
            {avatarState.emotion === 'curiosity' && '🤔'}
            {avatarState.emotion === 'helpful' && '💡'}
            {avatarState.emotion === 'playful' && '🎾'}
          </div>
        )}
      </div>
      
      {showName && (
        <p className="mt-2 font-semibold text-lg text-gray-800 dark:text-gray-200">
          {defaultAvatar.petName}
        </p>
      )}
      
      {greeting && (
        <div className="mt-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
          <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
            {greeting}
          </p>
        </div>
      )}
    </div>
  );
}
