/**
 * Canonical ServiceSession DTO — the shape every client reads for
 * "what's happening with this booking's live execution right now".
 *
 * Per CEO 2026-08-18 §12 + §13: booking is the COMMERCIAL/SCHEDULING
 * object; ServiceSession is the ACTUAL LIVE EXECUTION. The customer's
 * "Track Service" screen, the provider's "Live service" screen, and any
 * future report/photos surface all read this shape.
 *
 * Per §13 "Adapt first": there is NO service_sessions table today —
 * live execution data is scattered across walk_bookings (dog-walking),
 * pettrek_trips (transport), and the flat status fields on
 * booking_requests. The server-side adapter (server/lib/serviceSessionAdapter.ts)
 * PROJECTS whichever source is authoritative for a given booking into
 * this canonical shape at READ time. No fourth store.
 *
 * Adding a real service_sessions table later is a swap of the adapter
 * — this shape stays stable, so no client rewrite needed.
 */

export type ServiceSessionSource =
  | 'booking_requests'   // first-slice; canonical booking status only, no live GPS
  | 'walk_bookings'      // adapter path — walk_bookings + walk_gps_tracking
  | 'pettrek_trips';     // adapter path — pettrek_trips + pettrek_gps_tracking

/**
 * High-level lifecycle of a service session — derived from the underlying
 * source table's status. Kept smaller than the full booking state machine
 * because live-execution consumers only care about these 5 buckets.
 */
export type ServiceSessionStatus =
  | 'scheduled'       // booking confirmed but not yet started (server flip pending)
  | 'in_progress'     // provider has started the live service
  | 'awaiting_report' // provider marked complete; customer approval / report pending
  | 'completed'       // fully closed, reviewed or auto-approved
  | 'cancelled';      // cancelled / declined at any stage

export interface ServiceLocation {
  latitude: number;
  longitude: number;
  /** ISO timestamp of the location reading. */
  recordedAt: string;
  /** GPS accuracy in metres, if the source provides it. */
  accuracyM?: number | null;
}

export interface ServiceSessionDTO {
  /** Stable id: '<source-prefix>-<sourceRowId>' — e.g. 'br-BR-ABC123'. */
  sessionId: string;
  /** The identifier the caller queried by (requestId, walk bookingId, pettrek tripId). */
  bookingRef: string;
  /** Which underlying table this DTO was projected from. */
  source: ServiceSessionSource;

  /** Canonical service type when known ('dog_walking' | 'pet_sitting' | …). */
  serviceType: string | null;
  status: ServiceSessionStatus;

  /** Both party ids — Firebase UIDs. Either may be null on some sources. */
  customerId: string | null;
  providerId: string | null;

  /** Scheduled start (from booking record) — may equal actual start. */
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;

  /** Actual live-execution timestamps — null until the provider starts / ends. */
  startedAt: string | null;
  endedAt: string | null;

  /** True if the source considers this session still in-flight. */
  isActive: boolean;

  /**
   * Most recent GPS reading — null when the source has no live-tracking
   * data (e.g. every booking_requests projection, or a walk that hasn't
   * pushed a location yet). Consumers show "no live location" rather
   * than fabricating an old marker.
   */
  lastLocation: ServiceLocation | null;

  /** Where the service actually started, if the source recorded it. */
  startLocation: ServiceLocation | null;

  /**
   * Report/photos state — 'none' when nothing was submitted, 'submitted'
   * when the provider posted at least one report artifact. First slice
   * always returns 'none' for booking_requests; adapter paths populate.
   */
  reportStatus: 'none' | 'submitted';
}
