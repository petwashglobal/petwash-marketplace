/**
 * Post-release 2026-09-03 (backlog P1): branded error boundary for the
 * auth routes.
 *
 * Reclaimed from closed PR #2169. The Phase-11 ReturnLogin door + the
 * eager SignUpLuxury registration substantially reduced the surface,
 * but a lazy chunk 404 (bad deploy, mid-flight rollout, browser cache
 * pointing to a pruned filename) can still crash the tree with
 * `TypeError: Cannot read properties of undefined (reading 'default')`.
 * That's how a single stale index.html killed /signin in the 2026-08-29
 * incident.
 *
 * Contract:
 *   • Catches any render-time error inside the wrapped subtree
 *     (typically the whole /signin | /signup | /login group).
 *   • Renders a small, branded, retry-friendly fallback — NEVER a
 *     white screen. A visible "Reload" button + a small "return home"
 *     link is enough — we don't want the user stuck.
 *   • Logs the failure to console + posts a fingerprint to
 *     /api/errors/log if that endpoint is reachable (best-effort;
 *     the boundary never surfaces a secondary error).
 *   • Never depends on i18n / theme / router hooks — it must render
 *     even when the failure is in the routing bundle itself.
 *
 * Zero external deps beyond React. Safe to import at the top of App.tsx.
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /**
   * Optional label sent with the fingerprint (e.g. 'signin' | 'signup').
   * Helps ops group crashes by surface without parsing stack traces.
   */
  surface?: string;
}

interface State {
  crashed: boolean;
  /** Message the user sees when we can't recover — kept short. */
  message: string;
}

export class AuthRouteErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    // Keep the user-facing message stable and free of internals.
    // Real details go to console + /api/errors/log.
    const raw = err instanceof Error ? err.message : String(err);
    // Detect the lazy-chunk 404 shape so we can hint at "reload" being
    // the right action (a stale index.html is fixed by a hard refresh).
    const looksLikeStaleChunk =
      /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported|reading 'default'/i.test(
        raw,
      );
    return {
      crashed: true,
      message: looksLikeStaleChunk
        ? 'This page updated. Please reload to continue.'
        : 'Something went wrong loading this page.',
    };
  }

  componentDidCatch(err: unknown, info: ErrorInfo): void {
    const raw = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    // Console: loud in dev, structured in prod so Cloud Run picks it up.
    // eslint-disable-next-line no-console
    console.error('[AuthRouteErrorBoundary]', {
      surface: this.props.surface || 'auth',
      message: raw,
      componentStack: info.componentStack,
    });

    // Best-effort fingerprint post — never surfaces a secondary error.
    try {
      const payload = {
        surface: this.props.surface || 'auth',
        message: raw.slice(0, 512),
        stackHead: (stack || '').split('\n').slice(0, 4).join('\n').slice(0, 1024),
        href: typeof window !== 'undefined' ? window.location.href : '',
        ua: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 256) : '',
        ts: new Date().toISOString(),
      };
      // sendBeacon avoids blocking + survives a subsequent reload.
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon('/api/errors/log', blob);
      } else if (typeof fetch === 'function') {
        // Fire-and-forget; ignore rejection.
        fetch('/api/errors/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Never let the reporter throw a secondary error out of the boundary.
    }
  }

  private reload = () => {
    try {
      // A hard reload is right for stale-chunk 404s — normal reload can
      // re-hit the SW cache. `location.replace` avoids adding to history.
      if (typeof window !== 'undefined') {
        window.location.replace(window.location.pathname + window.location.search);
      }
    } catch {
      /* no-op */
    }
  };

  render() {
    if (!this.state.crashed) return this.props.children;

    // Deliberately dependency-free markup — no i18n, no theme provider,
    // no router hooks. This must render even when everything else in the
    // bundle has broken. Brand colors kept as literals so a broken CSS
    // token store cannot leave the user staring at unstyled HTML.
    return (
      <div
        role="alert"
        data-testid="auth-route-error-boundary"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fafaf7',
          color: '#111',
          padding: '24px',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            padding: '32px',
            borderRadius: '20px',
            background: '#fff',
            border: '1px solid #eee',
            boxShadow: '0 10px 40px rgba(0,0,0,.06)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '40px', lineHeight: 1, marginBottom: '12px' }}>🐾</div>
          <h1 style={{ fontSize: '20px', margin: '0 0 8px', fontWeight: 600 }}>
            {this.state.message}
          </h1>
          <p style={{ margin: '0 0 24px', color: '#555', fontSize: '14px' }}>
            You can try again — your work is not lost.
          </p>
          <button
            type="button"
            onClick={this.reload}
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: '#111',
              color: '#fff',
              border: 'none',
              borderRadius: '999px',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
          <div style={{ marginTop: '16px', fontSize: '13px' }}>
            <a
              href="/"
              style={{ color: '#666', textDecoration: 'underline' }}
            >
              Back to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default AuthRouteErrorBoundary;
