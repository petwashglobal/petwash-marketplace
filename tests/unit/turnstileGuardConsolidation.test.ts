/**
 * PR-AUTH-OTP-8 regression pins — Turnstile as the ONE bot check on
 * customer OTP surfaces + retired RegistrationOTPService phone endpoints +
 * production-readiness health reporter.
 *
 * The mapping pass identified three concrete drifts that this PR closes:
 *   1) /api/auth/email/start had NO bot check at all — the only customer
 *      OTP surface unprotected.
 *   2) /api/auth/sms/start ran verifyTurnstileToken advisory-only —
 *      logged failures but never blocked, so a scripted bot could send
 *      unlimited SMS to any number.
 *   3) The RegistrationOTPService endpoints (/api/auth/phone/otp/{send,
 *      resend,verify}) had no client caller in the tree — dead-on-client
 *      but still reachable, doubling the auth surface a security review
 *      has to cover.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PR-AUTH-OTP-8 — turnstileGuard middleware exists with one policy', () => {
  const guard = read('server/lib/turnstileGuard.ts');

  it('exports turnstileGuard(opts) and isTurnstileConfigured()', () => {
    expect(guard).toMatch(/export function turnstileGuard\(opts: TurnstileGuardOptions\)/);
    expect(guard).toMatch(/export function isTurnstileConfigured\(\): boolean/);
  });

  it('SKIPS the check when TURNSTILE_SECRET_KEY is unset (with a WARN)', () => {
    // The CEO's section 20 rule: do not hard-enable enforcement before
    // production configuration is ready. When the env is unset the guard
    // must fall through so sign-ins keep working; the WARN alerts
    // operators, and /api/health/bot-check reports the misconfiguration.
    expect(guard).toMatch(/if \(!isTurnstileConfigured\(\)\) \{/);
    expect(guard).toMatch(/logger\.warn\('\[TurnstileGuard\] TURNSTILE_SECRET_KEY not configured/);
    expect(guard).toMatch(/return next\(\);/);
  });

  it('BLOCKS with 400 TURNSTILE_TOKEN_REQUIRED on missing token when configured', () => {
    // A client that has JavaScript disabled or a scripted caller that
    // skips the widget will land here. 400 is the correct shape (client
    // sent an invalid request), not 403.
    expect(guard).toMatch(/if \(!token\) \{/);
    expect(guard).toMatch(/error: 'TURNSTILE_TOKEN_REQUIRED'/);
    expect(guard).toMatch(/return res\.status\(400\)\.json/);
  });

  it('BLOCKS with 403 TURNSTILE_CHECK_FAILED on invalid token', () => {
    // Verified by Cloudflare and returned invalid → 403. Includes the
    // Cloudflare error code as `reason` so a real user can retry (the
    // widget refresh will mint a fresh token) but a scripted brute-force
    // cannot infer more than "no".
    expect(guard).toMatch(/if \(!result\.valid\) \{/);
    expect(guard).toMatch(/error: 'TURNSTILE_CHECK_FAILED'/);
    expect(guard).toMatch(/return res\.status\(403\)\.json/);
  });

  it('stashes turnstileVerified on the request for downstream audit', () => {
    // Downstream handlers include the signal in their audit log entry
    // without re-verifying (see auth-sms /start).
    expect(guard).toMatch(/\(req as any\)\.turnstileVerified = true;/);
  });
});

describe('PR-AUTH-OTP-8 — canonical OTP endpoints ENFORCE the guard', () => {
  const sms = read('server/routes/auth-sms.ts');
  const email = read('server/routes/auth-email.ts');

  it('/api/auth/sms/start mounts turnstileGuard({action:"signup_sms_start"})', () => {
    // Was: read turnstileToken inline, log-only. Now: middleware runs
    // BEFORE the handler and either passes / 400s / 403s per policy.
    expect(sms).toMatch(
      /router\.post\('\/start', turnstileGuard\(\{ action: 'signup_sms_start' \}\),/,
    );
    // The old advisory-only shape must be gone:
    expect(sms).not.toMatch(/Turnstile failed \(non-blocking\)/);
    expect(sms).not.toMatch(/verifyTurnstileToken\(turnstileToken/);
  });

  it('/api/auth/email/start mounts turnstileGuard({action:"signup_email_start"})', () => {
    // Previously HAD NO BOT CHECK — the biggest gap on the customer
    // OTP surface. The middleware now runs before the handler.
    expect(email).toMatch(
      /router\.post\('\/start', turnstileGuard\(\{ action: 'signup_email_start' \}\),/,
    );
  });

  it('preserves the audit captchaSignal on the SMS /start path', () => {
    // Downstream audit still records whether Turnstile ran — but now the
    // signal is sourced from req.turnstileVerified (set by the guard),
    // not from an inline verify call.
    expect(sms).toMatch(/\(req as any\)\.turnstileVerified === true/);
    expect(sms).toMatch(/captchaSignal/);
  });
});

describe('PR-AUTH-OTP-8 — client sends turnstileToken on the email OTP start', () => {
  const signup = read('client/src/pages/SignUpLuxury.tsx');

  it('sendEmailCode() executes Turnstile and forwards the token', () => {
    // The email start body must carry turnstileToken so the server's
    // enforced guard has a token to verify. Two call sites: the
    // dedicated sendEmailCode function AND the mobile-first-step-2
    // that also opens the email code prompt.
    const emailCalls = signup.match(
      /body: JSON\.stringify\(\{[^}]*turnstileToken:[\s\S]*?\}\)/g,
    ) || [];
    expect(emailCalls.length).toBeGreaterThanOrEqual(2);
    expect(signup).toMatch(/executeTurnstileInvisible\('signup_email_start'\)/);
  });
});

describe('PR-AUTH-OTP-8 — RegistrationOTPService phone endpoints retired', () => {
  const publicAuth = read('server/routes/publicAuthRoutes.ts');

  it('/api/auth/phone/otp/send returns 410 ENDPOINT_RETIRED', () => {
    // Dead on the client — SignUpLuxury moved to /api/auth/sms/* months
    // ago. Retired to 410 Gone so a stray caller sees a loud failure and
    // switches to the canonical surface. The 410 short-circuit sits
    // immediately at the top of the handler (before any of the preserved
    // body). Bind on a 400-char window starting at the router.post
    // signature — enough to see the retirement block, small enough to
    // avoid the rest of the preserved body.
    const send = publicAuth.match(
      /publicAuthRouter\.post\('\/api\/auth\/phone\/otp\/send'[\s\S]{0,400}/,
    );
    expect(send, '/otp/send handler prelude missing').toBeTruthy();
    expect(send![0]).toMatch(/return res\.status\(410\)\.json\(\{/);
    expect(send![0]).toMatch(/error: 'ENDPOINT_RETIRED'/);
    expect(send![0]).toMatch(/Use \/api\/auth\/sms\/start/);
  });

  it('/api/auth/phone/otp/resend returns 410 ENDPOINT_RETIRED', () => {
    const resend = publicAuth.match(
      /publicAuthRouter\.post\('\/api\/auth\/phone\/otp\/resend'[\s\S]{0,400}/,
    );
    expect(resend, '/otp/resend handler prelude missing').toBeTruthy();
    expect(resend![0]).toMatch(/return res\.status\(410\)\.json\(\{/);
    expect(resend![0]).toMatch(/error: 'ENDPOINT_RETIRED'/);
  });

  it('/api/auth/phone/otp/verify returns 410 ENDPOINT_RETIRED (points at /sms/verify)', () => {
    const verify = publicAuth.match(
      /publicAuthRouter\.post\('\/api\/auth\/phone\/otp\/verify'[\s\S]{0,400}/,
    );
    expect(verify, '/otp/verify handler prelude missing').toBeTruthy();
    expect(verify![0]).toMatch(/return res\.status\(410\)\.json\(\{/);
    expect(verify![0]).toMatch(/Use \/api\/auth\/sms\/verify/);
  });
});

describe('PR-AUTH-OTP-8 — production-readiness reporter', () => {
  const index = read('server/index.ts');
  // Isolate the bot-check handler by binding to a tight window starting at
  // the app.get signature — enough to see the whole res.json body without
  // pulling in the adjacent /health/strict handler that greedy [\s\S]*?
  // would otherwise sweep in.
  const botCheckHandler = (() => {
    const startIdx = index.indexOf(`app.get('/api/health/bot-check'`);
    if (startIdx === -1) return null;
    return index.slice(startIdx, startIdx + 2000);
  })();

  it('exposes GET /api/health/bot-check returning turnstileServerConfigured as a BOOLEAN', () => {
    // Ops runs this before flipping enforcement live. Response fields are
    // strict booleans and status labels — NEVER the key values themselves.
    // The boolean coercion may be declared as a local const OR inlined in
    // the response object; both shapes are safe as long as the response
    // ships a boolean and the coercion uses `!!`.
    expect(botCheckHandler, 'bot-check handler missing').toBeTruthy();
    expect(botCheckHandler!).toMatch(/!!process\.env\.TURNSTILE_SECRET_KEY/);
    expect(botCheckHandler!).toMatch(/turnstileServerConfigured/);
    expect(botCheckHandler!).toMatch(/enforcementActive/);
    expect(botCheckHandler!).toMatch(/status: enforcementActive \? 'READY' : 'ADVISORY'/);
  });

  it('never echoes secret values in the response body', () => {
    // The CEO's rule (section 20): do not expose key VALUES. Env NAMES
    // may appear in operator-facing notes — that's how ops knows what to
    // configure. This test verifies no VALUE (raw or interpolated) can
    // leak: (a) no template string reads the secret env, and (b) the
    // response body never assigns the secret env's value to a field.
    expect(botCheckHandler, 'bot-check handler missing').toBeTruthy();
    expect(botCheckHandler!).not.toMatch(/\$\{[^}]*process\.env\.TURNSTILE_SECRET_KEY/);
    const responseBody = botCheckHandler!.match(/res\.status\(\d+\)\.json\(\{[\s\S]*?\}\);/);
    expect(responseBody, 'json response body missing').toBeTruthy();
    // No raw process.env read in the body — only pre-coerced local flags
    // and pre-built label strings.
    expect(responseBody![0]).not.toMatch(/process\.env\.TURNSTILE_SECRET_KEY(?!,)/);
    // Boolean coercion must be present in the handler:
    expect(botCheckHandler!).toMatch(/!!process\.env\.TURNSTILE_SECRET_KEY/);
  });

  it('names the protected surfaces so ops can verify the enforcement footprint', () => {
    expect(botCheckHandler, 'bot-check handler missing').toBeTruthy();
    expect(botCheckHandler!).toMatch(/'signup_sms_start'/);
    expect(botCheckHandler!).toMatch(/'signup_email_start'/);
  });
});
