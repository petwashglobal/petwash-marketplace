import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { auditEvents } from '@shared/schema';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      userId?: string;
    }
  }
}

export interface LogAuditEventParams {
  actorUserId?: string;
  actorRole?: string;
  actionType: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  traceId?: string;
  metadata?: Record<string, any>;
}

/**
 * Generates a UUID trace_id and attaches it to req.traceId
 * Used to track requests across the system
 */
export function traceIdMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.traceId) {
    req.traceId = crypto.randomUUID();
  }
  res.setHeader('X-Trace-Id', req.traceId);
  next();
}

/**
 * Logs an audit event to the audit_events table
 * Useful for tracking user actions, administrative changes, and security events
 */
export async function logAuditEvent(params: LogAuditEventParams): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      actionType: params.actionType,
      targetType: params.targetType,
      targetId: params.targetId,
      ip: params.ip,
      userAgent: params.userAgent,
      traceId: params.traceId,
      metadata: params.metadata || {},
    });
  } catch (error) {
    console.error('[AuditLog] Failed to log audit event:', {
      actionType: params.actionType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Express middleware factory that logs audit events after the response is sent
 * Captures the actorUserId from req.userId, IP, user agent, and trace ID
 *
 * @param actionType - The action type to log (e.g., 'LOGIN', 'APPROVE_STAFF', 'KYC_SUBMIT')
 * @param extractors - Optional custom extractor functions for actorRole, targetType, and targetId
 * @returns Express middleware
 */
export function auditMiddleware(
  actionType: string,
  extractors?: {
    actorRole?: (req: Request) => string | undefined;
    targetType?: (req: Request) => string | undefined;
    targetId?: (req: Request) => string | undefined;
  }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', async () => {
      try {
        const actorRole = extractors?.actorRole?.(req);
        const targetType = extractors?.targetType?.(req);
        const targetId = extractors?.targetId?.(req);

        await logAuditEvent({
          actorUserId: (req as any).userId || (req as any).user?.id,
          actorRole,
          actionType,
          targetType,
          targetId,
          ip: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0],
          userAgent: req.headers['user-agent'],
          traceId: req.traceId,
        });
      } catch (error) {
        console.error('[AuditMiddleware] Error logging audit event:', error);
      }
    });

    next();
  };
}
