/**
 * Turnstile circuit breaker — "our own widget is broken" detection.
 *
 * WHY THIS EXISTS (2026-09-19, found live on petwash.co.il):
 *   Cloudflare answered `error 600010` for the site key baked into the
 *   production bundle: the key does not list petwash.co.il among its allowed
 *   domains. A visitor's browser therefore CANNOT mint a token, however many
 *   times they retry. executeTurnstileInvisible() returns ok:false, the client
 *   posts an empty turnstileToken, and turnstileGuard answers
 *   400 TURNSTILE_TOKEN_REQUIRED.
 *
 *   Measured on production that day: POST /api/auth/sms/start,
 *   /api/auth/email/start and /api/contact all refused every caller. Signup by
 *   phone, signup by email, the gift-card purchase, the Privilege signup, the
 *   onboarding verification and the contact form were all dead. Google
 *   sign-in, which needs no token, was the only working door — which is
 *   exactly what ~1 signup a week looks like.
 *
 *   turnstileGuard's own docstring states the design intent: "deliberately
 *   conservative so a missing env cannot lock every user out of the primary
 *   signup path". A site key that Cloudflare rejects locks every user out just
 *   as completely as a missing env, and nothing detected it.
 *
 * WHAT IT DOES
 *   It watches the outcome of every guarded attempt. If enough attempts in a row
 *   produce NOT ONE valid token, the only consistent explanation is that our own
 *   widget cannot mint tokens — real traffic always produces some passes. The breaker then OPENS: guarded requests are allowed
 *   through, tagged `turnstileDegraded`, and an alert is raised. The bot floor
 *   is not removed — the auth and OTP rate limiters on those mounts still
 *   apply, and every degraded request is marked for audit.
 *
 *   The instant one valid token arrives, the breaker CLOSES again. So once the
 *   Cloudflare domain list is fixed, this code stops having any effect on its
 *   own, and it can never open while real users are passing the check.
 *
 * DELIBERATE LIMITS
 *   - A flood of token-less requests can open the breaker. That is a real
 *     trade-off, and it is the better side of it: today the gate is shut to
 *     100% of humans, and an attacker still faces authLimiter + otpLimiter.
 *   - It never opens when TURNSTILE_SECRET_KEY is unset — that path is
 *     unchanged and still fails closed in production.
 *   - TURNSTILE_BREAKER=off disables it entirely.
 */
import { logger } from './logger';

/**
 * NO TIME WINDOW. An earlier draft of this file tripped on "10 attempts inside
 * 15 minutes with no pass". On this site that threshold can never be reached —
 * production sees roughly one signup a week — so the breaker would have stayed
 * shut forever and nobody would have been unblocked. What matters is not how
 * many attempts arrive per hour, it is whether ANY of them can mint a token.
 *
 * So we count consecutive token-less attempts SINCE THE LAST VALID TOKEN, at
 * whatever pace they arrive, and we treat a process that has never seen a
 * single valid token differently from one that has.
 */

/** The widget has never worked here — a handful of misses is already proof. */
const COLD_MISSES = 5;
/** It worked before, so demand much stronger evidence before opening. */
const WARM_MISSES = 25;
/** Re-alert at most this often while open. */
const ALERT_EVERY_MS = 15 * 60 * 1000;

let everPassed = false;
let missesSinceLastPass = 0;
let openedAt: number | null = null;
let lastAlertAt = 0;

export function breakerEnabled(): boolean {
  return (process.env.TURNSTILE_BREAKER || '').toLowerCase() !== 'off';
}

/** Record one guarded attempt. `outcome` is what the guard actually observed. */
export function recordAttempt(outcome: 'pass' | 'missing' | 'invalid'): void {
  if (outcome === 'pass') {
    everPassed = true;
    missesSinceLastPass = 0;
    if (openedAt !== null) {
      logger.info('[TurnstileBreaker] a valid token arrived — closing, bot check enforced again');
      openedAt = null;
    }
    return;
  }
  // A forged-but-invalid token is a bot, not a broken widget: a broken widget
  // produces NOTHING. Only empty tokens count towards opening.
  if (outcome === 'missing') missesSinceLastPass += 1;
}

/**
 * Should this request be let through even though it has no usable token?
 * True only when the evidence says OUR widget is broken, not this caller.
 */
export function shouldBypass(now: number = Date.now()): boolean {
  if (!breakerEnabled()) return false;
  if (openedAt !== null) return true;
  const needed = everPassed ? WARM_MISSES : COLD_MISSES;
  if (missesSinceLastPass >= needed) {
    openedAt = now;
    return true;
  }
  return false;
}

/** True while the breaker is open — for the readiness endpoint and admin. */
export function isDegraded(): boolean {
  return openedAt !== null;
}

export function shouldAlertNow(now: number = Date.now()): boolean {
  if (openedAt === null) return false;
  if (now - lastAlertAt < ALERT_EVERY_MS) return false;
  lastAlertAt = now;
  return true;
}

/** Test seam only. */
export function __resetBreakerForTests(): void {
  everPassed = false;
  missesSinceLastPass = 0;
  openedAt = null;
  lastAlertAt = 0;
}

/**
 * For surfaces that call verifyTurnstileToken directly instead of going
 * through turnstileGuard — the guest gift-card purchase is the important one,
 * because it is a live money path and it refused every caller on 2026-09-19
 * with 403 BOT_CHECK for exactly the same reason.
 *
 * Returns whether the request may proceed, and whether it did so only because
 * the breaker is open (so the caller can tag it for audit).
 */
export async function checkTurnstileWithBreaker(
  token: string,
  ip: string | undefined,
  verify: (t: string, ip?: string) => Promise<{ valid: boolean; reason?: string }>,
): Promise<{ ok: boolean; degraded: boolean; reason?: string }> {
  const trimmed = (token || '').trim();
  if (!trimmed) {
    recordAttempt('missing');
    if (shouldBypass()) return { ok: true, degraded: true, reason: 'widget_unavailable' };
    return { ok: false, degraded: false, reason: 'missing' };
  }
  const result = await verify(trimmed, ip).catch(() => ({ valid: false, reason: 'error' }));
  recordAttempt(result.valid ? 'pass' : 'invalid');
  // 'not_configured' keeps its existing meaning: the server half is absent.
  if (result.valid || result.reason === 'not_configured') {
    return { ok: true, degraded: false, reason: result.reason };
  }
  return { ok: false, degraded: false, reason: result.reason };
}
