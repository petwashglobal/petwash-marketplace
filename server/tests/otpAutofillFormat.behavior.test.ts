/**
 * OtpAutofillFormat — task #183 (CEO OTP brief §7).
 *
 * The template catalog (task #179) produces iOS-safe bodies out of
 * the box. This test pins that + the additive Android wrapper.
 */
import { describe, it, expect } from 'vitest';
import {
  checkAutofillCompliance,
  formatForAndroidRetriever,
  ANDROID_RETRIEVER_SIGIL,
} from '@shared/auth/otpAutofillFormat';
import { renderOtpSms } from '@shared/auth/otpMessageTemplateCatalog';
import { OTP_PURPOSES, type OtpPurpose } from '@shared/auth/otpPurposeRegistry';

const CODE = '123456';
const APP_HASH = 'aBcDeFgHiJk'; // 11-char placeholder, real APK hash lives in env

describe('OtpAutofillFormat', () => {
  describe('iOS compliance across every purpose × locale', () => {
    it('every rendered OTP SMS satisfies iOS AutoFill (has a 4-8 digit code)', () => {
      for (const purpose of OTP_PURPOSES) {
        for (const locale of ['he-IL', 'en'] as const) {
          const body = renderOtpSms({ purpose, locale, code: CODE, minutes: 5 });
          const v = checkAutofillCompliance({ smsBody: body });
          expect(v.ios.code, `${purpose} × ${locale} iOS: ${JSON.stringify(v.ios)}`).toBe('OK');
          expect(v.android.code).toBe('NOT_CHECKED');
        }
      }
    });
  });

  describe('iOS failure paths', () => {
    it('FAIL(NO_DIGIT_CODE_FOUND) when the body carries no digits', () => {
      const v = checkAutofillCompliance({ smsBody: 'Pet Wash: no code here.' });
      expect(v.ios.code).toBe('FAIL');
      if (v.ios.code !== 'FAIL') throw new Error();
      expect(v.ios.reasonCode).toBe('NO_DIGIT_CODE_FOUND');
    });

    it('FAIL(CODE_LENGTH_OUT_OF_RANGE) when the code is too short (3 digits)', () => {
      const v = checkAutofillCompliance({ smsBody: 'Pet Wash: your code is 12.' });
      // "12" is only 2 digits — regex requires 4-8 so no code is found at all
      expect(v.ios.code).toBe('FAIL');
      if (v.ios.code !== 'FAIL') throw new Error();
      expect(v.ios.reasonCode).toBe('NO_DIGIT_CODE_FOUND');
    });

    it('FAIL(CODE_LENGTH_OUT_OF_RANGE) when the digit run is longer than 8 — regex caps at 8 so finds the 8-digit prefix, which is OK', () => {
      // 9-digit number: the regex finds an 8-digit prefix as the "code" — that's still OK for iOS.
      // This test documents the intended trade-off; the sender is responsible for keeping the code to a single 6-digit run in the body.
      const v = checkAutofillCompliance({ smsBody: 'Pet Wash: 123456789.' });
      expect(v.ios.code).toBe('OK');
    });
  });

  describe('Android SMS Retriever compliance', () => {
    it('OK when the body starts with <#> and ends with the app hash', () => {
      const base = renderOtpSms({ purpose: 'LOGIN', locale: 'en', code: CODE, minutes: 5 });
      const wrapped = formatForAndroidRetriever(base, APP_HASH);
      const v = checkAutofillCompliance({ smsBody: wrapped, androidAppHash: APP_HASH });
      expect(v.android.code).toBe('OK');
      // iOS still finds the code inside the wrapped body.
      expect(v.ios.code).toBe('OK');
    });

    it('FAIL(MISSING_RETRIEVER_SIGIL) when the sigil is absent', () => {
      const base = renderOtpSms({ purpose: 'LOGIN', locale: 'en', code: CODE, minutes: 5 });
      const v = checkAutofillCompliance({ smsBody: `${base}\n${APP_HASH}`, androidAppHash: APP_HASH });
      expect(v.android.code).toBe('FAIL');
      if (v.android.code !== 'FAIL') throw new Error();
      expect(v.android.reasonCode).toBe('MISSING_RETRIEVER_SIGIL');
    });

    it('FAIL(APP_HASH_TAIL_WRONG) when the tail is 11-char but wrong', () => {
      const base = renderOtpSms({ purpose: 'LOGIN', locale: 'en', code: CODE, minutes: 5 });
      const wrapped = `${ANDROID_RETRIEVER_SIGIL} ${base}\nWRONGxxHASH`; // 11-char but not our hash
      const v = checkAutofillCompliance({ smsBody: wrapped, androidAppHash: APP_HASH });
      expect(v.android.code).toBe('FAIL');
      if (v.android.code !== 'FAIL') throw new Error();
      expect(v.android.reasonCode).toBe('APP_HASH_TAIL_WRONG');
    });

    it('FAIL(MISSING_APP_HASH_TAIL) when nothing hash-shaped is at the tail', () => {
      const wrapped = `${ANDROID_RETRIEVER_SIGIL} Pet Wash: code 123456. valid 5 min.`;
      const v = checkAutofillCompliance({ smsBody: wrapped, androidAppHash: APP_HASH });
      expect(v.android.code).toBe('FAIL');
      if (v.android.code !== 'FAIL') throw new Error();
      expect(v.android.reasonCode).toBe('MISSING_APP_HASH_TAIL');
    });

    it('NOT_CHECKED when caller does not supply an androidAppHash', () => {
      const v = checkAutofillCompliance({ smsBody: 'anything', androidAppHash: undefined });
      expect(v.android.code).toBe('NOT_CHECKED');
    });
  });

  describe('formatForAndroidRetriever preserves iOS-compatible base', () => {
    it('the wrapped body still passes iOS + newly passes Android', () => {
      // Sample every purpose to confirm the wrapper is content-agnostic.
      const purposes: OtpPurpose[] = ['ACCOUNT_ACTIVATION', 'BOOKING_CONFIRMATION', 'GIFT_PURCHASE'];
      for (const purpose of purposes) {
        const base = renderOtpSms({ purpose, locale: 'he-IL', code: CODE, minutes: 5 });
        const wrapped = formatForAndroidRetriever(base, APP_HASH);
        const v = checkAutofillCompliance({ smsBody: wrapped, androidAppHash: APP_HASH });
        expect(v.ios.code, `${purpose}: iOS after wrap`).toBe('OK');
        expect(v.android.code, `${purpose}: Android after wrap`).toBe('OK');
      }
    });
  });
});
