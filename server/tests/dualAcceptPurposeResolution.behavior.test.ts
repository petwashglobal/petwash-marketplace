/**
 * Dual-accept OTP purpose resolution — task #193.
 *
 * The ONE_TO_ONE canonical migration must keep both LEGACY and
 * CANONICAL purpose strings resolving to the same PurposeDefinition
 * during the migration window (existing rows carry lowercase; new
 * rows carry SCREAMING_SNAKE_CASE).
 *
 * getPurposeDefinition covers the READ side; canonicalizePurposeInput
 * covers the WRITE side. This test pins both.
 */
import { describe, it, expect } from 'vitest';
import { getPurposeDefinition } from '../services/UnifiedVerificationService';
import {
  canonicalFor,
  legacyFor,
  canonicalizePurposeInput,
} from '@shared/auth/legacyOtpPurposeMap';

describe('Dual-accept OTP purpose resolution (task #193)', () => {
  describe('READ side — getPurposeDefinition accepts both forms', () => {
    it('legacy "login" resolves', () => {
      const def = getPurposeDefinition('login');
      expect(def.purpose).toBe('login');
    });

    it('canonical "LOGIN" resolves to the SAME PurposeDefinition entry', () => {
      const legacy = getPurposeDefinition('login');
      const canonical = getPurposeDefinition('LOGIN');
      expect(canonical.purpose).toBe('login');   // registry key stays legacy
      expect(canonical).toBe(legacy);            // identity match — same entry
    });

    it('canonical "EMAIL_VERIFICATION" resolves to the change_email entry', () => {
      const legacy = getPurposeDefinition('change_email');
      const canonical = getPurposeDefinition('EMAIL_VERIFICATION');
      expect(canonical.purpose).toBe('change_email');
      expect(canonical).toBe(legacy);
    });

    it('canonical "CLOSE_ACCOUNT" resolves to the close_account entry', () => {
      const legacy = getPurposeDefinition('close_account');
      const canonical = getPurposeDefinition('CLOSE_ACCOUNT');
      expect(canonical.purpose).toBe('close_account');
      expect(canonical).toBe(legacy);
    });

    it('a canonical that has no ONE_TO_ONE (e.g. GIFT_REDEEM not yet added) throws UNKNOWN_PURPOSE', () => {
      expect(() => getPurposeDefinition('GIFT_REDEEM')).toThrow(/UNKNOWN_PURPOSE|Unknown/);
    });

    it('a random string throws UNKNOWN_PURPOSE (no silent fallback)', () => {
      expect(() => getPurposeDefinition('totally_unrelated')).toThrow(/UNKNOWN_PURPOSE|Unknown/);
    });
  });

  describe('WRITE side — canonicalizePurposeInput promotes ONE_TO_ONE, pass-through otherwise', () => {
    it('legacy "login" → canonical "LOGIN"', () => {
      expect(canonicalizePurposeInput('login')).toBe('LOGIN');
    });

    it('legacy "change_email" → canonical "EMAIL_VERIFICATION"', () => {
      expect(canonicalizePurposeInput('change_email')).toBe('EMAIL_VERIFICATION');
    });

    it('legacy "close_account" → canonical "CLOSE_ACCOUNT"', () => {
      expect(canonicalizePurposeInput('close_account')).toBe('CLOSE_ACCOUNT');
    });

    it('canonical input is already canonical → pass-through', () => {
      expect(canonicalizePurposeInput('LOGIN')).toBe('LOGIN');
    });

    it('legacy purposes that are NEEDS_CEO / NEEDS_NEW pass through unchanged (no unsafe promotion)', () => {
      expect(canonicalizePurposeInput('signup')).toBe('signup');
      expect(canonicalizePurposeInput('enable_2fa')).toBe('enable_2fa');
      expect(canonicalizePurposeInput('disable_2fa')).toBe('disable_2fa');
      expect(canonicalizePurposeInput('payout')).toBe('payout');
      expect(canonicalizePurposeInput('egift_redeem')).toBe('egift_redeem');
    });

    it('unknown strings pass through (never fabricated)', () => {
      expect(canonicalizePurposeInput('bogus_purpose')).toBe('bogus_purpose');
      expect(canonicalizePurposeInput('')).toBe('');
    });
  });

  describe('canonicalFor / legacyFor — inverse pair for the 3 ONE_TO_ONE mappings', () => {
    for (const [legacy, canonical] of [
      ['login', 'LOGIN'],
      ['change_email', 'EMAIL_VERIFICATION'],
      ['close_account', 'CLOSE_ACCOUNT'],
    ] as const) {
      it(`${legacy} ↔ ${canonical} round-trips`, () => {
        expect(canonicalFor(legacy)).toBe(canonical);
        expect(legacyFor(canonical)).toBe(legacy);
      });
    }

    it('legacyFor returns undefined for a canonical with no ONE_TO_ONE mapping', () => {
      expect(legacyFor('PASSWORD_RECOVERY')).toBeUndefined();
      expect(legacyFor('GIFT_PURCHASE')).toBeUndefined();
    });
  });
});
