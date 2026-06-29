/**
 * Waitlist / wishlist demand capture. Low-friction: name optional, but at least
 * one contact (email or mobile) is required so we can follow up.
 */
import { z } from 'zod';
import { fieldSchemas } from './fieldSchemas';
import { vmsg, type ValidationLang } from './messages';

export function waitlistSchema(lang: ValidationLang = 'en') {
  const f = fieldSchemas(lang);
  return z
    .object({
      name: z.string().trim().optional().or(z.literal('')),
      email: f.emailOptional,
      mobile: f.phoneOptional,
      city: z.string().trim().optional().or(z.literal('')),
      consentMarketing: z.boolean().optional(),
    })
    .superRefine((val, ctx) => {
      const hasContact = !!(val.email && val.email.length) || !!(val.mobile && val.mobile.length);
      if (!hasContact) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email'],
          message: vmsg('validation.gift.recipientRequired', lang),
        });
      }
    });
}
