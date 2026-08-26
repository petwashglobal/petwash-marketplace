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
  | 'SITTER_SUITE'       // sitter_bookings native pipeline
  | 'WALK'               // walk_bookings native pipeline
  | 'ACADEMY'            // trainer_bookings native pipeline
  | 'UNIFIED_REQUEST'    // POSITIVELY no legacy mirror — canonical marketplace booking
  | 'UNKNOWN_SOURCE';    // legacyRef PRESENT but malformed/unknown → NEVER dispatch

export interface BookingSourceResolution {
  source: BookingSource;
  legacyBookingId?: string;
  legacyTable?: 'sitter_bookings' | 'walk_bookings' | 'trainer_bookings';
  /** Populated when source==='UNKNOWN_SOURCE' — the raw table + id we
   *  saw so the reconciliation signal can be traced. */
  unresolvedRef?: { table: string | null; id: string | null };
}

/**
 * Resolve the authoritative accept path from a booking_requests row's
 * `quote_breakdown` JSON. The legacyBookingBridge writes a
 * `legacyRef: { table, id }` field at mirror-create time (see
 * server/services/legacyBookingBridge.ts).
 *
 * CEO 2026-08-26 correction pass #3 §2-3: absence of legacyRef is
 * treated as UNIFIED_REQUEST ONLY because that IS the positive
 * discriminator today — every legacy source writes the ref on
 * bridge-create. A legacyRef that IS present but malformed or unknown
 * is NOT treated as UNIFIED — that would be a hopeful fallback that
 * could route an unknown money pipeline through the wrong path.
 * Malformed/unknown legacyRef → UNKNOWN_SOURCE, which the dispatcher
 * refuses to touch (returns BOOKING_SOURCE_UNRESOLVED); reconciliation
 * gets an observable signal.
 *
 * A future PR that changes the mirror-create semantics MUST also
 * update this resolver — the guard is verified by the regression
 * test in `bookingResponseDispatcher.regression.test.ts`.
 */
export function resolveBookingSource(quoteBreakdown: unknown): BookingSourceResolution {
  const qb = (quoteBreakdown ?? {}) as { legacyRef?: { table?: unknown; id?: unknown } };
  const ref = qb?.legacyRef;

  // No legacyRef at all → native marketplace booking (positive rule).
  if (!ref || typeof ref !== 'object') {
    return { source: 'UNIFIED_REQUEST' };
  }

  const tableRaw = (ref as any).table;
  const idRaw = (ref as any).id;
  const table = typeof tableRaw === 'string' ? tableRaw : null;
  const id =
    typeof idRaw === 'string' || typeof idRaw === 'number' ? String(idRaw) : null;

  if (table === 'sitter_bookings' && id)  return { source: 'SITTER_SUITE', legacyBookingId: id, legacyTable: 'sitter_bookings' };
  if (table === 'walk_bookings' && id)    return { source: 'WALK',         legacyBookingId: id, legacyTable: 'walk_bookings' };
  if (table === 'trainer_bookings' && id) return { source: 'ACADEMY',      legacyBookingId: id, legacyTable: 'trainer_bookings' };

  // legacyRef PRESENT but malformed/unknown → refuse to guess a pipeline.
  return { source: 'UNKNOWN_SOURCE', unresolvedRef: { table, id } };
}
