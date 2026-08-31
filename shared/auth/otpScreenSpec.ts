/**
 * OtpScreenSpec — CEO OTP brief §8 (task #184).
 *
 * Doctrine: "The screen itself must say:
 *   אימות מספר הטלפון
 *   שלחנו קוד בן 6 ספרות למספר המסתיים ב-1234.
 *
 * Then show the 6-digit input and:
 *   שליחה מחדש בעוד 00:30
 *   שינוי מספר טלפון
 *
 * Never expose the complete phone / email unnecessarily."
 *
 * This file is a PURE view-model composer. Given the purpose,
 * locale, channel that was actually chosen (from otpChannelChoice),
 * the destination the code was sent to, and the current resend
 * cool-down state, it returns the exact strings the OTP screen
 * renders. NO React, NO fetch, NO client state — the caller drives
 * the resend timer clock and re-invokes on tick.
 *
 * Masking rules:
 *   • Phone → "…LAST4"       (brief exemplar "מספר המסתיים ב-1234")
 *   • Email → local[0]•••local[-1]@domain (reuses ContactMaskingService rules)
 *
 * The tail form for phone matches the CEO exemplar literally so the
 * screen text can concatenate the pill without re-mangling.
 */

import type { OtpPurpose } from './otpPurposeRegistry';
import type { OtpLocale } from './otpMessageTemplateCatalog';
import type { OtpChannel } from './otpChannelChoice';

export interface ScreenSpecInput {
  purpose: OtpPurpose;
  locale: OtpLocale;
  channel: OtpChannel;
  /**
   * The raw destination (email address or E.164 phone) the code
   * was sent to. The screen never renders this raw value — the
   * spec exposes only the masked form.
   */
  destination: string;
  /** Seconds until the "Resend" button becomes clickable. */
  resendCooldownSeconds: number;
}

export interface OtpScreenSpec {
  /** Translated title slug the client renders (e.g. "otp.screen.title.PHONE_VERIFICATION.he-IL"). */
  titleSlug: string;
  /**
   * The full body sentence — locale-appropriate, embedding the
   * masked-destination pill. Ready to render as-is.
   */
  body: string;
  /** Short pill string the screen renders next to the destination line ("…4567" / "a•••e@example.com"). */
  destinationPill: string;
  /** "mm:ss" countdown; empty string when resend is ready. */
  resendCountdownDisplay: string;
  /** True when the Resend button should be enabled. */
  resendReady: boolean;
  /**
   * Slug for the secondary CTA that lets the user change the
   * destination (e.g. "otp.cta.change_destination.PHONE").
   */
  changeDestinationSlug: string;
}

/** Format a mm:ss countdown from a positive integer of seconds. */
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '';
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

/** Mask a phone destination to "…LAST4" form the OTP screen expects. */
function maskPhoneTail(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `…${digits.slice(-4)}`;
}

/** Mask an email destination to local[0]•••local[-1]@domain. */
function maskEmailForScreen(raw: string): string {
  const at = raw.indexOf('@');
  if (at < 1) return '';
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  if (local.length <= 2) return `${local[0]}•••@${domain}`;
  return `${local[0]}•••${local[local.length - 1]}@${domain}`;
}

/** Purpose-scoped title slug — the client resolves to translated text. */
function titleSlugFor(purpose: OtpPurpose, locale: OtpLocale): string {
  return `otp.screen.title.${purpose}.${locale}`;
}

/**
 * Body sentence templates. Kept short and single-language.
 * "{pill}" is the ONLY interpolation token — the screen never
 * embeds anything else in the sentence.
 */
const BODY_TEMPLATES: {
  he: { phone: string; email: string };
  en: { phone: string; email: string };
} = {
  he: {
    phone: 'שלחנו קוד בן 6 ספרות למספר המסתיים ב-{pill}.',
    email: 'שלחנו קוד בן 6 ספרות לכתובת {pill}.',
  },
  en: {
    phone: 'We sent a 6-digit code to the number ending in {pill}.',
    email: 'We sent a 6-digit code to {pill}.',
  },
};

/** Change-destination CTA slug the screen renders as a secondary link. */
function changeDestinationSlugFor(channel: OtpChannel): string {
  return channel === 'sms'
    ? 'otp.cta.change_destination.PHONE'
    : 'otp.cta.change_destination.EMAIL';
}

/** Compose the full OTP screen view-model. Pure. */
export function composeOtpScreenSpec(input: ScreenSpecInput): OtpScreenSpec {
  const pill = input.channel === 'sms'
    ? maskPhoneTail(input.destination)
    : maskEmailForScreen(input.destination);

  const bodyTemplate = input.locale === 'he-IL'
    ? BODY_TEMPLATES.he[input.channel === 'sms' ? 'phone' : 'email']
    : BODY_TEMPLATES.en[input.channel === 'sms' ? 'phone' : 'email'];
  const body = bodyTemplate.replace('{pill}', pill);

  const countdown = formatCountdown(input.resendCooldownSeconds);
  return {
    titleSlug: titleSlugFor(input.purpose, input.locale),
    body,
    destinationPill: pill,
    resendCountdownDisplay: countdown,
    resendReady: countdown === '',
    changeDestinationSlug: changeDestinationSlugFor(input.channel),
  };
}
