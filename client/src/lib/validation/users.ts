/**
 * User-domain form schemas: signup / login-completion / profile.
 * Backend still authorizes auth & identity — these are UX guards.
 */
import { z } from 'zod';
import { fieldSchemas } from './fieldSchemas';
import { dateSchemas } from './dates';
import type { ValidationLang } from './messages';

/** Email + password signup (+ optional name). */
export function signupSchema(lang: ValidationLang = 'en') {
  const f = fieldSchemas(lang);
  return z.object({
    email: f.email,
    password: f.password,
    fullName: f.requiredName.optional(),
  });
}

/** Member profile — contact details; user DOB must be logical (not future). */
export function userProfileSchema(lang: ValidationLang = 'en') {
  const f = fieldSchemas(lang);
  const d = dateSchemas(lang);
  return z.object({
    fullName: f.requiredName,
    email: f.email,
    phone: f.phoneOptional,
    dob: d.dobNotFuture.optional().or(z.literal('')),
    city: f.requiredString.optional().or(z.literal('')),
    postalCode: f.postalCodeOptional,
  });
}
