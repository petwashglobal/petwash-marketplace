import { useState, useEffect } from 'react';
import { KenzoTalkingAvatar } from './KenzoTalkingAvatar';
import NewHumanAvatar from './NewHumanAvatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dog, User } from 'lucide-react';

interface MultiAvatarSelectorProps {
  isVisible: boolean;
  isSpeaking: boolean;
  emotion?: 'happy' | 'thinking' | 'excited' | 'helpful' | 'playful' | 'kiss' | 'wink' | 'smile' | 'love';
}

type AvatarType = 'kenzo' | 'human';

export function MultiAvatarSelector({ 
  isVisible, 
  isSpeaking, 
  emotion = 'happy' 
}: MultiAvatarSelectorProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarType>('kenzo');
  const [rotation, setRotation] = useState(0);

  // Load saved preference
  useEffect(() => {
    const saved = localStorage.getItem('petwash_avatar_type') as AvatarType;
    if (saved) {
      setSelectedAvatar(saved);
    }
  }, []);

  // Save preference
  const handleAvatarChange = (type: AvatarType) => {
    setSelectedAvatar(type);
    localStorage.setItem('petwash_avatar_type', type);
  };

  // Rotation animation
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setRotation(prev => (prev + (isSpeaking ? 2 : 0.5)) % 360);
    }, 50);

    return () => clearInterval(interval);
  }, [isVisible, isSpeaking]);

  // Emotion to color mapping (complete coverage for all 9 states)
  const emotionColors: Record<string, string> = {
    happy: '#60a5fa', // blue-400
    thinking: '#a78bfa', // purple-400
    excited: '#fb923c', // orange-400
    helpful: '#4ade80', // green-400
    playful: '#f472b6', // pink-400
    kiss: '#f43f5e', // rose-600
    wink: '#fbbf24', // amber-400
    smile: '#34d399', // emerald-400
    love: '#f43f5e', // red-600
  };

  const emotionColor = emotionColors[emotion] || emotionColors.happy;

  if (!isVisible) return null;

  return (
    <div className="w-full">
      {/* Avatar Type Selector */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <Button
          variant={selectedAvatar === 'kenzo' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleAvatarChange('kenzo')}
          className="gap-2"
          data-testid="button-select-kenzo"
        >
          <Dog className="w-4 h-4" />
          Kenzo
        </Button>
        <Button
          variant={selectedAvatar === 'human' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleAvatarChange('human')}
          className="gap-2"
          data-testid="button-select-human"
        >
          <User className="w-4 h-4" />
          Human
        </Button>
      </div>

      {/* Avatar Display Area */}
      <div className="relative" data-testid="avatar-display-area">
        {selectedAvatar === 'kenzo' ? (
          <KenzoTalkingAvatar
            isVisible={true}
            isSpeaking={isSpeaking}
            emotion={emotion}
          />
        ) : (
          <div className="flex justify-center">
            <NewHumanAvatar
              rotateY={rotation}
              emotionColor={emotionColor}
              isTalking={isSpeaking}
            />
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div className="flex justify-center mt-4">
        <Badge variant={isSpeaking ? 'default' : 'secondary'} className="gap-2">
          <div className={`w-2 h-2 rounded-full ${
            isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`} />
          {isSpeaking ? 'Speaking...' : 'Listening'}
        </Badge>
      </div>
    </div>
  );
}
