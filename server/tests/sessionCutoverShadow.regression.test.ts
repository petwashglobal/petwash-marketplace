/**
 * Regression pin — Pet Wash session cutover Phase 3.c.1 + 3.c.2.
 *
 * Guardrails on the dual-cookie staged rollout:
 *
 *   1. Two new flags exist and default OFF:
 *        ff.returning_user.sessions_owned.emit_cookie
 *        ff.returning_user.sessions_owned.shadow_verify
 *   2. Cookie emission (in routes.ts) is:
 *        - gated on emit_cookie
 *        - HttpOnly: true
 *        - SameSite: 'lax'
 *        - Secure toggled by NODE_ENV === 'production'
 *        - Uses cookie name 'pw_session_id' (distinct from Firebase's
 *          '__session' and from the legacy alias 'pw_session')
 *   3. shadow-verify middleware:
 *        - Never throws — every branch wrapped in try/catch
 *        - Never logs the raw session id — only hash prefix
 *        - Never logs full UIDs — only truncated prefix
 *        - Observation only in 3.c.2 (no res.status(401) exists)
 *        - Uses SHA-256 hashPrefix for correlation, not the raw cookie
 *   4. validateFirebaseToken invokes runSessionShadowCompareInline
 *      but wraps in try/catch so a shadow error never blocks auth.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const cfg = readFileSync(join(ROOT, 'server/services/SystemConfig.ts'), 'utf8');
const routes = readFileSync(join(ROOT, 'server/routes.ts'), 'utf8');
const shadow = readFileSync(join(ROOT, 'server/middleware/sessionShadowVerify.ts'), 'utf8');
const fbAuth = readFileSync(join(ROOT, 'server/middleware/firebase-auth.ts'), 'utf8');

describe('session cutover Phase 3.c — shadow observation', () => {
  it('SystemConfig declares emit_cookie + shadow_verify flags, default OFF', () => {
    expect(cfg).toMatch(/'ff\.returning_user\.sessions_owned\.emit_cookie':\s*boolean;/);
    expect(cfg).toMatch(/'ff\.returning_user\.sessions_owned\.shadow_verify':\s*boolean;/);
    // Defaults are false in the DEFAULTS block.
    expect(cfg).toMatch(/'ff\.returning_user\.sessions_owned\.emit_cookie':\s*false,/);
    expect(cfg).toMatch(/'ff\.returning_user\.sessions_owned\.shadow_verify':\s*false,/);
  });

  it('cookie emission is HttpOnly + Secure-in-prod + SameSite lax + gated by flag', () => {
    // The emit block must be gated by the emit_cookie flag.
    expect(routes).toMatch(/getFeatureFlag\(['"]ff\.returning_user\.sessions_owned\.emit_cookie['"]\)/);
    // The res.cookie call must use the right options.
    const emitBlock = routes.match(/res\.cookie\(['"]pw_session_id['"][\s\S]{0,600}?\}\);/);
    expect(emitBlock, 'pw_session_id cookie emission must exist').toBeTruthy();
    expect(emitBlock![0]).toMatch(/httpOnly:\s*true/);
    expect(emitBlock![0]).toMatch(/sameSite:\s*['"]lax['"]/);
    expect(emitBlock![0]).toMatch(/secure:\s*isProd/);
    expect(emitBlock![0]).toMatch(/path:\s*['"]\/['"]/);
  });

  it('shadow-verify middleware never logs raw session id or full UID', () => {
    // Only prefixed correlation values may appear in log meta objects.
    expect(shadow).toMatch(/function hashPrefix/);
    expect(shadow).toMatch(/function uidPrefix/);
    // The logger meta blocks — every logger.error that names
    // SECURITY_SESSION_MISMATCH must reference the prefix helpers,
    // not raw values. We iterate over all matches (there are two:
    // one in the middleware, one in the inline flavour).
    const mismatchCalls = [...shadow.matchAll(
      /logger\.error\(\s*['"][^'"]*SECURITY_SESSION_MISMATCH[^'"]*['"][\s\S]*?\}\s*\);/g,
    )];
    expect(mismatchCalls.length).toBeGreaterThanOrEqual(1);
    for (const call of mismatchCalls) {
      const block = call[0];
      expect(block).toMatch(/sessionHashPrefix:\s*hashPrefix\(/);
      expect(block).toMatch(/pwUidPrefix:\s*uidPrefix\(/);
      // MUST NOT log raw values.
      expect(block.includes('raw:')).toBe(false);
      expect(/uid:\s*firebaseUid/.test(block)).toBe(false);
      expect(/userId:\s*pw\.userId/.test(block)).toBe(false);
    }
  });

  it('shadow module itself never sends 401 — deny is signalled to caller via authorityDeny', () => {
    // The middleware / inline helper MUST NOT call res.status(…) —
    // even when authority mode wants to fail-CLOSED, that decision is
    // signalled back to validateFirebaseToken (which owns the 401
    // response shape). This keeps the shadow module test-friendly
    // (a pure compare function).
    expect(/res\.status\(/.test(shadow)).toBe(false);
    // But the module MUST expose the authority signal so callers
    // can act on it.
    expect(shadow).toMatch(/authorityDeny/);
    expect(shadow).toMatch(/getFeatureFlag\(\s*['"]ff\.returning_user\.sessions_owned\.authority['"]\s*\)/);
    // And the SECURITY_SESSION_AUTHORITY_DROP event fires only inside
    // the authority-on branch.
    expect(shadow).toMatch(/SECURITY_SESSION_AUTHORITY_DROP/);
  });

  it('validateFirebaseToken honours authorityDeny with a 401 SESSION_AUTHORITY_SKEW', () => {
    // The Firebase middleware is the ONE place we translate the
    // authority signal into an HTTP response — this pin makes sure
    // the translation exists and cannot regress to a silent pass.
    expect(fbAuth).toMatch(/result\?\.authorityDeny/);
    expect(fbAuth).toMatch(/error:\s*['"]SESSION_AUTHORITY_SKEW['"]/);
    expect(fbAuth).toMatch(/status\(401\)/);
  });

  it('shadow module never throws (every entry point is try/catch wrapped)', () => {
    // Both exported flavours must have a try/catch guarding the body.
    const inline = shadow.match(/export async function runSessionShadowCompareInline[\s\S]*?\n\}/);
    expect(inline).toBeTruthy();
    expect(inline![0]).toMatch(/try\s*\{/);
    expect(inline![0]).toMatch(/catch/);

    const mw = shadow.match(/export function sessionShadowVerify\(\)[\s\S]*?\n\}/);
    expect(mw).toBeTruthy();
    expect(mw![0]).toMatch(/try\s*\{/);
    expect(mw![0]).toMatch(/catch/);
  });

  it('validateFirebaseToken invokes shadow compare in an isolated try/catch', () => {
    // The call must exist AND be in a try/catch so a shadow error never
    // blocks Firebase auth.
    expect(fbAuth).toMatch(/runSessionShadowCompareInline\(req\)/);
    const call = fbAuth.match(/try\s*\{[\s\S]{0,500}?runSessionShadowCompareInline[\s\S]{0,300}?\}\s*catch/);
    expect(call, 'runSessionShadowCompareInline call must be try/catch wrapped').toBeTruthy();
  });
});
