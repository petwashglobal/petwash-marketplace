/**
 * OtpMessageTemplateCatalog — CEO OTP brief §2 (task #179).
 *
 * Doctrine: "Generic messages such as 'Your verification code is
 * 123456' are not good enough. Use contextual messages. The message
 * must tell the customer WHY they received the code."
 *
 * This file DECLARES the SMS + email template for every
 * (purpose × locale) combination. Templates are:
 *   • Short — one SMS segment where possible.
 *   • Branded — every SMS starts with "Pet Wash™:" so the user
 *     can spot it against phishing.
 *   • Action-specific — the message names the action the code
 *     approves (activation / booking / purchase / etc.).
 *   • Localised — ONE language per SMS, chosen from the user's
 *     preferred locale (§4). Never bilingual concatenation.
 *   • Time-bounded — every template names the validity window.
 *   • Safety-tagged — money-moving purposes carry the "do not
 *     share" warning; ownership-only checks do not (to keep the
 *     SMS short).
 *
 * Pure — no I/O, no gateway calls. The runtime OTP sender resolves
 * (purpose, locale, code, ttl) → rendered string via renderOtpSms /
 * renderOtpEmail and hands the string to the delivery adapter.
 *
 * Renderer contract: NEVER interpolates anything other than {code}
 * and {minutes} into the message body. That keeps the template
 * regex-anchored so a source-anchored regression pin can verify
 * every rendered SMS still carries "Pet Wash™:" and the code
 * position iOS/Android autofill expects (task #183).
 */

import { type OtpPurpose } from './otpPurposeRegistry';

export const OTP_LOCALES = ['he-IL', 'en'] as const;
export type OtpLocale = (typeof OTP_LOCALES)[number];

export function isOtpLocale(v: unknown): v is OtpLocale {
  return typeof v === 'string' && (OTP_LOCALES as readonly string[]).includes(v);
}

/**
 * The canonical Israeli PetWash brand prefix that every SMS starts
 * with. Kept as a constant so a regression pin can assert it is
 * present in every rendered message.
 */
export const OTP_SMS_BRAND_PREFIX = 'Pet Wash™:';

export interface RenderInput {
  purpose: OtpPurpose;
  locale: OtpLocale;
  code: string;                      // e.g. "123456"
  minutes: number;                   // TTL in whole minutes
}

/**
 * Purposes that MOVE MONEY or grant sensitive account access and
 * therefore need the "if you did not initiate this action, do not
 * share the code" warning appended.
 */
const NEEDS_SAFETY_WARNING = new Set<OtpPurpose>([
  'BOOKING_CONFIRMATION',
  'PURCHASE_CONFIRMATION',
  'GIFT_PURCHASE',
  'PASSWORD_RECOVERY',
  'CLOSE_ACCOUNT',
  'CHANGE_PAYOUT_DESTINATION',
  'SENSITIVE_ACCOUNT_CHANGE',
  'PROVIDER_SECURITY_STEPUP',
]);

/**
 * Short, purpose-specific one-liner. The renderer prepends the
 * brand prefix and appends the TTL sentence and (if applicable)
 * the safety warning.
 *
 * "{code}" and "{minutes}" are the ONLY interpolation tokens. Every
 * other content is verbatim, so a regression pin on the template
 * body can assert brand + code position + language purity.
 */
type PurposeMessagePair = { he: string; en: string };
const PURPOSE_ONE_LINER: Record<OtpPurpose, PurposeMessagePair> = {
  ACCOUNT_ACTIVATION: {
    he: 'קוד האימות להפעלת החשבון שלך הוא {code}.',
    en: 'Your account activation code is {code}.',
  },
  EMAIL_VERIFICATION: {
    he: 'קוד האימות לכתובת האימייל שלך הוא {code}.',
    en: 'Your email verification code is {code}.',
  },
  PHONE_VERIFICATION: {
    he: 'קוד האימות למספר הטלפון שלך הוא {code}.',
    en: 'Your phone verification code is {code}.',
  },
  LOGIN: {
    he: 'קוד ההתחברות שלך הוא {code}.',
    en: 'Your sign-in code is {code}.',
  },
  PASSWORD_RECOVERY: {
    he: 'קוד לאיפוס הסיסמה שלך הוא {code}.',
    en: 'Your password reset code is {code}.',
  },
  PROVIDER_SECURITY_STEPUP: {
    he: 'קוד לאישור פעולה מאובטחת בחשבון הספק הוא {code}.',
    en: 'Your provider security verification code is {code}.',
  },
  BOOKING_CONFIRMATION: {
    he: 'קוד האימות לאישור ההזמנה שלך הוא {code}.',
    en: 'Your booking verification code is {code}.',
  },
  PURCHASE_CONFIRMATION: {
    he: 'קוד האימות לאישור הרכישה שלך הוא {code}.',
    en: 'Your purchase verification code is {code}.',
  },
  GIFT_PURCHASE: {
    he: 'קוד האימות לרכישת הגיפט קארד שלך הוא {code}.',
    en: 'Your gift card purchase verification code is {code}.',
  },
  CLOSE_ACCOUNT: {
    he: 'קוד לאישור סגירת החשבון שלך הוא {code}.',
    en: 'Your account closure verification code is {code}.',
  },
  CHANGE_PAYOUT_DESTINATION: {
    he: 'קוד לאישור שינוי חשבון הבנק לתשלומים הוא {code}.',
    en: 'Your payout account change verification code is {code}.',
  },
  SENSITIVE_ACCOUNT_CHANGE: {
    he: 'קוד לאישור שינוי מאובטח בחשבון שלך הוא {code}.',
    en: 'Your sensitive account change verification code is {code}.',
  },
};

const TTL_SENTENCE: PurposeMessagePair = {
  he: 'הקוד תקף ל-{minutes} דקות.',
  en: 'It is valid for {minutes} minutes.',
};

const SAFETY_WARNING: PurposeMessagePair = {
  he: 'אם לא ביצעת פעולה זו, אין למסור את הקוד.',
  en: 'If you did not initiate this action, do not share this code.',
};

function interp(template: string, code: string, minutes: number): string {
  return template.replace('{code}', code).replace('{minutes}', String(minutes));
}

function pickLocale(pair: PurposeMessagePair, locale: OtpLocale): string {
  return locale === 'he-IL' ? pair.he : pair.en;
}

/**
 * Render the SMS body for a given (purpose, locale). Includes:
 *   BRAND_PREFIX + one-liner + TTL_SENTENCE + (optional SAFETY_WARNING)
 *
 * Single-language output — never bilingual — per §4.
 */
export function renderOtpSms(input: RenderInput): string {
  const one = interp(pickLocale(PURPOSE_ONE_LINER[input.purpose], input.locale), input.code, input.minutes);
  const ttl = interp(pickLocale(TTL_SENTENCE, input.locale), input.code, input.minutes);
  const parts = [OTP_SMS_BRAND_PREFIX, one, ttl];
  if (NEEDS_SAFETY_WARNING.has(input.purpose)) {
    parts.push(pickLocale(SAFETY_WARNING, input.locale));
  }
  return parts.join(' ');
}

/**
 * Render the email body for a given (purpose, locale). Longer form,
 * with a leading greeting line and the same code + TTL + safety
 * discipline. Callers layer this into an HTML template.
 */
export function renderOtpEmail(input: RenderInput): { subjectSlug: string; body: string } {
  const subjectSlug = `otp.email.subject.${input.purpose}`;
  const body = renderOtpSms(input);   // v1 reuses the SMS body verbatim; a real HTML template lands later.
  return { subjectSlug, body };
}
