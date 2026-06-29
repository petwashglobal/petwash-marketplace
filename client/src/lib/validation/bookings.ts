/**
 * Booking request schema. Business rules: pet required, dates required,
 * start not in the past, end on/after start. Price/amount is backend-only.
 */
import { z } from 'zod';
import { dateSchemas, isEndOnOrAfterStart } from './dates';
import { vmsg, type ValidationLang } from './messages';

export function bookingRequestSchema(lang: ValidationLang = 'en') {
  const d = dateSchemas(lang);
  return z
    .object({
      petId: z.string().trim().min(1, vmsg('validation.booking.petRequired', lang)),
      startDate: d.notPastDate,
      endDate: z.string().trim().min(1, vmsg('validation.booking.dateRequired', lang)),
    })
    .superRefine((val, ctx) => {
      if (val.startDate && val.endDate && !isEndOnOrAfterStart(val.startDate, val.endDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: vmsg('validation.date.endBeforeStart', lang),
        });
      }
    });
}
