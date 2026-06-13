/**
 * PetWash — 2026 Financial Guard ("smart calculator")
 * ====================================================
 * ONE place every financial act runs its math through, so money is consistent
 * and safe everywhere — no scattered `* 0.18`, no float drift, no negative
 * balances, no fabricated agorot.
 *
 * RULES (enforced by these helpers):
 *  1. Money is ALWAYS integer agorot (cents). Never store/compute money as a float.
 *  2. VAT is 18/118 of a VAT-INCLUSIVE total (Israeli consumer prices include מע"מ).
 *  3. A balance/amount can never go negative or non-finite.
 *
 * The VAT rate comes from the single source of truth (israel-compliance-config),
 * so a rate change happens in exactly one file.
 */
import { ISRAEL_VAT_RATE } from './israel-compliance-config';

/** Round to whole agorot. Throws on non-finite input (a NaN must never become money). */
export function roundAgorot(n: number): number {
  if (!Number.isFinite(n)) {
    throw new Error(`[money] roundAgorot received a non-finite value: ${n}`);
  }
  return Math.round(n);
}

/** Shekels → integer agorot (e.g. 14.99 → 1499). */
export function toAgorot(ils: number): number {
  return roundAgorot(ils * 100);
}

/** Integer agorot → shekels number (e.g. 1499 → 14.99). */
export function fromAgorot(agorot: number): number {
  return roundAgorot(agorot) / 100;
}

/**
 * VAT contained WITHIN a VAT-inclusive gross amount (Israel 18/118).
 * Use this for consumer-paid totals — the price already includes VAT.
 * e.g. ₪100 inclusive → 1525 agorot VAT (≈15.25%), NOT 1800.
 */
export function vatFromInclusive(grossAgorot: number, rate: number = ISRAEL_VAT_RATE): number {
  return roundAgorot(grossAgorot * rate / (1 + rate));
}

/** Net (VAT-exclusive) portion of a VAT-inclusive gross. */
export function netFromInclusive(grossAgorot: number, rate: number = ISRAEL_VAT_RATE): number {
  return roundAgorot(grossAgorot) - vatFromInclusive(grossAgorot, rate);
}

/** VAT added ON TOP of a net (exclusive) amount. Use only when the base is net. */
export function vatOnNet(netAgorot: number, rate: number = ISRAEL_VAT_RATE): number {
  return roundAgorot(netAgorot * rate);
}

/** Guard: assert a money value is a non-negative integer agorot (else throw). */
export function assertNonNegativeAgorot(n: number, label = 'amount'): number {
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`[money] ${label} must be a non-negative agorot value, got ${n}`);
  }
  return roundAgorot(n);
}

/** Clamp a deduction so it never overdraws the available balance (never < 0, never > available). */
export function clampDeduction(requestedAgorot: number, availableAgorot: number): number {
  const req = roundAgorot(requestedAgorot);
  const avail = roundAgorot(availableAgorot);
  return Math.max(0, Math.min(req, avail));
}
