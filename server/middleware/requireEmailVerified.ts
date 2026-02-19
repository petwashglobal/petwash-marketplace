import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

const PROTECTED_ACTIONS = [
  '/api/bookings',
  '/api/marketplace-bookings',
  '/api/unified-booking',
  '/api/wallet',
  '/api/credit-wallet',
  '/api/provider',
  '/api/sitter',
  '/api/walker',
  '/api/kyc',
  '/api/loyalty/redeem',
  '/api/gift-cards/purchase',
  '/api/egift/send',
  '/api/escrow',
  '/api/payout',
];

// Allowlist rules for email verification bypass:
// 1. Phone-only auth: User authenticated via phone number with no email on record.
//    Firebase sets `phone_number` for phone-auth users. These users have no email
//    to verify, so they pass through.
// 2. Email + phone: If the user has both an email AND a phone number, email
//    verification is still required. The phone alone does not substitute for
//    an unverified email.
// 3. Email-only auth: Standard flow — email_verified must be true.

export function requireEmailVerified(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.firebaseUser?.uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.firebaseUser.email_verified === true) {
      return next();
    }

    const hasPhone = !!(req.firebaseUser as any).phone_number;
    const hasEmail = !!req.firebaseUser.email;

    if (hasPhone && !hasEmail) {
      return next();
    }

    logger.warn(`[EmailGate] Unverified email blocked: ${req.firebaseUser.email} on ${req.method} ${req.path}`);

    return res.status(403).json({
      error: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address before using this feature. Check your inbox for a verification link.',
      action: 'verify_email',
    });
  } catch (error) {
    logger.error('[EmailGate] Error checking email verification:', error);
    res.status(500).json({ error: 'Failed to verify email status' });
  }
}

export function requireEmailVerifiedForProtectedPaths(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.firebaseUser?.uid) {
    return next();
  }

  if (req.method === 'GET') {
    return next();
  }

  const isProtected = PROTECTED_ACTIONS.some(prefix => req.path.startsWith(prefix));
  if (!isProtected) {
    return next();
  }

  return requireEmailVerified(req, res, next);
}

export default requireEmailVerified;
