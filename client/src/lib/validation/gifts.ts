/**
 * Send-a-Gift purchase. Business rule: recipient contact (email or mobile)
 * required BEFORE payment. Amount is a UX guard only — backend owns the charge.
 */
import { z } from 'zod';
import { fieldSchemas } from './fieldSchemas';
import { vmsg, type ValidationLang } from './messages';

export function giftPurchaseSchema(lang: ValidationLang = 'en', minAmount = 50, maxAmount = 5000) {
  const f = fieldSchemas(lang);
  return z
    .object({
      recipientName: z.string().trim().optional().or(z.literal('')),
      recipientEmail: f.emailOptional,
      recipientMobile: f.phoneOptional,
      amount: f.amount(minAmount, maxAmount),
      message: z.string().trim().max(500).optional().or(z.literal('')),
    })
    .superRefine((val, ctx) => {
      const hasContact = !!(val.recipientEmail && val.recipientEmail.length) || !!(val.recipientMobile && val.recipientMobile.length);
      if (!hasContact) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recipientEmail'],
          message: vmsg('validation.gift.recipientRequired', lang),
        });
      }
    });
}
