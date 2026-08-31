/**
 * OtpChannelChoiceEvaluator — task #180 (CEO OTP brief §3).
 *
 * Email-preferred where risk allows. SMS reserved for mobile
 * verification, sensitive/money-moving purposes, and elevated risk.
 * Fail-CLOSED when the required channel is unavailable.
 */
import { describe, it, expect } from 'vitest';
import { chooseOtpChannel } from '@shared/auth/otpChannelChoice';

describe('OtpChannelChoiceEvaluator', () => {
  it('ACCOUNT_ACTIVATION with a verified email → email (cheap channel default)', () => {
    const v = chooseOtpChannel({
      purpose: 'ACCOUNT_ACTIVATION',
      hasVerifiedEmail: true,
      hasVerifiedMobile: false,
      elevatedRisk: false,
    });
    expect(v.code).toBe('SEND');
    if (v.code !== 'SEND') throw new Error();
    expect(v.channels).toEqual(['email']);
    expect(v.reasonCode).toBe('EMAIL_PREFERRED_LOW_RISK');
  });

  it('EMAIL_VERIFICATION with only a verified mobile → SMS fallback (mobile-verification reason)', () => {
    const v = chooseOtpChannel({
      purpose: 'EMAIL_VERIFICATION',
      hasVerifiedEmail: false,
      hasVerifiedMobile: true,
      elevatedRisk: false,
    });
    expect(v.code).toBe('SEND');
    if (v.code !== 'SEND') throw new Error();
    expect(v.channels).toEqual(['sms']);
  });

  it('PHONE_VERIFICATION MUST go SMS even if email is verified', () => {
    const v = chooseOtpChannel({
      purpose: 'PHONE_VERIFICATION',
      hasVerifiedEmail: true,
      hasVerifiedMobile: true,
      elevatedRisk: false,
    });
    expect(v.code).toBe('SEND');
    if (v.code !== 'SEND') throw new Error();
    expect(v.channels).toEqual(['sms']);
    expect(v.reasonCode).toBe('SMS_REQUIRED_MOBILE_VERIFICATION');
  });

  it('PHONE_VERIFICATION without a verified mobile → REFUSE(NO_VERIFIED_MOBILE_FOR_SMS_PURPOSE)', () => {
    const v = chooseOtpChannel({
      purpose: 'PHONE_VERIFICATION',
      hasVerifiedEmail: true,
      hasVerifiedMobile: false,
      elevatedRisk: false,
    });
    expect(v.code).toBe('REFUSE');
    if (v.code !== 'REFUSE') throw new Error();
    expect(v.reasonCode).toBe('NO_VERIFIED_MOBILE_FOR_SMS_PURPOSE');
  });

  it('PURCHASE_CONFIRMATION with mobile verified prefers SMS', () => {
    const v = chooseOtpChannel({
      purpose: 'PURCHASE_CONFIRMATION',
      hasVerifiedEmail: true,
      hasVerifiedMobile: true,
      elevatedRisk: false,
    });
    expect(v.code).toBe('SEND');
    if (v.code !== 'SEND') throw new Error();
    expect(v.channels).toEqual(['sms']);
  });

  it('PURCHASE_CONFIRMATION with only email verified falls back to email (better than nothing)', () => {
    const v = chooseOtpChannel({
      purpose: 'PURCHASE_CONFIRMATION',
      hasVerifiedEmail: true,
      hasVerifiedMobile: false,
      elevatedRisk: false,
    });
    expect(v.code).toBe('SEND');
    if (v.code !== 'SEND') throw new Error();
    expect(v.channels).toEqual(['email']);
    expect(v.reasonCode).toBe('EMAIL_PREFERRED_LOW_RISK');
  });

  it('CLOSE_ACCOUNT with elevated risk and both contacts → SMS + email (belt & braces)', () => {
    const v = chooseOtpChannel({
      purpose: 'CLOSE_ACCOUNT',
      hasVerifiedEmail: true,
      hasVerifiedMobile: true,
      elevatedRisk: true,
    });
    expect(v.code).toBe('SEND');
    if (v.code !== 'SEND') throw new Error();
    expect(v.channels).toEqual(['sms', 'email']);
    expect(v.reasonCode).toBe('BOTH_REQUIRED_ELEVATED_RISK');
  });

  it('LOGIN with elevated risk + verified mobile → SMS instead of email', () => {
    const v = chooseOtpChannel({
      purpose: 'LOGIN',
      hasVerifiedEmail: true,
      hasVerifiedMobile: true,
      elevatedRisk: true,
    });
    expect(v.code).toBe('SEND');
    if (v.code !== 'SEND') throw new Error();
    expect(v.channels).toEqual(['sms']);
    expect(v.reasonCode).toBe('SMS_REQUIRED_HIGH_RISK');
  });

  it('no verified contacts at all → REFUSE(NO_VERIFIED_CONTACT_AT_ALL)', () => {
    const v = chooseOtpChannel({
      purpose: 'ACCOUNT_ACTIVATION',
      hasVerifiedEmail: false,
      hasVerifiedMobile: false,
      elevatedRisk: false,
    });
    expect(v.code).toBe('REFUSE');
    if (v.code !== 'REFUSE') throw new Error();
    expect(v.reasonCode).toBe('NO_VERIFIED_CONTACT_AT_ALL');
  });
});
