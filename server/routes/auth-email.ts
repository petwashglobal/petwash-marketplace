/**
 * Email-code auth front door — matched 6-digit code over email (mirrors the SMS
 * OTP). Thin wrapper over UnifiedVerificationService (same challenge store, hashed
 * + peppered codes, expiry/lock/cooldown, otp_events audit) — it does NOT roll its
 * own code store.
 *
 *   POST /api/auth/email/start   { email, purpose?, language? }  -> sends a code
 *   POST /api/auth/email/verify  { email, code, purpose? }       -> verifies (matched, recorded)
 *
 * purpose: 'signup' (default) | 'login'. Used by the easy Prestige join so the
 * member's email is verified with a code matched live, exactly like their mobile.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { UnifiedVerificationError, unifiedVerificationService } from '../services/UnifiedVerificationService';
import { mintEmailVerifiedToken } from '../lib/emailVerifiedToken';
import { logger } from '../lib/logger';

const router = Router();

function maskEmail(email: unknown): string | undefined {
  if (typeof email !== 'string' || !email.includes('@')) return undefined;
  const [u, d] = email.split('@');
  return `${u.slice(0, 2)}•••@${d}`;
}

function statusForUnifiedFailure(error: UnifiedVerificationError): number {
  if (error.reasonCode === 'INVALID_CODE') return 401;
  if (error.reasonCode === 'CHALLENGE_LOCKED') return 423;
  if (error.reasonCode === 'CHALLENGE_EXPIRED') return 410;
  if (error.reasonCode === 'CHALLENGE_COOLDOWN') return 429;
  if (error.reasonCode === 'EMAIL_PROVIDER_ERROR') return 503;
  return error.statusCode || 400;
}

function actorFrom(req: Request) {
  return {
    userId: (req as any).firebaseUser?.uid || (req as any).user?.uid,
    ip: req.ip || (req.headers['x-forwarded-for'] as string) || undefined,
    userAgent: req.headers['user-agent'],
  };
}

const startSchema = z.object({
  email: z.string().trim().email().max(254),
  purpose: z.enum(['signup', 'login']).default('signup'),
  language: z.string().max(8).optional(),
});

// POST /api/auth/email/start
router.post('/start', async (req: Request, res: Response) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_email' });
  const { email, purpose, language } = parsed.data;

  try {
    const result = await unifiedVerificationService.startChallenge({
      purpose,
      channel: 'email',
      destination: email.toLowerCase(),
      payload: language ? { language } : undefined,
      actor: actorFrom(req),
    });
    return res.json({
      ok: true,
      challengeId: (result.challenge as any)?.challengeId,
      // testCode only present in non-prod with the test flag on.
      testCode: (result as any).testCode,
    });
  } catch (err: any) {
    if (err instanceof UnifiedVerificationError) {
      logger.warn('[AuthEmail] start failed', { email: maskEmail(email), reason: err.reasonCode });
      return res.status(statusForUnifiedFailure(err)).json({ ok: false, error: err.reasonCode, message: err.message });
    }
    logger.error('[AuthEmail] start error', { email: maskEmail(email), err: err?.message });
    return res.status(503).json({ ok: false, error: 'email_unavailable' });
  }
});

const verifySchema = z.object({
  email: z.string().trim().email().max(254),
  code: z.string().trim().min(4).max(10),
  purpose: z.enum(['signup', 'login']).default('signup'),
});

// POST /api/auth/email/verify
router.post('/verify', async (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_input' });
  const { email, code, purpose } = parsed.data;

  try {
    const result = await unifiedVerificationService.verifyLatestChallengeForDestination({
      purpose,
      destination: email.toLowerCase(),
      code,
      actor: actorFrom(req),
    });
    // Mint a short-lived, HMAC-signed proof so /api/auth/email-session can mint a
    // login WITHOUT trusting a bare { email }. Only issued on a matched code.
    const sessionToken = mintEmailVerifiedToken(email);
    return res.json({ ok: true, verified: true, action: (result as any).action, sessionToken });
  } catch (err: any) {
    if (err instanceof UnifiedVerificationError) {
      logger.warn('[AuthEmail] verify failed', { email: maskEmail(email), reason: err.reasonCode });
      return res.status(statusForUnifiedFailure(err)).json({ ok: false, verified: false, error: err.reasonCode, message: err.message });
    }
    logger.error('[AuthEmail] verify error', { email: maskEmail(email), err: err?.message });
    return res.status(500).json({ ok: false, error: 'verify_failed' });
  }
});

export default router;
