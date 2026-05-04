import { useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
      execute: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  theme?: 'light' | 'dark' | 'auto';
}

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || '';

const TURNSTILE_TIMEOUT_MS = 15000;

async function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return;
  if (document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
    return new Promise((resolve) => {
      const poll = setInterval(() => {
        if (window.turnstile) { clearInterval(poll); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(poll); resolve(); }, TURNSTILE_TIMEOUT_MS);
    });
  }
  return new Promise((resolve, reject) => {
    window.onTurnstileLoad = resolve;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load Turnstile script'));
    setTimeout(() => reject(new Error('Turnstile script load timed out')), TURNSTILE_TIMEOUT_MS);
    document.head.appendChild(script);
  });
}

export async function executeTurnstileInvisible(action: string = 'submit'): Promise<string | null> {
  if (!SITE_KEY) {
    logger.warn('[Turnstile] VITE_TURNSTILE_SITE_KEY not set — skipping Turnstile');
    return null;
  }

  try {
    await loadTurnstileScript();
    if (!window.turnstile) {
      logger.warn('[Turnstile] window.turnstile not available after script load');
      return null;
    }

    return await new Promise<string>((resolve, reject) => {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.bottom = '0';
      container.style.left = '-9999px';
      container.style.zIndex = '-1';
      document.body.appendChild(container);

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Turnstile token timed out'));
      }, TURNSTILE_TIMEOUT_MS);

      function cleanup() {
        clearTimeout(timeout);
        try {
          if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
        } catch (_) {}
        try { document.body.removeChild(container); } catch (_) {}
      }

      let widgetId: string;
      try {
        if (!window.turnstile) {
          cleanup();
          reject(new Error('Turnstile script not loaded'));
          return;
        }
        widgetId = window.turnstile.render(container, {
          sitekey: SITE_KEY,
          size: 'invisible',
          action,
          callback: (token: string) => {
            logger.info('[Turnstile] Invisible token obtained', { action, tokenLength: token.length });
            cleanup();
            resolve(token);
          },
          'error-callback': () => {
            logger.warn('[Turnstile] Invisible widget error', { action });
            cleanup();
            reject(new Error('Turnstile verification failed'));
          },
          'expired-callback': () => {
            logger.warn('[Turnstile] Invisible widget expired', { action });
            cleanup();
            reject(new Error('Turnstile token expired'));
          },
        });
      } catch (err: any) {
        cleanup();
        reject(new Error(`Turnstile render error: ${err.message}`));
      }
    });
  } catch (err: any) {
    logger.error('[Turnstile] executeTurnstileInvisible failed', { action, error: err.message });
    return null;
  }
}

export function TurnstileWidget({ onVerify, onError, theme = 'auto' }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const mounted = useRef(true);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || !SITE_KEY || widgetId.current) return;
    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: onVerify,
      'error-callback': onError,
      theme,
      size: 'normal',
    });
  }, [onVerify, onError, theme]);

  useEffect(() => {
    mounted.current = true;

    if (!SITE_KEY) return;

    if (window.turnstile) {
      renderWidget();
      return;
    }

    if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
      window.onTurnstileLoad = () => {
        if (mounted.current) renderWidget();
      };
      const script = document.createElement('script');
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      const poll = setInterval(() => {
        if (window.turnstile) {
          clearInterval(poll);
          if (mounted.current) renderWidget();
        }
      }, 100);
      return () => clearInterval(poll);
    }

    return () => {
      mounted.current = false;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [renderWidget]);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className="flex justify-center my-4" />;
}

export { SITE_KEY as TURNSTILE_CONFIGURED };
