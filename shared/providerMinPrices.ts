/**
 * Provider service price guardrails — the platform price FLOOR and CEILING.
 *
 * CEO rule: each approved provider sets their OWN rate (Rover/MadPaws-style), but the
 * system enforces a sensible MINIMUM so nobody can list a ₪0.02 / ₪10 job — which
 * cheapens the brand, signals fraud, and produces bad-quality service — AND a sensible
 * MAXIMUM so nobody can list a ₪9,999 job (typo, abuse, or price-gouging that damages
 * trust). Providers may price anywhere INSIDE [floor, ceiling] freely; outside it is
 * rejected with a clear message.
 *
 * Values (₪) from the 2026 architecture spec. Admin can revise here — single source.
 */
export const PROVIDER_MIN_PRICE_CENTS: Record<string, number> = {
  walk_my_pet:     4900,   // dog walking — ₪49
  sitter_suite:    9900,   // pet sitting — ₪99
  pet_trek:        7900,   // transport — ₪79
  academy:        14900,   // training — ₪149
  grooming:       12900,   // grooming — ₪129
  mobile_grooming:14900,   // mobile grooming — ₪149
  station_assist:  3900,   // station-assist — ₪39
};

/**
 * Provider MAXIMUM service prices — the platform price ceiling (cents). Generous so
 * genuine premium/luxury providers are never blocked, but low enough to catch a typo
 * (₪1500 → ₪150000) or abusive gouging. Admin can revise — single source.
 */
export const PROVIDER_MAX_PRICE_CENTS: Record<string, number> = {
  walk_my_pet:      50000,  // dog walking — ₪500 / walk
  sitter_suite:    200000,  // pet sitting — ₪2,000 / day (luxury boarding)
  pet_trek:        150000,  // transport — ₪1,500
  academy:         150000,  // training — ₪1,500 / hr (elite trainer)
  grooming:        150000,  // grooming — ₪1,500
  mobile_grooming: 200000,  // mobile grooming — ₪2,000
  station_assist:   50000,  // station-assist — ₪500
};

/** Fallback floor for any platform not explicitly listed (₪39). */
export const DEFAULT_MIN_PRICE_CENTS = 3900;

/** Fallback ceiling for any platform not explicitly listed (₪2,000). */
export const DEFAULT_MAX_PRICE_CENTS = 200000;

/** The minimum allowed base price (cents) a provider may charge on a platform. */
export function getProviderMinPriceCents(platform: string): number {
  return PROVIDER_MIN_PRICE_CENTS[platform] ?? DEFAULT_MIN_PRICE_CENTS;
}

/** The maximum allowed base price (cents) a provider may charge on a platform. */
export function getProviderMaxPriceCents(platform: string): number {
  return PROVIDER_MAX_PRICE_CENTS[platform] ?? DEFAULT_MAX_PRICE_CENTS;
}

/**
 * Validate a set of provider base rates (cents) against the platform floor AND ceiling.
 * Returns { ok:true } when every non-zero rate is within [floor, ceiling]. On failure
 * returns { ok:false, ... } with the customer-facing rejection text. `minPriceCents` is
 * always the floor (kept for backward compatibility with existing callers); `maxPriceCents`
 * and `reason` disambiguate which bound was crossed.
 */
export function validateProviderRates(
  platform: string,
  rateCentsValues: Array<number | null | undefined>,
): { ok: true } | { ok: false; minPriceCents: number; maxPriceCents: number; reason: 'too_low' | 'too_high'; message: string } {
  const floor = getProviderMinPriceCents(platform);
  const ceiling = getProviderMaxPriceCents(platform);
  const set = rateCentsValues.filter((c): c is number => typeof c === 'number' && c > 0);
  if (set.length === 0) return { ok: true }; // nothing priced yet — not this gate's job
  const lowest = Math.min(...set);
  if (lowest < floor) {
    return {
      ok: false,
      minPriceCents: floor,
      maxPriceCents: ceiling,
      reason: 'too_low',
      message: `Price is too low. Minimum allowed price for this service is ₪${Math.round(floor / 100)}.`,
    };
  }
  const highest = Math.max(...set);
  if (highest > ceiling) {
    return {
      ok: false,
      minPriceCents: floor,
      maxPriceCents: ceiling,
      reason: 'too_high',
      message: `Price is too high. Maximum allowed price for this service is ₪${Math.round(ceiling / 100)}.`,
    };
  }
  return { ok: true };
}
