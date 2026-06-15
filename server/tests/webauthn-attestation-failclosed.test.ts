/**
 * WebAuthn platform attestation must never silently pass.
 *
 * validateAppleAttestation / validateAndroidAttestation were stubs that returned
 * true even when the policy asked for validation — a "banking-level attestation"
 * config that was actually a no-op. They now fail closed when enabled-but-unimplemented.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  validateAppleAttestation,
  validateAndroidAttestation,
  ATTESTATION_POLICY,
} from '../webauthn/config';

const origApple = ATTESTATION_POLICY.validateAppleAttestation;
const origAndroid = ATTESTATION_POLICY.validateAndroidAttestation;

afterEach(() => {
  (ATTESTATION_POLICY as any).validateAppleAttestation = origApple;
  (ATTESTATION_POLICY as any).validateAndroidAttestation = origAndroid;
});

describe('WebAuthn attestation — fail closed, never silent-pass', () => {
  it('Apple: returns false (reject) when validation is ENABLED but unimplemented', () => {
    (ATTESTATION_POLICY as any).validateAppleAttestation = true;
    expect(validateAppleAttestation({ fmt: 'apple' })).toBe(false);
  });

  it('Apple: returns true only when validation is explicitly NOT required', () => {
    (ATTESTATION_POLICY as any).validateAppleAttestation = false;
    expect(validateAppleAttestation({ fmt: 'apple' })).toBe(true);
  });

  it('Android: returns false (reject) when validation is ENABLED but unimplemented', () => {
    (ATTESTATION_POLICY as any).validateAndroidAttestation = true;
    expect(validateAndroidAttestation({ fmt: 'android-key' })).toBe(false);
  });

  it('Android: returns true only when validation is explicitly NOT required', () => {
    (ATTESTATION_POLICY as any).validateAndroidAttestation = false;
    expect(validateAndroidAttestation({ fmt: 'android-key' })).toBe(true);
  });
});
