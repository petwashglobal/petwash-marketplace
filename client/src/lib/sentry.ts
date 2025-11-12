import * as Sentry from '@sentry/browser';

const isDevelopment = import.meta.env.DEV;
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

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
