/**
 * WALK MY PET™ - Financial Fee Calculator
 *
 * ONE MONEY MODEL (CEO 2026-09-14, confirmed 2026-09-17 — "same as Mad Paws,
 * Rover"), shared with every marketplace flow via shared/marketplaceMoney.ts:
 * - Owner pays: the walker's rate + the 15% Pet Wash fee on top.
 * - Walker receives: the full rate.
 * - PetWash™ keeps: the fee; the 18% VAT it owes is INSIDE the fee (18/118),
 *   never added on top and never charged on the walker's money.
 *
 * Example (₪100 rate): owner ₪115 · walker ₪100 · Pet Wash ₪15
 * (₪2.29 VAT inside, ₪12.71 net).
 *
 * HISTORY: before 2026-06-15 the owner paid +15% AND the walker lost 15% (a 30%
 * take). 2026-06-15 → 2026-09-17 the 15% came out of the walker's rate (walker
 * netted 85%) while booking_requests put it on top — two models on one
 * platform. Now one.
 *
 * Israeli Market Adaptations:
 * - Currency: ILS (Israeli Shekel)
 * - VAT: 18%, inside Pet Wash's fee only
 */

import { splitMarketplaceJob, MARKETPLACE_SERVICE_FEE_RATE } from "@shared/marketplaceMoney";
import { ISRAEL_VAT_RATE } from "@shared/israel-compliance-config";

export interface WalkFeeCalculation {
  basePriceCents: number;
  
  platformServiceFeeOwnerCents: number; // the Pet Wash fee, on top of the rate
  walkerFeeCents: number; // taken from the walker — always 0 in the one money model
  walkerPayoutCents: number; // the full rate
  platformCommissionTotalCents: number; // Pet Wash's whole fee (VAT inside)
  totalChargeCents: number; // What owner pays (base + 15% platform fee)
  vatCents: number; // VAT Pet Wash owes, extracted from its fee
  totalChargeWithVATCents: number; // = totalChargeCents (VAT is already inside the fee)
  
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
 * // Owner pays: ₪115 (₪100 rate + ₪15 Pet Wash fee)
 * // Walker gets: ₪100
 * // PetWash keeps: ₪15 (₪2.29 VAT inside, ₪12.71 net)
 */
export function calculateWalkFees(basePriceCents: number): WalkFeeCalculation {
  const split = splitMarketplaceJob(basePriceCents);

  // The whole fee is on the owner's side, on top of the rate.
  const platformServiceFeeOwnerCents = split.serviceFeeCents;
  const platformCommissionTotalCents = split.serviceFeeCents;

  // Nothing is taken from the walker.
  const walkerFeeCents = 0;
  const walkerPayoutCents = split.providerPayoutCents;

  const totalChargeCents = split.customerTotalCents;
  const vatCents = split.serviceFeeVatCents;

  // VAT lives inside the fee — never added on top of what the owner pays.
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
 * 1. The walker is owed the whole rate (nothing taken from them)
 * 2. Rate + Pet Wash fee = what the owner pays
 * 3. VAT is inside the fee (final charge = total; VAT ≤ fee)
 * 4. All amounts are positive
 */
export function validateWalkFeeCalculation(fees: WalkFeeCalculation): boolean {
  if (fees.walkerPayoutCents !== fees.basePriceCents || fees.walkerFeeCents !== 0) {
    console.error('[Walk Fee Validation] Walker must be owed the whole rate', {
      walkerPayout: fees.walkerPayoutCents,
      walkerFee: fees.walkerFeeCents,
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

  // VAT is inside the fee, never on top.
  if (fees.totalChargeWithVATCents !== fees.totalChargeCents) {
    console.error('[Walk Fee Validation] Final Charge ≠ Total (VAT must be inside the fee, not added)', {
      total: fees.totalChargeCents,
      finalCharge: fees.totalChargeWithVATCents,
    });
    return false;
  }
  if (fees.vatCents > fees.platformCommissionTotalCents) {
    console.error('[Walk Fee Validation] VAT exceeds the fee (must be extracted from it)', {
      vat: fees.vatCents,
      fee: fees.platformCommissionTotalCents,
    });
    return false;
  }

  if (
    fees.basePriceCents <= 0 ||
    fees.walkerPayoutCents <= 0 ||
    fees.platformCommissionTotalCents <= 0 ||
    fees.totalChargeCents <= 0 ||
    fees.vatCents <= 0
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
    platformCommissionTotalRate: MARKETPLACE_SERVICE_FEE_RATE,
    ownerFeeRate: MARKETPLACE_SERVICE_FEE_RATE, // the fee sits on top of the walker's rate
    walkerFeeRate: 0,                           // nothing is taken from the walker
    walkerPayoutRate: 1,                        // the walker is owed the whole rate
    vatRate: ISRAEL_VAT_RATE,
    currency: 'ILS',
  };
}
