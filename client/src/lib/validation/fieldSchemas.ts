/**
 * Centralized field validation — the single source of truth every form imports.
 *
 * Stack (all already installed, no new deps): zod + libphonenumber-js.
 * Pair with react-hook-form via zodResolver, and render errors with the
 * existing <FormMessage /> component (client/src/components/ui/form.tsx).
 *
 * Usage:
 *   const schemas = fieldSchemas(language);            // language-aware messages
 *   const formSchema = z.object({
 *     email: schemas.email,
 *     phone: schemas.phone,
 *     fullName: schemas.requiredName,
 *   });
 *   const form = useForm({ resolver: zodResolver(formSchema) });
 *
 * Standalone validators (isValidIsraeliId, isValidPhone) are exported for
 * non-zod call sites that need a quick boolean.
 */

import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { vmsg, type ValidationLang } from './messages';

/**
 * Israeli national-ID checksum (mirrors server/lib/israeliId.ts — the backend
 * remains the source of truth; this is for immediate client-side feedback).
 */
export function isValidIsraeliId(id: string): boolean {
  const digits = (id || '').replace(/\D/g, '');
  if (digits.length === 0 || digits.length > 9 || /^0+$/.test(digits)) return false;
  const padded = digits.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = parseInt(padded[i], 10) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * A value "looks like" an Israeli ID (pure ≤9-digit string). Passports/licences
 * contain letters and are left alone (return false → skip ID checksum).
 */
export function looksLikeIsraeliId(id: string): boolean {
  const v = (id || '').trim();
  return v.length > 0 && /^\d{1,9}$/.test(v.replace(/\D/g, '')) && /^\d+$/.test(v);
}

/** E.164 phone validity via libphonenumber-js (same engine as <PhoneInput />). */
export function isValidPhone(value: string): boolean {
  if (!value) return false;
  try {
    return isValidPhoneNumber(value);
  } catch {
    return false;
  }
}

/** Israeli postal code: 5–7 digits. */
const POSTAL_CODE_RE = /^\d{5,7}$/;

/**
 * Build the canonical set of reusable field schemas with localized messages.
 * Call per render with the active language so error copy matches the UI.
 */
export function fieldSchemas(lang: ValidationLang | string = 'en') {
  const m = (key: Parameters<typeof vmsg>[0]) => vmsg(key, lang);

  return {
    /** Required, format-checked email. */
    email: z.string().trim().min(1, m('required')).email(m('email_invalid')),

    /** Optional email — empty allowed, but if present must be valid. */
    emailOptional: z
      .string()
      .trim()
      .refine((v) => v === '' || z.string().email().safeParse(v).success, m('email_invalid'))
      .optional()
      .or(z.literal('')),

    /** Required intl phone (E.164). */
    phone: z.string().trim().min(1, m('required')).refine(isValidPhone, m('phone_invalid')),

    /** Optional phone — empty allowed, but if present must be valid. */
    phoneOptional: z
      .string()
      .trim()
      .refine((v) => !v || isValidPhone(v), m('phone_invalid'))
      .optional()
      .or(z.literal('')),

    /** Israeli national ID with checksum. */
    israeliId: z
      .string()
      .trim()
      .min(1, m('required'))
      .refine((v) => isValidIsraeliId(v), m('israeli_id_invalid')),

    /** Israeli postal code (5–7 digits). */
    postalCode: z.string().trim().regex(POSTAL_CODE_RE, m('postal_code_invalid')),

    /** Optional postal code. */
    postalCodeOptional: z
      .string()
      .trim()
      .refine((v) => !v || POSTAL_CODE_RE.test(v), m('postal_code_invalid'))
      .optional()
      .or(z.literal('')),

    /** Required full name (≥2 chars). */
    requiredName: z.string().trim().min(2, m('name_too_short')),

    /** Strong password: ≥8 chars, one uppercase, one number. */
    password: z
      .string()
      .min(8, m('password_too_short'))
      .regex(/[A-Z]/, m('password_needs_upper'))
      .regex(/\d/, m('password_needs_number')),

    /** Consent checkbox — must be true. */
    consent: z.literal(true, {
      errorMap: () => ({ message: m('consent_required') }),
    }),

    /** Generic required string. */
    requiredString: z.string().trim().min(1, m('required')),

    /** Required text with min/max length. */
    text: (min = 1, max = 5000) =>
      z
        .string()
        .trim()
        .min(min, min <= 1 ? m('required') : m('text_too_short'))
        .max(max, m('text_too_long')),

    /**
     * Positive money amount within [min, max], parsed from string. Returns a
     * number. NOTE: client-side guard only — the server re-validates all money.
     */
    amount: (min = 1, max = 100000) =>
      z
        .union([z.string(), z.number()])
        .transform((v) => (typeof v === 'number' ? v : Number(String(v).replace(/[^\d.]/g, ''))))
        .refine((n) => !Number.isNaN(n) && n > 0, m('amount_invalid'))
        .refine((n) => n >= min, m('amount_min'))
        .refine((n) => n <= max, m('amount_max')),
  };
}

export type FieldSchemas = ReturnType<typeof fieldSchemas>;
