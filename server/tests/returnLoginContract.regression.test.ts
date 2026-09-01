/**
 * ReturnLogin contract regression pin (Phase 4, CEO auth-rebuild).
 *
 * The returning-user door is the CEO's key deliverable. This pin
 * enforces the design invariants from the brief so a future refactor
 * cannot silently:
 *   - trust a localStorage value as identity (only as UX hint)
 *   - send an SMS on page open
 *   - bypass the canonical returnTo helper
 *   - render "Welcome back" without a passkey capability check
 *   - dead-end users when the passkey path is unavailable
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '..', '..', 'client', 'src', 'auth', 'ReturnLogin.tsx'),
  'utf8',
);

describe('ReturnLogin · Phase 4 contract pin', () => {
  it('imports the canonical returnTo helper', () => {
    expect(SRC).toMatch(/from ['"]\.\/returnTo['"]/);
    expect(SRC).toMatch(/\bbuildReturnToParam\b/);
    expect(SRC).toMatch(/\breadReturnTo\b/);
  });

  it('uses signInWithPasskey from the canonical passkey module', () => {
    expect(SRC).toMatch(/from ['"]\.\/passkey['"]/);
    expect(SRC).toMatch(/\bsignInWithPasskey\b/);
    expect(SRC).toMatch(/\bisPlatformAuthenticatorAvailable\b/);
  });

  it('gates the passkey button on platform-authenticator availability', () => {
    // If neither a hint NOR a platform authenticator is available, the
    // component MUST fall through to the fallback surface — not render
    // a Face ID button that never fires.
    expect(SRC).toMatch(/isPlatformAuthenticatorAvailable\(\)/);
    expect(SRC).toMatch(/\bfallback\b/);
  });

  it('reads the passkey email hint from the canonical localStorage key', () => {
    // The canonical writer is auth/passkey.ts (rememberPasskeyEmailHint
    // writes petwash_passkey_email). Any regression that reads
    // lastPasskeyEmail is the old broken key.
    expect(SRC).toMatch(/petwash_passkey_email/);
    expect(SRC).not.toMatch(/lastPasskeyEmail/);
  });

  it('treats the hint as UX-only — never as identity', () => {
    // hint is passed as an OPTIONAL argument to signInWithPasskey.
    // The server always re-verifies via /api/webauthn/login/verify.
    // Look for a comment or pattern that treats hint as identity.
    expect(SRC).not.toMatch(/hint\s*===\s*[^']*['"][^']*['"]/); // no equality on hint as an identity check
    expect(SRC).toMatch(/signInWithPasskey\(hint/);
  });

  it('emits ZERO SMS on page open (no Twilio, no send-code paths)', () => {
    // The component must never call an OTP send endpoint. Explicit list.
    expect(SRC).not.toMatch(/\/api\/auth\/sms\//);
    expect(SRC).not.toMatch(/\/api\/auth\/phone\/send-code/);
    expect(SRC).not.toMatch(/\/api\/auth\/email\/start/);
    expect(SRC).not.toMatch(/sendVerificationCode|TwilioSMSService|sendSMS/);
  });

  it('preserves deep-link ?returnTo on both success and fallback paths', () => {
    // Success: navigate(returnTo || '/')
    expect(SRC).toMatch(/readReturnTo\(window\.location\.search\)/);
    // Fallback → /signin: buildReturnToParam is called in the fallback flow.
    // (Split across two lines in the source; check each element.)
    expect(SRC).toMatch(/buildReturnToParam\(/);
    expect(SRC).toMatch(/\/signin/);
  });

  it('never renders "Welcome back, X" without a real hint', () => {
    // The greeting uses greetingFromEmailHint which returns null on empty.
    expect(SRC).toMatch(/greetingFromEmailHint/);
    expect(SRC).toMatch(/greeting\s*\?/);
  });

  it('exposes a fallback path ("Use another account") that navigates to /signin', () => {
    expect(SRC).toMatch(/onUseAnotherAccount/);
    expect(SRC).toMatch(/data-testid=["']button-return-login-fallback['"]/);
  });

  it('documents the biometric-privacy commitment', () => {
    // Explicit end-user copy: PetWash never sees the face; passkey lives on device.
    expect(SRC).toMatch(/never sees\s*your face|only a passkey/i);
  });

  it('primary CTA has a stable test id', () => {
    expect(SRC).toMatch(/data-testid=["']button-return-login-passkey['"]/);
  });
});
