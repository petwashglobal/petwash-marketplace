/**
 * PET WASH™ — BOOKING PROXIMITY GUARD (shared)
 *
 * Proximity must be enforced at BOOKING CREATION, not just SEARCH. Search filters
 * providers by distance, but historically nothing re-validated it when the booking
 * row was actually written — so a stale search result (or a provider who moved)
 * could let a customer book a provider outside their service radius.
 *
 * This module centralises the check so every booking-creation path can reuse the
 * SAME haversine the search uses.
 *
 * ── CRITICAL: FAIL OPEN ──────────────────────────────────────────────────────
 * We ONLY reject when BOTH the customer and the provider have real coordinates
 * AND the distance clearly exceeds the allowed radius (+ a generous buffer for
 * geocoding imprecision). If EITHER side's coords are missing / null / NaN / 0,0
 * we CANNOT tell — so we SKIP and ALLOW the booking. We never block a legitimate
 * booking just because geocoding was missing.
 *
 * STRICT: this module performs NO pricing / payment / refund / wallet logic.
 * It is a pure read-only distance check.
 */

import { haversineKm } from '../utils/providerSearch';

/**
 * Generous default radius (km) for service domains that have no per-provider
 * service-radius column. The guard then only catches *clearly* too-far bookings.
 * Overridable via env so it stays reversible without a code change.
 */
export const BOOKING_MAX_DISTANCE_KM = (() => {
  const raw = Number(process.env.BOOKING_MAX_DISTANCE_KM);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
})();

/**
 * Grace multiplier applied to the allowed radius to absorb geocoding imprecision
 * (two free-OSM geocodes of the "same" address can differ by a few hundred metres
 * to a couple of km). 1.2 == 20% slack. Keeps the guard from rejecting near-edge
 * but legitimate bookings.
 */
export const PROXIMITY_BUFFER = 1.2;

/**
 * Master switch. Defaults to ON, but the guard is *inherently* fail-open (it only
 * acts when coords exist on both sides), so "ON" never blocks a coord-less
 * booking. Set BOOKING_PROXIMITY_ENFORCED=false to disable the reject entirely
 * (still logs) — fully reversible via env.
 */
export const BOOKING_PROXIMITY_ENFORCED =
  String(process.env.BOOKING_PROXIMITY_ENFORCED ?? 'true').toLowerCase() !== 'false';

export interface ProximityInput {
  /** Customer coordinates (service address preferred, else profile). May be missing. */
  customerLat?: number | string | null;
  customerLng?: number | string | null;
  /** Provider coordinates. May be missing. */
  providerLat?: number | string | null;
  providerLng?: number | string | null;
  /**
   * Allowed radius in km. Resolution priority is the caller's job:
   *   provider's own service-radius column → else BOOKING_MAX_DISTANCE_KM.
   * Pass undefined/null to use BOOKING_MAX_DISTANCE_KM.
   */
  maxKm?: number | null;
  /** Explicit bypass (e.g. admin-created booking). Skips the reject, still computes. */
  bypass?: boolean;
}

export type ProximityResult =
  | { ok: true; skipped: 'no-coords' | 'disabled' | 'bypass' | 'within-range'; distanceKm?: number; maxKm?: number }
  | { ok: false; distanceKm: number; maxKm: number };

/** Coerce a possibly-string/decimal coord to a finite number, else NaN. */
function num(v: number | string | null | undefined): number {
  if (v == null) return NaN;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Decide whether a booking is within the provider's service area.
 *
 * Returns { ok: true, skipped } when we ALLOW (and why), or
 * { ok: false, distanceKm, maxKm } when the booking is clearly out of range.
 * Callers should translate ok:false into a 422/400 OUT_OF_RANGE response.
 */
export function checkBookingProximity(input: ProximityInput): ProximityResult {
  const maxKm = input.maxKm != null && Number.isFinite(input.maxKm) && input.maxKm > 0
    ? input.maxKm
    : BOOKING_MAX_DISTANCE_KM;

  if (input.bypass) {
    return { ok: true, skipped: 'bypass', maxKm };
  }

  const cLat = num(input.customerLat);
  const cLng = num(input.customerLng);
  const pLat = num(input.providerLat);
  const pLng = num(input.providerLng);

  // FAIL OPEN: any missing/NaN coordinate → we can't tell → allow.
  // Treat exact 0,0 (null-island) on either side as "no coords" too.
  const missing =
    [cLat, cLng, pLat, pLng].some(Number.isNaN) ||
    (cLat === 0 && cLng === 0) ||
    (pLat === 0 && pLng === 0);
  if (missing) {
    return { ok: true, skipped: 'no-coords' };
  }

  const distanceKm = haversineKm(cLat, cLng, pLat, pLng);

  if (distanceKm > maxKm * PROXIMITY_BUFFER) {
    if (!BOOKING_PROXIMITY_ENFORCED) {
      // Would have rejected, but enforcement is switched off → allow, computed.
      return { ok: true, skipped: 'disabled', distanceKm, maxKm };
    }
    return { ok: false, distanceKm, maxKm };
  }

  return { ok: true, skipped: 'within-range', distanceKm, maxKm };
}
