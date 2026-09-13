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
  // Cheap exits first — this runs on every request.
  if (req.method === 'GET') {
    return next();
  }

  const isProtected = PROTECTED_ACTIONS.some(prefix => req.path.startsWith(prefix));
  if (!isProtected) {
    return next();
  }

  // THIS GATE WAS DEAD (2026-09-13). It is mounted globally in
  // server/routes.ts, BEFORE the routers it protects mount their own auth —
  // /api/bookings, /api/credit-wallet, /api/escrow and the rest attach
  // validateFirebaseToken / optionalFirebaseToken further down the file. So
  // `req.firebaseUser` was still undefined when this ran, the first line was
  // `if (!req.firebaseUser?.uid) return next()`, and EVERY caller sailed
  // through: an account with an unverified e-mail could book, move wallet
  // money and submit KYC. The bail-out is still correct for an anonymous
  // caller — but it has to be the answer to "no credentials at all", not to
  // "identity has not been resolved yet". So resolve it here, for the handful
  // of mutating requests on a protected prefix, and only when nobody has.
  if (req.firebaseUser?.uid) {
    return requireEmailVerified(req, res, next);
  }

  void (async () => {
    try {
      const { optionalFirebaseToken } = await import('./firebase-auth');
      // optionalFirebaseToken never throws and never answers the request: it
      // populates req.firebaseUser when the caller presented something valid.
      await optionalFirebaseToken(req, res, () => { /* resolve only — do not continue here */ });
      if (!req.firebaseUser?.uid) return next(); // genuinely anonymous — the route's own auth will answer
      return requireEmailVerified(req, res, next);
    } catch {
      // Never let this gate be the reason a request fails to route.
      return next();
    }
  })();
}

export default requireEmailVerified;
