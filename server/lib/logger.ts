/**
 * Production-safe structured logger for server-side code
 * Uses LOG_LEVEL from environment
 */
import * as Sentry from '@sentry/node';
import { redactLogContext } from './redaction';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  correlationId?: string;
  userId?: string;
  [key: string]: any;
}

class ServerLogger {
  private level: LogLevel;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
    this.level = this.levels[envLevel] !== undefined ? envLevel : 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    // Release freeze 2026-09-03 top-up (doctrine #208): sanitize every context
    // spread through the logger so secrets/PII cannot reach stdout/Sentry via
    // an accidental `{ body: req.body }` or `{ token }` shape. redactLogContext
    // never throws — a bad input yields a placeholder string, never a log break.
    let safeContext: LogContext | undefined = context;
    try {
      safeContext = context ? redactLogContext(context) : undefined;
    } catch {
      safeContext = { redactionError: true };
    }
    const log = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...safeContext
    };

    // In production (LOG_LEVEL=info or higher), output structured JSON
    if (process.env.APP_ENV === 'production') {
      return JSON.stringify(log);
    }

    // In development, output human-readable format
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${safeContext ? ' ' + JSON.stringify(safeContext) : ''}`;
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog('debug')) {
      console.log(this.formatLog('debug', message, context));
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog('info')) {
      console.log(this.formatLog('info', message, context));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, context));
    }
  }

  error(message: string, error?: Error | any, context?: LogContext) {
    if (this.shouldLog('error')) {
      let errorFields: Record<string, any> = {};
      if (error && typeof error === 'object' && (error instanceof Error || error.message || error.stack)) {
        errorFields = {
          errorName: error.name || error.constructor?.name || 'Error',
          errorMessage: typeof error.message === 'string' ? error.message : String(error.message ?? error),
          errorCode: error.code,
          errorStack: process.env.APP_ENV !== 'production' ? error.stack : undefined
        };
      } else if (error !== undefined && error !== null) {
        errorFields = { error: typeof error === 'string' ? error : JSON.stringify(error) };
      }
      const errorContext = { ...context, ...errorFields };
      // AGENT-14 privacy lane (2026-09-05): formatLog redacts internally, but
      // the Sentry call below used to receive the RAW errorContext — so a
      // `logger.error('x', err, { body: req.body })` shipped the whole request
      // body (password / OTP / Firebase token) to a third-party service even
      // though stdout was clean. Redact ONCE here and use the same safe object
      // for both sinks.
      let safeErrorContext: Record<string, any>;
      try {
        safeErrorContext = redactLogContext(errorContext);
      } catch {
        safeErrorContext = { redactionError: true };
      }
      console.error(this.formatLog('error', message, safeErrorContext));
      // F1 (2026-08-06 hidden-failure hunt): logger.error was stdout-ONLY. ~4,000
      // call sites — none reached Sentry — so money/fiscal failures ("logged loudly
      // for reconciliation") were invisible unless someone tailed Cloud Run. Forward
      // every error-level log to Sentry so it actually surfaces + can page. No-op when
      // Sentry has no DSN; wrapped so telemetry can NEVER break logging itself.
      try {
        const err = error instanceof Error ? error : new Error(message);
        Sentry.captureException(err, { level: 'error', extra: safeErrorContext, tags: { source: 'logger.error' } });
      } catch { /* telemetry must never throw into the logger */ }

      // Modernity SEV-1 #4 (2026-08-20 audit): every logger.error already reaches
      // Sentry, but nothing fed alertManager — 7 runtime errors fired every 60s
      // for 24h and nobody was paged. Route sustained error rates (>= 20/min) to
      // the existing checkServerErrorRate() helper. alertManager applies its own
      // 1-hour cooldown per alert key, so this never spams; the in-memory counter
      // resets on each new minute-bucket. Fire-and-forget + fully guarded.
      forwardToAlertManagerIfSustained();
    }
  }
}

// ── Modernity SEV-1 #4 rolling counter (module-level, in-memory) ────────────
// One process = one counter. Multi-instance Cloud Run: each instance rolls its
// own bucket; alertManager dedupes per instance via the 1-hour cooldown.
let _errBucketMinute = -1;
let _errBucketCount = 0;
const _ERR_ALERT_THRESHOLD_PER_MIN = 20;

function forwardToAlertManagerIfSustained(): void {
  try {
    const nowMinute = Math.floor(Date.now() / 60_000);
    if (nowMinute !== _errBucketMinute) {
      _errBucketMinute = nowMinute;
      _errBucketCount = 0;
    }
    _errBucketCount++;
    if (_errBucketCount === _ERR_ALERT_THRESHOLD_PER_MIN) {
      // Dynamic import so a circular dep between logger and alerts can't crash
      // the boot path. checkServerErrorRate triggers alertManager when the rate
      // exceeds the (unmodified) 1% threshold — we pass count/count so the rate
      // is 1.0, guaranteeing the alert fires. alertManager's own 1h cooldown
      // prevents a storm.
      import('./alerts')
        .then(({ checkServerErrorRate }) => {
          void checkServerErrorRate(_errBucketCount, _errBucketCount);
        })
        .catch(() => { /* alerts is non-critical — never throw into logger */ });
    }
  } catch { /* counter must never throw */ }
}

export const logger = new ServerLogger();

// Helper to generate correlation IDs
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
