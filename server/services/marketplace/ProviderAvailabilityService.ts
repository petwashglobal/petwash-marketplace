/**
 * ProviderAvailabilityService — CEO PROGRAM 23 (Per-Service Availability).
 *
 * Pure evaluator. Availability is DECLARED PER SERVICE — a Dog Walker
 * calendar is NOT a Sitter calendar. Availability changes MUST NOT
 * erase an already-confirmed booking.
 *
 * Given:
 *   • the provider's declared weekly schedule for a specific service,
 *   • date-specific exceptions (closures, extra windows),
 *   • existing confirmed commitments,
 * the evaluator decides whether a requested time window is bookable
 * and, if not, WHY (stable reason slug).
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;   // 0 = Sunday

/**
 * A recurring availability block on a given weekday. Times are
 * "HH:MM" 24h in the provider's declared timezone. The evaluator
 * treats the range as [startTime, endTime) — endTime is exclusive.
 */
export interface WeeklySlot {
  weekday: Weekday;
  startTime: string;                        // "09:00"
  endTime: string;                          // "17:00"
}

/**
 * Per-date exception. Overrides the weekly slots for the given
 * ISO date (YYYY-MM-DD).
 *   kind: 'CLOSED' — the whole day is unavailable.
 *   kind: 'REPLACE' — the provided ranges REPLACE the recurring ones for that day.
 */
export type DateException =
  | { date: string; kind: 'CLOSED' }
  | { date: string; kind: 'REPLACE'; ranges: Array<{ startTime: string; endTime: string }> };

/** A previously confirmed booking that blocks its window. */
export interface CommittedBooking {
  bookingId: string;
  startAt: string;                          // ISO
  endAt: string;                            // ISO
}

export type AvailabilityOutcome =
  | { code: 'AVAILABLE' }
  | { code: 'OUTSIDE_WEEKLY_SCHEDULE' }
  | { code: 'DATE_CLOSED' }
  | { code: 'OUTSIDE_REPLACED_HOURS' }
  | { code: 'CONFLICT_EXISTING_BOOKING'; conflictBookingId: string }
  | { code: 'INVALID_INPUT'; reasonCode: string };

export interface AvailabilityInput {
  weeklySchedule: WeeklySlot[];
  exceptions?: DateException[];
  commitments?: CommittedBooking[];
  requested: { startAt: string; endAt: string };  // ISO
}

// ── Helpers ───────────────────────────────────────────────────────

function parseHhmm(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  if (!Number.isFinite(min) || min < 0 || min > 59) return null;
  return { h, m: min };
}

function dateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function withinDailyRange(reqStart: Date, reqEnd: Date, dayStart: string, dayEnd: string): boolean {
  const s = parseHhmm(dayStart);
  const e = parseHhmm(dayEnd);
  if (!s || !e) return false;
  const startFloor = new Date(Date.UTC(reqStart.getUTCFullYear(), reqStart.getUTCMonth(), reqStart.getUTCDate(), s.h, s.m));
  const endCeil    = new Date(Date.UTC(reqEnd.getUTCFullYear(),   reqEnd.getUTCMonth(),   reqEnd.getUTCDate(),   e.h, e.m));
  return reqStart >= startFloor && reqEnd <= endCeil;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ── The evaluator ─────────────────────────────────────────────────

export function evaluateAvailability(input: AvailabilityInput): AvailabilityOutcome {
  const start = new Date(input.requested.startAt);
  const end = new Date(input.requested.endAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return { code: 'INVALID_INPUT', reasonCode: 'REQUESTED_TIME_INVALID' };
  }
  if (end.getTime() <= start.getTime()) {
    return { code: 'INVALID_INPUT', reasonCode: 'REQUESTED_END_BEFORE_START' };
  }
  // Cross-day requests are rejected — availability is a per-day
  // concept for scheduling purposes; a multi-day request (sitter /
  // daycare) uses a different evaluator (per-night booking price
  // model already exists in ProviderPricingService).
  if (dateKey(start) !== dateKey(end)) {
    return { code: 'INVALID_INPUT', reasonCode: 'REQUEST_CROSSES_MIDNIGHT_UTC' };
  }

  const dayKey = dateKey(start);
  const exception = (input.exceptions ?? []).find((e) => e.date === dayKey);
  if (exception?.kind === 'CLOSED') return { code: 'DATE_CLOSED' };

  if (exception?.kind === 'REPLACE') {
    const inside = exception.ranges.some((r) => withinDailyRange(start, end, r.startTime, r.endTime));
    if (!inside) return { code: 'OUTSIDE_REPLACED_HOURS' };
  } else {
    const weekday = start.getUTCDay() as Weekday;
    const relevant = input.weeklySchedule.filter((s) => s.weekday === weekday);
    const inside = relevant.some((s) => withinDailyRange(start, end, s.startTime, s.endTime));
    if (!inside) return { code: 'OUTSIDE_WEEKLY_SCHEDULE' };
  }

  const conflict = (input.commitments ?? []).find((c) => {
    const cs = new Date(c.startAt);
    const ce = new Date(c.endAt);
    return overlaps(start, end, cs, ce);
  });
  if (conflict) return { code: 'CONFLICT_EXISTING_BOOKING', conflictBookingId: conflict.bookingId };

  return { code: 'AVAILABLE' };
}
