/**
 * Date & age validation — the business-rule logic that field primitives don't
 * cover. All checks are inclusive-of-today where sensible and tolerant of
 * empty input (let `.required` handle emptiness separately).
 *
 * Standalone helpers are pure (testable); schema factories carry localized
 * messages. NOTE: the backend re-validates all dates — this is UX only.
 */

import { z } from 'zod';
import { vmsg, type ValidationLang } from './messages';

/** Parse a YYYY-MM-DD or ISO string to a Date; returns null if invalid. */
export function parseDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Age in whole years as of today. Returns null for unparseable input. */
export function ageInYears(dob: string | Date): number | null {
  const d = parseDate(dob);
  if (!d) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/** True if the DOB makes the person at least `minAge` (default 18). */
export function isAtLeastAge(dob: string | Date, minAge = 18): boolean {
  const age = ageInYears(dob);
  return age !== null && age >= minAge;
}

/** True if the date is strictly in the future (after end of today). */
export function isFutureDate(value: string | Date): boolean {
  const d = parseDate(value);
  if (!d) return false;
  return d.getTime() > Date.now();
}

/** True if the date is today or earlier (not in the future). */
export function isNotFutureDate(value: string | Date): boolean {
  const d = parseDate(value);
  if (!d) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return d.getTime() <= endOfToday.getTime();
}

/** True if the date is today or later (not in the past). */
export function isNotPastDate(value: string | Date): boolean {
  const d = parseDate(value);
  if (!d) return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return d.getTime() >= startOfToday.getTime();
}

/** True if end is on/after start (both parseable). */
export function isEndOnOrAfterStart(start: string | Date, end: string | Date): boolean {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e) return false;
  return e.getTime() >= s.getTime();
}

/** Date schemas with localized messages. */
export function dateSchemas(lang: ValidationLang = 'en') {
  const m = (k: Parameters<typeof vmsg>[0]) => vmsg(k, lang);

  return {
    /** Required date string. */
    required: z.string().trim().min(1, m('validation.date.required')),

    /** Date of birth that must not be in the future (pets, users). */
    dobNotFuture: z
      .string()
      .trim()
      .min(1, m('validation.date.required'))
      .refine((v) => isNotFutureDate(v), m('validation.date.notFuture')),

    /** Adult DOB — must be ≥18 (provider applicants). */
    adultDob: z
      .string()
      .trim()
      .min(1, m('validation.date.required'))
      .refine((v) => isNotFutureDate(v), m('validation.date.notFuture'))
      .refine((v) => isAtLeastAge(v, 18), m('validation.user.mustBe18')),

    /** A date that must be in the future. */
    futureDate: z
      .string()
      .trim()
      .min(1, m('validation.date.required'))
      .refine((v) => isFutureDate(v), m('validation.date.futureRequired')),

    /** A date that must not be in the past (booking start; allow admin override upstream). */
    notPastDate: z
      .string()
      .trim()
      .min(1, m('validation.date.required'))
      .refine((v) => isNotPastDate(v), m('validation.booking.startInPast')),
  };
}

/**
 * Reusable cross-field refinement: end date on/after start date.
 * Apply with `.superRefine` or `.refine` on the parent object schema.
 */
export function endAfterStartRefinement(
  start: string | Date,
  end: string | Date,
  lang: ValidationLang = 'en',
): { ok: boolean; message: string } {
  return {
    ok: isEndOnOrAfterStart(start, end),
    message: vmsg('validation.date.endBeforeStart', lang),
  };
}
