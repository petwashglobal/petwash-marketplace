import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../lib/logger';

const ONBOARDING_BYPASS_PATHS = [
  '/api/auth',
  '/api/user/profile',
  '/api/user/update-profile',
  '/api/upload',
  '/api/health',
  '/api/config',
  '/api/i18n',
  '/api/onboarding',
  '/api/provider-onboarding',
  '/api/provider/application',
  '/api/staff/access-request',
  '/api/biometric',
];

interface OnboardingRequirements {
  requiredFields: string[];
  redirectTo: string;
  reason: string;
}

const ROLE_REQUIREMENTS: Record<string, OnboardingRequirements> = {
  customer: {
    requiredFields: ['firstName', 'lastName', 'termsAcceptedAt'],
    redirectTo: '/complete-profile',
    reason: 'CUSTOMER_PROFILE_INCOMPLETE',
  },
  loyalty: {
    requiredFields: ['firstName', 'lastName', 'dateOfBirth', 'termsAcceptedAt'],
    redirectTo: '/complete-profile',
    reason: 'LOYALTY_PROFILE_INCOMPLETE',
  },
  provider: {
    requiredFields: ['firstName', 'lastName', 'phone', 'termsAcceptedAt'],
    redirectTo: '/complete-profile',
    reason: 'PROVIDER_PROFILE_INCOMPLETE',
  },
  staff: {
    requiredFields: ['firstName', 'lastName', 'termsAcceptedAt'],
    redirectTo: '/complete-profile',
    reason: 'STAFF_PROFILE_INCOMPLETE',
  },
};

function shouldBypass(path: string): boolean {
  return ONBOARDING_BYPASS_PATHS.some(bp => path.startsWith(bp));
}

export async function requireOnboardingComplete(req: Request, res: Response, next: NextFunction) {
  try {
    if (shouldBypass(req.path)) {
      return next();
    }

    // READ operations never require onboarding — users must be able to browse
    // services, see pricing, and explore the platform before they commit to registering.
    // Only WRITE operations (booking, payment, profile mutation) require a complete profile.
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const userId = (req as any).userId || (req as any).user?.id || (req.session as any)?.userId;
    if (!userId) {
      return next();
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return next();
    }

    const role = (user as any).role || 'customer';
    const requirements = ROLE_REQUIREMENTS[role];

    if (!requirements) {
      return next();
    }

    const missingFields: string[] = [];
    for (const field of requirements.requiredFields) {
      if (!(user as any)[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      logger.debug(`[OnboardingGate] User ${userId} (${role}) missing fields: ${missingFields.join(', ')}`);
      return res.status(403).json({
        error: 'ONBOARDING_INCOMPLETE',
        reason: requirements.reason,
        redirectTo: requirements.redirectTo,
        missingFields,
        role,
      });
    }

    if (role === 'provider') {
      const app = await storage.getProviderApplicationByUser(userId);
      // Allow through if: (a) onboardingComplete flag is set, OR (b) application status is 'approved'.
      // The onboarding_complete column is set to true during admin approval. Checking status directly
      // as a fallback ensures approved providers with legacy records (before the column was populated)
      // are never incorrectly blocked.
      const isApproved = app?.status === 'approved';
      const flagSet = !!(app as any)?.onboardingComplete;
      if (!app || (!isApproved && !flagSet)) {
        return res.status(403).json({
          error: 'ONBOARDING_INCOMPLETE',
          reason: 'PROVIDER_ONBOARDING_REQUIRED',
          redirectTo: '/provider-onboarding',
          role,
        });
      }
    }

    if (role === 'staff' || role === 'admin') {
      const staffReq = await storage.getStaffAccessRequestByUser(userId);
      if (!staffReq || staffReq.status !== 'approved') {
        return res.status(403).json({
          error: 'ONBOARDING_INCOMPLETE',
          reason: staffReq?.status === 'rejected' ? 'STAFF_REJECTED' : 'STAFF_APPROVAL_REQUIRED',
          redirectTo: staffReq?.status === 'rejected' ? '/staff/rejected' : '/staff/pending',
          role,
        });
      }
    }

    next();
  } catch (error: any) {
    logger.error(`[OnboardingGate] Error: ${error.message}`);
    return res.status(503).json({ error: 'SERVICE_UNAVAILABLE' });
  }
}

export function requireProfileField(...fields: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).userId || (req as any).user?.id || (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

      const missing = fields.filter(f => !(user as any)[f]);
      if (missing.length > 0) {
        return res.status(403).json({
          error: 'PROFILE_FIELDS_REQUIRED',
          missingFields: missing,
          redirectTo: '/complete-profile',
        });
      }

      next();
    } catch (error: any) {
      logger.error(`[RequireProfileField] Error: ${error.message}`);
      next();
    }
  };
}
