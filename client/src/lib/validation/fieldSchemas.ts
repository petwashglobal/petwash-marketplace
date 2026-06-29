/**
 * Common field validation — reusable primitives every form composes from.
 *
 * Stack (all already installed, no new deps): zod + libphonenumber-js.
 * Pair with react-hook-form via zodResolver, and render errors with the
 * existing <FormMessage /> component (client/src/components/ui/form.tsx).
 *
 * Usage:
 *   const f = fieldSchemas(language);                  // language-aware messages
 *   const formSchema = z.object({ email: f.email, phone: f.phone });
 *   const form = useForm({ resolver: zodResolver(formSchema) });
 *
 * Standalone validators (isValidIsraeliId, isValidPhone) are exported for
 * non-zod call sites. Domain object schemas live in the sibling files
 * (users.ts, providers.ts, pets.ts, bookings.ts, pawFinder.ts, …) and the
 * barrel is index.ts.
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
export const POSTAL_CODE_RE = /^\d{5,7}$/;

/**
 * Build the canonical set of reusable field schemas with localized messages.
 * Call per render with the active language so error copy matches the UI.
 */
export function fieldSchemas(lang: ValidationLang = 'en') {
  const m = (key: Parameters<typeof vmsg>[0]) => vmsg(key, lang);

  return {
    /** Required, format-checked email. */
    email: z.string().trim().min(1, m('validation.required')).email(m('validation.email.invalid')),

    /** Optional email — empty allowed, but if present must be valid. */
    emailOptional: z
      .string()
      .trim()
      .refine((v) => v === '' || z.string().email().safeParse(v).success, m('validation.email.invalid'))
      .optional()
      .or(z.literal('')),

    /** Required intl phone (E.164). */
    phone: z.string().trim().min(1, m('validation.required')).refine(isValidPhone, m('validation.phone.invalid')),

    /** Optional phone — empty allowed, but if present must be valid. */
    phoneOptional: z
      .string()
      .trim()
      .refine((v) => !v || isValidPhone(v), m('validation.phone.invalid'))
      .optional()
      .or(z.literal('')),

    /** Israeli national ID with checksum. */
    israeliId: z
      .string()
      .trim()
      .min(1, m('validation.required'))
      .refine((v) => isValidIsraeliId(v), m('validation.id.invalid')),

    /** Israeli postal code (5–7 digits). */
    postalCode: z.string().trim().regex(POSTAL_CODE_RE, m('validation.postalCode.invalid')),

    /** Optional postal code. */
    postalCodeOptional: z
      .string()
      .trim()
      .refine((v) => !v || POSTAL_CODE_RE.test(v), m('validation.postalCode.invalid'))
      .optional()
      .or(z.literal('')),

    /** Required full name (≥2 chars). */
    requiredName: z.string().trim().min(2, m('validation.name.required')),

    /** Strong password: ≥8 chars, one uppercase, one number. */
    password: z
      .string()
      .min(8, m('validation.password.tooShort'))
      .regex(/[A-Z]/, m('validation.password.needsUpper'))
      .regex(/\d/, m('validation.password.needsNumber')),

    /** Consent checkbox — must be true. */
    consent: z.literal(true, {
      errorMap: () => ({ message: m('validation.consent.required') }),
    }),

    /** Generic required string. */
    requiredString: z.string().trim().min(1, m('validation.required')),

    /** Required text with min/max length. */
    text: (min = 1, max = 5000) =>
      z
        .string()
        .trim()
        .min(min, min <= 1 ? m('validation.required') : m('validation.text.tooShort'))
        .max(max, m('validation.text.tooLong')),

    /**
     * Positive money amount within [min, max], parsed from string. Returns a
     * number. NOTE: client-side guard only — the server re-validates all money.
     */
    amount: (min = 1, max = 100000) =>
      z
        .union([z.string(), z.number()])
        .transform((v) => (typeof v === 'number' ? v : Number(String(v).replace(/[^\d.]/g, ''))))
        .refine((n) => !Number.isNaN(n) && n > 0, m('validation.payment.amountInvalid'))
        .refine((n) => n >= min, m('validation.payment.amountMin'))
        .refine((n) => n <= max, m('validation.payment.amountMax')),
  };
}

export type FieldSchemas = ReturnType<typeof fieldSchemas>;
