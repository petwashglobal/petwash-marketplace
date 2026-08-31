/**
 * CommunicationPreferencesService — CEO P0-CEP task #173 (Batch §13).
 *
 * Granular per-channel per-purpose gate. Transactional messages
 * always deliver; marketing is opt-IN; relationship/announcement is
 * opt-OUT. Quiet hours suppress on non-in_app channels EXCEPT for
 * OTP / ACCOUNT_SECURITY (safety wins).
 */
import { describe, it, expect } from 'vitest';
import {
  gateForDelivery,
  preferenceMapFromRecord,
  TRANSACTIONAL_MANDATORY,
  MARKETING_PURPOSES,
  type PreferenceKey,
} from '@shared/marketplace/communicationPreferences';

const NOW_UTC_10 = new Date('2026-08-31T10:00:00Z'); // 13:00 Asia/Jerusalem (UTC+3 in summer)
const NOW_UTC_23 = new Date('2026-08-31T23:00:00Z'); // 02:00 next-day Asia/Jerusalem

describe('CommunicationPreferencesService', () => {
  describe('transactional mandatory', () => {
    it('BOOKING_CONFIRMATION on any channel delivers even with an opt-out preference', () => {
      const prefs = preferenceMapFromRecord({
        'email.BOOKING_CONFIRMATION': false,
        'sms.BOOKING_CONFIRMATION': false,
      });
      for (const channel of ['email', 'sms', 'push', 'in_app'] as const) {
        const v = gateForDelivery({ purpose: 'BOOKING_CONFIRMATION', channel, prefs, now: NOW_UTC_10 });
        expect(v.code).toBe('DELIVER');
      }
    });

    it('OTP delivers through quiet hours (safety override)', () => {
      const prefs = preferenceMapFromRecord({});
      const v = gateForDelivery({
        purpose: 'OTP',
        channel: 'sms',
        prefs,
        quietHours: { tz: 'Asia/Jerusalem', startHour: 22, endHour: 7 },
        now: NOW_UTC_23,
      });
      expect(v.code).toBe('DELIVER');
    });

    it('PAYMENT_RECEIPT DEFERS on quiet hours for email but not for in_app', () => {
      const prefs = preferenceMapFromRecord({});
      const emailV = gateForDelivery({
        purpose: 'PAYMENT_RECEIPT', channel: 'email', prefs,
        quietHours: { tz: 'Asia/Jerusalem', startHour: 22, endHour: 7 }, now: NOW_UTC_23,
      });
      expect(emailV.code).toBe('SUPPRESS');
      if (emailV.code !== 'SUPPRESS') throw new Error();
      expect(emailV.reasonCode).toBe('QUIET_HOURS_ACTIVE');

      const inappV = gateForDelivery({
        purpose: 'PAYMENT_RECEIPT', channel: 'in_app', prefs,
        quietHours: { tz: 'Asia/Jerusalem', startHour: 22, endHour: 7 }, now: NOW_UTC_23,
      });
      expect(inappV.code).toBe('DELIVER');
    });
  });

  describe('marketing (opt-IN)', () => {
    it('SUPPRESS(MARKETING_NOT_OPTED_IN) when the user has expressed no preference', () => {
      const prefs = preferenceMapFromRecord({});
      const v = gateForDelivery({ purpose: 'MARKETING', channel: 'email', prefs, now: NOW_UTC_10 });
      expect(v.code).toBe('SUPPRESS');
      if (v.code !== 'SUPPRESS') throw new Error();
      expect(v.reasonCode).toBe('MARKETING_NOT_OPTED_IN');
    });

    it('DELIVER when the user has explicitly opted in for that channel × purpose', () => {
      const prefs = preferenceMapFromRecord({
        'email.MARKETING': true,
      } as Partial<Record<PreferenceKey, boolean>>);
      const v = gateForDelivery({ purpose: 'MARKETING', channel: 'email', prefs, now: NOW_UTC_10 });
      expect(v.code).toBe('DELIVER');
    });

    it('opt-in on one channel does NOT leak to another channel', () => {
      const prefs = preferenceMapFromRecord({
        'email.MARKETING': true,
      });
      const smsV = gateForDelivery({ purpose: 'MARKETING', channel: 'sms', prefs, now: NOW_UTC_10 });
      expect(smsV.code).toBe('SUPPRESS');
      if (smsV.code !== 'SUPPRESS') throw new Error();
      expect(smsV.reasonCode).toBe('MARKETING_NOT_OPTED_IN');
    });
  });

  describe('relationship / announcement (opt-OUT)', () => {
    it('DELIVER by default', () => {
      const prefs = preferenceMapFromRecord({});
      const v = gateForDelivery({ purpose: 'ANNOUNCEMENT', channel: 'push', prefs, now: NOW_UTC_10 });
      expect(v.code).toBe('DELIVER');
    });

    it('SUPPRESS(USER_OPTED_OUT) when explicitly turned off', () => {
      const prefs = preferenceMapFromRecord({ 'push.ANNOUNCEMENT': false });
      const v = gateForDelivery({ purpose: 'ANNOUNCEMENT', channel: 'push', prefs, now: NOW_UTC_10 });
      expect(v.code).toBe('SUPPRESS');
      if (v.code !== 'SUPPRESS') throw new Error();
      expect(v.reasonCode).toBe('USER_OPTED_OUT');
    });

    it('quiet hours suppress on push/email/sms/whatsapp for non-mandatory purposes', () => {
      const prefs = preferenceMapFromRecord({});
      const v = gateForDelivery({
        purpose: 'REVIEW_REMINDER', channel: 'push', prefs,
        quietHours: { tz: 'Asia/Jerusalem', startHour: 22, endHour: 7 }, now: NOW_UTC_23,
      });
      expect(v.code).toBe('SUPPRESS');
      if (v.code !== 'SUPPRESS') throw new Error();
      expect(v.reasonCode).toBe('QUIET_HOURS_ACTIVE');
    });
  });

  describe('meta', () => {
    it('MARKETING is the only marketing purpose (nothing else silently promoted)', () => {
      expect(MARKETING_PURPOSES.has('MARKETING')).toBe(true);
      expect(MARKETING_PURPOSES.size).toBe(1);
    });
    it('TRANSACTIONAL_MANDATORY includes the safety-critical purposes', () => {
      for (const p of ['BOOKING_CONFIRMATION', 'PAYMENT_RECEIPT', 'FISCAL_DOCUMENT', 'ACCOUNT_SECURITY', 'ACCOUNT_ACTIVATION', 'OTP', 'REFUND_ISSUED'] as const) {
        expect(TRANSACTIONAL_MANDATORY.has(p)).toBe(true);
      }
    });
  });
});
