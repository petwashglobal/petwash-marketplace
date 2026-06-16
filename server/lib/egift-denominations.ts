/**
 * egift-denominations.ts
 *
 * Single source of truth for the allowed e-gift purchase amounts.
 * Mirrors the four product cards on petwash.co.il/gift-cards:
 *   ₪100 (Classic), ₪250 (Plus), ₪500 (Premium), ₪1000 (Mazon)
 *
 * Why this exists:
 *   The legacy purchase schema accepted any positive number for `amount`,
 *   which is an abuse vector (₪0.01 vouchers, ₪999,999 vouchers) and an
 *   accounting drift risk (admin reports show denominations the UI does
 *   not advertise). This module locks the allowlist; the test
 *   server/tests/egift-denominations.test.ts pins it.
 *
 * Pure values + pure functions. No I/O. Safe to import anywhere.
 */

export const EGIFT_ALLOWED_DENOMINATIONS = [100, 250, 500, 1000] as const;
export type EgiftDenomination = (typeof EGIFT_ALLOWED_DENOMINATIONS)[number];

/**
 * Israeli Payment Services exemption cap (תקנות שירותי תשלום (פטור), 2022,
 * extended to 2027-06-06): a closed-loop, non-reloadable, paid-in-full voucher
 * is exempt from a payment-services LICENCE only up to ₪1,500. Above this,
 * PetWash would need a licence — so NO denomination may exceed this cap.
 */
export const EGIFT_EXEMPTION_CAP_ILS = 1500;

// Lock-in: if a future change adds a denomination over the exemption cap, this
// throws at module load -> fails the build/tests, so the licence exemption can
// never be silently broken.
for (const d of EGIFT_ALLOWED_DENOMINATIONS) {
  if (d > EGIFT_EXEMPTION_CAP_ILS) {
    throw new Error(
      `E-gift denomination ₪${d} exceeds the ₪${EGIFT_EXEMPTION_CAP_ILS} payment-services exemption cap — that would require a payment licence.`,
    );
  }
}

/**
 * Validate that a value (number or numeric string) is one of the allowed
 * e-gift denominations. Returns the canonical number on success, or null
 * on failure (caller decides how to surface the error).
 */
export function parseEgiftDenomination(value: unknown): EgiftDenomination | null {
  if (value === null || value === undefined) return null;
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    n = Number(trimmed);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  if ((EGIFT_ALLOWED_DENOMINATIONS as readonly number[]).includes(n)) {
    return n as EgiftDenomination;
  }
  return null;
}

/**
 * Human-readable list for error messages.
 */
export function describeAllowedDenominations(currency = '₪'): string {
  return EGIFT_ALLOWED_DENOMINATIONS.map((n) => `${currency}${n}`).join(', ');
}
