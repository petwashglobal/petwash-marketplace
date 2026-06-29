/**
 * Pet Passport schema. Business rules: name required, pet DOB cannot be future.
 */
import { z } from 'zod';
import { fieldSchemas } from './fieldSchemas';
import { dateSchemas } from './dates';
import { vmsg, type ValidationLang } from './messages';

export function petPassportSchema(lang: ValidationLang = 'en') {
  const f = fieldSchemas(lang);
  const d = dateSchemas(lang);
  return z.object({
    petName: z.string().trim().min(1, vmsg('validation.pet.nameRequired', lang)),
    petType: f.requiredString,
    breed: z.string().trim().optional().or(z.literal('')),
    dob: d.dobNotFuture.optional().or(z.literal('')),
    weight: z.string().trim().optional().or(z.literal('')),
  });
}
