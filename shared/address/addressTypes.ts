/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ADDRESS TYPES — foundation for the Location Infrastructure Program.       ║
 * ║                                                                            ║
 * ║  PURE TYPES ONLY. No runtime code, no schema, no UI, no service.           ║
 * ║  This is the vocabulary the LOCATION PR sequence (2..8) will consume;      ║
 * ║  by pinning the shapes first, every downstream PR can build against a      ║
 * ║  stable contract instead of inventing its own field names.                 ║
 * ║                                                                            ║
 * ║  Rules preserved from the CEO's location program spec:                     ║
 * ║   • No fake distance math without lat/lng — every distance-bearing type    ║
 * ║     REQUIRES a GeoPoint. If we don't have coordinates, we don't pretend.   ║
 * ║   • No live Google Places wiring — types are provider-agnostic; the        ║
 * ║     addressRulebook.ts still enforces "free OSM only" at the code layer.   ║
 * ║   • No automatic provider assignment at first — the AddressMatch type is   ║
 * ║     an OFFER (distance + in-area + confidence), never an assignment.       ║
 * ║   • User must understand who is coming and where — AddressMatch carries    ║
 * ║     the source + displayName so the UI can render "you are booking X, in   ║
 * ║     area Y".                                                               ║
 * ║   • Provider must control service areas — ServiceArea is either a radius   ║
 * ║     from a center point or an explicit polygon; there is no "the system    ║
 * ║     decides" mode.                                                         ║
 * ║   • Audit trail for match decisions — AddressMatchDecision records the    ║
 * ║     inputs + verdict + timestamp so a later dispute can be reconstructed.  ║
 * ║                                                                            ║
 * ║  What this file is NOT:                                                    ║
 * ║   • NOT a database schema. See shared/schema.ts for that (a later PR      ║
 * ║     may add columns backing these types; this PR does not).                ║
 * ║   • NOT a runtime library. No distance calc, no polygon test, no fetch.    ║
 * ║   • NOT a UI component. See client/src/components/ui/address-picker.tsx.   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * PR-LOCATION-ADDRESS-MODEL-1 (2026-08-15).
 */

// ─── Coordinates ──────────────────────────────────────────────────────────

/**
 * A geographic coordinate in WGS84 decimal degrees. This is the ONLY
 * coordinate shape used across the location program — no {latitude,
 * longitude}, no {y, x}, no swapped-axis strings. Pin the shape here so
 * the downstream code cannot invent its own.
 *
 * Latitude range: [-90, 90]. Longitude range: [-180, 180]. Runtime
 * validation lives in a later PR; this file only pins the STATIC shape.
 */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Present when the address has been geocoded, absent when only text is
 * known. Consumers MUST branch on absence — "no coords" is not the same
 * as "coords are 0,0" (which is a real place off West Africa and is a
 * classic bug pattern for uninitialised location fields).
 */
export type MaybeGeoPoint = GeoPoint | null;

// ─── Structured address ───────────────────────────────────────────────────

/**
 * Structured address fields. Deliberately parallel to the existing
 * `AddressParts` shape in shared/formatAddress.ts so the two files can
 * eventually converge without a client-visible migration. Every field
 * is optional because different capture paths yield different shapes
 * (a saved-address row has everything; a fresh OSM suggestion has
 * street + city; a manual-entry has only what the user typed).
 */
export interface StructuredAddress {
  street?: string | null;
  streetNumber?: string | null;
  apartment?: string | null;
  floor?: string | null;
  entrance?: string | null;
  city?: string | null;
  postalCode?: string | null;
  /** ISO-3166-1 alpha-2, e.g. "IL". Pin the format so consumers don't drift into "Israel" vs "IL". */
  countryCode?: string | null;
  /** Access notes: gate code, "ring bell", "dog in yard". PII-adjacent — provider/courier view only. */
  notes?: string | null;
  /** Pre-formatted fallback (legacy free-text rows before we captured structure). */
  fallback?: string | null;
}

/**
 * Where the address came from. Downstream code uses this to decide
 * confidence + display treatment. `manual` addresses (typed but never
 * geocoded) are the lowest-trust source and must never be used for
 * distance math.
 */
export type AddressSource =
  | 'user_typed'         // free-text before autocomplete resolved anything
  | 'osm_suggestion'     // picked from /api/geocode/suggest (OSM Nominatim)
  | 'saved_profile'      // reused from the user's saved address list
  | 'manual'             // typed and confirmed WITHOUT geocoding — no coords
  | 'imported_legacy';   // migrated from an older schema, treat with caution

/**
 * Canonical dedup key for an address. Computed as a normalized form
 * (lowercased, trimmed, punctuation-stripped, house-number-normalized)
 * of street + streetNumber + city + countryCode. Used to detect that
 * two typed addresses refer to the same place before creating a duplicate
 * saved-address row. The NORMALIZER lives in a later PR — this file just
 * pins the type.
 */
export type AddressNormalizedKey = string & { readonly __brand: 'AddressNormalizedKey' };

/**
 * A fully-resolved address ready for reuse. Combines the structured
 * fields + optional coordinates + source + optional dedup key. This is
 * the "saved" shape that a booking / receipt / courier label consumes.
 */
export interface ResolvedAddress {
  /** Human-readable display line, one string. Pre-rendered by shared/formatAddress. */
  displayName: string;
  /** Structured fields (may be sparse depending on source). */
  parts: StructuredAddress;
  /** Coordinates, or null when unknown. NEVER default to (0, 0). */
  geo: MaybeGeoPoint;
  /** Provenance. Consumers use this to gate confidence-sensitive actions. */
  source: AddressSource;
  /** Present iff a canonical dedup key has been computed. */
  normalizedKey?: AddressNormalizedKey;
}

// ─── Service area (provider coverage) ─────────────────────────────────────

/**
 * A provider's declared service area. Two mutually-exclusive shapes:
 *   - `radius` — a circle of `radiusMeters` around `center`
 *   - `polygon` — an explicit ring of GeoPoints (min 3 points, first/last
 *                 need not repeat — the polygon test lives in a later PR)
 *
 * Providers CONTROL their own service areas — this type never carries a
 * "system-decided" or "auto-generated" area. If a provider hasn't
 * declared one, no ServiceArea exists.
 */
export type ServiceArea =
  | ServiceAreaRadius
  | ServiceAreaPolygon;

export interface ServiceAreaRadius {
  kind: 'radius';
  center: GeoPoint;
  radiusMeters: number; // strictly > 0; enforced at runtime in a later PR
  /** Provider-facing label, e.g. "Tel Aviv 5km". */
  label?: string;
}

export interface ServiceAreaPolygon {
  kind: 'polygon';
  ring: GeoPoint[]; // >= 3 points; enforced at runtime in a later PR
  /** Provider-facing label, e.g. "Sharon corridor". */
  label?: string;
}

// ─── Match (address → provider) ───────────────────────────────────────────

/**
 * Result of matching a customer address to a provider's ServiceArea.
 * This is an OFFER, never an assignment — the CEO's rule "no automatic
 * provider assignment at first" is preserved in the type: nothing here
 * commits either party.
 *
 * Distance is REQUIRED to be null when either side lacks coordinates.
 * The Referee rule "no fake distance math without lat/lng" is pinned in
 * the type by making distanceMeters | null the only shape.
 */
export interface AddressMatch {
  /** Provider whose service area was tested. Opaque id string — the type does not care what a provider id is. */
  providerId: string;
  /** True iff the customer address is INSIDE the provider's ServiceArea, per that area's kind. */
  inServiceArea: boolean;
  /**
   * Great-circle distance in metres between the customer geo and the
   * provider's service-area center (for radius areas) or nearest polygon
   * edge (for polygon areas). NULL when the customer address has no geo
   * — never a fake 0 or Infinity.
   */
  distanceMeters: number | null;
  /**
   * Match confidence in [0, 1]. Combines geo presence, address source,
   * and area kind. Undefined when the underlying model has not been
   * decided yet — a later PR pins the formula. Present here so the
   * consumers can start reserving screen space for it.
   */
  confidence?: number;
  /** Copy of the customer address's source, so the UI can weight it. */
  addressSource: AddressSource;
  /** Display name to render to the customer, e.g. "Tel Aviv sitter within 3.2 km". */
  displayName?: string;
}

/**
 * Audit record for a single match decision. The location program needs
 * to be able to reconstruct WHY a given provider was offered (or not),
 * long after the customer address / provider service area have changed.
 * Persistence + retention lives in a later PR; this file pins the shape
 * so downstream code writes the same fields.
 */
export interface AddressMatchDecision {
  /** ISO-8601 timestamp of the decision. */
  at: string;
  /** Customer address considered (snapshot — the source-of-truth row may change later). */
  customerAddress: ResolvedAddress;
  /** Provider service area considered (snapshot — same reason). */
  providerServiceArea: ServiceArea;
  /** The match result the customer was shown. */
  match: AddressMatch;
  /** Which system produced the decision, e.g. "matcher-v1" — for A/B analysis. */
  decidedBy: string;
}
