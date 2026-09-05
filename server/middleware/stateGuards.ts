import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../lib/logger';
import { logSecurityEvent } from '../services/securityEventsService';
import { getUserCapabilities } from '../lib/userCapabilities';
import { hasProviderCapability } from '@shared/lib/userCapabilities';

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

/**
 * Only an APPROVED provider may accept a booking.
 *
 * 2026-09-05 — the predicate here was
 *   `role !== 'provider' || status !== 'provider_active'`
 * read off the users row, exactly like requireProviderActive in gates.ts,
 * and it is unsatisfiable for the same two reasons: users.role is
 * deliberately never flipped to 'provider' (2026-08-20 multi-role
 * contract) and nothing in the repo ever writes
 * users.user_status = 'provider_active'. It also resolved the caller via
 * getUserId, which does not know about req.firebaseUser.
 *
 * NOTE: this guard is currently IMPORTED BY server/routes.ts:283 BUT
 * NEVER MOUNTED on any route. Fixed anyway so it is not a landmine for
 * whoever wires it up — a gate that silently denies everyone is as bad as
 * one that silently allows everyone. Which accept endpoints should carry
 * it is a booking-lane decision.
 *
 * Authority is the ONE server aggregator: provider_applications.status
 * === 'approved'. Fails closed (the aggregator degrades to empty
 * capabilities on a DB error, which lands as a 403).
 */
export function requireProviderCanAcceptBooking(req: Request, res: Response, next: NextFunction) {
  return (async () => {
    try {
      const r = req as any;
      const userId = r.firebaseUser?.uid || r.userId || r.user?.uid || r.user?.id || (req.session as any)?.userId || null;
      if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

      let caps = r.userCapabilities;
      if (!caps) {
        caps = await getUserCapabilities(userId);
        r.userCapabilities = caps;
      }

      if (!hasProviderCapability(caps)) {
        const applicationStatus = caps?.provider?.applicationStatus ?? 'none';
        logSecurityEvent({ userId, eventType: 'booking_accept_blocked', ip: req.ip || '', userAgent: req.headers['user-agent'] || '', riskScore: 50, metadata: { applicationStatus, endpoint: req.originalUrl } });
        return res.status(403).json({ error: 'PROVIDER_NOT_ACTIVE', message: 'Only approved providers can accept bookings', applicationStatus });
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
