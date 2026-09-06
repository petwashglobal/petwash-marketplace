/**
 * Turnstile bot-check guard — one policy, one middleware.
 *
 * Applied to the customer OTP / signup surfaces the MASTER AUTH contract
 * requires: signup init, SMS OTP start, email OTP start, high-risk resend,
 * password-recovery start. One helper so the enforcement policy lives in
 * exactly one place and cannot drift between endpoints.
 *
 * Enforcement policy — deliberately conservative so a missing env cannot
 * lock every user out of the primary signup path:
 *
 *   1) TURNSTILE_SECRET_KEY unset       → SKIP the check, log a WARN.
 *      Production readiness endpoint reports the misconfiguration so
 *      operators can fix it, but sign-in continues to work. The CEO's
 *      section 20 rule "do not hard-enable enforcement before production
 *      configuration is ready" applies here.
 *
 *   2) TURNSTILE_SECRET_KEY set + client sent NO token → 400 with
 *      TURNSTILE_TOKEN_REQUIRED. The client widget is armed in
 *      TurnstileWidget.tsx / executeTurnstileInvisible; a missing token
 *      is a client bug or a scripted bot skipping the widget.
 *
 *   3) TURNSTILE_SECRET_KEY set + Turnstile verify says invalid → 403
 *      with TURNSTILE_CHECK_FAILED (includes Cloudflare error code as
 *      `reason` so a real user can retry / a bot cannot brute-force
 *      by inspecting the response shape).
 *
 * Body field: `turnstileToken` (already the convention across the
 * codebase — see SignUpLuxury.tsx executeTurnstileInvisible callers).
 *
 * SPECIFICITY: the middleware accepts an `action` label used by
 * Turnstile's `action` telemetry and included in the audit log entry.
 * Different endpoints ("signup_sms_start", "signup_email_start",
 * "password_reset_start") should pass distinct labels so the
 * Cloudflare console can slice failure rates per surface.
 */
import type { Request, Response, NextFunction } from 'express';
import { verifyTurnstileToken } from './verifyTurnstile';
import { logger } from './logger';

export interface TurnstileGuardOptions {
  /** Cloudflare `action` telemetry label — pick a unique short slug per endpoint. */
  action: string;
  /**
   * Which body/header field carries the token. Defaults to `turnstileToken`
   * (the codebase-wide convention).
   */
  tokenField?: string;
}

export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

/**
 * TURNSTILE HAS TWO HALVES AND BOTH MUST SHIP TOGETHER.
 *
 *   TURNSTILE_SECRET_KEY      server runtime (Cloud Run env / Secret Manager)
 *   VITE_TURNSTILE_SITE_KEY   client BUILD time (compiled into the bundle)
 *
 * Setting only the secret does not restore service. The browser cannot mint a
 * token without the site key — Vite folds the widget away at build time and
 * executeTurnstileInvisible() returns SITE_KEY_MISSING — so the guard moves
 * from 503 TURNSTILE_NOT_CONFIGURED to 400 TURNSTILE_TOKEN_REQUIRED and the
 * surface stays dead. Observed exactly this way in production on 2026-09-06:
 * neither half had ever been provisioned after the Replit -> Cloud Run
 * migration (see the note in .github/workflows/petwash-ci.yml).
 *
 * A VITE_* value is baked into the bundle, so adding it to Cloud Run after the
 * client is built changes nothing — the client must be REBUILT.
 */

export function turnstileGuard(opts: TurnstileGuardOptions) {
  const tokenField = opts.tokenField ?? 'turnstileToken';
  return async function turnstileGuardMiddleware(req: Request, res: Response, next: NextFunction) {
    // AUDIT-SMS-6 (2026-09-01): env-not-configured MUST fail CLOSED in
    // production. The prior behaviour was SKIP + WARN — meaning a
    // missing TURNSTILE_SECRET_KEY silently bypassed bot-checks on
    // every signup / OTP / password-reset surface. A deploy that
    // dropped the secret would look green from the outside while the
    // entire bot floor was open.
    //
    // In production → 503 TURNSTILE_NOT_CONFIGURED so the surface
    // stops accepting requests until ops fixes the env.
    // Outside production → keep skip+warn so local dev / preview
    // environments don't require the secret. NODE_ENV is the same
    // signal every other prod-only gate uses (see server/index.ts
    // CSRF secret enforcement).
    if (!isTurnstileConfigured()) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('[TurnstileGuard] TURNSTILE_SECRET_KEY missing in production — failing CLOSED', {
          action: opts.action,
        });
        return res.status(503).json({
          ok: false,
          error: 'TURNSTILE_NOT_CONFIGURED',
          action: opts.action,
        });
      }
      logger.warn('[TurnstileGuard] TURNSTILE_SECRET_KEY not configured — check skipped (non-prod)', {
        action: opts.action,
      });
      return next();
    }

    const rawToken = (req.body ?? {})[tokenField];
    const token = typeof rawToken === 'string' ? rawToken.trim() : '';
    if (!token) {
      logger.warn('[TurnstileGuard] Token missing on protected surface', { action: opts.action });
      return res.status(400).json({
        ok: false,
        error: 'TURNSTILE_TOKEN_REQUIRED',
        action: opts.action,
      });
    }

    const callerIp = req.ip || (req.headers['x-forwarded-for'] as string) || undefined;
    const result = await verifyTurnstileToken(token, callerIp);
    if (!result.valid) {
      logger.warn('[TurnstileGuard] Token rejected', {
        action: opts.action,
        reason: result.reason,
      });
      return res.status(403).json({
        ok: false,
        error: 'TURNSTILE_CHECK_FAILED',
        reason: result.reason,
        action: opts.action,
      });
    }

    // Stash the pass on the request so downstream handlers can include the
    // signal in their audit log without re-verifying.
    (req as any).turnstileVerified = true;
    (req as any).turnstileAction = opts.action;
    next();
  };
}
