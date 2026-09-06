/**
 * Email-code auth front door — matched 6-digit code over email (mirrors the SMS
 * OTP). Thin wrapper over UnifiedVerificationService (same challenge store, hashed
 * + peppered codes, expiry/lock/cooldown, otp_events audit) — it does NOT roll its
 * own code store.
 *
 *   POST /api/auth/email/start   { email, purpose?, language? }  -> sends a code
 *   POST /api/auth/email/verify  { email, code, purpose? }       -> verifies (matched, recorded)
 *   POST /api/auth/email/resend  { challengeId }                 -> resends the SAME challenge
 *
 * /start and /resend return the full masked `challenge` object, identical in
 * shape to /api/verification/*. That is what lets the shared VerificationFlow
 * drive this surface without a second OTP implementation: the UI is the same
 * component, only the transport differs — and it has to differ here, because
 * this route carries the Turnstile bot guard that the generic endpoint does
 * not. Pointing the UI straight at /api/verification would silently drop that
 * guard from the most-attacked surface in the product.
 *
 * purpose: 'signup' (default) | 'login'. Used by the easy Prestige join so the
 * member's email is verified with a code matched live, exactly like their mobile.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { UnifiedVerificationError, unifiedVerificationService } from '../services/UnifiedVerificationService';
import { mintEmailVerifiedToken } from '../lib/emailVerifiedToken';
import { logger } from '../lib/logger';
import { turnstileGuard } from '../lib/turnstileGuard';

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
// Turnstile guard: previously this route had NO bot check at all — the only
// customer-facing OTP surface without one. Same policy as the canonical SMS
// surface.
//
// POLICY, corrected 2026-09-06. This comment used to say "skipped with a WARN
// otherwise", which stopped being true when AUDIT-SMS-6 (2026-09-01) made the
// guard fail CLOSED in production. The real policy is:
//
//   production,     TURNSTILE_SECRET_KEY missing -> 503, THIS ROUTE IS DOWN
//   non-production, TURNSTILE_SECRET_KEY missing -> skip + WARN
//   configured,     token missing                -> 400 TURNSTILE_TOKEN_REQUIRED
//   configured,     token invalid                -> 403 TURNSTILE_CHECK_FAILED
//
// The stale wording mattered: on 2026-09-06 both this route and the SMS one
// were returning 503 in production for want of the secret, and everything an
// operator could read — this comment and /api/health/bot-check — described a
// surface that was merely unprotected rather than dead.
router.post('/start', turnstileGuard({ action: 'signup_email_start' }), async (req: Request, res: Response) => {
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
      // Same masked shape as /api/verification/start. challengeId is kept as a
      // top-level field because existing callers read it there.
      challenge: result.challenge,
      challengeId: (result.challenge as any)?.challengeId,
      // testCode only present in non-prod with the test flag on.
      testCode: (result as any).testCode,
    });
  } catch (err: any) {
    if (err instanceof UnifiedVerificationError) {
      logger.warn('[AuthEmail] start failed', { email: maskEmail(email), reason: err.reasonCode });
      return res.status(statusForUnifiedFailure(err)).json({ ok: false, error: err.reasonCode, reasonCode: err.reasonCode, message: err.message });
    }
    logger.error('[AuthEmail] start error', { email: maskEmail(email), err: err?.message });
    return res.status(503).json({ ok: false, error: 'email_unavailable' });
  }
});

const verifySchema = z.object({
  email: z.string().trim().email().max(254),
  code: z.string().trim().min(4).max(10),
  purpose: z.enum(['signup', 'login']).default('signup'),
  /**
   * Verify THIS challenge rather than "the latest one for this address".
   *
   * verifyLatestChallengeForDestination is a reasonable default for a stateless
   * caller, but it can resolve to a different challenge than the one the screen
   * is showing — open the flow in two tabs, or start again after a resend, and
   * the code the customer is looking at is no longer "the latest". Callers that
   * hold a challengeId (anything driving the shared VerificationFlow) should
   * send it and get an exact match.
   *
   * Optional so existing callers keep working unchanged.
   */
  verificationChallengeId: z.string().min(10).max(100).optional(),
});

// POST /api/auth/email/verify
router.post('/verify', async (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_input' });
  const { email, code, purpose, verificationChallengeId } = parsed.data;

  try {
    const result = verificationChallengeId
      ? await unifiedVerificationService.verifyChallenge({
          challengeId: verificationChallengeId,
          code,
          actor: actorFrom(req),
        })
      : await unifiedVerificationService.verifyLatestChallengeForDestination({
          purpose,
          destination: email.toLowerCase(),
          code,
          actor: actorFrom(req),
        });
    // Mint a short-lived, HMAC-signed proof so /api/auth/email-session can mint a
    // login WITHOUT trusting a bare { email }. Only issued on a matched code.
    const sessionToken = mintEmailVerifiedToken(email);
    return res.json({
      ok: true,
      verified: true,
      challenge: (result as any).challenge,
      action: (result as any).action,
      sessionToken,
    });
  } catch (err: any) {
    if (err instanceof UnifiedVerificationError) {
      logger.warn('[AuthEmail] verify failed', { email: maskEmail(email), reason: err.reasonCode });
      return res.status(statusForUnifiedFailure(err)).json({ ok: false, verified: false, error: err.reasonCode, reasonCode: err.reasonCode, message: err.message });
    }
    logger.error('[AuthEmail] verify error', { email: maskEmail(email), err: err?.message });
    return res.status(500).json({ ok: false, error: 'verify_failed' });
  }
});


const resendSchema = z.object({
  challengeId: z.string().min(10).max(100),
});

/**
 * POST /api/auth/email/resend
 *
 * Before this existed the signup screen's "Resend code" button called /start
 * again. That creates a BRAND NEW challenge — so the code already sitting in
 * the customer's inbox stops working the moment they ask for another one, and
 * anyone who typed the first code after pressing resend got "that code isn't
 * correct" for a code that was perfectly valid when it arrived.
 *
 * This resends the SAME challenge. Cooldown, expiry and pending-state checks
 * are the service's, so a customer mashing the button cannot send twenty
 * emails.
 *
 * No Turnstile here on purpose: a resend requires a challengeId that only a
 * successful /start (which IS guarded) could have produced.
 */
router.post('/resend', async (req: Request, res: Response) => {
  const parsed = resendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_input' });

  try {
    const result = await unifiedVerificationService.resendChallenge({
      challengeId: parsed.data.challengeId,
      actor: actorFrom(req),
    });
    return res.json({
      ok: true,
      challenge: result.challenge,
      testCode: (result as any).testCode,
    });
  } catch (err: any) {
    if (err instanceof UnifiedVerificationError) {
      logger.warn('[AuthEmail] resend failed', { reason: err.reasonCode });
      return res.status(statusForUnifiedFailure(err)).json({
        ok: false, error: err.reasonCode, reasonCode: err.reasonCode, message: err.message,
      });
    }
    logger.error('[AuthEmail] resend error', { err: err?.message });
    return res.status(503).json({ ok: false, error: 'email_unavailable' });
  }
});

export default router;
