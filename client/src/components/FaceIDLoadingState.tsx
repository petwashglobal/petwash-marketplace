/**
 * FaceIDLoadingState Component
 * Banking-style loading UI for automatic Face ID authentication
 * Shows animated face icon and status messages
 * Includes "Use password instead" button for manual fallback
 */

import { ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type AutoFaceIDState } from '@/hooks/useAutoFaceID';
import { type Language } from '@/lib/i18n';

interface FaceIDLoadingStateProps {
  state: AutoFaceIDState;
  message: string;
  language: Language;
  onUsePasswordInstead?: () => void;
}

export function FaceIDLoadingState({ 
  state, 
  message, 
  language,
  onUsePasswordInstead 
}: FaceIDLoadingStateProps) {
  // Don't show anything for idle or unavailable states
  if (state === 'idle' || state === 'unavailable' || state === 'failed') {
    return null;
  }

  const isAnimating = state === 'authenticating';
  const isSuccess = state === 'success';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm animate-in fade-in duration-300"
      data-testid="faceid-loading-state"
      role="dialog"
      aria-live="polite"
      aria-label={language === 'he' ? 'מתבצעת הזדהות' : 'Authenticating'}
    >
      <div className="flex flex-col items-center gap-6 px-6 max-w-md">
        {/* Animated Face Icon */}
        <div
          className={`
            relative rounded-full p-6
            ${isSuccess 
              ? 'bg-green-500/10 dark:bg-green-500/20' 
              : 'bg-primary/10 dark:bg-primary/20'
            }
            ${isAnimating ? 'animate-pulse' : ''}
          `}
          data-testid="faceid-icon-container"
        >
          <ScanFace
            className={`
              h-16 w-16
              ${isSuccess 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-primary'
              }
              ${isAnimating ? 'animate-pulse' : ''}
            `}
            strokeWidth={1.5}
            data-testid="faceid-icon"
            aria-hidden="true"
          />
          
          {/* Scanning animation ring */}
          {isAnimating && (
            <div
              className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping"
              style={{ animationDuration: '2s' }}
              data-testid="faceid-scan-ring"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Status Message */}
        {message && (
          <div className="text-center">
            <p
              className={`
                text-lg font-medium
                ${isSuccess 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-foreground'
                }
              `}
              data-testid="faceid-message"
            >
              {message}
            </p>
          </div>
        )}

        {/* Progress dots for authenticating state */}
        {isAnimating && (
          <div className="flex gap-2" data-testid="faceid-progress-dots" aria-hidden="true">
            <div
              className="h-2 w-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <div
              className="h-2 w-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <div
              className="h-2 w-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
        )}

        {/* Manual Fallback Button - Banking UX: Always show option to use password */}
        {(isAnimating || state === 'checking') && onUsePasswordInstead && (
          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onUsePasswordInstead}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-use-password-instead"
              aria-label={language === 'he' ? 'השתמש בסיסמה במקום' : 'Use password instead'}
            >
              {language === 'he' ? 'השתמש בסיסמה במקום' : 'Use password instead'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
