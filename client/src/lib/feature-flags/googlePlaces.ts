/**
 * PR-LOCATION-GUARD-PLACES-1 — Client-side Google Places feature flag.
 *
 * Companion to server/lib/feature-flags/googlePlaces.ts. The
 * server is the authoritative gate (it returns 503 when off so
 * a misconfigured client never spends an API key budget); this
 * client flag lets the autocomplete component skip the network
 * call entirely when we already know the guard is closed.
 *
 * Vite exposes import.meta.env.VITE_GOOGLE_PLACES_LIVE to the
 * browser bundle at build time. Three reads:
 *
 *   VITE_GOOGLE_PLACES_LIVE = 'true'        → ON
 *   VITE_GOOGLE_PLACES_LIVE = 'false'       → OFF
 *   unset                                   → defer to env:
 *                                              production build → ON
 *                                              non-production    → OFF
 *
 * The default in production-built bundles preserves today's
 * behaviour (Google Places usage on 30+ pages). Dev / test
 * builds default OFF so PROGRAM.md §1.12 ("no live third-party
 * geocoding without approval") is honoured locally.
 *
 * If the flag is OFF but the user types into an autocomplete-
 * backed input, the component falls through to the existing
 * 503 fallback (manual entry). No removal of the component.
 */

export const GOOGLE_PLACES_CLIENT_FLAG_NAME =
  "VITE_GOOGLE_PLACES_LIVE" as const;

/**
 * Pure resolver. Returns whether the client should attempt to
 * call /api/google/places-autocomplete and /api/google/places-
 * details at runtime.
 *
 * The optional `env` arg lets unit tests inject a fake env
 * object. In real browser runtime, callers should invoke this
 * without arguments so it reads import.meta.env directly.
 */
export function isGooglePlacesEnabled(env?: {
  VITE_GOOGLE_PLACES_LIVE?: string;
  PROD?: boolean;
}): boolean {
  const resolved =
    env ??
    ({
      VITE_GOOGLE_PLACES_LIVE: (import.meta as any).env
        ?.VITE_GOOGLE_PLACES_LIVE,
      PROD: !!(import.meta as any).env?.PROD,
    } as { VITE_GOOGLE_PLACES_LIVE?: string; PROD?: boolean });

  const raw = (resolved.VITE_GOOGLE_PLACES_LIVE || "")
    .toString()
    .toLowerCase()
    .trim();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return !!resolved.PROD;
}
