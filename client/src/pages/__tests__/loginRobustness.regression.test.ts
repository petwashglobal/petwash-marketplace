/**
 * Login robustness — flaws found in the 2026-08-06 both-ends audit:
 *  · Phone/SMS verify() fell through to finishAndRoute() even when NO session token
 *    came back → user routed into the app session-less → RequireAuth bounced them to
 *    /signin ("entered my code and got kicked out"). Must fail honestly instead.
 *  · The "Sign in with Face ID" button was shown by DEVICE biometric capability, not
 *    by whether a passkey exists → tapped, then failed (NotAllowedError). Must gate on
 *    the registered-passkey signal (petwash_passkey_email), which is now set on
 *    passkey register/login so the one-tap button appears only when it will work.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const signup = readFileSync(resolve(__dirname, '..', 'SignUpLuxury.tsx'), 'utf8');
const passkey = readFileSync(resolve(__dirname, '..', '..', 'auth', 'passkey.ts'), 'utf8');

describe('phone/SMS verify never routes into a session-less app', () => {
  const verify = signup.slice(signup.indexOf('async function verify('), signup.indexOf('async function sendEmailCode('));
  it('fails honestly when no customToken comes back (no fall-through to finishAndRoute)', () => {
    expect(verify).toMatch(/if \(!sd\.customToken\)\s*\{[\s\S]*?fail\([\s\S]*?return;/);
  });
  it('also fails if the /api/auth/session POST is not ok (no hollow session)', () => {
    expect(verify).toMatch(/if \(!sessionRes\.ok\)/);
  });
});

describe('Face ID button gated on an actual registered passkey', () => {
  it('login screen requires petwash_passkey_email, not just device biometrics', () => {
    expect(signup).toMatch(/localStorage\.getItem\('petwash_passkey_email'\)/);
    expect(signup).toMatch(/setBioAvailable\(avail && hasRegisteredPasskey\)/);
  });
  it('passkey register + login SET the signal so the button becomes real', () => {
    expect(passkey).toMatch(/function rememberPasskeyEmail/);
    expect(passkey).toMatch(/localStorage\.setItem\('petwash_passkey_email', email\)/);
    expect((passkey.match(/rememberPasskeyEmail\(/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
