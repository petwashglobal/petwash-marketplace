/**
 * WALK MY PET™ - Financial Fee Calculator
 * 
 * FLAT 15% COMMISSION (disclosed-agent model, unified across ALL PetWash™
 * paid services — same as Academy + TransactionEngine; CEO-confirmed 2026-06-15):
 * - Owner pays: the provider's rate (base price). NO separate surcharge.
 * - Walker receives: 85% of the base price.
 * - PetWash™ keeps: 15% commission (taken out of the base, not added on top).
 * - VAT (18%) is on PetWash's COMMISSION only, extracted from it (the commission
 *   is VAT-inclusive); the customer's total IS the base price.
 *
 * HISTORY: the previous version charged the owner +15% AND deducted 15% from the
 * walker = 30% real platform take while labelling it "15%". Corrected to a single
 * 15% commission per the CEO's instruction ("15% on every paid service").
 *
 * Commission Breakdown Example (₪100 base):
 * - Owner pays: ₪100 (the walker's rate, nothing added).
 * - Walker gets: ₪85 (₪100 − 15% commission).
 * - PetWash keeps: ₪15 commission, of which ₪2.29 is VAT remitted (18/118) → ₪12.71 net.
 *
 * Israeli Market Adaptations:
 * - Currency: ILS (Israeli Shekel)
 * - VAT: 18% on the commission, extracted (disclosed-agent), per Tax Authority rules
 * - Payment: Nayax (preferred Israeli payment gateway)
 */

import { ISRAEL_VAT_RATE } from "@shared/israel-compliance-config";

export interface WalkFeeCalculation {
  basePriceCents: number;
  
  platformServiceFeeOwnerCents: number; // 15% platform fee charged to owner
  walkerFeeCents: number; // 15% deducted from walker payout
  walkerPayoutCents: number; // 85% to walker (base - 15%)
  platformCommissionTotalCents: number; // 15% total platform revenue
  totalChargeCents: number; // What owner pays (base + 15% platform fee)
  vatCents: number; // 18% Israeli VAT on platform fee
  totalChargeWithVATCents: number; // Final amount charged
  
  // Human-readable amounts (in ILS)
  basePrice: string;
  platformServiceFeeOwner: string;
  walkerFee: string;
  walkerPayout: string;
  platformCommissionTotal: string;
  totalCharge: string;
  vat: string;
  totalChargeWithVAT: string;
}

/**
 * Calculate transparent fees for ⁦Walk My Pet™⁩ booking
 * FLAT 15% commission (unified across all ⁦PetWash™⁩ platforms)
 * 
 * @param basePriceCents - Walker's rate for this walk in agorot (Israeli cents)
 * @returns Complete fee breakdown with all amounts
 * 
 * @example
 * const fees = calculateWalkFees(10000); // ₪100 base walk price
 * // Owner pays: ₪100 (the walker's rate — nothing added)
 * // Walker gets: ₪85 (₪100 − 15% commission)
 * // PetWash keeps: ₪15 commission (₪2.29 VAT remitted, ₪12.71 net)
 */
export function calculateWalkFees(basePriceCents: number): WalkFeeCalculation {
  // 15% commission, disclosed-agent (unified with Academy + TransactionEngine):
  // the owner pays the rate; PetWash keeps 15% out of it; the walker gets 85%;
  // VAT is on the commission, extracted (18/118), so the customer's total = base.
  const platformCommissionTotalCents = Math.round(basePriceCents * 0.15);

  // The 15% comes OUT of the provider's rate (NOT added on top of it).
  const walkerFeeCents = platformCommissionTotalCents;

  const walkerPayoutCents = basePriceCents - walkerFeeCents;

  // No separate owner surcharge — the owner pays exactly the rate.
  const platformServiceFeeOwnerCents = 0;

  const totalChargeCents = basePriceCents;

  // VAT is on the commission only, extracted (the commission is VAT-inclusive).
  const vatCents = Math.round(platformCommissionTotalCents * (ISRAEL_VAT_RATE / (1 + ISRAEL_VAT_RATE)));

  // VAT lives inside the commission — it is NOT added on top of what the owner pays.
  const totalChargeWithVATCents = totalChargeCents;
  
  // Convert to ILS for display (divide by 100: agorot → shekels)
  const basePrice = (basePriceCents / 100).toFixed(2);
  const platformServiceFeeOwner = (platformServiceFeeOwnerCents / 100).toFixed(2);
  const walkerFee = (walkerFeeCents / 100).toFixed(2);
  const walkerPayout = (walkerPayoutCents / 100).toFixed(2);
  const platformCommissionTotal = (platformCommissionTotalCents / 100).toFixed(2);
  const totalCharge = (totalChargeCents / 100).toFixed(2);
  const vat = (vatCents / 100).toFixed(2);
  const totalChargeWithVAT = (totalChargeWithVATCents / 100).toFixed(2);
  
  return {
    basePriceCents,
    platformServiceFeeOwnerCents,
    walkerFeeCents,
    walkerPayoutCents,
    platformCommissionTotalCents,
    totalChargeCents,
    vatCents,
    totalChargeWithVATCents,
    basePrice,
    platformServiceFeeOwner,
    walkerFee,
    walkerPayout,
    platformCommissionTotal,
    totalCharge,
    vat,
    totalChargeWithVAT,
  };
}

/**
 * Calculate walk fees for hourly walks (30/60/90/120 minutes)
 * 
 * @param walkerHourlyRateCents - Walker's hourly rate in agorot
 * @param durationMinutes - Walk duration (30, 60, 90, or 120 minutes)
 * @returns Fee breakdown for this specific walk
 */
export function calculateWalkFeesByDuration(
  walkerHourlyRateCents: number,
  durationMinutes: number
): WalkFeeCalculation {
  // Calculate pro-rated base price for this duration
  const basePriceCents = Math.round((walkerHourlyRateCents / 60) * durationMinutes);
  
  return calculateWalkFees(basePriceCents);
}

/**
 * Validate fee calculation integrity for ⁦Walk My Pet™⁩
 * 
 * Ensures that:
 * 1. Walker payout + walker fee = base price (85% + 15% = 100%)
 * 2. Platform commission = 15% of base
 * 3. Base price + platform fee = total charge before VAT
 * 4. Total + VAT = final charge
 * 5. All amounts are positive
 */
export function validateWalkFeeCalculation(fees: WalkFeeCalculation): boolean {
  const payoutPlusFee = fees.walkerPayoutCents + fees.walkerFeeCents;
  if (payoutPlusFee !== fees.basePriceCents) {
    console.error('[Walk Fee Validation] Payout + Walker Fee ≠ Base Price', {
      walkerPayout: fees.walkerPayoutCents,
      walkerFee: fees.walkerFeeCents,
      sum: payoutPlusFee,
      basePrice: fees.basePriceCents,
    });
    return false;
  }
  
  const basePlusPlatformFee = fees.basePriceCents + fees.platformServiceFeeOwnerCents;
  if (basePlusPlatformFee !== fees.totalChargeCents) {
    console.error('[Walk Fee Validation] Base + Platform Fee ≠ Total', {
      base: fees.basePriceCents,
      platformFee: fees.platformServiceFeeOwnerCents,
      sum: basePlusPlatformFee,
      total: fees.totalChargeCents,
    });
    return false;
  }
  
  // Disclosed-agent: VAT is extracted from the commission, NOT added on top —
  // so the owner's final charge equals the base/total, and VAT ≤ commission.
  if (fees.totalChargeWithVATCents !== fees.totalChargeCents) {
    console.error('[Walk Fee Validation] Final Charge ≠ Total (VAT must be inside the commission, not added)', {
      total: fees.totalChargeCents,
      finalCharge: fees.totalChargeWithVATCents,
    });
    return false;
  }
  if (fees.vatCents > fees.platformCommissionTotalCents) {
    console.error('[Walk Fee Validation] VAT exceeds commission (must be extracted from it)', {
      vat: fees.vatCents,
      commission: fees.platformCommissionTotalCents,
    });
    return false;
  }

  // platformServiceFeeOwnerCents is intentionally 0 (no owner surcharge), so it
  // is NOT in this positive-amount check.
  if (
    fees.basePriceCents <= 0 ||
    fees.walkerFeeCents <= 0 ||
    fees.walkerPayoutCents <= 0 ||
    fees.platformCommissionTotalCents <= 0 ||
    fees.totalChargeCents <= 0 ||
    fees.vatCents <= 0 ||
    fees.totalChargeWithVATCents <= 0
  ) {
    console.error('[Walk Fee Validation] Negative or zero amount detected', fees);
    return false;
  }
  
  return true;
}

/**
 * Get commission breakdown for transparency display
 */
export function getWalkCommissionBreakdown(): {
  platformCommissionTotalRate: number;
  ownerFeeRate: number;
  walkerFeeRate: number;
  walkerPayoutRate: number;
  vatRate: number;
  currency: string;
} {
  return {
    platformCommissionTotalRate: 0.15,
    ownerFeeRate: 0, // no owner surcharge — the 15% comes out of the provider's rate
    walkerFeeRate: 0.15,
    walkerPayoutRate: 0.85,
    vatRate: ISRAEL_VAT_RATE,
    currency: 'ILS',
  };
}
