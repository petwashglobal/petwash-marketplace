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
import { turnstileGuard } from '../lib/turnstileGuard';
import { normalizePhoneE164 } from '../lib/phoneE164';

// Last-4 only — never log a full phone number (PII) or the OTP code.
function maskPhone(phone: unknown): string | undefined {
  return typeof phone === 'string' && phone.length >= 4 ? `••••${phone.slice(-4)}` : undefined;
}

// Server-side phone normalization — DEFENSE IN DEPTH 2026-06-18. The client util
// (client/src/lib/authUtils.ts normalizePhoneE164) is the primary normalizer, but
// not every signup page calls it (SignUpLuxury/SmartSignIn historically didn't), so
// a number like "541234567" (Israeli mobile, no leading 0) reached Twilio as
// "+541234567" → wrong country → code silently never arrived. Normalize here too so
// EVERY entry point is covered. Mirrors the client logic.
//
// 2026-09-05 (auth/identity sprint): the implementation moved to
// server/lib/phoneE164.ts so that the profile / booking-contact writers of
// `users.phone` share ONE normaliser with the login path. Two normalisers meant
// `0541234567` and `+972541234567` produced different `users.phone_hash` values,
// so an OTP login could not find a row written by the profile path. This alias
// is kept so existing call sites in this file stay untouched.
function normalizePhoneServer(raw: string): string {
  return normalizePhoneE164(raw);
}

// All flow values the client actually hands to /api/auth/sms/*.
// Signup-friction audit 2026-08-19 SEV-2 #7: previously only prestige|provider|
// guest were recognized, so 'general' (SignUpLuxury default), 'booking'
// (/booking entry), and 'activation' (AccountActivation) were silently
// bucketed as prestige — the post-verify redirect and every audit-log tag
// then falsely said "prestige signup". The union now mirrors the client's
// Flow union in SignUpLuxury.tsx plus 'activation' from AccountActivation.tsx.
// Grep(client): flow: ['"](prestige|provider|guest|general|booking|activation)
export type AuthFlow = 'prestige' | 'provider' | 'guest' | 'general' | 'booking' | 'activation';

// Post-verify destination per onboarding channel. These are the canonical
// targets from the platform plan; the client navigates here after the session
// cookie is minted via the existing /api/auth/session chain.
const FLOW_REDIRECTS: Record<AuthFlow, string> = {
  // SEV-1 fix (2026-08-20): was '/member/dashboard' — a route that does NOT
  // exist in client/src/App.tsx, so every SMS signup with the default flow
  // (SignUpLuxury's default) landed on a 404 immediately after verify. The
  // canonical members' home is /prestige/home (matches post-login.ts:168,230).
  prestige: '/prestige/home',
  // SEV-1 fix (evil-hunt 2026-08-20): was '/provider/dashboard' — which is
  // only a REDIRECT stub in client/src/App.tsx (→ /provider-os). Round-
  // tripping through a redirect right after the session cookie is minted
  // races the auth guard (wouter renders the redirect before the cookie
  // propagates and the app RequireAuth kicks the user back to /signin).
  // The canonical approved-provider home is /provider-os per post-login.ts:192.
  provider: '/provider-os',
  guest: '/egift',
  // 'booking' users came in from /booking — return them to it after auth so
  // the interrupted booking flow resumes at the step they left it on.
  booking: '/booking',
  // 'activation' users came in from /activate-account (email-first signups
  // finishing the phone half). Return them to complete the second half.
  activation: '/activate-account',
  // 'general' is SignUpLuxury's default when no explicit flow was passed.
  // Pre-fix this was '/' (marketing homepage) — a returning-member SMS login
  // landed on the marketing page instead of their member home. Use /home
  // (existing route in App.tsx:898); the client's post-login coordinator
  // still overrides this with the whoami-based decision when it fires.
  general: '/home',
};
const DEFAULT_FLOW: AuthFlow = 'prestige';

const KNOWN_FLOWS: ReadonlySet<AuthFlow> = new Set<AuthFlow>([
  'prestige',
  'provider',
  'guest',
  'general',
  'booking',
  'activation',
]);

export function normalizeFlow(input: unknown): AuthFlow {
  return typeof input === 'string' && (KNOWN_FLOWS as Set<string>).has(input)
    ? (input as AuthFlow)
    : DEFAULT_FLOW;
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
router.post('/start', turnstileGuard({ action: 'signup_sms_start' }), async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const rawPhone = body.phone;
  const language = typeof body.language === 'string' ? body.language : 'he';
  const flow = normalizeFlow(body.flow);

  if (!rawPhone || typeof rawPhone !== 'string') {
    return res.status(400).json({ ok: false, error: 'phone_required' });
  }
  const phone = normalizePhoneServer(rawPhone);

  const callerIp = req.ip || (req.headers['x-forwarded-for'] as string) || undefined;

  // Bot check ran in turnstileGuard middleware above. When TURNSTILE_SECRET_KEY
  // is configured, an invalid/missing token blocks with 400/403 before this
  // handler runs. When the env is unset the middleware skips + logs a WARN;
  // the /api/health/bot-check endpoint reports the unconfigured state to
  // operators so they can fix it without stranding sign-ins.
  const captchaSignal: 'turnstile_passed' | 'turnstile_absent' =
    (req as any).turnstileVerified === true ? 'turnstile_passed' : 'turnstile_absent';

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
  const rawPhone = body.phone;
  const code = body.code;
  const language = typeof body.language === 'string' ? body.language : 'he';
  const flow = normalizeFlow(body.flow);

  if (!rawPhone || !code || typeof rawPhone !== 'string' || typeof code !== 'string') {
    return res.status(400).json({ ok: false, error: 'phone_and_code_required' });
  }
  // Must match the normalization used in /start so the OTP store key lines up.
  const phone = normalizePhoneServer(rawPhone);

  try {
    if (isUnifiedVerificationLoginEnabled()) {
      const result = await unifiedVerificationService.verifyLatestChallengeForDestination({
        purpose: 'login',
        destination: phone,
        code,
        actor: requestActor(req, body),
      });
      // Defensive: a malformed unified-verification result must surface as a
      // typed, handled error — NOT a generic Error that falls through to a raw 500
      // (which read as "Something went wrong" to the user after a correct code).
      if (!result || !result.action) {
        throw new UnifiedVerificationError(
          'INVALID_VERIFICATION_RESPONSE',
          'Verification could not be completed. Please request a new code and try again.',
          500,
        );
      }
      const verificationToken = typeof result.action.verificationToken === 'string'
        ? result.action.verificationToken
        : undefined;
      if (!verificationToken) {
        throw new UnifiedVerificationError(
          'VERIFICATION_TOKEN_GENERATION_FAILED',
          'Verification could not be completed. Please request a new code and try again.',
          500,
        );
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
