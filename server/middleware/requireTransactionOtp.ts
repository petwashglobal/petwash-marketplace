/**
 * requireTransactionOtp — step-up enforcement for sensitive money/security actions.
 *
 * AUDIT 2026-07-06: TransactionOTPService (send/verify/validate) was fully built but
 * ENFORCED NOWHERE — a dark capability. The CEO's bar is "verify every command with a
 * code." This is the missing primitive that makes an action actually REQUIRE a
 * verified OTP.
 *
 * Flow: the client first POSTs /api/transaction-otp/send then /verify for
 * `expectedType`, receives a single-use `transactionToken`, and replays it on the
 * protected request as the `x-transaction-otp` header (or body.transactionToken).
 * The token is bound to (userId, transactionType) and CONSUMED on validation
 * (single-use in Redis → no replay).
 *
 * Fail-closed: any missing / invalid / mismatched / wrong-user token → 401, and the
 * protected handler never runs.
 *
 * ROLLOUT NOTE: applying this to a live route REQUIRES the client for that action to
 * obtain + send the token first — otherwise every request 401s. Wire per-route in
 * lockstep with the client, highest-risk first (bank_details_change, provider_payout,
 * payment_method_change, large wallet withdrawals).
 */
import type { Request, Response, NextFunction } from 'express';
import { transactionOTPService, type TransactionType } from '../services/TransactionOTPService';
import { logger } from '../lib/logger';

function extractToken(req: Request): string | undefined {
  const h = req.headers['x-transaction-otp'];
  const fromHeader = Array.isArray(h) ? h[0] : h;
  if (typeof fromHeader === 'string' && fromHeader) return fromHeader;
  const fromBody = (req.body && typeof req.body.transactionToken === 'string') ? req.body.transactionToken : undefined;
  return fromBody || undefined;
}

export function requireTransactionOtp(expectedType: TransactionType) {
  return async function requireTransactionOtpMw(req: Request, res: Response, next: NextFunction) {
    const userId = (req as any).userId || (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized', code: 'auth_required' });
    }

    const token = extractToken(req);
    if (!token) {
      // Tell the client exactly which OTP to obtain — enables a clean step-up UX.
      return res.status(401).json({
        error: 'otp_required',
        code: 'otp_required',
        transactionType: expectedType,
        message: 'This action requires a one-time confirmation code.',
      });
    }

    try {
      const result = await transactionOTPService.validateTransactionToken(token);
      if (!result.valid || result.userId !== userId || result.transactionType !== expectedType) {
        logger.warn('[requireTransactionOtp] rejected', {
          userId, expectedType,
          valid: result.valid,
          userMatch: result.userId === userId,
          typeGot: result.transactionType,
        });
        return res.status(401).json({
          error: 'otp_invalid',
          code: 'otp_invalid',
          transactionType: expectedType,
          message: 'Confirmation code invalid or expired — please verify again.',
        });
      }
      (req as any).transactionOtpVerified = { transactionType: expectedType, at: Date.now() };
      return next();
    } catch (err: any) {
      logger.error('[requireTransactionOtp] validation error', { err: err?.message });
      return res.status(500).json({ error: 'otp_validation_failed' });
    }
  };
}

export default requireTransactionOtp;
