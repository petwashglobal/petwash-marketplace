/**
 * Provider application schema. Business rules:
 * - applicant must be 18+ (adultDob)
 * - at least one requested service
 * - valid email + phone; Israeli ID checksum where applicable
 * Backend re-validates and approval is admin-gated (no auto-activation).
 */
import { z } from 'zod';
import { fieldSchemas, looksLikeIsraeliId, isValidIsraeliId } from './fieldSchemas';
import { dateSchemas } from './dates';
import { vmsg, type ValidationLang } from './messages';

export function providerApplicationSchema(lang: ValidationLang = 'en') {
  const f = fieldSchemas(lang);
  const d = dateSchemas(lang);
  return z.object({
    legalName: f.requiredName,
    email: f.email,
    phone: f.phone,
    dob: d.adultDob, // enforces 18+
    // National ID: only checksum-validate values that look like an Israeli ID
    // (passports/licences contain letters and are accepted as-is).
    nationalId: z
      .string()
      .trim()
      .min(1, vmsg('validation.required', lang))
      .refine((v) => !looksLikeIsraeliId(v) || isValidIsraeliId(v), vmsg('validation.id.invalid', lang)),
    requestedServices: z.array(z.string()).min(1, vmsg('validation.provider.serviceRequired', lang)),
    city: f.requiredString,
    country: f.requiredString,
    postalCode: f.postalCodeOptional,
  });
}
