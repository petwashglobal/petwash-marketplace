import { Request, Response, NextFunction } from 'express';
import { isIncidentMode, getIncidentStatus } from '../services/incidentMode';
import { logger } from '../lib/logger';

export function blockDuringIncident(...blockedActions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isIncidentMode()) return next();
    const status = getIncidentStatus();
    const traceId = req.traceId || '';
    logger.warn(`[INCIDENT GUARD] Blocked ${req.method} ${req.originalUrl} during incident mode: ${status.reason}`, { traceId });
    return res.status(503).json({
      error: 'INCIDENT_MODE_ACTIVE',
      message: 'System is in incident mode. This action is temporarily unavailable.',
      reason: status.reason,
      blockedActions,
      traceId,
    });
  };
}
