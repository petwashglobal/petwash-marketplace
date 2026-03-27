import { useEffect, useRef, useCallback } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
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
