/**
 * WALK MY PET™ - Financial Fee Calculator
 * 
 * INDUSTRY-LEADING PRICING powered by NAYAX (Israel):
 * - Owner pays: Base Price ONLY (₪0 service fee - simpler for customers!)
 * - Walker receives: 80% of Base Price (base - 20% walker fee)
 * - PetWash™ keeps: 20% TOTAL (0% from owner + 20% from walker)
 * 
 * 🏆 EXACTLY MATCHES ROVER (USA MARKET LEADER): 20% platform / 80% walker payout
 * 
 * Payment Flow (Airbnb-style escrow):
 * 1. Owner pays base price to PetWash via Nayax (no additional fees!)
 * 2. Nayax holds payment in escrow
 * 3. After walk completion (GPS check-out verified), walker receives 80% payout
 * 4. PetWash keeps 20% total commission (deducted from walker payout)
 * 
 * Commission Breakdown Example (₪100 base):
 * - Owner pays: ₪100 (no service fee!)
 * - Walker gets: ₪100 - ₪20 (20% fee) = ₪80
 * - Platform keeps: ₪20 (20% total)
 * 
 * Commission Comparison (2025 Benchmarks):
 * - Rover: 20% platform commission, 80% walker payout (USA market leader) ✓
 * - Wag: 40% platform commission, 60% walker payout (USA on-demand)
 * - CitizenShipper: $0 commission, 100% driver payout ($25/month subscription)
 * - Walk My Pet™: 20% platform commission, 80% walker payout (MATCHES ROVER) ✓
 * 
 * Israeli Market Adaptations:
 * - Currency: ILS (Israeli Shekel)
 * - VAT: 18% automatic calculation for Tax Authority compliance
 * - Payment: Nayax (preferred Israeli payment gateway)
 */

export interface WalkFeeCalculation {
  // Input
  basePriceCents: number; // Walker's rate for this walk (in agorot - Israeli cents)
  
  // Calculated amounts (all in agorot)
  platformServiceFeeOwnerCents: number; // 0% charged to owner (UPDATED: was 6%, now 0% to match Rover)
  walkerFeeCents: number; // 20% deducted from walker (UPDATED: was 18%, now 20%)
  walkerPayoutCents: number; // 80% to walker (base - 20%) - UPDATED: was 76%, now 80% - MATCHES ROVER
  platformCommissionTotalCents: number; // 20% total platform revenue (0% + 20%) - UPDATED: was 24%, now 20%
  totalChargeCents: number; // What owner pays (base + 0% = base) - UPDATED: was base + 6%, now just base
  vatCents: number; // 18% Israeli VAT on total charge
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
 * 
 * @param basePriceCents - Walker's rate for this walk in agorot (Israeli cents)
 * @returns Complete fee breakdown with all amounts
 * 
 * @example
 * const fees = calculateWalkFees(10000); // ₪100 base walk price
 * // Owner pays: ₪100 (no service fee!) + VAT
 * // Walker gets: ₪100 - ₪20 (20% fee) = ₪80
 * // Platform total: ₪0 + ₪20 = ₪20 (20% - MATCHES ROVER!)
 */
export function calculateWalkFees(basePriceCents: number): WalkFeeCalculation {
  // Platform service fee charged to owner: 0% (UPDATED: was 6%, now 0% to match Rover)
  const platformServiceFeeOwnerCents = 0;
  
  // Walker fee (withheld from walker): 20% of base (UPDATED: was 18%, now 20%)
  const walkerFeeCents = Math.round(basePriceCents * 0.20);
  
  // Walker payout: 80% of base (base - 20%) - MATCHES ROVER!
  const walkerPayoutCents = basePriceCents - walkerFeeCents;
  
  // Platform total commission: 0% + 20% = 20% (UPDATED: was 24%, now 20% - matches Rover)
  const platformCommissionTotalCents = platformServiceFeeOwnerCents + walkerFeeCents;
  
  // Total charge before VAT: base + 0% owner fee = base price only!
  const totalChargeCents = basePriceCents + platformServiceFeeOwnerCents;
  
  // Israeli VAT: 18% on total charge (base price only, no owner fees!)
  const vatCents = Math.round(totalChargeCents * 0.18);
  
  // Final total with VAT
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
 * 1. Walker payout + walker fee = base price (80% + 20% = 100%)
 * 2. Platform total = owner fee + walker fee (0% + 20% = 20%)
 * 3. Base price + owner fee = total charge before VAT (base + 0% = base)
 * 4. Total + VAT = final charge
 * 5. All amounts are positive
 */
export function validateWalkFeeCalculation(fees: WalkFeeCalculation): boolean {
  // Check walker payout + walker fee = base price
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
  
  // Check platform total = owner fee + walker fee
  const platformTotal = fees.platformServiceFeeOwnerCents + fees.walkerFeeCents;
  if (platformTotal !== fees.platformCommissionTotalCents) {
    console.error('[Walk Fee Validation] Owner Fee + Walker Fee ≠ Platform Total', {
      ownerFee: fees.platformServiceFeeOwnerCents,
      walkerFee: fees.walkerFeeCents,
      sum: platformTotal,
      platformTotal: fees.platformCommissionTotalCents,
    });
    return false;
  }
  
  // Check base + owner fee = total (before VAT)
  const basePlusOwnerFee = fees.basePriceCents + fees.platformServiceFeeOwnerCents;
  if (basePlusOwnerFee !== fees.totalChargeCents) {
    console.error('[Walk Fee Validation] Base + Owner Fee ≠ Total', {
      base: fees.basePriceCents,
      ownerFee: fees.platformServiceFeeOwnerCents,
      sum: basePlusOwnerFee,
      total: fees.totalChargeCents,
    });
    return false;
  }
  
  // Check total + VAT = final charge
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
  
  // Check all amounts are positive
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
    platformCommissionTotalRate: 0.20, // 20% total platform commission (UPDATED: was 0.24, now 0.20 - matches Rover)
    ownerFeeRate: 0.00, // 0% charged to owner (UPDATED: was 0.06, now 0.00 - simpler pricing!)
    walkerFeeRate: 0.20, // 20% deducted from walker (UPDATED: was 0.18, now 0.20)
    walkerPayoutRate: 0.80, // 80% walker payout (UPDATED: was 0.82, now 0.80 - MATCHES ROVER!)
    vatRate: 0.18, // 18% Israeli VAT
    currency: 'ILS', // Israeli Shekel
  };
}
