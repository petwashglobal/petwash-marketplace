/**
 * Money field validation — client-side UX guard ONLY.
 *
 * CRITICAL: the real amount, price, discount, wallet balance, and tier are
 * decided by the backend and must NEVER be trusted from the frontend. This
 * schema only stops obviously-bad input (non-numeric, negative, out of range)
 * before submit. It does not compute or authorize any charge.
 */

import type { ValidationLang } from './messages';
import { fieldSchemas } from './fieldSchemas';

/** Positive amount within [min,max], parsed to a number. UX guard only. */
export function amountSchema(min = 1, max = 100000, lang: ValidationLang = 'en') {
  return fieldSchemas(lang).amount(min, max);
}
