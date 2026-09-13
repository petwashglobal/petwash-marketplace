/**
 * P0-142 CEO fix — PIN authentication lifecycle regression pin.
 *
 * These are source-pin assertions (not behavioural — no full express
 * app boot). They lock in the security contract so a future refactor
 * cannot silently re-open the pre-fix holes:
 *
 *   - /setup /change /remove /status now require Firebase Bearer.
 *   - Zod schemas for those routes have NO `email` field — identity
 *     is derived from the decoded token, never trusted from body.
 *   - /setup is CREATE ONLY (409 PIN_ALREADY_EXISTS).
 *   - /change requires currentPin + newPin, no email.
 *   - /remove requires current PIN in body.
 *   - Client Settings.tsx no longer sends `email` on any of these
 *     four endpoints, has explicit change/remove flows, and no longer
 *     silently uses setup as a change path.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SERVER = readFileSync(resolve(__dirname, '..', 'routes', 'pin-auth.ts'), 'utf8');
const CLIENT = readFileSync(
  resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'Settings.tsx'),
  'utf8',
);

// 2026-09-13 — re-pinned against the CURRENT design. Three same-day PRs
// (#1820, #1870, #1947) collided; 18 of these assertions pinned helper names and
// UI step names that no longer exist, so the whole file sat in the red baseline
// and guarded nothing. While re-pinning, two real regressions were found and
// fixed in pin-auth.ts: /setup silently OVERWROTE an active PIN (no currentPin),
// and the auth path did SELECT * on users. The security intent below is #1820's.

const handler = (anchor: string, len = 2600) => {
  const idx = SERVER.indexOf(anchor);
  expect(idx, anchor).toBeGreaterThan(-1);
  return SERVER.slice(idx, idx + len);
};

describe('server — a body email can never select the account', () => {
  it('identity comes only from the verified token (resolvePinIdentityFromRequest reads req.firebaseUser)', () => {
    const start = SERVER.indexOf('export async function resolvePinIdentityFromRequest');
    const fn = SERVER.slice(start, SERVER.indexOf('\n}\n', start));
    expect(fn).toContain('req.firebaseUser?.uid');
    expect(fn).not.toMatch(/req\.body|req\.query/);
  });

  for (const [name, anchor] of [['setup', "router.post('/setup'"], ['change', "router.post('/change'"], ['remove', "router.delete('/remove'"]] as const) {
    it(`${name}: a body email that differs from the token is refused BEFORE identity/DB access`, () => {
      const region = handler(anchor);
      const conflictAt = region.indexOf('bodyEmailConflictsWithToken(req, email)');
      const resolveAt = region.indexOf('resolvePinIdentityFromRequest(req)');
      const dbAt = region.indexOf('await db.');
      expect(conflictAt).toBeGreaterThan(-1);
      expect(resolveAt).toBeGreaterThan(conflictAt);
      if (dbAt > -1) expect(dbAt).toBeGreaterThan(resolveAt);
      expect(region.slice(0, resolveAt)).not.toMatch(/findUserByEmail\(/);
    });
  }

  it('status resolves identity from the token and never reads an email param', () => {
    const idx = SERVER.indexOf("router.get('/status'");
    const region = SERVER.slice(idx, SERVER.indexOf('});', idx) + 4);
    expect(region).toContain('resolvePinIdentityFromRequest(req)');
    expect(region).not.toMatch(/req\.query\.email|req\.body\.email/);
  });

  it('change and remove require the CURRENT pin', () => {
    const change = SERVER.slice(SERVER.indexOf('const changePinSchema = z.object({'), SERVER.indexOf('});', SERVER.indexOf('const changePinSchema = z.object({')));
    expect(change).toMatch(/currentPin:\s*z\.string\(\)/);
    expect(change).toMatch(/newPin:\s*z\.string\(\)/);
    expect(handler("router.delete('/remove'")).toContain('removePinSchema.safeParse');
  });
});

describe('server — /setup is CREATE ONLY for an active PIN (409 PIN_ALREADY_EXISTS)', () => {
  it('refuses to overwrite an active PIN; only a removed (inactive) row is re-activated', () => {
    const region = handler("router.post('/setup'", 4000);
    expect(region).toMatch(/if \(existingPin && existingPin\.isActive\) \{\s*return res\.status\(409\)/);
    expect(region).toContain("code: 'PIN_ALREADY_EXISTS'");
    const guardAt = region.indexOf('existingPin.isActive');
    const updateAt = region.indexOf('await db.update(userPins)');
    expect(updateAt).toBeGreaterThan(guardAt);
  });
});

describe('client Settings.tsx — PIN lifecycle', () => {
  const idx = CLIENT.indexOf('function PinSecuritySection');
  const region = CLIENT.slice(idx, CLIENT.indexOf('function SettingsControlMap'));

  it('no request body to pin-auth contains email', () => {
    const bodies = region.match(/JSON\.stringify\(\{[\s\S]{0,400}?\}\)/g) || [];
    expect(bodies.length).toBeGreaterThan(0);
    for (const b of bodies) expect(b).not.toMatch(/\bemail\b/);
  });

  it('Change goes current → new through /change with { currentPin, newPin }', () => {
    expect(region).toContain("setFlow('change-current')");
    expect(region).toContain("flow === 'change-new'");
    expect(region).toContain("authedFetch('/api/pin-auth/change'");
    expect(region).toContain('JSON.stringify({ currentPin, newPin })');
  });

  it('Set PIN (/setup) is offered only when no PIN exists', () => {
    const hasPinAt = region.indexOf('pinStatus?.hasPin ?');
    const changeAt = region.indexOf("setFlow('change-current')");
    const setupAt = region.indexOf("setFlow('setup')");
    expect(hasPinAt).toBeGreaterThan(-1);
    expect(changeAt).toBeGreaterThan(hasPinAt);
    expect(setupAt).toBeGreaterThan(changeAt); // the ": else" (no PIN) branch
  });

  it('Remove sends { pin } via DELETE', () => {
    const r = region.slice(region.indexOf("authedFetch('/api/pin-auth/remove'"));
    expect(r.slice(0, 200)).toContain("method: 'DELETE'");
    expect(r.slice(0, 200)).toContain('JSON.stringify({ pin })');
  });
});

describe('server — /verify requires Bearer and refuses a mismatched email', () => {
  it('verifies the ID token and 403s EMAIL_MISMATCH', () => {
    const region = handler("router.post('/verify'", 4000);
    expect(region).toContain('verifyIdToken');
    expect(region).toMatch(/email\.toLowerCase\(\) !== decodedToken\.email\.toLowerCase\(\)/);
    expect(region).toContain("code: 'EMAIL_MISMATCH'");
  });
});

describe('server — no raw email in PIN logs', () => {
  it('every [PIN Auth] logger.info bag omits email', () => {
    const lines = SERVER.split('\n').filter((l) => l.includes("logger.info('[PIN Auth]"));
    expect(lines.length).toBeGreaterThan(3);
    for (const l of lines) expect(l, l.trim()).not.toMatch(/\bemail\b/);
  });
});
