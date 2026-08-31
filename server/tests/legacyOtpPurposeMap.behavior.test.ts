/**
 * LegacyOtpPurposeMap — task #177.
 *
 * Pins the 9-entry legacy → canonical bridge and the certainty
 * annotations that gate auto-migration.
 */
import { describe, it, expect } from 'vitest';
import {
  LEGACY_OTP_PURPOSES,
  LEGACY_OTP_PURPOSE_MAP,
  isLegacyOtpPurpose,
  lookupLegacyMapping,
  canonicalFor,
} from '@shared/auth/legacyOtpPurposeMap';
import { OTP_PURPOSES } from '@shared/auth/otpPurposeRegistry';

describe('LegacyOtpPurposeMap', () => {
  describe('coverage', () => {
    it('exactly the 9 legacy purposes the trigger inventory names', () => {
      expect([...LEGACY_OTP_PURPOSES].sort()).toEqual([
        'change_email',
        'close_account',
        'diagnostic_noop',
        'disable_2fa',
        'egift_redeem',
        'enable_2fa',
        'login',
        'payout',
        'signup',
      ]);
    });

    it('has a map entry for every legacy purpose (no gaps)', () => {
      for (const legacy of LEGACY_OTP_PURPOSES) {
        expect(lookupLegacyMapping(legacy), `missing entry for ${legacy}`).toBeDefined();
      }
    });

    it('every ONE_TO_ONE entry carries a canonical that IS in OTP_PURPOSES', () => {
      const canonicals = new Set(OTP_PURPOSES as readonly string[]);
      for (const e of LEGACY_OTP_PURPOSE_MAP) {
        if (e.certainty === 'ONE_TO_ONE') {
          expect(e.canonical, `ONE_TO_ONE ${e.legacy} has no canonical`).toBeDefined();
          expect(canonicals.has(e.canonical as string), `${e.legacy}.canonical ${e.canonical} not in OTP_PURPOSES`).toBe(true);
        }
      }
    });

    it('every NEEDS_CEO / NEEDS_NEW / DELETE entry carries a followUp note', () => {
      for (const e of LEGACY_OTP_PURPOSE_MAP) {
        if (e.certainty === 'ONE_TO_ONE') continue;
        expect(e.followUp, `${e.legacy} (${e.certainty}) missing followUp`).toBeDefined();
      }
    });

    it('every entry has a non-empty rationale (audit trail)', () => {
      for (const e of LEGACY_OTP_PURPOSE_MAP) {
        expect(e.rationale.trim().length, `${e.legacy} missing rationale`).toBeGreaterThan(10);
      }
    });
  });

  describe('isLegacyOtpPurpose', () => {
    it('accepts registered legacy strings', () => {
      expect(isLegacyOtpPurpose('login')).toBe(true);
      expect(isLegacyOtpPurpose('close_account')).toBe(true);
    });
    it('rejects unrelated strings, canonicals, and non-strings', () => {
      expect(isLegacyOtpPurpose('LOGIN')).toBe(false);       // canonical, not legacy
      expect(isLegacyOtpPurpose('bogus')).toBe(false);
      expect(isLegacyOtpPurpose('')).toBe(false);
      expect(isLegacyOtpPurpose(undefined)).toBe(false);
    });
  });

  describe('canonicalFor — safe-auto-migration gate', () => {
    it('returns the canonical for ONE_TO_ONE entries', () => {
      expect(canonicalFor('login')).toBe('LOGIN');
      expect(canonicalFor('change_email')).toBe('EMAIL_VERIFICATION');
      expect(canonicalFor('close_account')).toBe('CLOSE_ACCOUNT');
    });

    it('returns undefined for NEEDS_CEO entries (caller keeps the legacy string)', () => {
      expect(canonicalFor('signup')).toBeUndefined();
      expect(canonicalFor('enable_2fa')).toBeUndefined();
      expect(canonicalFor('disable_2fa')).toBeUndefined();
      expect(canonicalFor('payout')).toBeUndefined();
    });

    it('returns undefined for NEEDS_NEW entries (canonical does not exist yet)', () => {
      expect(canonicalFor('egift_redeem')).toBeUndefined();
    });

    it('returns undefined for DELETE entries (should be removed entirely)', () => {
      expect(canonicalFor('diagnostic_noop')).toBeUndefined();
    });

    it('returns undefined for unregistered strings (never guess)', () => {
      expect(canonicalFor('unknown_purpose')).toBeUndefined();
    });
  });

  describe('certainty distribution — matches CEO OTP brief audit findings', () => {
    it('3 ONE_TO_ONE, 1 DELETE, 4 NEEDS_CEO, 1 NEEDS_NEW', () => {
      const counts = { ONE_TO_ONE: 0, DELETE: 0, NEEDS_CEO: 0, NEEDS_NEW: 0 };
      for (const e of LEGACY_OTP_PURPOSE_MAP) counts[e.certainty as keyof typeof counts]++;
      expect(counts).toEqual({ ONE_TO_ONE: 3, DELETE: 1, NEEDS_CEO: 4, NEEDS_NEW: 1 });
    });
  });
});
