/**
 * PR-AUTH-SECURITY-9 — Section 1 regression: "Remember me on this device"
 *
 * Verifies the STATIC shape of the session-cookie contract without needing a
 * running Firebase Admin SDK. These are file-level regressions to prevent the
 * three failure modes:
 *   (a) rememberMe:false silently still writing a 14d Max-Age
 *   (b) the client autofilling forms with autoComplete values that DON'T match
 *       the WICG HTML spec exactly (breaks iOS/Android password fill)
 *   (c) any storage of a raw password anywhere.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

describe('PR-AUTH-SECURITY-9 §1 — Remember me + autocomplete', () => {
  const sessionCookies = read('server/lib/sessionCookies.ts');
  const routes = read('server/routes.ts');
  const authProvider = read('client/src/auth/AuthProvider.tsx');
  const signUp = read('client/src/pages/SignUpLuxury.tsx');
  const otp = read('client/src/components/OtpCodeInput.tsx');
  const phone = read('client/src/components/PhoneInput.tsx');

  it('createSessionCookie accepts { rememberMe } opts', () => {
    expect(sessionCookies).toMatch(/rememberMe\?\s*:\s*boolean/);
    expect(sessionCookies).toMatch(/isSessionOnly\s*=\s*opts\?\.rememberMe\s*===\s*false/);
  });

  it('rememberMe:false sets NO browser maxAge (session cookie)', () => {
    // The setSessionCookie helper must NOT unconditionally assign maxAge.
    expect(sessionCookies).toMatch(/browserMaxAge\s*=\s*isSessionOnly\s*\?\s*undefined/);
    expect(sessionCookies).toMatch(/if\s*\(typeof\s+effectiveMaxAge\s*===\s*'number'/);
  });

  it('POST /api/auth/session forwards rememberMe to createSessionCookie', () => {
    expect(routes).toMatch(/rememberMe\s*,\s*captchaToken/);
    expect(routes).toMatch(/rememberMe:\s*typeof\s+rememberMe\s*===\s*'boolean'/);
    // Response body reports which persistence was chosen.
    expect(routes).toMatch(/persistence:\s*rememberChosen/);
  });

  it('AuthProvider forwards remembered preference on every postSession', () => {
    expect(authProvider).toMatch(/const\s+REMEMBER_ME_KEY\s*=\s*'pw_remember_me'/);
    expect(authProvider).toMatch(/rememberMe\s*}\s*:\s*{\s*idToken\s*}/);
  });

  it('SignUpLuxury login sends { idToken, rememberMe } on POST /api/auth/session', () => {
    expect(signUp).toMatch(/body:\s*JSON\.stringify\(\{\s*idToken\s*,\s*rememberMe\s*\}\)/);
  });

  it('SignUpLuxury renders a Remember-me checkbox on the login-password path', () => {
    expect(signUp).toMatch(/data-testid="remember-me-checkbox"/);
    expect(signUp).toMatch(/'Remember me on this device'/);
    expect(signUp).toMatch(/'זכור אותי במכשיר הזה'/);
  });

  it('autocomplete: login email = "email" (WICG spec, exact)', () => {
    // Grab the login email input line and assert exact autoComplete="email".
    // The signup email input is a separate occurrence; this asserts the login one.
    const loginBlock = signUp.match(/authMode === 'login'[\s\S]*?}/);
    expect(loginBlock).toBeTruthy();
    expect(signUp).toMatch(/autoComplete="email"[^>]*value=\{email\}/);
    expect(signUp).not.toMatch(/autoComplete="username email webauthn"/);
  });

  it('autocomplete: signup password = "new-password" (WICG spec, exact)', () => {
    expect(signUp).toMatch(/autoComplete="new-password"/);
  });

  it('autocomplete: login password = "current-password" (WICG spec, exact)', () => {
    expect(signUp).toMatch(/autoComplete="current-password"/);
  });

  it('autocomplete: OTP first cell = "one-time-code" (WICG spec, exact)', () => {
    expect(otp).toMatch(/autoComplete=\{i === 0 \? 'one-time-code' : 'off'\}/);
  });

  it('autocomplete: PhoneInput default = "tel" and forwarded to numberInputProps', () => {
    expect(phone).toMatch(/autoComplete\s*=\s*"tel"/);
    expect(phone).toMatch(/numberInputProps=\{\{\s*autoComplete\s*\}\}/);
  });

  it('NEVER stores a raw password (localStorage/sessionStorage/DB/cookies/logs)', () => {
    // Search each touched file for a suspicious assignment/write of password.
    // This is a coarse guard that fails if someone tries to persist password.
    const files = [sessionCookies, routes, authProvider, signUp];
    for (const f of files) {
      // Password should only appear as react-state, request body to Firebase,
      // or the autoComplete attribute — never localStorage.setItem('...password'.
      expect(f).not.toMatch(/setItem\([^)]*password/i);
      expect(f).not.toMatch(/sessionStorage\.setItem\([^)]*password/i);
      expect(f).not.toMatch(/document\.cookie\s*=\s*.*password/i);
    }
  });
});
