/**
 * bookingSourceResolver — pure function that reads
 * `booking_requests.quote_breakdown.legacyRef` and returns which
 * native accept pipeline owns the money for this booking.
 *
 * READ-ONLY. Never touches money. Never mutates. Never invokes a
 * pipeline. The dispatcher (`BookingResponseDispatcher`) uses this to
 * pick a delegate; the observability layer uses it to record what
 * the dispatcher WOULD have done (shadow mode) before we cut the
 * money over.
 *
 * Design note: docs/design/2026-08-26-booking-accept-dispatcher.md
 */

export type BookingSource =
  | 'SITTER_SUITE'      // sitter_bookings native pipeline
  | 'WALK'              // walk_bookings native pipeline
  | 'ACADEMY'           // trainer_bookings native pipeline
  | 'UNIFIED_REQUEST';  // no legacy mirror — canonical booking_requests

export interface BookingSourceResolution {
  source: BookingSource;
  legacyBookingId?: string;
  legacyTable?: 'sitter_bookings' | 'walk_bookings' | 'trainer_bookings';
}

/**
 * Resolve the authoritative accept path from a booking_requests row's
 * `quote_breakdown` JSON. The legacyBookingBridge writes a
 * `legacyRef: { table, id }` field at mirror-create time (see
 * server/services/legacyBookingBridge.ts). Rows without a legacyRef
 * are native marketplace bookings that live only in booking_requests.
 */
export function resolveBookingSource(quoteBreakdown: unknown): BookingSourceResolution {
  const qb = (quoteBreakdown ?? {}) as { legacyRef?: { table?: unknown; id?: unknown } };
  const ref = qb.legacyRef;
  const table = typeof ref?.table === 'string' ? ref.table : null;
  const id = typeof ref?.id === 'string' || typeof ref?.id === 'number' ? String(ref.id) : undefined;

  if (table === 'sitter_bookings' && id)  return { source: 'SITTER_SUITE', legacyBookingId: id, legacyTable: 'sitter_bookings' };
  if (table === 'walk_bookings' && id)    return { source: 'WALK',         legacyBookingId: id, legacyTable: 'walk_bookings' };
  if (table === 'trainer_bookings' && id) return { source: 'ACADEMY',      legacyBookingId: id, legacyTable: 'trainer_bookings' };
  return { source: 'UNIFIED_REQUEST' };
}
