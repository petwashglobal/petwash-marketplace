/**
 * PR-AUTH-SECURITY-9 §3 — regression: user A cannot touch user B's PIN
 * via any body/query parameter. Identity comes from the Firebase Bearer token.
 *
 * These are FILE-LEVEL regressions (do not require a running server) that
 * pin the SHAPE of the pin-auth router: no body.email destructure on
 * setup/change/remove/status, an authoritative resolveAuthedUser choke-point,
 * and a client component that never forwards email/userId.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

describe('PR-AUTH-SECURITY-9 §3 — PIN lifecycle: A cannot touch B', () => {
  const pinAuth = read('server/routes/pin-auth.ts');
  const settings = read('client/src/pages/Settings.tsx');

  it('server defines the authoritative resolveAuthedUser choke-point', () => {
    expect(pinAuth).toMatch(/async function resolveAuthedUser\(/);
    expect(pinAuth).toMatch(/firebaseAdminAuth\.verifyIdToken\(idToken, true\)/);
    expect(pinAuth).toMatch(/return\s*\{\s*uid: decoded\.uid,\s*email: decoded\.email\?\.toLowerCase\(\)/);
  });

  it('server /setup does NOT destructure email from body', () => {
    // Match the /setup handler body only.
    const setupBlock = pinAuth.match(/router\.post\('\/setup'[\s\S]*?}\);\n/);
    expect(setupBlock).toBeTruthy();
    expect(setupBlock![0]).not.toMatch(/req\.body\.email/);
    expect(setupBlock![0]).not.toMatch(/const\s*\{\s*[^}]*\bemail\b/);
    expect(setupBlock![0]).toMatch(/resolveAuthedUser\(req, res\)/);
  });

  it('server /change does NOT destructure email from body', () => {
    const changeBlock = pinAuth.match(/router\.post\('\/change'[\s\S]*?}\);\n/);
    expect(changeBlock).toBeTruthy();
    expect(changeBlock![0]).not.toMatch(/req\.body\.email/);
    expect(changeBlock![0]).not.toMatch(/const\s*\{\s*[^}]*\bemail\b/);
    expect(changeBlock![0]).toMatch(/resolveAuthedUser\(req, res\)/);
  });

  it('server /remove does NOT read email from body or query', () => {
    const removeBlock = pinAuth.match(/router\.delete\('\/remove'[\s\S]*?}\);\n/);
    expect(removeBlock).toBeTruthy();
    expect(removeBlock![0]).not.toMatch(/req\.body\.email/);
    expect(removeBlock![0]).not.toMatch(/req\.query\.email/);
    expect(removeBlock![0]).toMatch(/resolveAuthedUser\(req, res\)/);
  });

  it('server /status does NOT read email from query', () => {
    const statusBlock = pinAuth.match(/router\.get\('\/status'[\s\S]*?}\);\n/);
    expect(statusBlock).toBeTruthy();
    expect(statusBlock![0]).not.toMatch(/req\.query\.email/);
    expect(statusBlock![0]).not.toMatch(/req\.body\.email/);
    expect(statusBlock![0]).toMatch(/resolveAuthedUser\(req, res\)/);
  });

  it('server /verify still requires body.email BUT enforces token match', () => {
    const verifyBlock = pinAuth.match(/router\.post\('\/verify'[\s\S]*?}\);\n/);
    expect(verifyBlock).toBeTruthy();
    // Must call resolveAuthedUser then require email.toLowerCase() === authed.email.
    expect(verifyBlock![0]).toMatch(/resolveAuthedUser\(req, res\)/);
    expect(verifyBlock![0]).toMatch(/email\.toLowerCase\(\)\s*!==\s*authed\.email/);
    expect(verifyBlock![0]).toMatch(/EMAIL_MISMATCH/);
  });

  it('server /setup is CREATE-ONLY: 409 PIN_ALREADY_EXISTS when a PIN is active', () => {
    expect(pinAuth).toMatch(/status\(409\)[^}]*PIN_ALREADY_EXISTS/);
  });

  it('server logger lines carry userId (not email)', () => {
    // Regressive: PII-safe. The old code logged { userId, email }; the new logs userId only.
    expect(pinAuth).not.toMatch(/logger\.info\([^)]*'\[PIN Auth\][^)]*email\s*[,}]/);
  });

  it('client Settings.tsx does NOT put email in any /api/pin-auth/* body', () => {
    // Find every fetch() call to /api/pin-auth/* and check its body has no email/userId.
    const calls = settings.matchAll(/getApiUrl\('\/api\/pin-auth\/[a-z-]+'\)[\s\S]{0,600}?body:\s*JSON\.stringify\(([\s\S]*?)\)/g);
    let n = 0;
    for (const m of calls) {
      n++;
      const body = m[1];
      expect(body).not.toMatch(/\bemail\b/);
      expect(body).not.toMatch(/\buserId\b/);
    }
    expect(n).toBeGreaterThan(0);
  });

  it('client never sends email as a query parameter to pin-auth', () => {
    expect(settings).not.toMatch(/\/api\/pin-auth\/status\?email=/);
    expect(settings).not.toMatch(/\/api\/pin-auth\/[a-z-]+\?email=/);
  });

  it('client uiMode splits the three flows (setup / change / remove)', () => {
    expect(settings).toMatch(/uiMode.*'idle'\s*\|\s*'setup'\s*\|\s*'change'\s*\|\s*'remove'/);
    expect(settings).toMatch(/setUiMode\('change'\)/);
    expect(settings).toMatch(/setUiMode\('remove'\)/);
  });
});
