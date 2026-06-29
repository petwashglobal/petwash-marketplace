/**
 * Centralized, localized validation messages.
 *
 * Single source of truth for field-level error copy so every form shows the
 * SAME wording in the SAME language. Currently he + en (the two languages the
 * app renders for in practice); other languages fall back to English until
 * translations are added below — extend each key with ar/ru/fr/es as needed.
 *
 * Used by ./fieldSchemas.ts. Do not hardcode validation strings in forms —
 * import a schema from fieldSchemas, or call vmsg() for a one-off message.
 */

export type ValidationLang = 'he' | 'en';

export type ValidationMessageKey =
  | 'required'
  | 'email_invalid'
  | 'phone_invalid'
  | 'israeli_id_invalid'
  | 'postal_code_invalid'
  | 'amount_invalid'
  | 'amount_min'
  | 'amount_max'
  | 'password_too_short'
  | 'password_needs_upper'
  | 'password_needs_number'
  | 'text_too_short'
  | 'text_too_long'
  | 'consent_required'
  | 'name_too_short';

// en is the guaranteed fallback. Add more languages per key over time.
const MESSAGES: Record<ValidationMessageKey, { en: string; he: string }> = {
  required: { en: 'This field is required', he: 'שדה חובה' },
  email_invalid: { en: 'Please enter a valid email address', he: 'אנא הזן כתובת אימייל תקינה' },
  phone_invalid: { en: 'Please enter a valid phone number', he: 'אנא הזן מספר טלפון תקין' },
  israeli_id_invalid: { en: 'Please enter a valid ID number', he: 'אנא הזן מספר תעודת זהות תקין' },
  postal_code_invalid: { en: 'Please enter a valid postal code', he: 'אנא הזן מיקוד תקין' },
  amount_invalid: { en: 'Please enter a valid amount', he: 'אנא הזן סכום תקין' },
  amount_min: { en: 'Amount is below the minimum', he: 'הסכום נמוך מהמינימום' },
  amount_max: { en: 'Amount is above the maximum', he: 'הסכום גבוה מהמקסימום' },
  password_too_short: { en: 'Password must be at least 8 characters', he: 'הסיסמה חייבת להכיל לפחות 8 תווים' },
  password_needs_upper: { en: 'Password must include an uppercase letter', he: 'הסיסמה חייבת לכלול אות גדולה' },
  password_needs_number: { en: 'Password must include a number', he: 'הסיסמה חייבת לכלול ספרה' },
  text_too_short: { en: 'This is too short', he: 'הטקסט קצר מדי' },
  text_too_long: { en: 'This is too long', he: 'הטקסט ארוך מדי' },
  consent_required: { en: 'Please accept to continue', he: 'יש לאשר כדי להמשיך' },
  name_too_short: { en: 'Please enter your full name', he: 'אנא הזן שם מלא' },
};

/** Resolve a validation message key into a localized string (en fallback). */
export function vmsg(key: ValidationMessageKey, lang: ValidationLang | string = 'en'): string {
  const entry = MESSAGES[key];
  if (!entry) return key;
  // Tolerate region tags like 'he-IL'; everything non-Hebrew falls back to en.
  return String(lang).toLowerCase().startsWith('he') ? entry.he : entry.en;
}
