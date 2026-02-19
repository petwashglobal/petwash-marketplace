import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
    }
  }
}

export function traceIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const traceId = crypto.randomUUID();
  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);
  logger.info(`[TraceId] ${req.method} ${req.path}`, { traceId });
  next();
}
