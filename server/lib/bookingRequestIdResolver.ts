/**
 * LEGACY BOOKING ID → CANONICAL BOOKING-REQUEST ID (2026-09-18).
 *
 * Sitter Suite / Walk My Pet / Academy bookings are mirrored into
 * booking_requests by the legacy bridge, and the customer's screens carry the
 * LEGACY id (SIT-…, WLK-…, TRN-…) because that is what their own service
 * returns. GET /api/booking-requests/:requestId learned to resolve that id
 * back in 2026-07-31 — so the confirmation page RENDERS, and for an accepted
 * booking it renders the gold "Pay & confirm booking" panel with the amount.
 *
 * None of the ACTION routes learned it. POST /:requestId/pay looked the id up
 * by request_id alone and answered 404 "Booking not found": the provider
 * accepted, the customer opened the booking, saw the price, pressed pay — and
 * could never pay. /confirm (end of stay), /cancel and /meet-greet were dead
 * in exactly the same way.
 *
 * Resolving the id once, as an express `router.param`, fixes every route in
 * that file at the same time and leaves the handlers unchanged.
 *
 * Deliberately conservative:
 *   • a canonical id is returned untouched, and costs one indexed lookup;
 *   • the legacy lookup runs only for a SIGNED-IN caller — an anonymous probe
 *     must not be able to make the server scan jsonb;
 *   • the match is constrained to a booking the caller is actually on, so it
 *     can never widen who can reach a row;
 *   • no match leaves the id exactly as it came in, so the handler's own 404
 *     still applies.
 */
import type { RequestHandler } from 'express';

export interface BookingIdResolverDeps {
  /** True when this id is already a booking_requests.request_id. */
  isCanonicalId(requestId: string): Promise<boolean>;
  /** The canonical request_id of the bridged row for this legacy id, for THIS user. */
  findCanonicalForLegacyId(legacyId: string, userId: string): Promise<string | null>;
  onResolved?(legacyId: string, canonical: string): void;
  onError?(legacyId: string, error: unknown): void;
}

export async function resolveBookingRequestId(
  requestId: string,
  userId: string,
  deps: BookingIdResolverDeps,
): Promise<string | null> {
  if (!requestId || !userId) return null;
  if (await deps.isCanonicalId(requestId)) return null;
  return deps.findCanonicalForLegacyId(requestId, userId);
}

/** express `router.param('requestId', …)` handler built on the deps above. */
export function bookingRequestIdParam(deps: BookingIdResolverDeps) {
  const handler = (req: any, _res: any, next: any, value: string) => {
    const userId = req.user?.uid || req.firebaseUser?.uid;
    if (!userId || typeof value !== 'string' || !value) return next();
    resolveBookingRequestId(value, userId, deps)
      .then((canonical) => {
        if (canonical) {
          // Keep what the caller sent for logs/support; hand the handlers the
          // canonical id.
          req.legacyRequestId = value;
          req.params.requestId = canonical;
          deps.onResolved?.(value, canonical);
        }
        next();
      })
      .catch((err) => {
        // A resolver failure must never take down a route that works today.
        deps.onError?.(value, err);
        next();
      });
  };
  return handler as unknown as RequestHandler;
}
