/**
 * OtpChannelChoiceEvaluator — CEO OTP brief §3 (task #180).
 *
 * Doctrine: "Because email is substantially cheaper than SMS,
 * design the system so SMS isn't unnecessarily sent for every
 * action. Suggested hierarchy:
 *   • Email — account activation, routine email confirmation,
 *              lower-risk confirmations and non-urgent actions.
 *   • SMS  — initial mobile-number verification, password /
 *              account recovery where appropriate, sensitive
 *              account changes, higher-risk transactions, or
 *              where mobile ownership genuinely needs to be
 *              established."
 *
 * This file is a PURE evaluator that answers "which channel(s)
 * should the OTP go on, for THIS purpose, given the user's
 * verified contacts and any elevated risk?".
 *
 * Refuses to guess when the required channel is unavailable —
 * fail-CLOSED. The caller (a runtime send-OTP handler) must handle
 * the refusal by asking the user to add a missing contact.
 */

import type { OtpPurpose } from './otpPurposeRegistry';

export const OTP_CHANNELS = ['email', 'sms'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

export interface ChannelChoiceInput {
  purpose: OtpPurpose;
  hasVerifiedEmail: boolean;
  hasVerifiedMobile: boolean;
  /**
   * Signal from the risk engine — elevates a normally-email purpose
   * to also require SMS. Runtime source (device change, new IP,
   * unusual hour) is out of scope for this evaluator; the caller
   * supplies the bit.
   */
  elevatedRisk: boolean;
}

export type ChannelChoiceVerdict =
  | { code: 'SEND'; channels: readonly OtpChannel[]; reasonCode:
      | 'EMAIL_PREFERRED_LOW_RISK'
      | 'SMS_REQUIRED_MOBILE_VERIFICATION'
      | 'SMS_REQUIRED_HIGH_RISK'
      | 'BOTH_REQUIRED_ELEVATED_RISK' }
  | { code: 'REFUSE'; reasonCode:
      | 'NO_VERIFIED_EMAIL_FOR_EMAIL_PURPOSE'
      | 'NO_VERIFIED_MOBILE_FOR_SMS_PURPOSE'
      | 'NO_VERIFIED_CONTACT_AT_ALL' };

/**
 * Purposes that MUST go SMS-first because they establish or use
 * mobile ownership itself. Sending them by email defeats the point.
 */
const REQUIRES_SMS: ReadonlySet<OtpPurpose> = new Set<OtpPurpose>([
  'PHONE_VERIFICATION',
]);

/**
 * Money-moving or sensitive purposes that WARRANT SMS whenever
 * mobile ownership is already established — SMS is treated as the
 * stronger channel (out-of-band from email).
 *
 * When there is no verified mobile, these fall back to email (better
 * than not sending), but the caller may want to prompt the user to
 * add a mobile at their next opportunity.
 */
const PREFERS_SMS_WHEN_AVAILABLE: ReadonlySet<OtpPurpose> = new Set<OtpPurpose>([
  'PASSWORD_RECOVERY',
  'CLOSE_ACCOUNT',
  'CHANGE_PAYOUT_DESTINATION',
  'SENSITIVE_ACCOUNT_CHANGE',
  'PROVIDER_SECURITY_STEPUP',
  'GIFT_PURCHASE',
  'PURCHASE_CONFIRMATION',
  'BOOKING_CONFIRMATION',
]);

/**
 * Purposes that DEFAULT to email — the routine, ownership-only,
 * cheap-side actions. SMS only if elevatedRisk demands it.
 */
const DEFAULT_EMAIL: ReadonlySet<OtpPurpose> = new Set<OtpPurpose>([
  'ACCOUNT_ACTIVATION',
  'EMAIL_VERIFICATION',
  'LOGIN',
]);

export function chooseOtpChannel(input: ChannelChoiceInput): ChannelChoiceVerdict {
  const { purpose, hasVerifiedEmail, hasVerifiedMobile, elevatedRisk } = input;

  // Nothing to send on.
  if (!hasVerifiedEmail && !hasVerifiedMobile) {
    return { code: 'REFUSE', reasonCode: 'NO_VERIFIED_CONTACT_AT_ALL' };
  }

  if (REQUIRES_SMS.has(purpose)) {
    if (!hasVerifiedMobile) {
      return { code: 'REFUSE', reasonCode: 'NO_VERIFIED_MOBILE_FOR_SMS_PURPOSE' };
    }
    return { code: 'SEND', channels: ['sms'], reasonCode: 'SMS_REQUIRED_MOBILE_VERIFICATION' };
  }

  if (PREFERS_SMS_WHEN_AVAILABLE.has(purpose)) {
    if (hasVerifiedMobile && elevatedRisk) {
      // Belt-and-braces on high-risk moments: both channels.
      const channels: OtpChannel[] = ['sms'];
      if (hasVerifiedEmail) channels.push('email');
      return { code: 'SEND', channels, reasonCode: 'BOTH_REQUIRED_ELEVATED_RISK' };
    }
    if (hasVerifiedMobile) {
      return { code: 'SEND', channels: ['sms'], reasonCode: 'SMS_REQUIRED_HIGH_RISK' };
    }
    if (hasVerifiedEmail) {
      return { code: 'SEND', channels: ['email'], reasonCode: 'EMAIL_PREFERRED_LOW_RISK' };
    }
    // Neither — unreachable given the top guard, but keep the shape.
    return { code: 'REFUSE', reasonCode: 'NO_VERIFIED_CONTACT_AT_ALL' };
  }

  if (DEFAULT_EMAIL.has(purpose)) {
    if (elevatedRisk && hasVerifiedMobile) {
      return { code: 'SEND', channels: ['sms'], reasonCode: 'SMS_REQUIRED_HIGH_RISK' };
    }
    if (hasVerifiedEmail) {
      return { code: 'SEND', channels: ['email'], reasonCode: 'EMAIL_PREFERRED_LOW_RISK' };
    }
    if (hasVerifiedMobile) {
      return { code: 'SEND', channels: ['sms'], reasonCode: 'SMS_REQUIRED_MOBILE_VERIFICATION' };
    }
    return { code: 'REFUSE', reasonCode: 'NO_VERIFIED_EMAIL_FOR_EMAIL_PURPOSE' };
  }

  // Any purpose not in the three families above (future additions
  // that forgot to classify): fall-back to email if present, else
  // refuse — SAFEST default is to not send at all.
  if (hasVerifiedEmail) {
    return { code: 'SEND', channels: ['email'], reasonCode: 'EMAIL_PREFERRED_LOW_RISK' };
  }
  return { code: 'REFUSE', reasonCode: 'NO_VERIFIED_EMAIL_FOR_EMAIL_PURPOSE' };
}
