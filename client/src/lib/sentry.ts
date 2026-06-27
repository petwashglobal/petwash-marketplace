import * as Sentry from '@sentry/browser';

const isDevelopment = import.meta.env.DEV;
// PetWash Sentry project (EU/Germany region). Client DSNs are public by design
// (they ship in the browser bundle), so we default it here so production error
// capture works without an env var; VITE_SENTRY_DSN still overrides. Dev stays
// quiet unless a DSN is explicitly set, so local crashes don't flood Sentry.
const DEFAULT_SENTRY_DSN = 'https://eafe6538ae59f035b0de2f752e93e2b0@o4511635352649728.ingest.de.sentry.io/4511635367526480';
const sentryDsn = import.meta.env.VITE_SENTRY_DSN || (import.meta.env.PROD ? DEFAULT_SENTRY_DSN : undefined);

export function initClientSentry() {
  if (!sentryDsn) {
    if (isDevelopment) {
      console.info('[Sentry] DSN not configured - client error tracking disabled (dev mode)');
    }
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE || 'development',
    release: `petwash@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: isDevelopment ? 1.0 : 0.1,
    beforeSend(event, hint) {
      if (isDevelopment) {
        console.log('[Sentry] Captured event:', event);
      }
      return event;
    },
  });

  if (isDevelopment) {
    console.log('[Sentry] ✅ Client error tracking initialized');
  }
}

/**
 * Capture a top-level render crash caught by AppErrorBoundary, tagged with the
 * user-facing referenceId so a "Reference: abc123" the user quotes can be found
 * directly in Sentry. No-op when no DSN is configured.
 */
export function trackBoundaryCrash(
  error: Error,
  context: {
    referenceId?: string;
    errorKind?: string;
    componentStack?: string;
    url?: string;
    userId?: string;
    userRole?: string;
  }
) {
  Sentry.captureException(error, {
    tags: {
      error_type: 'render_crash',
      reference_id: context.referenceId || 'unknown',
      error_kind: context.errorKind || 'render',
      user_role: context.userRole || 'unknown',
    },
    extra: {
      componentStack: context.componentStack,
      url: context.url,
      userId: context.userId,
    },
    level: 'fatal',
  });
}

export function trackAuthError(
  error: Error,
  context: {
    errorCode?: string;
    provider?: string;
    method?: string;
    stage?: 'init' | 'network' | 'validation' | 'server';
  }
) {
  Sentry.captureException(error, {
    tags: {
      error_type: 'auth_error',
      error_code: context.errorCode || 'unknown',
      auth_provider: context.provider || 'unknown',
      auth_method: context.method || 'unknown',
      auth_stage: context.stage || 'unknown',
    },
    level: 'error',
  });
}

export function trackNetworkError(
  error: Error,
  context: {
    url?: string;
    method?: string;
    statusCode?: number;
  }
) {
  Sentry.captureException(error, {
    tags: {
      error_type: 'network_error',
      url: context.url,
      http_method: context.method,
      status_code: context.statusCode?.toString(),
    },
    level: 'error',
  });
}

export function trackWebAuthnError(
  error: Error,
  context: {
    operation?: 'registration' | 'authentication';
    step?: string;
  }
) {
  Sentry.captureException(error, {
    tags: {
      error_type: 'webauthn_error',
      webauthn_operation: context.operation || 'unknown',
      webauthn_step: context.step || 'unknown',
    },
    level: 'error',
  });
}

export function trackPerformance(
  metric: string,
  value: number,
  context?: Record<string, any>
) {
  Sentry.captureMessage(`Performance: ${metric}`, {
    level: 'info',
    tags: {
      metric_type: 'performance',
      metric_name: metric,
      ...context,
    },
    extra: {
      value,
      ...context,
    },
  });
}

export function setUserContext(userId: string, email?: string, metadata?: Record<string, any>) {
  Sentry.setUser({
    id: userId,
    email,
    ...metadata,
  });
}

export function clearUserContext() {
  Sentry.setUser(null);
}

export { Sentry };
