/**
 * AuthRouteErrorBoundary — CEO §16 §17 §18 (2026-08-28 P0 incident).
 *
 * The canonical authentication route (SignUpLuxury on /signin
 * /sign-in /login /signup) MUST NEVER show a blank page. If a rare
 * module error still occurs (a hostile browser extension, a
 * hardware-level failure, an antique OS), render a branded
 * "Pet Wash couldn't load sign in" screen with a Try again + Go
 * Home affordance. Fire an automatic client crash report.
 *
 * Version-aware recovery (CEO §18): the report includes the client
 * build id so a downstream aggregator can tell "one user on an old
 * cached bundle" apart from "N users on the current build".
 */
import { Component, type ReactNode } from 'react';

declare const __APP_BUILD_ID__: string | undefined;

interface Props {
  children: ReactNode;
  /** Which route triggered the boundary; goes into the crash report. */
  route?: string;
}

interface State {
  hasError: boolean;
  clientErrorId: string;
}

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

export class AuthRouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, clientErrorId: randomId() };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true, clientErrorId: randomId() };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Best-effort report. Never throws.
    try {
      const buildId = (typeof __APP_BUILD_ID__ !== 'undefined')
        ? String(__APP_BUILD_ID__)
        : 'unknown';
      const payload = {
        source: 'client-auth-boundary',
        message: `AUTH ROUTE CRASH: ${error?.message ?? String(error)}`,
        stack: error?.stack ?? '',
        componentStack: info?.componentStack?.slice(0, 4000) ?? '',
        route: this.props.route ?? (typeof location !== 'undefined' ? location.pathname : ''),
        url: typeof location !== 'undefined' ? location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        clientBuildId: buildId,
        clientErrorId: this.state.clientErrorId,
        // Fingerprint the exact class of failure the CEO §21 rule
        // asked us to group.
        fingerprint: /reading ['"]default['"]/i.test(String(error?.message ?? ''))
          ? 'CLIENT_LAZY_MODULE_DEFAULT_UNDEFINED'
          : 'CLIENT_AUTH_ROUTE_CRASH',
      };
      void fetch('/api/errors/log', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => { /* silent */ });
    } catch { /* silent — reporter must never break the boundary */ }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        dir="rtl"
        role="alert"
        aria-live="assertive"
        data-testid="auth-boundary-fallback"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          background: '#0A0A0A',
          color: '#fff',
          fontFamily: '-apple-system, Segoe UI, Roboto, Arial, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 600, color: '#D4AF37' }}>PetWash</div>
        <div style={{ fontSize: 16, opacity: 0.92, lineHeight: 1.5 }}>
          לא הצלחנו לטעון את דף ההתחברות
          <br />
          <span style={{ opacity: 0.7, fontSize: 14 }}>
            Pet Wash couldn't load sign in. Please try again.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: '#D4AF37',
              color: '#0A0A0A',
              border: 'none',
              borderRadius: 9999,
              padding: '12px 28px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            data-testid="auth-boundary-retry"
          >
            נסה שוב · Try again
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/'; }}
            style={{
              background: 'transparent',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 9999,
              padding: '12px 28px',
              fontSize: 15,
              fontWeight: 500,
              cursor: 'pointer',
            }}
            data-testid="auth-boundary-home"
          >
            לדף הבית · Go Home
          </button>
        </div>
        <div style={{ fontSize: 10, opacity: 0.35, fontFamily: 'monospace' }}>
          id: {this.state.clientErrorId}
        </div>
      </div>
    );
  }
}

export default AuthRouteErrorBoundary;
