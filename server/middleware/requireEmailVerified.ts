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
