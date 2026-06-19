// Israeli national-ID (תעודת זהות) utilities.
//
// PRIVACY-LAW CRITICAL (Israeli Privacy Protection Law 2025 + Amendment 13):
// the raw national-ID number is sensitive personal data. These helpers exist so
// that callers can (a) reject obviously-invalid IDs at the door and (b) only
// ever persist a masked form. Nothing here logs or echoes the full number.

/**
 * Strip everything except digits. Israeli IDs are entered with spaces, dashes
 * or leading zeros stripped by some keyboards, so we normalise first.
 */
function digitsOnly(id: string): string {
  return (id || '').replace(/\D/g, '');
}

/**
 * Validate a standard 9-digit Israeli national ID using the official
 * check-digit algorithm (a Luhn-style weighted modulus-10).
 *
 * Algorithm:
 *   - left-pad the number to 9 digits with zeros
 *   - multiply each digit by an alternating weight of 1, 2, 1, 2, ...
 *   - if a weighted product is >= 10, sum its two digits (i.e. subtract 9)
 *   - the total sum must be divisible by 10
 *
 * @returns true only for a syntactically valid, checksum-passing 9-digit ID.
 */
export function isValidIsraeliId(id: string): boolean {
  const normalized = digitsOnly(id);

  // Must be 1–9 digits before padding (longer = not an Israeli ID).
  if (normalized.length === 0 || normalized.length > 9) {
    return false;
  }

  // Reject the all-zeros degenerate case (passes the modulus but is never real).
  if (/^0+$/.test(normalized)) {
    return false;
  }

  const padded = normalized.padStart(9, '0');

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = Number(padded[i]);
    const weight = (i % 2) + 1; // 1, 2, 1, 2, ...
    let product = digit * weight;
    if (product > 9) {
      product -= 9; // equivalent to summing the two digits of a 2-digit product
    }
    sum += product;
  }

  return sum % 10 === 0;
}

/**
 * Return the last 4 digits of an ID (for storage in the queryable, redacted
 * `kyc_id_last_four` column). Returns null if there are not enough digits.
 */
export function lastFour(id: string): string | null {
  const normalized = digitsOnly(id);
  if (normalized.length < 4) return null;
  return normalized.slice(-4);
}

/**
 * Mask an ID for display/logging, e.g. "302345674" -> "*****5674".
 * Never returns the full number. Safe to put in logs.
 */
export function maskId(id: string): string {
  const normalized = digitsOnly(id);
  if (normalized.length === 0) return '';
  if (normalized.length <= 4) {
    return '*'.repeat(normalized.length);
  }
  const visible = normalized.slice(-4);
  return '*'.repeat(normalized.length - 4) + visible;
}

/**
 * Heuristic: does this free-text identity field look like an Israeli national
 * ID rather than a passport or driver's licence? Passports/licences contain
 * letters or are not 9-or-fewer pure digits. We treat a pure-digit string of
 * up to 9 digits as an Israeli-ID candidate that should be checksum-validated.
 */
export function looksLikeIsraeliId(id: string): boolean {
  const raw = (id || '').trim();
  if (!raw) return false;
  // Contains any non-digit (after trimming spaces/dashes) → passport/licence.
  const cleaned = raw.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(cleaned)) return false;
  return cleaned.length <= 9;
}
