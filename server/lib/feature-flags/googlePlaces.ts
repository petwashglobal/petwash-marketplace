/**
 * PR-LOCATION-GUARD-PLACES-1 — Server-side Google Places feature flag.
 *
 * Single source of truth for whether the server may proxy a live
 * Google Places API call. Sits BETWEEN the request and the
 * existing GOOGLE_MAPS_API_KEY presence check (key gate stays
 * exactly as it is). When this guard returns false, the route
 * short-circuits with 503 PLACES_DISABLED and never spends an
 * API key budget.
 *
 * Context (docs/location/PROGRAM.md hard rule §1.12):
 *   "No live third-party APIs (Google Places, Israel Post, etc.)
 *    in the runtime path until both the API contract and the
 *    privacy impact are CEO-approved."
 *
 * Today the platform already runs live Google Places on 30+ UI
 * call sites (proxied through /api/google/places-autocomplete
 * and /api/google/places-details). This guard adds the missing
 * explicit toggle without removing the integration:
 *
 *   - flag = 'true'                → ON (deliberate opt-in)
 *   - flag unset / 'false' / other → OFF (graceful 503 fallback)
 *
 * COST GUARD (2026-06-19): the default is now OFF in EVERY env,
 * including production. Previously production-with-flag-unset
 * defaulted ON, and the paid Google Places/Geocoding meter caused
 * a ~$1000 surprise bill. The client already uses the FREE OSM /
 * Nominatim proxy (/api/geocode/suggest + /api/geocode/reverse) for
 * all address entry, so paid Places staying OFF does not break UX.
 *
 * Boundaries:
 *   - This module does NOT read auth, payment, wallet, K9000,
 *     Nayax, Tranzila, schema, or audit state.
 *   - It does NOT call Google. It only decides whether the
 *     caller may.
 *   - It does NOT remove the existing GOOGLE_MAPS_API_KEY check —
 *     that check still runs after this gate.
 */

import type { Request, Response, NextFunction } from "express";

export const GOOGLE_PLACES_FLAG_NAME = "GOOGLE_PLACES_LIVE" as const;

/**
 * Pure resolver — no side effects, no logging. Intended for
 * unit tests and for call sites that want to branch without
 * involving Express.
 */
export function isGooglePlacesServerEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env.GOOGLE_PLACES_LIVE || "").toLowerCase().trim();
  if (raw === "true") return true;
  // COST GUARD (2026-06-19): the default is now OFF in EVERY environment,
  // including production. The paid Google Places / autocomplete / details /
  // geocoding meter previously defaulted ON in production, which caused a
  // ~$1000 surprise Google bill. The client already uses the FREE
  // OpenStreetMap / Nominatim proxy (/api/geocode/suggest +
  // /api/geocode/reverse) for ALL address entry, so leaving paid Places
  // OFF does NOT break address UX — gated routes return the existing
  // graceful 503 PLACES_DISABLED fallback (the client handles it with a
  // manual-entry hint). Paid Google Places only turns on when
  // GOOGLE_PLACES_LIVE === 'true' is EXPLICITLY set (deliberate opt-in).
  // Any other value (including 'false', unset, or garbage) → OFF.
  return false;
}

/**
 * Result shape returned to the client when the guard is closed.
 * Mirrors the existing 503 contract used by the autocomplete
 * component (server/routes/google-services.ts already returns
 * 503 + reasonCode for MAPS_KEY_MISSING; the client component
 * has a graceful manual-entry fallback wired against 503).
 */
export interface GooglePlacesDisabledResponse {
  error: string;
  reasonCode: "PLACES_DISABLED";
}

/**
 * Express middleware. Apply to any route that proxies a live
 * Google Places call. Sits BEFORE the route handler so an
 * "off" posture never reaches the upstream fetch.
 *
 * Usage:
 *   router.get('/places-autocomplete',
 *              ...existingMiddlewares,
 *              requireGooglePlacesEnabled,
 *              async (req, res) => { ... });
 *
 * On disabled:
 *   HTTP 503
 *   { error: '...', reasonCode: 'PLACES_DISABLED' }
 *
 * The client autocomplete component already handles 503 by
 * showing a manual-entry hint, so end-users see a clean
 * fallback rather than a broken control.
 */
export function requireGooglePlacesEnabled(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isGooglePlacesServerEnabled()) {
    next();
    return;
  }
  const body: GooglePlacesDisabledResponse = {
    error:
      "Address autocomplete is disabled in this environment. Please type the address manually.",
    reasonCode: "PLACES_DISABLED",
  };
  res.status(503).json(body);
}
