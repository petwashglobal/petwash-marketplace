import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { Shield, CheckCircle2, Loader2 } from 'lucide-react';

interface ReCaptchaProps {
  onVerify?: (token: string) => void;
  onError?: (error: Error) => void;
  action?: string;
  language?: string;
}

interface SecurityCheckpointProps {
  onVerified: (token: string) => void;
  onFailed?: () => void;
  language?: string;
  action?: string;
  required?: boolean;
}

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      enterprise: {
        ready: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
      render?: (container: string | HTMLElement, options: any) => number;
      reset?: (widgetId?: number) => void;
    };
  }
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

const loadReCaptchaScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha?.enterprise?.ready) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src*="recaptcha/enterprise.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    if (!RECAPTCHA_SITE_KEY) {
      logger.warn('[ReCaptcha] No site key configured');
      reject(new Error('No reCAPTCHA site key configured'));
      return;
    }

    const oldScript = document.querySelector('script[src*="recaptcha/api.js"]');
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA Enterprise script'));
    document.head.appendChild(script);
  });
};

export async function executeReCaptcha(action: string = 'submit'): Promise<string | null> {
  try {
    if (!RECAPTCHA_SITE_KEY) {
      logger.warn('[ReCaptcha] No site key - skipping verification');
      return null;
    }

    await loadReCaptchaScript();

    return new Promise((resolve) => {
      window.grecaptcha.enterprise.ready(async () => {
        try {
          const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action });
          resolve(token);
        } catch (err) {
          logger.error('[ReCaptcha] Enterprise execute error:', err);
          resolve(null);
        }
      });
    });
  } catch (err) {
    logger.error('[ReCaptcha] Load error:', err);
    return null;
  }
}

export async function verifyReCaptchaOnServer(token: string, action: string): Promise<{ success: boolean; score?: number }> {
  try {
    const response = await fetch('/api/recaptcha/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action }),
    });
    return await response.json();
  } catch (err) {
    logger.error('[ReCaptcha] Server verification error:', err);
    return { success: false };
  }
}

export function SecurityCheckpoint({ 
  onVerified, 
  onFailed,
  language = 'en',
  action = 'register',
  required = true
}: SecurityCheckpointProps) {
  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified' | 'failed'>('idle');
  const [animating, setAnimating] = useState(false);
  const busyRef = useRef(false);
  const touchFiredRef = useRef(false);
  const isHebrew = language === 'he';

  const handleVerify = useCallback(async () => {
    if (busyRef.current || status === 'verified') return;
    busyRef.current = true;
    
    setStatus('verifying');
    setAnimating(true);

    try {
      const token = await executeReCaptcha(action);

      if (token) {
        const serverResult = await verifyReCaptchaOnServer(token, action);
        if (serverResult.success) {
          setStatus('verified');
          onVerified(token);
        } else {
          setStatus('failed');
          onFailed?.();
        }
      } else {
        setStatus('verified');
        onVerified('bypass-no-key');
      }
    } catch (error) {
      logger.error('[SecurityCheckpoint] Verification failed:', error);
      setStatus('failed');
      onFailed?.();
    } finally {
      setAnimating(false);
      busyRef.current = false;
    }
  }, [status, action, onVerified, onFailed]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    touchFiredRef.current = true;
    handleVerify();
    setTimeout(() => { touchFiredRef.current = false; }, 400);
  }, [handleVerify]);

  const handleMouseClick = useCallback((e: React.MouseEvent) => {
    if (touchFiredRef.current) return;
    handleVerify();
  }, [handleVerify]);

  return (
    <div className="w-full" data-testid="security-checkpoint">
      <div 
        className={`
          flex items-center gap-3 p-4 rounded-sm border-2 transition-all duration-300 cursor-pointer select-none
          ${status === 'idle' ? 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100' : ''}
          ${status === 'verifying' ? 'border-blue-200 bg-blue-50' : ''}
          ${status === 'verified' ? 'border-green-200 bg-green-50' : ''}
          ${status === 'failed' ? 'border-red-200 bg-red-50' : ''}
        `}
        onTouchEnd={handleTouchEnd}
        onClick={handleMouseClick}
        role="checkbox"
        aria-checked={status === 'verified'}
        aria-label={isHebrew ? 'אימות אבטחה - אני לא רובוט' : 'Security verification - I am not a robot'}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleVerify();
          }
        }}
        style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
          {status === 'idle' && (
            <div className="w-6 h-6 rounded-sm border-2 border-gray-400 bg-white transition-colors" />
          )}
          {status === 'verifying' && (
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          )}
          {status === 'verified' && (
            <div className="w-6 h-6 rounded-sm bg-green-500 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
          )}
          {status === 'failed' && (
            <div className="w-6 h-6 rounded-sm border-2 border-red-400 bg-white flex items-center justify-center">
              <span className="text-red-500 text-sm font-bold">!</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${
            status === 'verified' ? 'text-green-700' :
            status === 'failed' ? 'text-red-700' :
            status === 'verifying' ? 'text-blue-700' :
            'text-gray-700'
          }`}>
            {status === 'idle' && (isHebrew ? 'אני לא רובוט' : "I'm not a robot")}
            {status === 'verifying' && (isHebrew ? 'מאמת...' : 'Verifying...')}
            {status === 'verified' && (isHebrew ? 'אומת בהצלחה' : 'Verified')}
            {status === 'failed' && (isHebrew ? 'האימות נכשל - לחץ לניסיון נוסף' : 'Verification failed - click to retry')}
          </p>
        </div>

        <div className="flex-shrink-0 flex flex-col items-center">
          <Shield className={`w-5 h-5 ${
            status === 'verified' ? 'text-green-500' :
            status === 'failed' ? 'text-red-400' :
            'text-gray-400'
          }`} />
          <span className="text-[8px] text-gray-400 mt-0.5 leading-tight">reCAPTCHA</span>
        </div>
      </div>
      
      {required && status === 'idle' && (
        <p className="text-[11px] text-gray-400 mt-1 px-1">
          {isHebrew ? 'נדרש אימות אבטחה לפני הרשמה' : 'Security verification required before registration'}
        </p>
      )}

      <div className="flex items-center justify-center gap-1 mt-2">
        <span className="text-[9px] text-gray-400">
          {isHebrew ? 'מוגן על ידי' : 'Protected by'} Google reCAPTCHA
        </span>
        <a 
          href="https://policies.google.com/privacy" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[9px] text-blue-400 hover:text-blue-500"
          onClick={(e) => e.stopPropagation()}
        >
          {isHebrew ? 'פרטיות' : 'Privacy'}
        </a>
        <span className="text-[9px] text-gray-300">|</span>
        <a 
          href="https://policies.google.com/terms" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[9px] text-blue-400 hover:text-blue-500"
          onClick={(e) => e.stopPropagation()}
        >
          {isHebrew ? 'תנאים' : 'Terms'}
        </a>
      </div>
    </div>
  );
}

export function ReCaptcha({ 
  onVerify, 
  onError, 
  action = 'page_load',
  language = 'en'
}: ReCaptchaProps) {
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const executedRef = useRef(false);

  const runVerification = useCallback(async () => {
    if (executedRef.current || isVerifying) return;

    try {
      executedRef.current = true;
      setIsVerifying(true);

      const token = await executeReCaptcha(action);

      if (token) {
        setIsVerified(true);
        onVerify?.(token);
      } else {
        setIsVerified(true);
        onVerify?.('');
      }
    } catch (error) {
      logger.error('[ReCaptcha] Error:', error);
      executedRef.current = false;
      setIsVerified(true);
      onError?.(error as Error);
    } finally {
      setIsVerifying(false);
    }
  }, [action, onVerify, onError, isVerifying]);

  useEffect(() => {
    runVerification();
  }, []);

  return (
    <div className="recaptcha-wrapper w-full">
      <div className="flex items-center justify-center gap-2 py-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-50 dark:bg-neutral-800/50">
          {isVerified ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              <span className="text-[10px] font-medium text-green-700 dark:text-green-300 tracking-wide">
                {language === 'he' ? 'מוגן על ידי reCAPTCHA' : 'Protected by reCAPTCHA'}
              </span>
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5 text-neutral-400 animate-pulse" />
              <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 tracking-wide">
                {language === 'he' ? 'אבטחה פעילה...' : 'Securing...'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function InvisibleReCaptcha({ 
  onVerify, 
  onError,
  action = 'submit',
  language = 'en'
}: ReCaptchaProps) {
  return (
    <ReCaptcha 
      onVerify={onVerify}
      onError={onError}
      action={action}
      language={language}
    />
  );
}
