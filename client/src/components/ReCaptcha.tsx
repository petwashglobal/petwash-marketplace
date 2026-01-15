import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { Shield, Lock, CheckCircle2 } from 'lucide-react';

interface ReCaptchaProps {
  onVerify: (token: string) => void;
  onError?: (error: Error) => void;
  action?: string;
  language?: string;
}

declare global {
  interface Window {
    grecaptcha: {
      enterprise: {
        ready: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
        render: (container: string | HTMLElement, options: any) => number;
        reset: (widgetId?: number) => void;
      };
      ready?: (callback: () => void) => void;
      render?: (container: string | HTMLElement, options: any) => number;
      reset?: (widgetId?: number) => void;
    };
  }
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;

const loadReCaptchaEnterpriseScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha?.enterprise) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src*="recaptcha/enterprise.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA Enterprise script'));
    document.head.appendChild(script);
  });
};

export function ReCaptcha({ 
  onVerify, 
  onError, 
  action = 'LOGIN',
  language = 'en'
}: ReCaptchaProps) {
  const [isReady, setIsReady] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const executedRef = useRef(false);

  const executeRecaptcha = useCallback(async () => {
    if (executedRef.current || isVerifying) return;
    
    try {
      executedRef.current = true;
      setIsVerifying(true);
      
      await loadReCaptchaEnterpriseScript();
      
      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if (window.grecaptcha?.enterprise) {
            window.grecaptcha.enterprise.ready(resolve);
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });

      setIsReady(true);
      
      const token = await window.grecaptcha.enterprise.execute(RECAPTCHA_SITE_KEY, { action });
      
      logger.info('[ReCaptcha Enterprise] Token obtained for action:', action);
      setIsVerified(true);
      onVerify(token);
      
    } catch (error) {
      logger.error('[ReCaptcha Enterprise] Error:', error);
      executedRef.current = false;
      if (onError) {
        onError(error as Error);
      }
    } finally {
      setIsVerifying(false);
    }
  }, [action, onVerify, onError, isVerifying]);

  useEffect(() => {
    executeRecaptcha();
  }, [executeRecaptcha]);

  return (
    <div className="recaptcha-wrapper w-full">
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 backdrop-blur-sm">
          {isVerified ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 animate-in zoom-in duration-300" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300 tracking-wide">
                {language === 'he' ? 'אומת בהצלחה' : 'Verified Secure'}
              </span>
            </>
          ) : isVerifying ? (
            <>
              <Shield className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 tracking-wide">
                {language === 'he' ? 'מאמת...' : 'Verifying...'}
              </span>
            </>
          ) : (
            <>
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 tracking-wide">
                {language === 'he' ? 'אימות אבטחה' : 'Security Check'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
        
        <div className="relative">
          <div 
            className={`
              flex justify-center items-center p-4 rounded-2xl
              bg-white/90 dark:bg-neutral-900/90 backdrop-blur-2xl
              border-2 border-neutral-200/60 dark:border-neutral-700/60
              shadow-xl shadow-neutral-900/5 dark:shadow-neutral-950/20
              transition-all duration-500 ease-out
              ${isVerified ? 'ring-2 ring-green-500/30 border-green-500/50' : ''}
            `}
          >
            {!isReady && (
              <div className="flex flex-col items-center justify-center gap-3 py-2">
                <div className="relative">
                  <Lock className="w-6 h-6 text-primary animate-pulse" />
                  <div className="absolute inset-0 animate-ping">
                    <Lock className="w-6 h-6 text-primary/30" />
                  </div>
                </div>
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 tracking-wide animate-pulse">
                  {language === 'he' ? 'מאתחל אבטחה...' : 'Initializing security...'}
                </span>
              </div>
            )}
            
            {isReady && !isVerified && (
              <div className="flex items-center gap-2 py-2">
                <Shield className="w-5 h-5 text-primary animate-pulse" />
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {language === 'he' ? 'מאמת...' : 'Validating...'}
                </span>
              </div>
            )}
            
            {isVerified && (
              <div className="flex items-center gap-2 py-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                  {language === 'he' ? 'אומת בהצלחה' : 'Verified'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        <Shield className="w-3.5 h-3.5" />
        <span className="tracking-wide">
          {language === 'he' ? 'מוגן על ידי reCAPTCHA Enterprise' : 'Protected by reCAPTCHA Enterprise'}
        </span>
      </div>
    </div>
  );
}

export function InvisibleReCaptcha({ 
  onVerify, 
  onError,
  action = 'SUBMIT',
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
