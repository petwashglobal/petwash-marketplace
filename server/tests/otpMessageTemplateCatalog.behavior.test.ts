/**
 * OtpMessageTemplateCatalog — task #179 (CEO OTP brief §2).
 *
 * Every OTP SMS must be:
 *   • branded with "Pet Wash™:"
 *   • purpose-specific in its one-liner
 *   • single-language (never he+en concatenation)
 *   • time-bounded ("valid for N minutes")
 *   • safety-warned for money-moving / sensitive purposes
 */
import { describe, it, expect } from 'vitest';
import {
  renderOtpSms,
  renderOtpEmail,
  isOtpLocale,
  OTP_SMS_BRAND_PREFIX,
  OTP_LOCALES,
} from '@shared/auth/otpMessageTemplateCatalog';
import { OTP_PURPOSES, type OtpPurpose } from '@shared/auth/otpPurposeRegistry';

const CODE = '123456';

describe('OtpMessageTemplateCatalog', () => {
  describe('meta', () => {
    it('exactly the two locales we ship', () => {
      expect(OTP_LOCALES).toEqual(['he-IL', 'en']);
    });
    it('isOtpLocale accepts registered, rejects freeform', () => {
      expect(isOtpLocale('he-IL')).toBe(true);
      expect(isOtpLocale('en')).toBe(true);
      expect(isOtpLocale('he')).toBe(false);
      expect(isOtpLocale('en-US')).toBe(false);
    });
  });

  describe('renderOtpSms — brand + code + TTL', () => {
    it('every purpose × locale renders a string that starts with the brand prefix and contains the code and TTL', () => {
      for (const purpose of OTP_PURPOSES) {
        for (const locale of OTP_LOCALES) {
          const body = renderOtpSms({ purpose, locale, code: CODE, minutes: 5 });
          expect(body.startsWith(OTP_SMS_BRAND_PREFIX), `${purpose} × ${locale} missing brand`).toBe(true);
          expect(body.includes(CODE), `${purpose} × ${locale} missing code`).toBe(true);
          expect(body.includes('5'), `${purpose} × ${locale} missing TTL number`).toBe(true);
        }
      }
    });

    it('he-IL body contains Hebrew characters and NO English word "code"; en body is the mirror', () => {
      const he = renderOtpSms({ purpose: 'ACCOUNT_ACTIVATION', locale: 'he-IL', code: CODE, minutes: 5 });
      const en = renderOtpSms({ purpose: 'ACCOUNT_ACTIVATION', locale: 'en', code: CODE, minutes: 5 });
      expect(/[֐-׿]/.test(he)).toBe(true);           // has Hebrew
      // The word "code" as an English word should NOT appear in a
      // he-IL SMS — that would be the bilingual anti-pattern §4 bans.
      expect(/\bcode\b/i.test(he)).toBe(false);
      // en body has no Hebrew.
      expect(/[֐-׿]/.test(en)).toBe(false);
      expect(en.toLowerCase().includes('code')).toBe(true);
    });

    it('money-moving purposes include the safety warning; ownership-only purposes do NOT', () => {
      const moneyPurposes: OtpPurpose[] = [
        'BOOKING_CONFIRMATION', 'PURCHASE_CONFIRMATION', 'GIFT_PURCHASE',
        'PASSWORD_RECOVERY', 'CLOSE_ACCOUNT', 'CHANGE_PAYOUT_DESTINATION',
        'SENSITIVE_ACCOUNT_CHANGE', 'PROVIDER_SECURITY_STEPUP',
      ];
      const ownershipOnly: OtpPurpose[] = ['ACCOUNT_ACTIVATION', 'EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'LOGIN'];

      for (const purpose of moneyPurposes) {
        const en = renderOtpSms({ purpose, locale: 'en', code: CODE, minutes: 5 });
        expect(en.toLowerCase().includes('do not share'), `${purpose} missing safety warning (en)`).toBe(true);
        const he = renderOtpSms({ purpose, locale: 'he-IL', code: CODE, minutes: 5 });
        expect(he.includes('אין למסור את הקוד'), `${purpose} missing safety warning (he)`).toBe(true);
      }
      for (const purpose of ownershipOnly) {
        const en = renderOtpSms({ purpose, locale: 'en', code: CODE, minutes: 5 });
        expect(en.toLowerCase().includes('do not share'), `${purpose} unexpectedly carries safety warning (en)`).toBe(false);
      }
    });

    it('BOOKING_CONFIRMATION he-IL matches the CEO brief exemplar (identical to the specimen)', () => {
      const body = renderOtpSms({ purpose: 'BOOKING_CONFIRMATION', locale: 'he-IL', code: CODE, minutes: 5 });
      // Anchor test on the exact CEO exemplar so any drift trips CI.
      expect(body).toBe(
        'Pet Wash™: קוד האימות לאישור ההזמנה שלך הוא 123456. הקוד תקף ל-5 דקות. אם לא ביצעת פעולה זו, אין למסור את הקוד.',
      );
    });

    it('PURCHASE_CONFIRMATION en matches the CEO brief exemplar verbatim', () => {
      const body = renderOtpSms({ purpose: 'PURCHASE_CONFIRMATION', locale: 'en', code: CODE, minutes: 5 });
      expect(body).toBe(
        'Pet Wash™: Your purchase verification code is 123456. It is valid for 5 minutes. If you did not initiate this action, do not share this code.',
      );
    });

    it('ACCOUNT_ACTIVATION he-IL matches the CEO brief exemplar verbatim', () => {
      const body = renderOtpSms({ purpose: 'ACCOUNT_ACTIVATION', locale: 'he-IL', code: CODE, minutes: 5 });
      expect(body).toBe(
        'Pet Wash™: קוד האימות להפעלת החשבון שלך הוא 123456. הקוד תקף ל-5 דקות.',
      );
    });

    it('TTL variable interpolates ("5" vs "10")', () => {
      const short = renderOtpSms({ purpose: 'LOGIN', locale: 'en', code: CODE, minutes: 5 });
      const long = renderOtpSms({ purpose: 'LOGIN', locale: 'en', code: CODE, minutes: 10 });
      expect(short.includes('5 minutes')).toBe(true);
      expect(long.includes('10 minutes')).toBe(true);
    });
  });

  describe('renderOtpEmail', () => {
    it('returns per-purpose subjectSlug and a body carrying the same brand + code', () => {
      const out = renderOtpEmail({ purpose: 'ACCOUNT_ACTIVATION', locale: 'en', code: CODE, minutes: 5 });
      expect(out.subjectSlug).toBe('otp.email.subject.ACCOUNT_ACTIVATION');
      expect(out.body.startsWith(OTP_SMS_BRAND_PREFIX)).toBe(true);
      expect(out.body.includes(CODE)).toBe(true);
    });
  });
});
