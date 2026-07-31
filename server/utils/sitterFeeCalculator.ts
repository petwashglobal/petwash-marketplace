/**
 * THE SITTER SUITE™ - Financial Fee Calculator
 * Israeli Tax Law 2026 Compliant
 *
 * FLAT 15% COMMISSION (disclosed-agent model, unified across ALL PetWash™ paid
 * services — identical to Walk My Pet + Academy; CEO-confirmed 2026-07-31):
 * - Owner pays: the sitter's rate (base price). NOTHING added on top.
 * - Sitter receives: 85% of the base price.
 * - PetWash™ keeps: 15% commission, taken OUT of the base (not added on top).
 * - VAT (18%) is on PetWash's COMMISSION only, EXTRACTED from it (the commission is
 *   VAT-inclusive); the customer's total IS the base price.
 *
 * HISTORY (the money leak this file used to be): the previous version charged the
 * owner base + 15% + VAT AND deducted 15% from the sitter = a ~30% real platform take
 * while the header claimed "15%". Worse, the capture path (NayaxSitterMarketplaceService)
 * feeds the booking's stored total back in as a per-day rate, so the on-top model
 * charged fees a SECOND time. Corrected 2026-07-31 to a single 15% disclosed-agent
 * commission (customer pays the rate; VAT extracted 18/118), matching walkFeeCalculator.
 *
 * Payment Flow (PetWash™ escrow model):
 * 1. Owner pays the sitter's rate (base) to PetWash via Nayax.
 * 2. Platform holds funds in 72-hour escrow.
 * 3. Upon job completion: platform keeps 15% commission; withholding tax
 *    (ניכוי מס במקור) deducted from the sitter payout at settlement per certificate.
 * 4. Digital receipt (קבלה דיגיטלית) emailed to customer.
 * 5. Transaction recorded in internal accounting system.
 *
 * Israeli VAT Rate: 18% (as of 2025-2026), extracted from the commission.
 */

import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';

const ISRAELI_VAT_RATE = ISRAEL_VAT_RATE; // PR-W13: shared/israel-compliance-config.ts

export interface TransparentFeeCalculation {
  pricePerDayCents: number;
  totalDays: number;

  basePriceCents: number;
  platformServiceFeeCents: number;
  subtotalBeforeVatCents: number;
  vatCents: number;
  vatRate: number;
  brokerCutCents: number;
  sitterPayoutCents: number;
  totalChargeCents: number;

  basePrice: string;
  platformServiceFee: string;
  subtotalBeforeVat: string;
  vat: string;
  brokerCut: string;
  sitterPayout: string;
  totalCharge: string;
}

/**
 * Calculate transparent fees for ⁦The Sitter Suite™⁩ booking.
 * FLAT 15% commission, disclosed-agent (unified across all ⁦PetWash™⁩ platforms):
 * the owner pays the sitter's rate; PetWash keeps 15% out of it; the sitter gets 85%;
 * VAT is extracted from the commission (18/118), so the customer's total = the rate.
 *
 * @param pricePerDayCents - Sitter's daily rate in agorot (cents)
 * @param totalDays - Number of days for booking
 * @returns Complete fee breakdown
 *
 * @example
 * const fees = calculateTransparentFees(15000, 3); // ₪150/day × 3 days
 * // Base / owner pays: ₪450 (the sitter's rate — nothing added)
 * // Sitter payout: ₪382.50 (₪450 − 15% commission)
 * // PetWash commission: ₪67.50, of which ₪10.30 is VAT remitted (18/118) → ₪57.20 net
 */
export function calculateTransparentFees(
  pricePerDayCents: number,
  totalDays: number
): TransparentFeeCalculation {
  const basePriceCents = pricePerDayCents * totalDays;

  // SINGLE 15% commission, taken OUT of the base (disclosed-agent), NOT added on top.
  const platformServiceFeeCents = Math.round(basePriceCents * 0.15);

  const brokerCutCents = platformServiceFeeCents;

  // Sitter nets 85% — the 15% comes out of the rate.
  const sitterPayoutCents = basePriceCents - brokerCutCents;

  // The owner pays exactly the rate — no surcharge, no VAT on top.
  const subtotalBeforeVatCents = basePriceCents;

  // VAT (18%) is on the commission only, EXTRACTED (the commission is VAT-inclusive).
  const vatCents = Math.round(platformServiceFeeCents * (ISRAELI_VAT_RATE / (1 + ISRAELI_VAT_RATE)));

  // Customer's total IS the base — VAT lives inside the commission, not on top.
  const totalChargeCents = basePriceCents;

  const basePrice = (basePriceCents / 100).toFixed(2);
  const platformServiceFee = (platformServiceFeeCents / 100).toFixed(2);
  const subtotalBeforeVat = (subtotalBeforeVatCents / 100).toFixed(2);
  const vat = (vatCents / 100).toFixed(2);
  const brokerCut = (brokerCutCents / 100).toFixed(2);
  const sitterPayout = (sitterPayoutCents / 100).toFixed(2);
  const totalCharge = (totalChargeCents / 100).toFixed(2);

  return {
    pricePerDayCents,
    totalDays,
    basePriceCents,
    platformServiceFeeCents,
    subtotalBeforeVatCents,
    vatCents,
    vatRate: ISRAELI_VAT_RATE,
    brokerCutCents,
    sitterPayoutCents,
    totalChargeCents,
    basePrice,
    platformServiceFee,
    subtotalBeforeVat,
    vat,
    brokerCut,
    sitterPayout,
    totalCharge,
  };
}

/**
 * Validate fee calculation integrity (disclosed-agent, single 15%).
 *
 * Ensures:
 * 1. Sitter payout + commission = base price (85% + 15% = 100%)
 * 2. The owner's total = base price (no surcharge; VAT is inside the commission)
 * 3. VAT ≤ commission (it is extracted from the commission, never added on top)
 * 4. All amounts are positive
 */
export function validateFeeCalculation(fees: TransparentFeeCalculation): boolean {
  const payoutPlusBroker = fees.sitterPayoutCents + fees.brokerCutCents;
  if (payoutPlusBroker !== fees.basePriceCents) {
    console.error('[Fee Validation] Payout + Commission ≠ Base Price', {
      sitterPayout: fees.sitterPayoutCents,
      commission: fees.brokerCutCents,
      sum: payoutPlusBroker,
      basePrice: fees.basePriceCents,
    });
    return false;
  }

  // Disclosed-agent: the owner pays exactly the base — no surcharge, VAT extracted.
  if (fees.totalChargeCents !== fees.basePriceCents) {
    console.error('[Fee Validation] Owner total ≠ Base (no surcharge allowed; VAT is inside the commission)', {
      total: fees.totalChargeCents,
      basePrice: fees.basePriceCents,
    });
    return false;
  }
  if (fees.subtotalBeforeVatCents !== fees.basePriceCents) {
    console.error('[Fee Validation] Subtotal ≠ Base', {
      subtotal: fees.subtotalBeforeVatCents,
      basePrice: fees.basePriceCents,
    });
    return false;
  }
  if (fees.vatCents > fees.platformServiceFeeCents) {
    console.error('[Fee Validation] VAT exceeds commission (must be extracted from it)', {
      vat: fees.vatCents,
      commission: fees.platformServiceFeeCents,
    });
    return false;
  }

  if (
    fees.basePriceCents <= 0 ||
    fees.platformServiceFeeCents <= 0 ||
    fees.brokerCutCents <= 0 ||
    fees.sitterPayoutCents <= 0 ||
    fees.totalChargeCents <= 0 ||
    fees.vatCents <= 0
  ) {
    console.error('[Fee Validation] Negative or zero amount detected', fees);
    return false;
  }

  return true;
}
