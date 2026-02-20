import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../lib/logger';
import { logSecurityEvent } from '../services/securityEventsService';

function getUserId(req: Request): string | null {
  return (req as any).userId || (req as any).user?.id || (req.session as any)?.userId || null;
}

async function getOrLoadUser(req: Request, userId: string) {
  if ((req as any).dbUser) return (req as any).dbUser;
  const user = await storage.getUser(userId);
  if (user) (req as any).dbUser = user;
  return user;
}

export function requireOnboardingComplete(req: Request, res: Response, next: NextFunction) {
  return (async () => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      const user = await getOrLoadUser(req, userId);
      if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
      const status = (user as any).userStatus || 'new';
      const completedStatuses = ['profile_complete', 'provider_active', 'staff_active'];
      if (!completedStatuses.includes(status)) {
        logSecurityEvent({ userId, eventType: 'onboarding_incomplete_action', ip: req.ip || '', userAgent: req.headers['user-agent'] || '', riskScore: 20, metadata: { status, endpoint: req.originalUrl } });
        return res.status(403).json({ error: 'ONBOARDING_INCOMPLETE', userStatus: status, requiredActions: ['COMPLETE_PROFILE'] });
      }
      next();
    } catch (error: any) {
      logger.error(`[requireOnboardingComplete] Error: ${error.message}`);
      return res.status(403).json({ error: 'ONBOARDING_INCOMPLETE' });
    }
  })();
}

export function requireKycApproved(req: Request, res: Response, next: NextFunction) {
  return (async () => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      const user = await getOrLoadUser(req, userId);
      if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
      const status = (user as any).userStatus || 'new';
      if (status === 'kyc_pending' || status === 'provider_pending_approval') {
        logSecurityEvent({ userId, eventType: 'kyc_not_approved_action', ip: req.ip || '', userAgent: req.headers['user-agent'] || '', riskScore: 30, metadata: { status, endpoint: req.originalUrl } });
        return res.status(403).json({ error: 'KYC_NOT_APPROVED', userStatus: status });
      }
      next();
    } catch (error: any) {
      logger.error(`[requireKycApproved] Error: ${error.message}`);
      return res.status(403).json({ error: 'KYC_NOT_APPROVED' });
    }
  })();
}

export function requireProviderCanAcceptBooking(req: Request, res: Response, next: NextFunction) {
  return (async () => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      const user = await getOrLoadUser(req, userId);
      if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
      const role = (user as any).role || 'customer';
      const status = (user as any).userStatus || 'new';
      if (role !== 'provider' || status !== 'provider_active') {
        logSecurityEvent({ userId, eventType: 'booking_accept_blocked', ip: req.ip || '', userAgent: req.headers['user-agent'] || '', riskScore: 50, metadata: { role, status, endpoint: req.originalUrl } });
        return res.status(403).json({ error: 'PROVIDER_NOT_ACTIVE', message: 'Only active providers can accept bookings', role, userStatus: status });
      }
      next();
    } catch (error: any) {
      logger.error(`[requireProviderCanAcceptBooking] Error: ${error.message}`);
      return res.status(403).json({ error: 'PROVIDER_NOT_ACTIVE' });
    }
  })();
}

export function requireProfileComplete(req: Request, res: Response, next: NextFunction) {
  return (async () => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      const user = await getOrLoadUser(req, userId);
      if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
      const status = (user as any).userStatus || 'new';
      if (status === 'new' || status === 'profile_incomplete') {
        return res.status(403).json({ error: 'PROFILE_INCOMPLETE', userStatus: status, requiredActions: ['COMPLETE_PROFILE'] });
      }
      next();
    } catch (error: any) {
      logger.error(`[requireProfileComplete] Error: ${error.message}`);
      return res.status(403).json({ error: 'PROFILE_INCOMPLETE' });
    }
  })();
}
