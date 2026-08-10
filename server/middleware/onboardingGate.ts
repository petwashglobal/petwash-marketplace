import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../lib/logger';
import { MEMBER_REQUIRED_FIELDS } from '@shared/memberRequiredFields';

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

// Canonical BASE profile (CEO 2026-08-01 "email must be first-class"): name +
// a verified mobile + terms + privacy. That's ALL a member needs — NO DOB, gender,
// address or pet is required for a Prestige/customer account (those are optional).
// Whatever way the user signed in (mobile / email / Google / Apple), the gate
// returns only the MISSING subset, so we never re-ask what a provider already gave
// us (Google/Apple supply name+email; mobile/email OTP verify one contact). Mobile
// is required because Israel support/payment/security lean on it. DOB + the 18+
// gate + the heavy KYC belong to the PROVIDER role only (separate ProviderOnboarding).
// MEMBER_REQUIRED_FIELDS now imported from @shared/memberRequiredFields — the SINGLE
// source of truth shared with post-login.ts, so the two gates can never drift.

// PROVIDER KYC ENGINE (CEO 2026-08-01). A provider is a member PLUS this stricter
// set — collected + human-reviewed in the SEPARATE ProviderOnboarding flow (NEVER
// asked of a plain member). This is the single source of truth for "what a provider
// must supply"; ProviderOnboarding's form + the payout gate enforce it.
// The KYC set uses the REAL provider_applications columns (shared/schema.ts) — not
// invented names — so a check actually works. Bank payout details live in a SEPARATE
// table (contractor_bank_details / providers.bankAccount, bank_account_verified) and
// are verified before payout, not on the application row, so they're intentionally
// NOT in this list. The authority for "provider is complete + approved" is the
// application's own `onboardingComplete` flag + `status` (set by ProviderOnboarding +
// AdminProviderReviewService); this list is what that flow collects.
export const PROVIDER_KYC_FIELDS = [
  'providerType',          // walker | sitter | driver | groomer | trainer | ...
  'governmentIdUrl',       // ID / passport / licence document image
  'selfiePhotoUrl',        // selfie for liveness/biometric match
  'biometricStatus',       // liveness/biometric result (must be verified)
  'residentialHistory',    // address history
  'taxStatus',             // osek patur / murshe / company
  'selfDeclarationAt',     // signed self-declaration (incl. 18+ / no convictions)
  'backgroundCheckStatus', // must pass
  'petFirstAidCertUrl',    // safety / first-aid training certificate
  'insuranceCertUrl',      // insurance certificate (where the service requires it)
] as const;

/**
 * getRoleRequiredFields — what a user still needs. MEMBER = the base profile only
 * (checked against the USER record). PROVIDER additionally needs a COMPLETE provider
 * application: the authority is the application's `onboardingComplete` flag (set by
 * the ProviderOnboarding flow + AdminProviderReviewService), so pass the application
 * to check it. Without an application we conservatively report the whole KYC set as
 * outstanding. Returns only the MISSING items — nothing already supplied is re-asked.
 */
export function getRoleRequiredFields(
  user: Record<string, any>,
  role: string,
  providerApp?: Record<string, any> | null,
): string[] {
  const base = MEMBER_REQUIRED_FIELDS.filter((f) => !user?.[f]);
  if (role !== 'provider') return base;
  // A reviewed, complete application means the KYC is satisfied.
  if (providerApp?.onboardingComplete) return base;
  const kyc = PROVIDER_KYC_FIELDS.filter((f) => !providerApp?.[f]);
  return [...base, ...kyc];
}

const ROLE_REQUIREMENTS: Record<string, OnboardingRequirements> = {
  customer: {
    requiredFields: MEMBER_REQUIRED_FIELDS,
    redirectTo: '/complete-profile',
    reason: 'CUSTOMER_PROFILE_INCOMPLETE',
  },
  loyalty: {
    requiredFields: MEMBER_REQUIRED_FIELDS,
    redirectTo: '/complete-profile',
    reason: 'LOYALTY_PROFILE_INCOMPLETE',
  },
  provider: {
    // A provider is also a member (contact + 18+ + terms). The heavy KYC —
    // national ID, address, docs, bank, contract, human approval — is a SEPARATE
    // flow (ProviderOnboarding / provider application), not this base gate.
    requiredFields: MEMBER_REQUIRED_FIELDS,
    redirectTo: '/complete-profile',
    reason: 'PROVIDER_PROFILE_INCOMPLETE',
  },
  staff: {
    // Internal role — kept light so staff/admins aren't consumer-gated.
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
