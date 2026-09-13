/**
 * Returning-member login is CODE-FIRST (CEO 2026-08-06): email → one-time code is the
 * primary path; password is a secondary option behind a "use a password instead" link.
 * Signup (join) was already passwordless. These pins keep login from silently reverting
 * to password-first.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '..', 'SignUpLuxury.tsx'), 'utf8');

describe('login is code-first', () => {
  // 2026-09-13: CEO 2026-08-08 (#1735) — LOGIN shows email+password by default;
  // SIGNUP stays code-first. The default is derived from the path.
  it('usePassword defaults to code-first on signup and password on the login path', () => {
    expect(src).toMatch(/const \[usePassword, setUsePassword\] = useState\(isLoginPath\)/);
    expect(src).toMatch(/const isLoginPath = \/\\\/\(signin\|sign-in\|login\)\/\.test\(window\.location\.pathname\)/);
  });
  it('password field only renders when usePassword is on', () => {
    expect(src).toMatch(/\{usePassword && \(/);
  });
  it('the primary login CTA sends a one-time code when not using a password', () => {
    // usePassword ? [Sign in w/ password] : [Email me a one-time code → sendEmailCode]
    expect(src).toMatch(/\) : usePassword \? \(/);
    expect(src).toMatch(/CODE-FIRST primary CTA[\s\S]*?void sendEmailCode\(\)/);
  });
  it('the toggle switches modes without sending a code', () => {
    expect(src).toMatch(/onClick=\{\(\) => setUsePassword\(\(p\) => !p\)\}/);
    expect(src).toMatch(/Sign in with a password instead/);
  });
});
