import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

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
    Sentry.setUser({ id: userId, email: userEmail });
  }
}

export function logRequest(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
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

export function initSentry() {
  const sentryDsn = process.env.SENTRY_DSN;
  
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
          message: hint.originalException
        });
      }
      return event;
    }
  });
  
  winstonLogger.info('✅ Sentry initialized', {
    environment: process.env.NODE_ENV,
    tracesSampleRate: isProduction ? 0.1 : 1.0
  });
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
    error: err.message,
    stack: err.stack,
    userId: req.context?.userId
  });
  
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.requestId
  });
}

export { winstonLogger as logger };
