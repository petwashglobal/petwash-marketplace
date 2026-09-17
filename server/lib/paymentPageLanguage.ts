import type { Request } from 'express';

/**
 * Which language SUMIT's hosted payment page opens in.
 *
 * SUMIT's page speaks Hebrew, English, Arabic and Spanish (swagger
 * Accounting_Typed_Language; "Payment page language — Defaults to Hebrew").
 * We used to send 'Hebrew' always, so a tourist paying with a foreign card —
 * which Upay accepts — got a Hebrew-only card form (2026-09-17). Russian,
 * French and anything else fall back to English, the language a foreign
 * card holder is most likely to read.
 */
export type SumitPageLanguage = 'Hebrew' | 'English' | 'Arabic' | 'Spanish';

export function sumitPageLanguage(code?: string | null): SumitPageLanguage {
  const c = String(code ?? '').trim().toLowerCase().slice(0, 2);
  if (c === '' || c === 'he' || c === 'iw') return 'Hebrew';
  if (c === 'ar') return 'Arabic';
  if (c === 'es') return 'Spanish';
  return 'English';
}

/**
 * The customer's language for this payment: what the site is showing
 * (body.language, sent by the client), else their saved profile language,
 * else the browser's first Accept-Language, else Hebrew.
 */
export function paymentLanguageFor(req: Pick<Request, 'body' | 'headers'>, profileLanguage?: string | null): string {
  const fromBody = typeof req.body?.language === 'string' ? req.body.language : '';
  if (/^[a-z]{2}(-[A-Za-z]{2})?$/.test(fromBody)) return fromBody.slice(0, 2);
  if (profileLanguage && /^[a-z]{2}/i.test(profileLanguage)) return profileLanguage.slice(0, 2).toLowerCase();
  const accept = String(req.headers?.['accept-language'] || '').split(',')[0]?.trim() || '';
  if (/^[a-z]{2}/i.test(accept)) return accept.slice(0, 2).toLowerCase();
  return 'he';
}
