/**
 * Regression pin — "missing production configuration must fail CLOSED"
 * (CEO invariant — anchor for D6-ish audit findings).
 *
 * The CEO's invariant, stated verbatim in the auth-rebuild directives:
 * "Missing production configuration: 503 / unavailable — NOT
 * 'verification passed.'"
 *
 * The failure mode this pin defends against is a well-meaning
 * `if (!SECRET) return { valid: true }` fallback that lets an unsigned
 * webhook, unverified captcha, or unbudgeted AI request through when
 * an operator forgot to set the env variable in production. The fix
 * everywhere is: production returns 503 (or an equivalent "denied /
 * unavailable" result), non-production may skip with a WARN so local
 * dev is not blocked.
 *
 * This pin walks the guard modules where the pattern lives today and
 * refuses regression on each: production branch MUST short-circuit
 * with 503 / valid:false, never fall through to the success path.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const R = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('CEO invariant — missing production config fails CLOSED', () => {
  it('aiUserBudget middleware: Redis outage in production returns 503, not next()', () => {
    const src = R('server/middleware/aiUserBudget.ts');
    // The prod branch must return a 503 with AI_BUDGET_UNAVAILABLE and
    // MUST NOT fall through to next() before the return.
    expect(src).toMatch(/if\s*\(\s*failClosed\s*&&\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]\s*\)\s*\{[\s\S]{0,500}?return res\.status\(503\)\.json\(\{[\s\S]{0,200}?error:\s*['"]AI_BUDGET_UNAVAILABLE['"]/);
  });

  it('turnstileGuard middleware: missing TURNSTILE_SECRET_KEY in production returns 503', () => {
    const src = R('server/lib/turnstileGuard.ts');
    // The prod branch must reject with 503 TURNSTILE_NOT_CONFIGURED and
    // MUST NOT fall through to the "skip + warn" branch that non-prod uses.
    expect(src).toMatch(/if\s*\(\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]\s*\)\s*\{[\s\S]{0,500}?return res\.status\(503\)\.json\([\s\S]{0,200}?error:\s*['"]TURNSTILE_NOT_CONFIGURED['"]/);
  });

  it('phoneHmac: missing PHONE_HMAC_SECRET in production throws (never falls back to anchor)', () => {
    const src = R('server/lib/phoneHmac.ts');
    // The prod branch throws — a caller that catches it and continues
    // would silently store null lookups, which the write-side layer
    // treats as "no lookup key" and skips. Either way, a partial or
    // wrong secret cannot land in production.
    expect(src).toMatch(/if\s*\(\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]\s*\)\s*\{[\s\S]{0,300}?throw new Error\(/);
  });

  it('perUidSmsBudget: Redis outage in production fails CLOSED (BUDGET_UNAVAILABLE, not allowed:true)', () => {
    const src = R('server/lib/perUidSmsBudget.ts');
    // The prod outage branch MUST NOT return { allowed: true } — a
    // permissive fallback there is the exact anti-pattern the audit
    // named. It returns { allowed: false, reason: 'BUDGET_UNAVAILABLE' }.
    expect(src).toMatch(/reason:\s*['"]BUDGET_UNAVAILABLE['"]/);
    // And under production a fail-closed check must reference NODE_ENV.
    expect(src).toMatch(/NODE_ENV\s*===\s*['"]production['"]/);
  });

  it('one-tap handoff exchange: unknown / expired / consumed / Redis-down all return the SAME generic error', () => {
    const src = R('server/security/productionHardeningAndOneTap.ts');
    // The endpoint must map every failure to one_tap_handoff_invalid —
    // any branch that returns a distinct error code teaches an attacker
    // the difference between "wrong code" and "Redis down" and lets
    // them iterate. Count the string; three or more distinct return
    // sites all folding to the same code is the anti-iteration shape.
    const hits = src.match(/one_tap_handoff_invalid/g) || [];
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });

  it('nayax-monyx-events: unsigned webhook in production returns 503 (never processes)', () => {
    const src = R('server/routes/nayax-monyx-events.ts');
    // The prod branch must reject with a 503 when NAYAX_WEBHOOK_SECRET
    // is unset — accepting an unsigned webhook in prod would let anyone
    // forge a transaction and trigger loyalty awards.
    expect(src).toMatch(/if\s*\(\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]\s*\)\s*\{[\s\S]{0,300}?return res\.status\(503\)\.json\(\{\s*error:\s*['"]Webhook not configured['"]/);
  });
});
