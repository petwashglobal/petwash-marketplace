/**
 * OtpScreenSpec — task #184 (CEO OTP brief §8).
 *
 * Pins the exact strings the OTP screen renders — masked
 * destination pill, purpose-scoped title slug, mm:ss countdown,
 * change-destination CTA slug. Never exposes the raw destination.
 */
import { describe, it, expect } from 'vitest';
import { composeOtpScreenSpec } from '@shared/auth/otpScreenSpec';

describe('OtpScreenSpec', () => {
  describe('phone masking + he-IL body matches the CEO exemplar verbatim', () => {
    it('composes: "…4567" + "שלחנו קוד בן 6 ספרות למספר המסתיים ב-…4567."', () => {
      const spec = composeOtpScreenSpec({
        purpose: 'PHONE_VERIFICATION',
        locale: 'he-IL',
        channel: 'sms',
        destination: '+972501234567',
        resendCooldownSeconds: 30,
      });
      expect(spec.destinationPill).toBe('…4567');
      expect(spec.body).toBe('שלחנו קוד בן 6 ספרות למספר המסתיים ב-…4567.');
      expect(spec.titleSlug).toBe('otp.screen.title.PHONE_VERIFICATION.he-IL');
    });
  });

  describe('email masking + en body', () => {
    it('composes: "a•••e@example.com" pill and English body', () => {
      const spec = composeOtpScreenSpec({
        purpose: 'ACCOUNT_ACTIVATION',
        locale: 'en',
        channel: 'email',
        destination: 'alice@example.com',
        resendCooldownSeconds: 0,
      });
      expect(spec.destinationPill).toBe('a•••e@example.com');
      expect(spec.body).toBe('We sent a 6-digit code to a•••e@example.com.');
      expect(spec.titleSlug).toBe('otp.screen.title.ACCOUNT_ACTIVATION.en');
    });

    it('short local part still masks safely', () => {
      const spec = composeOtpScreenSpec({
        purpose: 'ACCOUNT_ACTIVATION', locale: 'en', channel: 'email',
        destination: 'a@example.com', resendCooldownSeconds: 0,
      });
      expect(spec.destinationPill).toBe('a•••@example.com');
    });
  });

  describe('resend countdown', () => {
    it('formats mm:ss and disables resend while > 0', () => {
      const spec = composeOtpScreenSpec({
        purpose: 'LOGIN', locale: 'en', channel: 'sms',
        destination: '+972501234567', resendCooldownSeconds: 30,
      });
      expect(spec.resendCountdownDisplay).toBe('00:30');
      expect(spec.resendReady).toBe(false);
    });

    it('over-a-minute cool-down formats correctly', () => {
      const spec = composeOtpScreenSpec({
        purpose: 'LOGIN', locale: 'en', channel: 'sms',
        destination: '+972501234567', resendCooldownSeconds: 125,
      });
      expect(spec.resendCountdownDisplay).toBe('02:05');
    });

    it('0 cool-down → empty countdown + resendReady=true', () => {
      const spec = composeOtpScreenSpec({
        purpose: 'LOGIN', locale: 'en', channel: 'sms',
        destination: '+972501234567', resendCooldownSeconds: 0,
      });
      expect(spec.resendCountdownDisplay).toBe('');
      expect(spec.resendReady).toBe(true);
    });
  });

  describe('change-destination CTA', () => {
    it('SMS channel → CHANGE_DESTINATION.PHONE', () => {
      const spec = composeOtpScreenSpec({
        purpose: 'PURCHASE_CONFIRMATION', locale: 'en', channel: 'sms',
        destination: '+972501234567', resendCooldownSeconds: 0,
      });
      expect(spec.changeDestinationSlug).toBe('otp.cta.change_destination.PHONE');
    });

    it('email channel → CHANGE_DESTINATION.EMAIL', () => {
      const spec = composeOtpScreenSpec({
        purpose: 'PURCHASE_CONFIRMATION', locale: 'en', channel: 'email',
        destination: 'alice@example.com', resendCooldownSeconds: 0,
      });
      expect(spec.changeDestinationSlug).toBe('otp.cta.change_destination.EMAIL');
    });
  });

  describe('privacy discipline', () => {
    it('NEVER embeds the raw destination anywhere in the composed spec', () => {
      const RAW_PHONE = '+972501234567';
      const spec = composeOtpScreenSpec({
        purpose: 'PHONE_VERIFICATION', locale: 'he-IL', channel: 'sms',
        destination: RAW_PHONE, resendCooldownSeconds: 30,
      });
      expect(JSON.stringify(spec).includes(RAW_PHONE)).toBe(false);
      expect(JSON.stringify(spec).includes('1234567')).toBe(false); // no 7-digit local run either
    });

    it('NEVER embeds the raw email anywhere in the composed spec', () => {
      const RAW_EMAIL = 'alice@example.com';
      const spec = composeOtpScreenSpec({
        purpose: 'ACCOUNT_ACTIVATION', locale: 'en', channel: 'email',
        destination: RAW_EMAIL, resendCooldownSeconds: 0,
      });
      // The masked "a•••e@example.com" contains the domain "example.com" — that's fine.
      // What must never leak: the full "alice" local part.
      expect(JSON.stringify(spec).includes('alice')).toBe(false);
    });
  });
});
