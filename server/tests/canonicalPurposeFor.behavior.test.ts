/**
 * canonicalPurposeFor — task #192 (P0-CEP read-side projection).
 *
 * Pins the additive read helper that lets loggers/telemetry/UI
 * surface the canonical OtpPurpose for a legacy row without
 * touching what gets persisted.
 */
import { describe, it, expect } from 'vitest';
import { canonicalPurposeFor } from '../services/UnifiedVerificationService';

describe('canonicalPurposeFor', () => {
  it('returns the canonical for ONE_TO_ONE mappings (login / change_email / close_account)', () => {
    expect(canonicalPurposeFor('login')).toBe('LOGIN');
    expect(canonicalPurposeFor('change_email')).toBe('EMAIL_VERIFICATION');
    expect(canonicalPurposeFor('close_account')).toBe('CLOSE_ACCOUNT');
  });

  it('returns undefined for NEEDS_CEO legacy purposes (caller falls back to legacy string)', () => {
    expect(canonicalPurposeFor('signup')).toBeUndefined();
    expect(canonicalPurposeFor('enable_2fa')).toBeUndefined();
    expect(canonicalPurposeFor('disable_2fa')).toBeUndefined();
    expect(canonicalPurposeFor('payout')).toBeUndefined();
  });

  it('returns undefined for the NEEDS_NEW mapping (egift_redeem — no canonical yet)', () => {
    expect(canonicalPurposeFor('egift_redeem')).toBeUndefined();
  });

  it('returns undefined for the DELETE mapping (diagnostic_noop)', () => {
    expect(canonicalPurposeFor('diagnostic_noop')).toBeUndefined();
  });

  it('returns undefined for unrelated / unrecognised strings', () => {
    expect(canonicalPurposeFor('LOGIN')).toBeUndefined();     // canonical, not legacy
    expect(canonicalPurposeFor('bogus_purpose')).toBeUndefined();
    expect(canonicalPurposeFor('')).toBeUndefined();
  });
});
