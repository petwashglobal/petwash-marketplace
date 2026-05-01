/**
 * Booking time-overlap helper.
 *
 * Pure functions only. Used by:
 *   - server/routes/booking-requests.ts /respond (accept branch) to
 *     reject a provider's accept that would conflict with another
 *     accepted/in-progress booking they already hold.
 *   - any future "is this slot free?" check.
 *
 * Two intervals overlap when:
 *     a.start < b.end  AND  a.end > b.start
 * Touching boundaries (a.end === b.start) do NOT count as overlap —
 * the provider can finish one booking at 12:00 and start the next
 * at 12:00 with zero seam.
 */

export interface TimeRange {
  start: Date | string | number;
  end:   Date | string | number;
}

/**
 * Statuses that count as "the provider is committed to this slot".
 * If any other booking with one of these statuses overlaps the new
 * window, accept must be refused.
 *
 * Rationale per status:
 *   pending                    — provider hasn't committed yet, doesn't block
 *   accepted                   — committed
 *   declined                   — terminal, doesn't block
 *   meet_greet_scheduled       — committed for the meet-greet slot
 *   meet_greet_completed       — committed
 *   payment_pending            — committed (waiting on customer to pay)
 *   confirmed                  — committed
 *   in_progress                — actively working
 *   provider_marked_complete   — actively pending owner approval
 *   completed                  — done, doesn't block
 *   reviewed                   — done
 *   cancelled                  — terminal, doesn't block
 *   disputed                   — slot is contested, treat as blocking
 */
export const BLOCKING_STATUSES: ReadonlyArray<string> = [
  'accepted',
  'meet_greet_scheduled',
  'meet_greet_completed',
  'payment_pending',
  'confirmed',
  'in_progress',
  'provider_marked_complete',
  'disputed',
];

/** Coerce a Date | string | number to milliseconds since epoch. */
function ms(v: Date | string | number): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return new Date(v).getTime();
}

/**
 * True when the two intervals overlap.
 *
 * Half-open semantics — a.end === b.start is NOT an overlap, so a
 * provider can hand off cleanly between back-to-back bookings.
 *
 * Returns false (rather than throwing) when any input is invalid.
 * The caller is responsible for treating "unknown" as "do not allow"
 * if that's the safer default — this helper is purely geometric.
 */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  const aStart = ms(a.start);
  const aEnd = ms(a.end);
  const bStart = ms(b.start);
  const bEnd = ms(b.end);
  if (
    Number.isNaN(aStart) || Number.isNaN(aEnd) ||
    Number.isNaN(bStart) || Number.isNaN(bEnd)
  ) {
    return false;
  }
  // Reject reversed intervals defensively (start >= end has no meaning).
  if (aStart >= aEnd || bStart >= bEnd) return false;
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Convenience filter: returns the subset of `existing` that conflicts
 * with `candidate` AND has a status in BLOCKING_STATUSES. Used by the
 * accept handler when the DB has already returned the provider's
 * recent bookings.
 */
export function findConflictingBookings<
  T extends TimeRange & { status: string }
>(candidate: TimeRange, existing: ReadonlyArray<T>): T[] {
  return existing.filter(b =>
    BLOCKING_STATUSES.includes(b.status) && rangesOverlap(candidate, b),
  );
}
