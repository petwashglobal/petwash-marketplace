import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { Shield, CheckCircle2 } from 'lucide-react';

interface ReCaptchaProps {
  onVerify?: (token: string) => void;
  onError?: (error: Error) => void;
  action?: string;
  language?: string;
}

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render?: (container: string | HTMLElement, options: any) => number;
      reset?: (widgetId?: number) => void;
    };
  }
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

const loadReCaptchaScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha?.ready) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src*="recaptcha/api.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    if (!RECAPTCHA_SITE_KEY) {
      logger.warn('[ReCaptcha] No site key configured');
      reject(new Error('No reCAPTCHA site key configured'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA script'));
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
      window.grecaptcha.ready(async () => {
        try {
          const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
          resolve(token);
        } catch (err) {
          logger.error('[ReCaptcha] Execute error:', err);
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
