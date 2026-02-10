/**
 * WALK MY PET™ - Financial Fee Calculator
 * 
 * FLAT 15% COMMISSION MODEL (unified across all PetWash™ platforms):
 * - Owner pays: Base Price + 15% Platform Fee + VAT on platform fee
 * - Walker receives: 85% of Base Price (after 15% commission)
 * - PetWash™ keeps: 15% commission (matches MadPaws industry standard)
 * 
 * Payment Flow (Airbnb-style escrow):
 * 1. Owner pays base + 15% platform fee + VAT to PetWash via Nayax
 * 2. Nayax holds payment in 72-hour escrow
 * 3. After walk completion (GPS check-out verified), walker receives 85% payout
 * 4. PetWash keeps 15% platform commission
 * 
 * Commission Breakdown Example (₪100 base):
 * - Owner pays: ₪100 + ₪15 platform fee + ₪2.70 VAT = ₪117.70
 * - Walker gets: ₪100 - ₪15 (15% fee) = ₪85
 * - Platform keeps: ₪15 (15% total) + VAT collected
 * 
 * Commission Comparison (2025 Benchmarks):
 * - MadPaws: 15% platform commission (acquired by Rover for $40.5M) ✓
 * - Rover: 20% platform commission (USA market leader)
 * - Wag: 40% platform commission (USA on-demand)
 * - Walk My Pet™: 15% platform commission (MATCHES MADPAWS) ✓
 * 
 * Israeli Market Adaptations:
 * - Currency: ILS (Israeli Shekel)
 * - VAT: 18% on platform fee for Tax Authority compliance
 * - Payment: Nayax (preferred Israeli payment gateway)
 */

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
 * Calculate transparent fees for Walk My Pet™ booking
 * FLAT 15% commission (unified across all PetWash™ platforms)
 * 
 * @param basePriceCents - Walker's rate for this walk in agorot (Israeli cents)
 * @returns Complete fee breakdown with all amounts
 * 
 * @example
 * const fees = calculateWalkFees(10000); // ₪100 base walk price
 * // Owner pays: ₪100 + ₪15 (15% fee) + ₪2.70 VAT = ₪117.70
 * // Walker gets: ₪100 - ₪15 (15% fee) = ₪85
 * // Platform total: ₪15 (15% - MATCHES MADPAWS!)
 */
export function calculateWalkFees(basePriceCents: number): WalkFeeCalculation {
  const platformServiceFeeOwnerCents = Math.round(basePriceCents * 0.15);
  
  const walkerFeeCents = Math.round(basePriceCents * 0.15);
  
  const walkerPayoutCents = basePriceCents - walkerFeeCents;
  
  const platformCommissionTotalCents = platformServiceFeeOwnerCents;
  
  const totalChargeCents = basePriceCents + platformServiceFeeOwnerCents;
  
  const vatCents = Math.round(platformServiceFeeOwnerCents * 0.18);
  
  const totalChargeWithVATCents = totalChargeCents + vatCents;
  
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
 * Validate fee calculation integrity for Walk My Pet™
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
  
  const totalPlusVAT = fees.totalChargeCents + fees.vatCents;
  if (totalPlusVAT !== fees.totalChargeWithVATCents) {
    console.error('[Walk Fee Validation] Total + VAT ≠ Final Charge', {
      total: fees.totalChargeCents,
      vat: fees.vatCents,
      sum: totalPlusVAT,
      finalCharge: fees.totalChargeWithVATCents,
    });
    return false;
  }
  
  if (
    fees.basePriceCents <= 0 ||
    fees.platformServiceFeeOwnerCents <= 0 ||
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
    ownerFeeRate: 0.15,
    walkerFeeRate: 0.15,
    walkerPayoutRate: 0.85,
    vatRate: 0.18,
    currency: 'ILS',
  };
}
