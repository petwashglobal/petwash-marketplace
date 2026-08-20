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

// Typed result for executeTurnstileInvisible. Callers MUST branch on `ok` and
// surface an inline error to the user on failure — the previous shape returned
// `string | null` and callers used `.catch(() => null)`, so a failed
// verification looked like "no site key configured" (silent-succeed) and the
// user only saw the downstream server 400 message. (Agent-2 hunt 2026-08-20.)
export type TurnstileFailureCode =
  | 'SITE_KEY_MISSING'
  | 'LOAD_FAILED'
  | 'EXECUTE_FAILED'
  | 'TIMEOUT'
  | 'TOKEN_EMPTY';

export type TurnstileResult =
  | { ok: true; token: string }
  | { ok: false; code: TurnstileFailureCode };

/**
 * POST sanitized failure telemetry to the server error logger. We send ONLY
 * the failure code + action + tokenLength (never token content), so a broken
 * Turnstile in prod is visible without exfiltrating user proofs.
 * Fire-and-forget; never throws, never blocks the caller.
 */
function reportTurnstileFailure(code: TurnstileFailureCode, action: string, extra?: Record<string, unknown>) {
  try {
    logger.warn('[Turnstile] failure', { code, action, ...(extra || {}) });
    // Best-effort server-side signal. Uses fetch so it works even in code
    // paths where the SDK hasn't finished booting. We never include token
    // contents in the payload.
    void fetch('/api/errors/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        source: 'turnstile-client',
        message: `Turnstile ${code}`,
        action: `turnstile:${action}`,
        metadata: { code, action, ...(extra || {}) },
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* never throw from telemetry */ }
}

export async function executeTurnstileInvisible(action: string = 'submit'): Promise<TurnstileResult> {
  if (!SITE_KEY) {
    // Not a caller error and not visible to end-users in dev — but still a
    // recognisable failure code so prod (where the key IS set) surfaces
    // "unavailable" instead of pretending the check passed.
    logger.warn('[Turnstile] VITE_TURNSTILE_SITE_KEY not set — skipping Turnstile');
    return { ok: false, code: 'SITE_KEY_MISSING' };
  }

  try {
    await loadTurnstileScript();
    if (!window.turnstile) {
      reportTurnstileFailure('LOAD_FAILED', action, { reason: 'window.turnstile missing after load' });
      return { ok: false, code: 'LOAD_FAILED' };
    }

    const token = await new Promise<string | null>((resolve) => {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.bottom = '0';
      container.style.left = '-9999px';
      container.style.zIndex = '-1';
      document.body.appendChild(container);

      let widgetId: string | undefined;
      let settled = false;
      const settle = (val: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        try { if (widgetId && window.turnstile) window.turnstile.remove(widgetId); } catch (_) {}
        try { document.body.removeChild(container); } catch (_) {}
        resolve(val);
      };
      const timeout = setTimeout(() => settle(null), TURNSTILE_TIMEOUT_MS);

      try {
        if (!window.turnstile) { settle(null); return; }
        widgetId = window.turnstile.render(container, {
          sitekey: SITE_KEY,
          size: 'invisible',
          action,
          callback: (tok: string) => {
            logger.info('[Turnstile] Invisible token obtained', { action, tokenLength: tok?.length ?? 0 });
            settle(tok || '');
          },
          'error-callback': () => {
            logger.warn('[Turnstile] Invisible widget error', { action });
            settle(null);
          },
          'expired-callback': () => {
            logger.warn('[Turnstile] Invisible widget expired', { action });
            settle(null);
          },
        });
      } catch (err: any) {
        logger.warn('[Turnstile] render threw', { action, error: err?.message });
        settle(null);
      }
    });

    if (token === null) {
      // Distinguish timeout vs generic exec failure by reading the last log
      // line is fragile — collapse to EXECUTE_FAILED. Timeout still becomes
      // EXECUTE_FAILED from the user's PoV; the internal warn above carries
      // the finer signal for ops.
      reportTurnstileFailure('EXECUTE_FAILED', action);
      return { ok: false, code: 'EXECUTE_FAILED' };
    }
    if (!token) {
      reportTurnstileFailure('TOKEN_EMPTY', action);
      return { ok: false, code: 'TOKEN_EMPTY' };
    }
    return { ok: true, token };
  } catch (err: any) {
    logger.error('[Turnstile] executeTurnstileInvisible failed', { action, error: err?.message });
    reportTurnstileFailure('LOAD_FAILED', action, { error: err?.message });
    return { ok: false, code: 'LOAD_FAILED' };
  }
}

/**
 * Localized user-facing message for a Turnstile failure. Kept stable so QA can
 * grep for it and so the copy is identical across every call site.
 */
export function turnstileFailureMessage(_code: TurnstileFailureCode, language: 'he' | 'en' = 'he'): string {
  return language === 'he'
    ? 'אימות האבטחה לא זמין כרגע. נסו שוב.'
    : 'Security verification unavailable. Please try again.';
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
