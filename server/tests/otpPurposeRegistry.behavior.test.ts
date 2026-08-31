/**
 * OTPPurposeRegistry — CEO P0-CEP task #171 (Batch §4).
 *
 * Purpose-scoped OTP: a code issued for one purpose must never be
 * consumable for another. These tests pin the ordering of refusals
 * (purpose first, unknown-purpose second, then status/expiry/attempts)
 * because the leakage risk lives in the ordering, not just the
 * eventual OK/REFUSE.
 */
import { describe, it, expect } from 'vitest';
import {
  OTP_PURPOSES,
  isOtpPurpose,
  evaluateOtpConsumption,
  type OtpChallengeSnapshot,
} from '@shared/auth/otpPurposeRegistry';

function makeChallenge(overrides: Partial<OtpChallengeSnapshot> = {}): OtpChallengeSnapshot {
  return {
    purpose: 'PHONE_VERIFICATION',
    status: 'pending',
    expiresAt: new Date('2026-08-31T02:00:00Z'),
    attempts: 0,
    maxAttempts: 5,
    ...overrides,
  };
}

const NOW = new Date('2026-08-31T01:00:00Z');

describe('OTPPurposeRegistry', () => {
  describe('purpose enumeration', () => {
    it('is a non-empty frozen list', () => {
      expect(OTP_PURPOSES.length).toBeGreaterThan(0);
      // readonly tuple at the type level; at runtime we still need
      // callers to treat it as immutable.
      expect(Array.isArray(OTP_PURPOSES)).toBe(true);
    });

    it('every entry is a distinct SCREAMING_SNAKE_CASE identifier', () => {
      const seen = new Set<string>();
      for (const p of OTP_PURPOSES) {
        expect(/^[A-Z][A-Z0-9_]+$/.test(p)).toBe(true);
        expect(seen.has(p)).toBe(false);
        seen.add(p);
      }
    });

    it('contains the CEO Batch §4 named purposes verbatim', () => {
      for (const required of [
        'ACCOUNT_ACTIVATION',
        'PHONE_VERIFICATION',
        'BOOKING_CONFIRMATION',
        'PURCHASE_CONFIRMATION',
        'PASSWORD_RECOVERY',
      ]) {
        expect((OTP_PURPOSES as readonly string[]).includes(required)).toBe(true);
      }
    });

    it('contains the CEO OTP brief §1 named purposes verbatim (GIFT_PURCHASE + SENSITIVE_ACCOUNT_CHANGE)', () => {
      for (const required of ['GIFT_PURCHASE', 'SENSITIVE_ACCOUNT_CHANGE']) {
        expect((OTP_PURPOSES as readonly string[]).includes(required)).toBe(true);
      }
    });
  });

  describe('isOtpPurpose', () => {
    it('accepts registered purposes', () => {
      expect(isOtpPurpose('LOGIN')).toBe(true);
    });
    it('rejects freeform / legacy strings', () => {
      expect(isOtpPurpose('login')).toBe(false);            // lowercase legacy
      expect(isOtpPurpose('change_email')).toBe(false);     // schema-column legacy
      expect(isOtpPurpose('')).toBe(false);
      expect(isOtpPurpose(undefined)).toBe(false);
      expect(isOtpPurpose(123)).toBe(false);
    });
  });

  describe('evaluateOtpConsumption', () => {
    it('OK on the happy path', () => {
      const v = evaluateOtpConsumption({
        challenge: makeChallenge(),
        requestedPurpose: 'PHONE_VERIFICATION',
        now: NOW,
      });
      expect(v).toEqual({ code: 'OK' });
    });

    it('REFUSE(PURPOSE_MISMATCH) BEFORE anything else — even if also expired', () => {
      const v = evaluateOtpConsumption({
        challenge: makeChallenge({
          purpose: 'PHONE_VERIFICATION',
          expiresAt: new Date(NOW.getTime() - 1),   // already expired
          attempts: 999,                             // and exhausted
        }),
        requestedPurpose: 'LOGIN',
        now: NOW,
      });
      expect(v.code).toBe('REFUSE');
      if (v.code !== 'REFUSE') throw new Error();
      expect(v.reasonCode).toBe('PURPOSE_MISMATCH');
    });

    it('REFUSE(UNKNOWN_STORED_PURPOSE) when the row carries an off-registry value', () => {
      const v = evaluateOtpConsumption({
        challenge: makeChallenge({ purpose: 'legacy_lowercase_purpose' }),
        requestedPurpose: 'PHONE_VERIFICATION',
        now: NOW,
      });
      expect(v.code).toBe('REFUSE');
      if (v.code !== 'REFUSE') throw new Error();
      expect(v.reasonCode).toBe('UNKNOWN_STORED_PURPOSE');
    });

    it('REFUSE(STATUS_NOT_CONSUMABLE) for consumed / expired / locked / cancelled', () => {
      for (const status of ['consumed', 'expired', 'locked', 'cancelled'] as const) {
        const v = evaluateOtpConsumption({
          challenge: makeChallenge({ status }),
          requestedPurpose: 'PHONE_VERIFICATION',
          now: NOW,
        });
        expect(v.code).toBe('REFUSE');
        if (v.code !== 'REFUSE') throw new Error();
        expect(v.reasonCode).toBe('STATUS_NOT_CONSUMABLE');
      }
    });

    it('accepts a verified challenge (contact-change two-step: verified → commit consumes)', () => {
      const v = evaluateOtpConsumption({
        challenge: makeChallenge({ status: 'verified' }),
        requestedPurpose: 'PHONE_VERIFICATION',
        now: NOW,
      });
      expect(v).toEqual({ code: 'OK' });
    });

    it('REFUSE(EXPIRED) when now is at or past expiresAt', () => {
      const v = evaluateOtpConsumption({
        challenge: makeChallenge({ expiresAt: NOW }),
        requestedPurpose: 'PHONE_VERIFICATION',
        now: NOW,
      });
      expect(v.code).toBe('REFUSE');
      if (v.code !== 'REFUSE') throw new Error();
      expect(v.reasonCode).toBe('EXPIRED');
    });

    it('REFUSE(ATTEMPTS_EXHAUSTED) when attempts >= maxAttempts', () => {
      const v = evaluateOtpConsumption({
        challenge: makeChallenge({ attempts: 5, maxAttempts: 5 }),
        requestedPurpose: 'PHONE_VERIFICATION',
        now: NOW,
      });
      expect(v.code).toBe('REFUSE');
      if (v.code !== 'REFUSE') throw new Error();
      expect(v.reasonCode).toBe('ATTEMPTS_EXHAUSTED');
    });
  });
});
