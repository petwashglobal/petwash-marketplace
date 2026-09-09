import { Router, Request, Response, NextFunction } from 'express';
import { validateFirebaseToken } from '../middleware/firebase-auth';
import { totpService } from '../services/TOTPService';
import { twoFactorAuth } from '../services/TwoFactorAuthService';
import { logger } from '../lib/logger';
import {
  isUnifiedVerificationEnabled,
  isUnifiedVerificationDisable2faEnabled,
  isUnifiedVerificationEnable2faEnabled,
} from '../lib/feature-flags/unifiedVerification';
import { pool } from '../db';
import {
  UnifiedVerificationError,
  unifiedVerificationService,
  type VerificationActor,
} from '../services/UnifiedVerificationService';

const mfaRouter = Router();

const MFA_RATE_LIMIT_MAX = 5;
const MFA_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MFA_RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const mfaRateLimitMap = new Map<string, { attempts: number; windowStart: number }>();

function verificationActorFromRequest(req: Request, uid: string): VerificationActor {
  return {
    userId: uid,
    ip: req.ip || (req.headers['x-forwarded-for'] as string | undefined),
    userAgent: req.headers['user-agent'],
  };
}

function handleUnifiedVerificationError(res: Response, error: unknown): boolean {
  if (error instanceof UnifiedVerificationError) {
    res.status(error.statusCode).json({ error: error.message, code: error.reasonCode });
    return true;
  }
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of mfaRateLimitMap) {
    if (now - entry.windowStart > MFA_RATE_LIMIT_WINDOW_MS) {
      mfaRateLimitMap.delete(userId);
    }
  }
}, MFA_RATE_LIMIT_CLEANUP_INTERVAL_MS);

function mfaRateLimiter(req: Request, res: Response, next: NextFunction) {
  const uid = req.firebaseUser?.uid;
  if (!uid) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const now = Date.now();
  const entry = mfaRateLimitMap.get(uid);

  if (entry) {
    if (now - entry.windowStart > MFA_RATE_LIMIT_WINDOW_MS) {
      mfaRateLimitMap.set(uid, { attempts: 1, windowStart: now });
      return next();
    }

    if (entry.attempts >= MFA_RATE_LIMIT_MAX) {
      const retryAfterSec = Math.ceil((MFA_RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000);
      logger.warn(`[MFA-RateLimit] User ${uid} exceeded MFA verify rate limit`);
      return res.status(429).json({
        error: 'MFA_RATE_LIMITED',
        message: 'Too many verification attempts. Please try again later.',
        retryAfterSeconds: retryAfterSec,
      });
    }

    entry.attempts += 1;
  } else {
    mfaRateLimitMap.set(uid, { attempts: 1, windowStart: now });
  }

  return next();
}

/**
 * TWO CONTROLS LIVE HERE, AND THIS ROUTE USED TO REPORT ONLY ONE.
 *
 *   `enrolled`      — mfa_enrollments (TOTP/SMS/email), stepped up on sensitive
 *                     ACTIONS. Nothing about it gates signing in.
 *   `twoStepLogin`  — users.two_factor_enabled, the member's join-time choice
 *                     that a password alone must not be enough. THIS is what
 *                     POST /api/auth/session enforces on a password sign-in.
 *
 * They share no state. So a member with two_factor_enabled = true and no TOTP
 * enrolment was told `enrolled: false`, and My Account rendered "Two-step
 * verification is off" with an Off badge — while the session gate was actively
 * challenging them for exactly that. The panel stated the opposite of the truth
 * about a live security control, which is worse than saying nothing.
 *
 * `enrolled` keeps its meaning for existing callers; the login control is
 * reported alongside it rather than folded into it, because collapsing two
 * different controls into one boolean is how this happened.
 */
mfaRouter.get('/status', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const enrollments = await totpService.getUserEnrollments(uid);
    // A read failure must not be rendered as "off" — that is the same false
    // claim in a new place. `null` means unknown and the UI says so.
    let twoStepLoginEnabled: boolean | null = null;
    try {
      const { rows } = await pool.query(
        'SELECT two_factor_enabled FROM users WHERE id = $1 LIMIT 1',
        [uid],
      );
      twoStepLoginEnabled = rows[0] ? rows[0].two_factor_enabled === true : false;
    } catch (e: any) {
      logger.warn('[MFA-API] could not read two_factor_enabled', { uid, error: e?.message });
    }
    res.json({
      twoStepLogin: { enabled: twoStepLoginEnabled },
      enrolled: enrollments.some(e => e.isActive && e.verified),
      enrollments: enrollments.map(e => ({
        id: e.id,
        method: e.method,
        isActive: e.isActive,
        verified: e.verified,
        enrolledAt: e.enrolledAt,
        lastUsedAt: e.lastUsedAt,
      })),
    });
  } catch (error) {
    logger.error('[MFA-API] Status error:', error);
    res.status(500).json({ error: 'Failed to load MFA status' });
  }
});

mfaRouter.post('/enroll/totp', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const email = req.firebaseUser!.email || '';

    if (isUnifiedVerificationEnable2faEnabled()) {
      const { verificationChallengeId, verificationCode } = req.body ?? {};

      if (!verificationChallengeId || !verificationCode) {
        if (!email) {
          return res.status(400).json({ error: 'Verified email required before MFA enrollment' });
        }

        const challenge = await unifiedVerificationService.startChallenge({
          purpose: 'enable_2fa',
          channel: 'email',
          destination: email,
          payload: { method: 'totp' },
          actor: verificationActorFromRequest(req, uid),
        });

        return res.status(202).json({
          requiresVerification: true,
          runtime: 'unified_verification',
          verificationChallengeId: challenge.challenge.challengeId,
          expiresAt: challenge.challenge.expiresAt,
          message: 'Verification code sent to your email',
        });
      }

      const verificationResult = await unifiedVerificationService.verifyChallenge({
        challengeId: verificationChallengeId,
        code: verificationCode,
        actor: verificationActorFromRequest(req, uid),
      });
      const metadata = (verificationResult.action as any)?.metadata || {};
      if (metadata.action !== 'enable_2fa') {
        return res.status(400).json({ error: 'Invalid verification challenge', code: 'INVALID_VERIFICATION_ACTION' });
      }
    }

    const result = await totpService.enrollUser({
      userId: uid,
      userEmail: email,
      method: 'totp',
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      enrollmentId: result.enrollmentId,
      secret: result.totpSecret,
      qrUri: result.totpUri,
      message: 'Scan the QR code with your authenticator app, then verify with a code.',
    });
  } catch (error) {
    if (handleUnifiedVerificationError(res, error)) return;
    logger.error('[MFA-API] TOTP enroll error:', error);
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

mfaRouter.post('/enroll/sms', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const email = req.firebaseUser!.email || '';
    const { phone } = req.body;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Phone number required' });
    }

    const result = await totpService.enrollUser({
      userId: uid,
      userEmail: email,
      method: 'sms',
      phone,
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      enrollmentId: result.enrollmentId,
      message: 'SMS MFA enrolled successfully.',
    });
  } catch (error) {
    logger.error('[MFA-API] SMS enroll error:', error);
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

mfaRouter.post('/enroll/email', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const email = req.firebaseUser!.email || '';

    const result = await totpService.enrollUser({
      userId: uid,
      userEmail: email,
      method: 'email',
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      enrollmentId: result.enrollmentId,
      message: 'Email MFA enrolled successfully.',
    });
  } catch (error) {
    logger.error('[MFA-API] Email enroll error:', error);
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

mfaRouter.post('/verify-enrollment', validateFirebaseToken, mfaRateLimiter, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { code } = req.body;

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({ error: 'Valid 6-digit code required' });
    }

    const result = await totpService.verifyEnrollment(uid, code);

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ verified: true, message: 'TOTP enrollment verified. MFA is now active.' });
  } catch (error) {
    logger.error('[MFA-API] Verify enrollment error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

mfaRouter.post('/verify', validateFirebaseToken, mfaRateLimiter, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { code, method } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Code required' });
    }

    if (method === 'sms' || method === 'email') {
      const sessionId = req.body.sessionId;
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId required for SMS/Email OTP' });
      }
      const result = method === 'sms'
        ? await twoFactorAuth.verifySmsCode(uid, sessionId, code)
        : await twoFactorAuth.verifyEmailCode(uid, sessionId, code);
      // False-success round 1 (2026-08-22): TwoFactorAuthService returns
      // `{ success: false, message: 'Invalid code' | 'Too many attempts'
      // | 'Code expired' }` on failure. Streaming that at HTTP 200 lets
      // clients that only branch on `res.ok` treat a WRONG OTP as a
      // verified one — a hard 2FA bypass. Status must reflect success.
      if (!result?.success) {
        return res.status(400).json(result || { success: false, message: 'Verification failed' });
      }
      return res.json(result);
    }

    const result = await totpService.verifyUserMfa(uid, code, method);

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ verified: true });
  } catch (error) {
    logger.error('[MFA-API] Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

mfaRouter.post('/send-otp', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const { method, phone, email, firstName, language } = req.body;

    if (!method || !['sms', 'email', 'both'].includes(method)) {
      return res.status(400).json({ error: 'Valid method required (sms, email, both)' });
    }

    const result = await twoFactorAuth.sendCode(uid, method, { phone, email, firstName }, language || 'he');
    // False-success round 1 (2026-08-22): sendCode returns
    // `{ success: false, reason: 'cooldown_active' | 'rate_limited_ip'
    // | 'delivery_failed' | 'invalid_phone' }` on failure. Wire it as
    // 4xx/5xx so the client's "code sent" screen only shows on real
    // sends. cooldown/rate-limit are 429; delivery/invalid are 400.
    if (!result?.success) {
      const status =
        result?.reason === 'cooldown_active' || result?.reason === 'rate_limited_ip'
          ? 429
          : 400;
      return res.status(status).json(result);
    }
    res.json(result);
  } catch (error) {
    logger.error('[MFA-API] Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

mfaRouter.delete('/enrollment/:id', validateFirebaseToken, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const enrollmentId = parseInt(req.params.id);

    if (isNaN(enrollmentId)) {
      return res.status(400).json({ error: 'Invalid enrollment ID' });
    }

    if (isUnifiedVerificationDisable2faEnabled()) {
      const email = req.firebaseUser!.email || '';
      const { verificationChallengeId, verificationCode } = req.body ?? {};

      if (!verificationChallengeId || !verificationCode) {
        if (!email) {
          return res.status(400).json({ error: 'Verified email required before MFA removal' });
        }

        const challenge = await unifiedVerificationService.startChallenge({
          purpose: 'disable_2fa',
          channel: 'email',
          destination: email,
          payload: { enrollmentId },
          actor: verificationActorFromRequest(req, uid),
        });

        return res.status(202).json({
          requiresVerification: true,
          runtime: 'unified_verification',
          verificationChallengeId: challenge.challenge.challengeId,
          expiresAt: challenge.challenge.expiresAt,
          message: 'Verification code sent to your email',
        });
      }

      const verificationResult = await unifiedVerificationService.verifyChallenge({
        challengeId: verificationChallengeId,
        code: verificationCode,
        actor: verificationActorFromRequest(req, uid),
      });
      const metadata = (verificationResult.action as any)?.metadata || {};
      if (metadata.action !== 'disable_2fa' || Number(metadata.enrollmentId) !== enrollmentId) {
        return res.status(400).json({ error: 'Invalid verification challenge', code: 'INVALID_VERIFICATION_ACTION' });
      }
    }

    const { adminAuth } = await import('../lib/firebase-admin');
    const userRecord = await adminAuth.getUser(uid);
    const claims = (userRecord.customClaims || {}) as Record<string, any>;
    const role = claims.role || '';

    const MFA_MANDATORY_ROLES = ['admin', 'super_admin', 'management', 'hr', 'finance'];
    if (MFA_MANDATORY_ROLES.includes(role) || claims.kycStaff || claims.kycAdmin || claims.financeAccess) {
      const enrollments = await totpService.getUserEnrollments(uid);
      const activeVerified = enrollments.filter(e => e.isActive && e.verified && e.id !== enrollmentId);
      if (activeVerified.length === 0) {
        return res.status(403).json({
          error: 'MFA_CANNOT_DISABLE',
          message: 'Your role requires at least one active MFA method. You cannot remove your last MFA enrollment.',
        });
      }
    }

    const result = await totpService.removeEnrollment(uid, enrollmentId);

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ removed: true });
  } catch (error) {
    if (handleUnifiedVerificationError(res, error)) return;
    logger.error('[MFA-API] Remove enrollment error:', error);
    res.status(500).json({ error: 'Removal failed' });
  }
});

/**
 * POST /api/mfa/two-step/disable — turn OFF users.two_factor_enabled.
 *
 * THE EXIT THAT DID NOT EXIST. The column was written in exactly one place,
 * POST /api/auth/verify-signup-email at join, and nowhere else: no route
 * cleared it, PATCH /api/user/profile refuses it, and the enrolment routes in
 * this file operate on mfa_enrollments and never touch it. A member who chose
 * two-step login at signup could never un-choose it — and if their number
 * disappeared from both stores, the session gate refused their password
 * sign-in with nothing they could do about it.
 *
 * A CHALLENGE IS REQUIRED, AND ITS ABSENCE REFUSES RATHER THAN DOWNGRADES.
 * Removing one of several enrolments falls back to session-only when the
 * unified runtime is off (see DELETE /enrollment/:id); switching the account's
 * whole login gate off is not the same act, so when the challenge machinery is
 * unavailable this answers 503 instead of quietly doing it on a session alone.
 * A security control may not be switched off by a caller who proved nothing.
 *
 * The code goes to the account EMAIL on purpose. The member who most needs
 * this route is the one with no phone in either store — sending the proof to a
 * number that does not exist is the loop this exists to break.
 *
 * Two-phase, like every other sensitive change here: call once to get a
 * challenge, again with the code to apply it.
 */
mfaRouter.post('/two-step/disable', validateFirebaseToken, mfaRateLimiter, async (req: Request, res: Response) => {
  try {
    const uid = req.firebaseUser!.uid;
    const email = req.firebaseUser!.email || '';

    // Already off → nothing to prove and nothing to change. Reported honestly
    // rather than emailing a code for a no-op.
    const { rows } = await pool.query(
      'SELECT two_factor_enabled FROM users WHERE id = $1 LIMIT 1',
      [uid],
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'Account not found', code: 'USER_NOT_FOUND' });
    }
    if (rows[0].two_factor_enabled !== true) {
      return res.json({ disabled: true, alreadyDisabled: true });
    }

    if (!isUnifiedVerificationEnabled()) {
      logger.warn('[MFA-API] two-step disable refused — verification runtime unavailable', { uid });
      return res.status(503).json({
        error: 'Two-step login cannot be changed right now. Please try again later.',
        code: 'VERIFICATION_UNAVAILABLE',
      });
    }
    if (!email) {
      return res.status(400).json({
        error: 'A verified email is required to turn two-step login off.',
        code: 'EMAIL_REQUIRED',
      });
    }

    const { verificationChallengeId, verificationCode } = req.body ?? {};
    if (!verificationChallengeId || !verificationCode) {
      const challenge = await unifiedVerificationService.startChallenge({
        purpose: 'disable_2fa',
        channel: 'email',
        destination: email,
        payload: { target: 'two_step_login' },
        actor: verificationActorFromRequest(req, uid),
      });
      return res.status(202).json({
        requiresVerification: true,
        verificationChallengeId: challenge.challenge.challengeId,
        expiresAt: challenge.challenge.expiresAt,
        message: 'Verification code sent to your email',
      });
    }

    const verificationResult = await unifiedVerificationService.verifyChallenge({
      challengeId: verificationChallengeId,
      code: verificationCode,
      actor: verificationActorFromRequest(req, uid),
    });
    const metadata = (verificationResult.action as any)?.metadata || {};
    if (metadata.action !== 'disable_2fa') {
      return res.status(400).json({ error: 'Invalid verification challenge', code: 'INVALID_VERIFICATION_ACTION' });
    }
    // A proof names a subject. assertActorCanVerify already refuses a challenge
    // belonging to another account; this re-checks the binding at the point of
    // the WRITE, because that is where getting it wrong changes someone else's
    // security settings.
    if (metadata.userId && metadata.userId !== uid) {
      logger.error('[MFA-API] two-step disable proof bound to a different account', { uid });
      return res.status(403).json({ error: 'Invalid verification challenge', code: 'ACTOR_MISMATCH' });
    }

    const updated = await pool.query(
      'UPDATE users SET two_factor_enabled = false WHERE id = $1 RETURNING id',
      [uid],
    );
    if (!updated.rowCount) {
      // The proof was spent. Saying "disabled" when no row changed would be the
      // false-success this codebase keeps having to undo.
      logger.error('[MFA-API] two-step disable matched 0 rows after a verified challenge', { uid });
      return res.status(500).json({
        error: 'The code was correct but the setting could not be saved. Please try again.',
        code: 'TWO_STEP_DISABLE_FAILED',
      });
    }

    logger.info('[MFA-API] two-step login disabled by member', { uid });
    return res.json({ disabled: true });
  } catch (error) {
    if (handleUnifiedVerificationError(res, error)) return;
    logger.error('[MFA-API] two-step disable error:', error);
    return res.status(500).json({ error: 'Could not turn two-step login off' });
  }
});

export default mfaRouter;
