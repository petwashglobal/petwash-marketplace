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
import { isUnifiedVerificationLoginEnabled } from '../lib/feature-flags/unifiedVerification';
import { UnifiedVerificationError, unifiedVerificationService } from '../services/UnifiedVerificationService';
import { logger } from '../lib/logger';
import { logAuditEvent } from '../middleware/auditLog';
import { verifyTurnstileToken } from '../lib/verifyTurnstile';

// Last-4 only — never log a full phone number (PII) or the OTP code.
function maskPhone(phone: unknown): string | undefined {
  return typeof phone === 'string' && phone.length >= 4 ? `••••${phone.slice(-4)}` : undefined;
}

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

function statusForSmsFailure(result: { status?: number; code?: string }): number {
  if (result.status && result.status >= 400 && result.status < 600) return result.status;
  if (result.code === 'SMS_RATE_LIMITED' || result.code === 'SMS_PROVIDER_RATE_LIMITED') return 429;
  if (result.code === 'SMS_PROVIDER_GEO_BLOCKED') return 422;
  return 503;
}

function requestActor(req: Request, body: { deviceId?: unknown; traceId?: unknown }) {
  return {
    userId: (req as any).user?.uid || (req as any).user?.id || (req as any).firebaseUser?.uid,
    ip: req.ip || (req.headers['x-forwarded-for'] as string) || undefined,
    userAgent: req.headers['user-agent'],
    deviceId: typeof body.deviceId === 'string' ? body.deviceId : undefined,
    traceId: typeof body.traceId === 'string' ? body.traceId : undefined,
  };
}

function statusForUnifiedFailure(error: UnifiedVerificationError): number {
  if (error.reasonCode === 'INVALID_CODE') return 401;
  if (error.reasonCode === 'CHALLENGE_LOCKED') return 423;
  if (error.reasonCode === 'CHALLENGE_EXPIRED') return 410;
  if (error.reasonCode === 'CHALLENGE_COOLDOWN') return 429;
  if (error.reasonCode === 'SMS_PROVIDER_ERROR') return 503;
  return error.statusCode;
}

// GET /api/auth/sms/status — cheap config signal for clients to default away from SMS.
router.get('/status', (_req: Request, res: Response) => {
  const smsProviderHealthy = twilioSMSService.isReady() && !twilioSMSService.isEmergencyDisabled();
  return res.status(200).json({
    ok: true,
    smsProviderHealthy,
  });
});

// POST /api/auth/sms/start — send a one-time login code to the phone.
router.post('/start', async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const phone = body.phone;
  const language = typeof body.language === 'string' ? body.language : 'he';
  const flow = normalizeFlow(body.flow);
  const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : undefined;

  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ ok: false, error: 'phone_required' });
  }

  const callerIp = req.ip || (req.headers['x-forwarded-for'] as string) || undefined;

  // Best-effort Turnstile verification (NEVER blocks).
  // Mirrors the existing pattern in publicAuthRoutes.ts:294-317. The OTP code
  // itself is the authentication factor; Turnstile is bonus signal. Blocking
  // on missing/invalid token would lock users out whenever
  // VITE_TURNSTILE_SITE_KEY is unset (PR #447 dependency) — that risk is not
  // acceptable for the primary signup path.
  let captchaSignal: 'turnstile_passed' | 'turnstile_failed' | 'turnstile_absent' = 'turnstile_absent';
  if (turnstileToken) {
    const tr = await verifyTurnstileToken(turnstileToken, callerIp);
    captchaSignal = tr.valid ? 'turnstile_passed' : 'turnstile_failed';
    if (!tr.valid) {
      logger.warn('[auth-sms] Turnstile failed (non-blocking)', { phone: maskPhone(phone), reason: tr.reason });
    }
  }

  try {
    if (isUnifiedVerificationLoginEnabled()) {
      const result = await unifiedVerificationService.startChallenge({
        purpose: 'login',
        channel: 'sms',
        destination: phone,
        payload: { flow, language },
        actor: requestActor(req, body),
      });
      void logAuditEvent({
        actionType: 'SIGNUP_OTP_SENT',
        ip: callerIp, userAgent: req.headers['user-agent'],
        metadata: { method: 'mobile', flow, phone: maskPhone(phone), captchaSignal, runtime: 'unified_verification' },
      });
      return res.status(200).json({
        ok: true,
        message: 'Verification code sent successfully',
        expiresIn: 300,
        flow,
        challengeId: result.challenge.challengeId,
      });
    }

    const result = await twilioSMSService.sendVerificationCode(phone, language, callerIp);
    if (!result.success) {
      const safeCode = result.code || 'SMS_PROVIDER_ERROR';
      const status = statusForSmsFailure(result);
      void logAuditEvent({
        actionType: 'SIGNUP_FAILED',
        ip: callerIp, userAgent: req.headers['user-agent'],
        metadata: {
          step: 'otp_send',
          method: 'mobile',
          flow,
          phone: maskPhone(phone),
          reason: safeCode,
          providerCode: result.providerCode,
          retryable: result.retryable,
        },
        severity: 'warning',
      });
      return res.status(status).json({
        ok: false,
        error: safeCode,
        code: safeCode,
        providerCode: result.providerCode,
        retryable: !!result.retryable,
        message: result.message,
        smsProviderHealthy: false,
        flow,
      });
    }
    void logAuditEvent({
      actionType: 'SIGNUP_OTP_SENT',
      ip: callerIp, userAgent: req.headers['user-agent'],
      metadata: { method: 'mobile', flow, phone: maskPhone(phone), captchaSignal },
    });
    return res.status(200).json({ ok: true, message: result.message, expiresIn: result.expiresIn, flow });
  } catch (err) {
    if (err instanceof UnifiedVerificationError) {
      void logAuditEvent({
        actionType: 'SIGNUP_FAILED',
        ip: callerIp, userAgent: req.headers['user-agent'],
        metadata: { step: 'otp_send', method: 'mobile', flow, phone: maskPhone(phone), reason: err.reasonCode, runtime: 'unified_verification' },
        severity: 'warning',
      });
      return res.status(statusForUnifiedFailure(err)).json({
        ok: false,
        error: err.reasonCode,
        code: err.reasonCode,
        message: err.message,
        smsProviderHealthy: false,
        flow,
      });
    }
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
    if (isUnifiedVerificationLoginEnabled()) {
      const result = await unifiedVerificationService.verifyLatestChallengeForDestination({
        purpose: 'login',
        destination: phone,
        code,
        actor: requestActor(req, body),
      });
      const verificationToken = typeof result.action.verificationToken === 'string'
        ? result.action.verificationToken
        : undefined;
      if (!verificationToken) {
        throw new Error('Unified verification completed without verificationToken');
      }
      void logAuditEvent({
        actionType: 'SIGNUP_AUTH_VERIFIED',
        ip: req.ip, userAgent: req.headers['user-agent'],
        metadata: { method: 'mobile', flow, phone: maskPhone(phone), runtime: 'unified_verification' },
      });
      return res.status(200).json({
        ok: true,
        verificationToken,
        flow,
        redirect: redirectForFlow(flow),
      });
    }

    const result = await twilioSMSService.verifyCode(phone, code, language);
    if (!result.success) {
      void logAuditEvent({
        actionType: 'SIGNUP_FAILED',
        ip: req.ip, userAgent: req.headers['user-agent'],
        metadata: { step: 'otp_verify', method: 'mobile', flow, phone: maskPhone(phone), reason: 'verification_failed', locked: !!result.lockedUntil },
        severity: 'warning',
      });
      return res.status(401).json({
        ok: false,
        error: 'verification_failed',
        message: result.message,
        lockedUntil: result.lockedUntil,
      });
    }
    void logAuditEvent({
      actionType: 'SIGNUP_AUTH_VERIFIED',
      ip: req.ip, userAgent: req.headers['user-agent'],
      metadata: { method: 'mobile', flow, phone: maskPhone(phone) },
    });
    return res.status(200).json({
      ok: true,
      verificationToken: result.verificationToken,
      flow,
      redirect: redirectForFlow(flow),
    });
  } catch (err) {
    if (err instanceof UnifiedVerificationError) {
      void logAuditEvent({
        actionType: 'SIGNUP_FAILED',
        ip: req.ip, userAgent: req.headers['user-agent'],
        metadata: { step: 'otp_verify', method: 'mobile', flow, phone: maskPhone(phone), reason: err.reasonCode, runtime: 'unified_verification' },
        severity: 'warning',
      });
      return res.status(statusForUnifiedFailure(err)).json({
        ok: false,
        error: 'verification_failed',
        reasonCode: err.reasonCode,
        message: err.message,
      });
    }
    logger.error('[auth-sms] verify failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ ok: false, error: 'verification_error' });
  }
});

export default router;
