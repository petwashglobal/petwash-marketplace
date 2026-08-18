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

describe('Face ID button — device-local hint only, server is authority', () => {
  // The signed-out login screen cannot query the server for a per-user
  // credential without leaking whether the account exists, so the button
  // uses a device-local hint (petwash_passkey_email) as a DISCOVERY signal
  // for visibility only. The authoritative "your account is enrolled"
  // record lives server-side and is read by Settings via
  // getServerPasskeyStatus(). The hint is written on successful register /
  // passkey login on this device, and cleared on a stale-hint failure.
  it('login screen uses the device-local hint for BUTTON VISIBILITY only', () => {
    expect(signup).toMatch(/localStorage\.getItem\('petwash_passkey_email'\)/);
    expect(signup).toMatch(/setBioAvailable\(avail && passkeyHintOnDevice\)/);
  });
  it('the button is explicitly renamed to make the hint nature obvious', () => {
    // The old `hasRegisteredPasskey` name read like server-authority. New
    // name says "hint on device" so no future reader mistakes it for the
    // real enrollment status.
    expect(signup).toContain('passkeyHintOnDevice');
    expect(signup).not.toContain('const hasRegisteredPasskey');
  });
  it('a failed passkey tap clears the stale hint (so the button stops misleading)', () => {
    // If the device hint says "you have a passkey" but the server has none
    // (user cleared their credentials, switched devices, or the hint
    // predates a reset), the tap fails. The handler recognises the
    // no-credential errors, clears the hint, and shows an honest fallback
    // message instead of "Face ID sign-in failed" (which reads as a
    // system fault when the real cause is "no matching passkey").
    expect(signup).toMatch(/localStorage\.removeItem\('petwash_passkey_email'\)/);
    expect(signup).toMatch(/No passkey found on this device/);
  });
  it('register + login write the UI hint via the explicit hint helper', () => {
    // Register + login MUST use rememberPasskeyEmailHint (renamed from
    // rememberPasskeyEmail) so grep-audits find every write site through
    // the hint-named entry point, and no reader mistakes the helper for
    // a "record that this account is enrolled" API.
    expect(passkey).toMatch(/function rememberPasskeyEmailHint/);
    expect(passkey).toMatch(/localStorage\.setItem\('petwash_passkey_email', email\)/);
    expect((passkey.match(/rememberPasskeyEmailHint\(/g) || []).length).toBeGreaterThanOrEqual(3);
    // The old un-hinted name must be gone — a lingering reference would
    // leave "authority-sounding" callers alive.
    expect(passkey).not.toMatch(/rememberPasskeyEmail\(/);
  });
  it('exports a server-authoritative status helper for authenticated surfaces', () => {
    // Settings/EnableFaceIDCard and any "Face ID: enabled" badge MUST use
    // this instead of reading localStorage. Reads the authoritative
    // credential list from /api/webauthn/credentials and fails closed on
    // any error so the UI offers registration instead of a false "enabled".
    expect(passkey).toMatch(/export async function getServerPasskeyStatus\(\)/);
    expect(passkey).toMatch(/\/api\/webauthn\/credentials/);
    expect(passkey).toMatch(/\{ enrolled: false, count: 0 \}/);
  });
});
