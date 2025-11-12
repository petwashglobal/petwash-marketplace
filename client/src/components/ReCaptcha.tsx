import { useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import { Shield, Lock, CheckCircle2 } from 'lucide-react';

interface ReCaptchaProps {
  onVerify: (token: string) => void;
  onError?: (error: Error) => void;
  size?: 'normal' | 'compact' | 'invisible';
  theme?: 'light' | 'dark';
  containerId?: string;
}

// Load reCAPTCHA script dynamically
const loadReCaptchaScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA script'));
    document.head.appendChild(script);
  });
};

/**
 * LUXURY 2025: Premium ReCaptcha Component - Ultra-modern bot protection
 * Features: Glassmorphism, smooth animations, elegant security badge
 * Shows visible reCAPTCHA with premium branding for signin and payment pages
 */
export function ReCaptcha({ 
  onVerify, 
  onError, 
  size = 'normal',
  theme = 'light',
  containerId = 'recaptcha-widget'
}: ReCaptchaProps) {
  const widgetIdRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [siteKey, setSiteKey] = useState<string | null>(null);

  useEffect(() => {
    // Fetch site key from backend
    const fetchSiteKey = async () => {
      try {
        // Try environment variable first
        const envSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
        if (envSiteKey) {
          logger.info('[ReCaptcha] Using site key from environment');
          setSiteKey(envSiteKey);
          return;
        }

        // Fallback to API
        const response = await fetch('/api/recaptcha/config');
        const data = await response.json();
        
        if (data.success && data.siteKey) {
          logger.info('[ReCaptcha] Site key loaded from API');
          setSiteKey(data.siteKey);
        } else {
          throw new Error('Failed to load reCAPTCHA site key');
        }
      } catch (error) {
        logger.error('[ReCaptcha] Failed to load site key:', error);
        if (onError) {
          onError(error as Error);
        }
      }
    };

    fetchSiteKey();
  }, [onError]);

  useEffect(() => {
    if (!siteKey) return;

    const initializeRecaptcha = async () => {
      try {
        // Load reCAPTCHA script
        await loadReCaptchaScript();

        // Wait for grecaptcha to be ready
        const waitForReady = () => {
          return new Promise<void>((resolve) => {
            if (window.grecaptcha && window.grecaptcha.ready) {
              window.grecaptcha.ready(() => resolve());
            } else {
              setTimeout(() => waitForReady().then(resolve), 100);
            }
          });
        };

        await waitForReady();

        // Render reCAPTCHA widget
        window.grecaptcha.ready(() => {
          const widgetId = window.grecaptcha.render(containerId, {
            sitekey: siteKey,
            size,
            theme,
            callback: (response: string) => {
              logger.info('[ReCaptcha] Verification successful');
              setIsVerified(true);
              onVerify(response);
            },
            'expired-callback': () => {
              logger.warn('[ReCaptcha] Token expired, please verify again');
              setIsVerified(false);
              if (onError) {
                onError(new Error('reCAPTCHA expired'));
              }
            },
            'error-callback': () => {
              logger.error('[ReCaptcha] Verification failed');
              setIsVerified(false);
              if (onError) {
                onError(new Error('reCAPTCHA error'));
              }
            }
          });

          widgetIdRef.current = widgetId;
          setIsReady(true);
          logger.info('[ReCaptcha] Widget rendered successfully');
        });
      } catch (error) {
        logger.error('[ReCaptcha] Failed to initialize:', error);
        if (onError) {
          onError(error as Error);
        }
      }
    };

    initializeRecaptcha();

    // Cleanup on unmount
    return () => {
      if (widgetIdRef.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(widgetIdRef.current);
        } catch (error) {
          logger.error('[ReCaptcha] Cleanup error:', error);
        }
      }
    };
  }, [siteKey, containerId, size, theme, onVerify, onError]);

  return (
    <div className="recaptcha-wrapper w-full">
      {/* LUXURY 2025: Premium Security Header */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 backdrop-blur-sm">
          {isVerified ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 animate-in zoom-in duration-300" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300 tracking-wide">
                Verified Secure
              </span>
            </>
          ) : (
            <>
              <Shield className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 tracking-wide">
                Security Verification
              </span>
            </>
          )}
        </div>
      </div>

      {/* LUXURY 2025: Premium reCAPTCHA Container with Advanced Glassmorphism */}
      <div className="relative group">
        {/* Premium Glow Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
        
        {/* Main Container */}
        <div className="relative">
          <div 
            id={containerId}
            className={`
              flex justify-center items-center p-6 rounded-2xl
              bg-white/90 dark:bg-neutral-900/90 backdrop-blur-2xl
              border-2 border-neutral-200/60 dark:border-neutral-700/60
              shadow-xl shadow-neutral-900/5 dark:shadow-neutral-950/20
              transition-all duration-500 ease-out
              hover:shadow-2xl hover:shadow-primary/10
              hover:border-primary/30 dark:hover:border-primary/30
              ${isVerified ? 'ring-2 ring-green-500/30 border-green-500/50' : ''}
            `}
            data-testid="recaptcha-container"
          />
          
          {/* Premium Loading State */}
          {!isReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl rounded-2xl">
              <div className="relative">
                <Lock className="w-8 h-8 text-primary animate-pulse" />
                <div className="absolute inset-0 animate-ping">
                  <Lock className="w-8 h-8 text-primary/30" />
                </div>
              </div>
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 tracking-wide animate-pulse">
                Initializing security...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* LUXURY 2025: Premium Security Badge */}
      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        <Shield className="w-3.5 h-3.5" />
        <span className="tracking-wide">Protected by advanced bot detection</span>
      </div>
    </div>
  );
}

/**
 * LUXURY 2025: Invisible ReCaptcha - Minimal bot protection
 * Shows only the small badge at bottom-right of page (Google default)
 */
export function InvisibleReCaptcha({ 
  onVerify, 
  onError,
  containerId = 'recaptcha-invisible'
}: Omit<ReCaptchaProps, 'size' | 'theme'>) {
  return (
    <ReCaptcha 
      onVerify={onVerify}
      onError={onError}
      size="invisible"
      containerId={containerId}
    />
  );
}

// TypeScript declarations for grecaptcha
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      render: (container: string, parameters: {
        sitekey: string;
        size?: 'normal' | 'compact' | 'invisible';
        theme?: 'light' | 'dark';
        callback?: (response: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
      }) => number;
      reset: (widgetId: number) => void;
      getResponse: (widgetId: number) => string;
    };
  }
}
