import { israeliFiscalDate } from '@shared/israel-compliance-config';

/**
 * Start instants of "today", "this month" and "this year" as an ISRAELI business
 * sees them. (2026-09-13)
 *
 * The admin analytics built these with `new Date(now.getFullYear(), now.getMonth(),
 * now.getDate())`, which is midnight in the SERVER's timezone. Cloud Run runs in
 * UTC, so "today's revenue" started at 02:00 or 03:00 Israel time and every sale
 * between local midnight and then landed on the previous day — and on the first of
 * the month, in the previous month.
 *
 * Built on israeliFiscalDate, the one place the repo already derives the Israel
 * calendar day, so reports and fiscal documents agree on which day a sale belongs to.
 */

/** The UTC instant at which the Israel calendar day `ymd` (yyyy-MM-dd) begins. DST-aware. */
export function israelMidnightUtc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  // Israel is UTC+2 (standard) or UTC+3 (daylight saving). Try both and keep the
  // instant that is inside `ymd` while the second before it is not.
  for (const offsetHours of [3, 2]) {
    const t = Date.UTC(y, m - 1, d, 0, 0, 0) - offsetHours * 3_600_000;
    if (israeliFiscalDate(new Date(t)) === ymd && israeliFiscalDate(new Date(t - 1000)) !== ymd) {
      return new Date(t);
    }
  }
  // Unreachable for Asia/Jerusalem; fail loudly rather than return a wrong boundary.
  throw new Error(`israelMidnightUtc: no Israel midnight found for ${ymd}`);
}

export function israelPeriodStarts(now: Date = new Date()) {
  const today = israeliFiscalDate(now);          // yyyy-MM-dd in Israel
  const [y, m] = today.split('-');
  return {
    todayStart: israelMidnightUtc(today),
    weekStart: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    monthStart: israelMidnightUtc(`${y}-${m}-01`),
    yearStart: israelMidnightUtc(`${y}-01-01`),
  };
}
