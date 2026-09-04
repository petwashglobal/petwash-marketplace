import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { redactLogContext, scrubSensitiveText, redactEmail } from './redaction';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'petwash-api',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    new winston.transports.Console({
      format: isDevelopment 
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : winston.format.json()
    })
  ]
});

export interface RequestContext {
  requestId: string;
  userId?: string;
  userEmail?: string;
  method: string;
  url: string;
  ip?: string;
  userAgent?: string;
  startTime: number;
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      context?: RequestContext;
      startTime?: number;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header('X-Request-ID') || uuidv4();
  req.requestId = requestId;
  req.startTime = Date.now();
  
  res.setHeader('X-Request-ID', requestId);
  
  req.context = {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.header('user-agent'),
    startTime: req.startTime
  };
  
  next();
}

export function addUserContext(req: Request, userId?: string, userEmail?: string) {
  if (req.context) {
    req.context.userId = userId;
    req.context.userEmail = userEmail;
  }
  
  if (userId) {
    // AGENT-14 privacy lane: never ship a customer's full email to a
    // third-party error tracker. The id is enough to correlate; the masked
    // email is enough for an operator to recognise the account.
    Sentry.setUser({ id: userId, email: userEmail ? redactEmail(userEmail) : undefined });
  }
}

export function logRequest(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: req.requestId,
      method: req.method,
      url: scrubSensitiveText(req.originalUrl || req.url),
      statusCode: res.statusCode,
      duration,
      userId: req.context?.userId,
      ip: req.ip,
      userAgent: req.header('user-agent')
    };
    
    if (res.statusCode >= 500) {
      winstonLogger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      winstonLogger.warn('Request warning', logData);
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      winstonLogger.info('Request success', logData);
    }
  });
  
  next();
}

// PetWash Sentry project (EU/Germany). Default in production so server error
// capture works without an env var; SENTRY_DSN still overrides. Same project as
// the client — Sentry tags events by SDK/platform (server vs browser).
const DEFAULT_SENTRY_DSN = 'https://eafe6538ae59f035b0de2f752e93e2b0@o4511635352649728.ingest.de.sentry.io/4511635367526480';

export function initSentry() {
  const sentryDsn = process.env.SENTRY_DSN || (process.env.NODE_ENV === 'production' ? DEFAULT_SENTRY_DSN : undefined);

  if (!sentryDsn) {
    winstonLogger.warn('Sentry DSN not configured - error tracking disabled');
    return;
  }
  
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    release: `petwash@${process.env.npm_package_version || '1.0.0'}`,
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    beforeSend(event, hint) {
      if (event.exception) {
        winstonLogger.error('Sentry captured exception', {
          eventId: event.event_id,
          // Was: the raw thrown value (its message routinely carries a
          // customer email via Postgres DETAIL lines). Scrubbed now.
          message: scrubSensitiveText(String((hint?.originalException as any)?.message ?? hint?.originalException ?? ''))
        });
      }
      // AGENT-14 privacy lane (2026-09-05): this hook previously did NOTHING
      // but log — every event went to Sentry exactly as built. It is the one
      // choke point every Sentry path in the codebase passes through, so the
      // redaction belongs here rather than at ~40 capture call sites.
      return scrubSentryEvent(event);
    }
  });
  
  winstonLogger.info('✅ Sentry initialized', {
    environment: process.env.NODE_ENV,
    tracesSampleRate: isProduction ? 0.1 : 1.0
  });
}

/**
 * Redact an outbound Sentry event in place-safe fashion.
 *
 * Covers every field an event can carry PII in:
 *   extra / contexts / tags   — arbitrary operator-supplied objects
 *   request.data/query/headers/cookies — the raw HTTP request
 *   user.email / user.username / user.ip_address
 *   exception values + messages — Postgres DETAIL lines, provider payloads
 *   breadcrumbs[].message/.data — the trail leading up to the error
 *
 * Never throws: a scrubbing failure must drop the event's detail, never the
 * event (or worse, crash the reporting path).
 */
export function scrubSentryEvent(event: any): any {
  if (!event) return event;
  try {
    if (event.extra) event.extra = redactLogContext(event.extra);
    if (event.contexts) event.contexts = redactLogContext(event.contexts);
    if (event.tags) event.tags = redactLogContext(event.tags);

    if (event.request) {
      const r = event.request;
      if (r.data) r.data = redactLogContext(r.data);
      if (r.headers) r.headers = redactLogContext(r.headers);
      if (r.cookies) r.cookies = redactLogContext(r.cookies);
      if (typeof r.query_string === 'string') r.query_string = scrubSensitiveText(r.query_string);
      if (typeof r.url === 'string') r.url = scrubSensitiveText(r.url);
    }

    if (event.user) {
      if (typeof event.user.email === 'string') event.user.email = redactEmail(event.user.email);
      if (typeof event.user.username === 'string') event.user.username = scrubSensitiveText(event.user.username);
      delete event.user.ip_address;
    }

    if (typeof event.message === 'string') event.message = scrubSensitiveText(event.message);
    if (event.exception?.values && Array.isArray(event.exception.values)) {
      for (const v of event.exception.values) {
        if (typeof v?.value === 'string') v.value = scrubSensitiveText(v.value);
      }
    }

    if (Array.isArray(event.breadcrumbs)) {
      for (const b of event.breadcrumbs) {
        if (typeof b?.message === 'string') b.message = scrubSensitiveText(b.message);
        if (b?.data) b.data = redactLogContext(b.data);
      }
    }
  } catch {
    // Scrubbing failed — send a stripped event rather than a leaky one.
    try {
      event.extra = { scrubError: true };
      event.request = undefined;
      event.user = undefined;
      event.breadcrumbs = undefined;
    } catch { /* give up quietly; never break error reporting */ }
  }
  return event;
}

export function sentryErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  Sentry.captureException(err, {
    tags: {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url
    },
    user: req.context?.userId ? {
      id: req.context.userId,
      email: req.context.userEmail
    } : undefined,
    extra: {
      ip: req.ip,
      userAgent: req.header('user-agent')
    }
  });
  
  winstonLogger.error('Unhandled error', {
    requestId: req.requestId,
    // winston does NOT pass through ServerLogger's redactor — scrub here.
    error: scrubSensitiveText(err.message ?? ''),
    stack: err.stack,
    userId: req.context?.userId
  });
  
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.requestId
  });
}

export { winstonLogger as logger };
