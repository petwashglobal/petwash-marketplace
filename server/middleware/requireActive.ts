import { Request, Response, NextFunction } from 'express';
import { getActivationState } from '../services/ActivationService';
import { logger } from '../lib/logger';

/**
 * requireActive — blocks mutating operations on wallet, K9000 redeem,
 * and booking routes unless the user's account is fully activated
 * (mobile_verified + email_verified → status = 'active').
 *
 * Passes through GET requests and unauthenticated requests (auth
 * middleware is responsible for 401s).
 */
export async function requireActive(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const uid = req.firebaseUser?.uid;
    if (!uid) {
      // Not authenticated — let auth middleware handle it
      next();
      return;
    }

    // GET requests pass through (read-only)
    if (req.method === 'GET') {
      next();
      return;
    }

    const state = await getActivationState(uid);

    if (state.isFullyActive) {
      next();
      return;
    }

    logger.warn('[RequireActive] Blocked — account not fully activated', {
      uid,
      activationStatus: state.activationStatus,
      missingSteps: state.missingSteps,
      method: req.method,
      path: req.path,
    });

    res.status(403).json({
      error: 'ACCOUNT_NOT_ACTIVATED',
      message: 'Complete account activation before using this feature.',
      action: 'activate_account',
      activationStatus: state.activationStatus,
      missingSteps: state.missingSteps,
    });
  } catch (err: any) {
    logger.error('[RequireActive] Error checking activation state', { error: err.message });
    // Fail open — don't block users on transient DB errors
    next();
  }
}
