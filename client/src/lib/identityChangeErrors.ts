/**
 * Bilingual (HE / EN) copy for the identity-change server error codes.
 *
 * WHY: `apiRequest` throws an `ApiError` whose shape is
 *   { status, body, userMessage, message: "<status>: <server msg>" }
 * — there is NO `error.code` property. MyAccount's email-change handler tested
 * `error?.code === 'REAUTH_REQUIRED'`, which is ALWAYS false, so the one branch
 * that told the user something actionable ("sign out and back in") never ran and
 * they got the generic "Failed to send verification code" instead. Worse, the
 * fallback rendered `error.message`, i.e. the literal string `403:
 * Re-authentication required` — a raw status code shown to a customer.
 *
 * This module reads the code from the right place and returns real copy in the
 * user's language for every code the identity endpoints can emit.
 */

export type IdentityChangeCode =
  | 'REAUTH_REQUIRED'
  | 'EMAIL_ALREADY_IN_USE'
  | 'EMAIL_UNCHANGED'
  | 'INVALID_EMAIL'
  | 'INVALID_CODE'
  | 'CODE_EXPIRED'
  | 'TOO_MANY_ATTEMPTS'
  | 'TOO_MANY_REQUESTS'
  | 'CANONICAL_ROW_MISSING'
  | 'MOBILE_CHANGE_REQUIRES_VERIFICATION'
  | 'PHONE_ALREADY_IN_USE'
  | 'INVALID_PHONE'
  | 'NO_PHONE_LINKED'
  | 'VERIFICATION_CHALLENGE_REQUIRED'
  | 'IDENTITY_UPDATE_FAILED';

/** Pull the stable server code out of whatever the fetch layer threw. */
export function identityErrorCode(error: any): IdentityChangeCode | null {
  const code = error?.body?.code ?? error?.code ?? null;
  return typeof code === 'string' ? (code as IdentityChangeCode) : null;
}

const COPY: Record<IdentityChangeCode, { he: string; en: string }> = {
  REAUTH_REQUIRED: {
    he: 'מטעמי אבטחה, יש להתנתק ולהתחבר מחדש לפני שינוי פרטי ההתחברות.',
    en: 'For your security, sign out and sign in again before changing your sign-in details.',
  },
  EMAIL_ALREADY_IN_USE: {
    he: 'כתובת האימייל הזו כבר משויכת לחשבון אחר.',
    en: 'That email address is already linked to another account.',
  },
  EMAIL_UNCHANGED: {
    he: 'זו כבר כתובת האימייל שלך.',
    en: 'That is already your email address.',
  },
  INVALID_EMAIL: {
    he: 'כתובת אימייל לא תקינה.',
    en: 'That email address is not valid.',
  },
  INVALID_CODE: {
    he: 'קוד אימות שגוי.',
    en: 'That verification code is incorrect.',
  },
  CODE_EXPIRED: {
    he: 'תוקף קוד האימות פג. בקש קוד חדש.',
    en: 'That verification code has expired. Request a new one.',
  },
  TOO_MANY_ATTEMPTS: {
    he: 'יותר מדי ניסיונות שגויים. בקש קוד חדש.',
    en: 'Too many incorrect codes. Please request a new one.',
  },
  TOO_MANY_REQUESTS: {
    he: 'יותר מדי בקשות. נסה שוב בעוד מספר דקות.',
    en: 'Too many requests. Please try again in a few minutes.',
  },
  CANONICAL_ROW_MISSING: {
    he: 'לא הצלחנו לשמור את השינוי בחשבון שלך — השינוי לא בוצע. פנה לתמיכה.',
    en: 'We could not save the change to your account — it was NOT applied. Please contact support.',
  },
  MOBILE_CHANGE_REQUIRES_VERIFICATION: {
    he: 'שינוי מספר הנייד מחייב אימות ב-SMS. השתמש ב"אימות מספר טלפון".',
    en: 'Changing your mobile number requires SMS verification. Use "Verify Phone Number".',
  },
  PHONE_ALREADY_IN_USE: {
    he: 'מספר הטלפון הזה כבר משויך לחשבון PetWash אחר.',
    en: 'That phone number is already linked to another PetWash account.',
  },
  INVALID_PHONE: {
    he: 'מספר טלפון לא תקין. השתמש בפורמט בינלאומי, לדוגמה ‎+972541234567.',
    en: 'That phone number is not valid. Use international format, e.g. +972541234567.',
  },
  NO_PHONE_LINKED: {
    he: 'לא משויך מספר טלפון לחשבון. אמת מספר תחילה.',
    en: 'No phone number is linked to this account. Verify a number first.',
  },
  VERIFICATION_CHALLENGE_REQUIRED: {
    he: 'תהליך האימות פג. בקש קוד חדש.',
    en: 'That verification session has ended. Request a new code.',
  },
  IDENTITY_UPDATE_FAILED: {
    he: 'לא הצלחנו לעדכן את פרטי ההתחברות. נסה שוב.',
    en: 'We could not update your sign-in details. Please try again.',
  },
};

/**
 * Human copy for an identity-change failure, in the user's language.
 * Falls back to `ApiError.userMessage` (already sanitised) and NEVER to
 * `error.message`, which is prefixed with the raw HTTP status.
 */
export function identityErrorMessage(error: any, isHebrew: boolean, fallback: string): string {
  const code = identityErrorCode(error);
  if (code && COPY[code]) return isHebrew ? COPY[code].he : COPY[code].en;
  if (typeof error?.userMessage === 'string' && error.userMessage) return error.userMessage;
  return fallback;
}

/** True when the server is asking for a fresh sign-in before it will proceed. */
export function isReauthRequired(error: any): boolean {
  return identityErrorCode(error) === 'REAUTH_REQUIRED' || error?.status === 403;
}
