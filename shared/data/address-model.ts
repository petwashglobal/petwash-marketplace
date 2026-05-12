/**
 * PR-LOCATION-ADDRESS-MODEL-1 — Address model types.
 *
 * Pure TypeScript interfaces and type aliases for customer,
 * provider, and booking addresses. Consumed by every downstream
 * Location PR (city picker, profile, booking, service areas,
 * matching). This file MUST NOT add runtime logic; types only.
 *
 * Hard rules (CEO directive 2026-05-12, docs/location/PROGRAM.md §3.2):
 *   - Types and interfaces only. No runtime functions. No
 *     validators. No builders. No constants beyond literal
 *     unions and tags.
 *   - citySymbol is the canonical city key. Every address
 *     references shared/data/israel-cities.ts via citySymbol;
 *     no free-text city.
 *   - postcode is optional and intentionally NOT TRUSTED.
 *     PROGRAM.md §3.13 defers postcode runtime to a future
 *     CEO-approved PR. The field exists so persistence layers
 *     do not need a schema change later, but no consumer may
 *     rely on it until that PR lands.
 *   - lat / lng are optional. The match engine refuses to
 *     compute fake distance unless both sides have real coords
 *     (PROGRAM.md hard rule §1.8 + §3.8).
 *   - No schema migration, no Drizzle table, no UI, no booking
 *     wiring, no provider matching, no payment, no auth, no
 *     wallet, no Google Places, no audit logging.
 *
 * Privacy boundary:
 *   This file declares the SHAPE of address data. It does NOT
 *   authorize persistence. Any consumer that intends to store
 *   street-level data MUST cite PR-LOCATION-PRIVACY-1 (§3.3)
 *   first. See docs/location/PROGRAM.md hard rule §1.9.
 *
 * Naming note:
 *   citySymbol values are strings (leading zeros preserved) —
 *   they come from the Israeli CBS table baked into
 *   shared/data/israel-cities.ts. Treat them as opaque tags.
 */

/**
 * How much we trust the address we have for a customer.
 *
 *   "city-only"        — Only citySymbol is known. The customer
 *                        picked a city; nothing finer. Safe to
 *                        match providers at city granularity.
 *   "street-known"     — citySymbol + streetAddress are known.
 *                        Building number may or may not be set.
 *                        Safe for in-city radius UI but NOT for
 *                        Haversine math.
 *   "building-known"   — citySymbol + streetAddress + building
 *                        number are known. Still no coordinates;
 *                        no real distance math is possible.
 *   "verified-coords"  — lat / lng are present AND verified
 *                        against a known source (customer pin,
 *                        verified pickup, etc.). Only this tier
 *                        unlocks Haversine matching per
 *                        PROGRAM.md §3.8 rule 4.
 *
 * The literal order above is also the confidence order: each
 * tier strictly supersedes the previous one in match-engine
 * scoring. The match engine SUGGESTS, never auto-assigns
 * (PROGRAM.md hard rule §1.10).
 */
export type AddressConfidence =
  | "city-only"
  | "street-known"
  | "building-known"
  | "verified-coords";

/** Const-array form of {@link AddressConfidence} for runtime iteration. */
export const ADDRESS_CONFIDENCE_TIERS = [
  "city-only",
  "street-known",
  "building-known",
  "verified-coords",
] as const satisfies readonly AddressConfidence[];

/**
 * Customer-facing address.
 *
 * Why each field exists:
 *   - citySymbol           required canonical key, matches an
 *                          IsraelCity row in shared/data/
 *                          israel-cities.ts. Every other field
 *                          is optional.
 *   - streetAddress        free-form Hebrew or English street
 *                          line. null when only the city is
 *                          known.
 *   - buildingNumber       separate from streetAddress because
 *                          Israeli forms collect it discretely
 *                          and search/match scoring weights it
 *                          differently.
 *   - apartment            never used for matching; kept for
 *                          delivery/dispatch UI only. Privacy-
 *                          sensitive — apartments are not shown
 *                          to providers until the customer
 *                          accepts a match.
 *   - postcode             optional; NOT TRUSTED yet. PROGRAM.md
 *                          §3.13 defers runtime postcode logic.
 *                          Persist if a UI captures it, but no
 *                          consumer reads it for matching until
 *                          a CEO-approved postcode source lands.
 *   - lat / lng            null unless verified. The match
 *                          engine treats null as "no coordinate
 *                          available" and refuses to invent
 *                          distance (PROGRAM.md hard rule §1.8).
 *   - addressConfidence    explicit tier so callers cannot pun
 *                          an empty string with "verified".
 *   - formattedAddress     display-only canonical render. Never
 *                          parsed back. Useful for receipts /
 *                          confirmations.
 */
export interface CustomerAddress {
  /** Canonical city key — must match an IsraelCity row. */
  citySymbol: string;
  /** Street line as typed by the customer. null when city only. */
  streetAddress: string | null;
  /** Building number (Israeli forms keep this discrete). */
  buildingNumber: string | null;
  /** Apartment / floor / entrance label. Privacy-sensitive. */
  apartment: string | null;
  /**
   * Israeli postcode (5 or 7 digits typically). Optional and
   * NOT TRUSTED — see PROGRAM.md §3.13.
   */
  postcode: string | null;
  /** Latitude in WGS84 decimal degrees. null when not verified. */
  lat: number | null;
  /** Longitude in WGS84 decimal degrees. null when not verified. */
  lng: number | null;
  /** Confidence tier for this address. Drives match-engine weight. */
  addressConfidence: AddressConfidence;
  /** Display-only canonical render. Never parsed back. */
  formattedAddress: string;
}

/**
 * Provider-facing address + service-area declaration.
 *
 * Why each field exists:
 *   - baseCitySymbol       the city the provider operates from.
 *                          Always required; it is the centroid
 *                          for radius math when coords are set.
 *   - serviceCitySymbols   the list of cities the provider
 *                          covers. Replaces today's free-text
 *                          contractor_service_areas.city column
 *                          (rewritten in PR-PROVIDER-SERVICE-
 *                          AREAS-1). readonly array so callers
 *                          cannot mutate state by reference.
 *   - serviceRadiusKm      optional radius around (lat, lng).
 *                          null means "city-list only — do not
 *                          compute distance".
 *   - preferredAreas       free-form labels (e.g. "north Tel
 *                          Aviv", "Florentin"). Soft signal;
 *                          never authoritative. Sitters often
 *                          want this granularity without
 *                          polluting the canonical citySymbol.
 *   - blockedAreas         free-form labels the provider will
 *                          NOT serve, even within an enabled
 *                          city. Match engine must respect.
 *   - lat / lng            provider's base coordinates. Optional;
 *                          set when the provider opts in to
 *                          radius-based discovery.
 */
export interface ProviderAddress {
  /** Provider's base city (centroid for radius math). */
  baseCitySymbol: string;
  /** Cities the provider covers. */
  serviceCitySymbols: readonly string[];
  /** Service radius around (lat, lng) in kilometres. null = city-list only. */
  serviceRadiusKm: number | null;
  /** Soft positive area tags (free-form, opt-in). */
  preferredAreas: readonly string[];
  /** Hard negative area tags. Match engine respects. */
  blockedAreas: readonly string[];
  /** Provider's base latitude in WGS84 decimal degrees. */
  lat: number | null;
  /** Provider's base longitude in WGS84 decimal degrees. */
  lng: number | null;
}

/**
 * Booking-scoped address envelope.
 *
 * Why each field exists:
 *   - serviceAddress       the address WHERE the service will
 *                          happen — usually the customer's
 *                          address, but can differ (e.g. drop-
 *                          off at a park for a walk, or a
 *                          training studio for an Academy
 *                          session). Carries its own confidence
 *                          tier independent of the customer's
 *                          profile address.
 *   - citySymbol           denormalized copy of
 *                          serviceAddress.citySymbol so booking
 *                          search and indexes do not need to
 *                          join through the address object.
 *   - matchingRadiusKm     the radius the customer agreed to
 *                          for this specific booking. null
 *                          means "exact city only". Distinct
 *                          from the provider's
 *                          serviceRadiusKm so a customer can
 *                          opt to widen / narrow per booking
 *                          without changing their profile.
 *   - selectedProviderId   the provider the customer manually
 *                          confirmed. null until a match is
 *                          accepted. NEVER set automatically —
 *                          PROGRAM.md hard rule §1.10.
 *   - matchScore           the score the match engine recorded
 *                          for the accepted provider, for post-
 *                          hoc audit (PROGRAM.md §3.8). null
 *                          until PR-LOCATION-ADDRESS-MATCHING-1
 *                          adds the scoring runtime.
 */
export interface BookingAddress {
  /** Address where the service actually happens. */
  serviceAddress: CustomerAddress;
  /** Denormalized copy of serviceAddress.citySymbol for indexing. */
  citySymbol: string;
  /** Per-booking matching radius in kilometres. */
  matchingRadiusKm: number | null;
  /** Provider the customer manually confirmed. null until accepted. */
  selectedProviderId: string | null;
  /** Match-engine score recorded at accept time. null pre-matching. */
  matchScore: number | null;
}

/**
 * Provenance tag for the address model spec. Increment the
 * version when this file's shape changes in a way consumers
 * must adapt to.
 */
export const ADDRESS_MODEL_SOURCE = "petwash-address-model" as const;
export const ADDRESS_MODEL_VERSION = "2026-05-12" as const;
