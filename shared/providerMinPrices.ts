/**
 * Provider minimum service prices — the platform price floor.
 *
 * CEO rule: each approved provider sets their OWN rate (Rover/MadPaws-style), but the
 * system enforces a sensible MINIMUM so nobody can list a ₪0.02 / ₪10 job — which
 * cheapens the brand, signals fraud, and produces bad-quality service. Providers may
 * price above the floor freely; below it is rejected.
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

/** Fallback floor for any platform not explicitly listed (₪39). */
export const DEFAULT_MIN_PRICE_CENTS = 3900;

/** The minimum allowed base price (cents) a provider may charge on a platform. */
export function getProviderMinPriceCents(platform: string): number {
  return PROVIDER_MIN_PRICE_CENTS[platform] ?? DEFAULT_MIN_PRICE_CENTS;
}

/**
 * Validate a set of provider base rates (cents) against the platform floor.
 * Returns { ok:true } when every non-zero rate meets the floor, else { ok:false,
 * minPriceCents, message } with the customer-facing rejection text.
 */
export function validateProviderRates(
  platform: string,
  rateCentsValues: Array<number | null | undefined>,
): { ok: true } | { ok: false; minPriceCents: number; message: string } {
  const floor = getProviderMinPriceCents(platform);
  const set = rateCentsValues.filter((c): c is number => typeof c === 'number' && c > 0);
  if (set.length === 0) return { ok: true }; // nothing priced yet — not this gate's job
  const lowest = Math.min(...set);
  if (lowest < floor) {
    return {
      ok: false,
      minPriceCents: floor,
      message: `Price is too low. Minimum allowed price for this service is ₪${Math.round(floor / 100)}.`,
    };
  }
  return { ok: true };
}
