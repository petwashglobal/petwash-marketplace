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
    expect(verify).toMatch(/if \(!sd\??\.customToken\)\s*\{[\s\S]*?fail\([\s\S]*?return;/); // sd?. since the one-shot proof rework
  });
  it('also fails if the /api/auth/session POST is not ok (no hollow session)', () => {
    expect(verify).toMatch(/if \(!sessionRes\.ok\)/);
  });
});

describe('Passkey button — shown on every capable device, the Apple way; server is authority', () => {
  // The signed-out login screen cannot query the server for a per-user
  // credential without leaking whether the account exists, so the button
  // uses a device-local hint (petwash_passkey_email) as a DISCOVERY signal
  // for visibility only. The authoritative "your account is enrolled"
  // record lives server-side and is read by Settings via
  // getServerPasskeyStatus(). The hint is written on successful register /
  // passkey login on this device, and cleared on a stale-hint failure.
  // 2026-09-13 CEO: "Face ID not there at all — Safari and Chrome". The hint
  // gate (written only after a passkey login that never worked in prod, and
  // deleted on the first cancel; separate storage per browser) hid the button
  // for everyone. Apple's guidance: offer passkey sign-in whenever the device
  // can do it and let the system sheet list the passkeys.
  it('the passkey button shows on every capable device — never gated on a device-local hint', () => {
    expect(signup).toMatch(/setBioAvailable\(avail\);/);
    expect(signup).not.toMatch(/setBioAvailable\(avail && /);
    expect(signup).not.toContain('passkeyHintOnDevice');
  });
  it('a cancelled or failed passkey tap keeps the button and says where to add a passkey', () => {
    expect(signup).not.toMatch(/localStorage\.removeItem\('petwash_passkey_email'\)/);
    expect(signup).not.toMatch(/setBioAvailable\(false\)/);
    expect(signup).toContain('Passkey sign-in did not complete');
    expect(signup).toContain('Account → Security');
    // live 2026-09-13: server reason for a passkey PetWash never saved
    expect(signup).toMatch(/credential not found\|cancel/);
    // Hebrew server text must not bypass the matcher — the English reason is matched too
    expect(signup).toContain('`${r.error || \'\'} ${r.errorEn || \'\'}`');
    expect(passkey).toContain('errorEn: error.error_en');
  });
  it('uses Apple\'s word: "passkey", unlocked with Face ID / Touch ID', () => {
    expect(signup).toContain('Sign in with a passkey (${bioName})');
    expect(signup).toContain('התחברות עם Passkey (${bioName})');
  });
  it('signed-out passkey sign-in is discoverable — no typed or stored email is sent', () => {
    const fn = passkey.slice(passkey.indexOf('export async function signInWithPasskey('), passkey.indexOf('export async function isConditionalMediationAvailable'));
    expect(fn).not.toMatch(/localStorage\.getItem\('petwash_passkey_email'\)/);
    expect(fn).toMatch(/let email = '';\s*if \(uid\) \{/);
  });
  it('register + login write the UI hint via the explicit hint helper', () => {
    // Register + login MUST use rememberPasskeyEmailHint (renamed from
    // rememberPasskeyEmail) so grep-audits find every write site through
    // the hint-named entry point, and no reader mistakes the helper for
    // a "record that this account is enrolled" API.
    expect(passkey).toMatch(/function rememberPasskeyEmailHint/);
    expect(passkey).toMatch(/localStorage\.setItem\('petwash_passkey_email', email\)/);
    // register + explicit login + autofill (conditional) login
    expect((passkey.match(/rememberPasskeyEmailHint\(/g) || []).length).toBeGreaterThanOrEqual(4);
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
