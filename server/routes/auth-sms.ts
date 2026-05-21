/**
 * Canonical SMS auth front door (Sprint 2).
 *
 * A THIN wrapper over the proven Twilio OTP engine (TwilioSMSService) and the
 * EXISTING phone-session -> /api/auth/session cookie chain. It deliberately does
 * NOT implement its own OTP store or session logic — it only exposes clean,
 * mobile-first endpoint names and a per-flow post-verify redirect target.
 *
 *   POST /api/auth/sms/start   { phone, language?, flow? }        -> sends an OTP
 *   POST /api/auth/sms/verify  { phone, code, language?, flow? }  -> verifies, returns
 *                                                                    verificationToken + redirect
 *
 * Crash-safe: TwilioSMSService.sendVerificationCode/verifyCode return
 * { success:false } (never throw) when Twilio/config is missing, so this module
 * can neither crash startup nor crash a request when SMS config is absent.
 *
 * After /verify succeeds the client continues the UNCHANGED existing chain:
 *   verificationToken -> POST /api/auth/phone-session (returns a Firebase customToken)
 *   -> client signInWithCustomToken -> POST /api/auth/session (sets the pw_session cookie)
 *   -> GET /api/session/whoami then works exactly as today.
 */
import { Router, type Request, type Response } from 'express';
import { twilioSMSService } from '../services/TwilioSMSService';
import { logger } from '../lib/logger';

export type AuthFlow = 'prestige' | 'provider' | 'guest';

// Post-verify destination per onboarding channel. These are the canonical
// targets from the platform plan; the client navigates here after the session
// cookie is minted via the existing /api/auth/session chain.
const FLOW_REDIRECTS: Record<AuthFlow, string> = {
  prestige: '/member/dashboard',
  provider: '/provider/dashboard',
  guest: '/egift',
};
const DEFAULT_FLOW: AuthFlow = 'prestige';

export function normalizeFlow(input: unknown): AuthFlow {
  return input === 'provider' || input === 'guest' || input === 'prestige' ? input : DEFAULT_FLOW;
}

export function redirectForFlow(flow: AuthFlow): string {
  return FLOW_REDIRECTS[flow];
}

const router = Router();

// POST /api/auth/sms/start — send a one-time login code to the phone.
router.post('/start', async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const phone = body.phone;
  const language = typeof body.language === 'string' ? body.language : 'he';
  const flow = normalizeFlow(body.flow);

  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ ok: false, error: 'phone_required' });
  }

  const callerIp = req.ip || (req.headers['x-forwarded-for'] as string) || undefined;
  try {
    const result = await twilioSMSService.sendVerificationCode(phone, language, callerIp);
    if (!result.success) {
      // Covers missing Twilio config, resend cooldown, and global/per-phone caps.
      return res.status(503).json({ ok: false, error: 'sms_unavailable', message: result.message, flow });
    }
    return res.status(200).json({ ok: true, message: result.message, expiresIn: result.expiresIn, flow });
  } catch (err) {
    logger.error('[auth-sms] start failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(503).json({ ok: false, error: 'sms_unavailable' });
  }
});

// POST /api/auth/sms/verify — verify the code; on success hand back the
// verificationToken (same contract as /api/auth/phone/verify-code) plus the
// per-flow redirect. Session minting stays in the existing chain.
router.post('/verify', async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const phone = body.phone;
  const code = body.code;
  const language = typeof body.language === 'string' ? body.language : 'he';
  const flow = normalizeFlow(body.flow);

  if (!phone || !code || typeof phone !== 'string' || typeof code !== 'string') {
    return res.status(400).json({ ok: false, error: 'phone_and_code_required' });
  }

  try {
    const result = await twilioSMSService.verifyCode(phone, code, language);
    if (!result.success) {
      return res.status(401).json({
        ok: false,
        error: 'verification_failed',
        message: result.message,
        lockedUntil: result.lockedUntil,
      });
    }
    return res.status(200).json({
      ok: true,
      verificationToken: result.verificationToken,
      flow,
      redirect: redirectForFlow(flow),
    });
  } catch (err) {
    logger.error('[auth-sms] verify failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ ok: false, error: 'verification_error' });
  }
});

export default router;
