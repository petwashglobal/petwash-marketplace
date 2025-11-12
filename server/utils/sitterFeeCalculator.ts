/**
 * THE SITTER SUITE™ - Financial Fee Calculator
 * 
 * Revolutionary transparent pricing model powered by NAYAX:
 * - Owner pays: Base Price + 10% Platform Service Fee (via Nayax)
 * - Sitter receives: 92.5% of Base Price (after 7.5% broker cut)
 * - PetWash™ keeps: 7.5% of Base Price (hidden broker commission)
 * 
 * Payment Flow (Like Booking.com/Airbnb):
 * 1. Owner pays full amount to PetWash via Nayax
 * 2. Nayax splits payment automatically:
 *    - 7.5% goes to PetWash merchant account (broker fee)
 *    - 92.5% held in escrow for sitter payout
 * 3. After job completion, sitter receives 92.5% payout
 * 
 * This model ensures:
 * 1. Non-greedy pricing (only 7.5% commission vs. industry standard 15-20%)
 * 2. Transparent fees for customers (10% visible platform fee)
 * 3. Competitive sitter payouts (92.5% of base rate)
 * 4. Scalable revenue model for growth
 * 5. Apple-level brand positioning - fresh, young, cool, premium
 */

export interface TransparentFeeCalculation {
  // Input
  pricePerDayCents: number;
  totalDays: number;
  
  // Calculated amounts (all in cents)
  basePriceCents: number;
  platformServiceFeeCents: number; // 10% visible to owner
  brokerCutCents: number; // 7.5% hidden (our profit)
  sitterPayoutCents: number; // 92.5% to sitter
  totalChargeCents: number; // What owner pays
  
  // Human-readable amounts (in dollars)
  basePrice: string;
  platformServiceFee: string;
  brokerCut: string;
  sitterPayout: string;
  totalCharge: string;
}

/**
 * Calculate transparent fees for The Sitter Suite™ booking
 * 
 * @param pricePerDayCents - Sitter's daily rate in cents
 * @param totalDays - Number of days for booking
 * @returns Complete fee breakdown with all amounts
 * 
 * @example
 * const fees = calculateTransparentFees(15000, 3); // $150/day × 3 days
 * // Owner pays: $450 + $45 platform fee = $495 total
 * // Sitter gets: $416.25 (92.5% of $450)
 * // PetWash keeps: $33.75 (7.5% of $450)
 */
export function calculateTransparentFees(
  pricePerDayCents: number,
  totalDays: number
): TransparentFeeCalculation {
  // Calculate base price (sitter's rate × days)
  const basePriceCents = pricePerDayCents * totalDays;
  
  // Platform service fee: 10% of base (visible to owner)
  const platformServiceFeeCents = Math.round(basePriceCents * 0.10);
  
  // Broker cut: 7.5% of base (hidden, our profit)
  const brokerCutCents = Math.round(basePriceCents * 0.075);
  
  // Sitter payout: 92.5% of base (after broker cut)
  const sitterPayoutCents = basePriceCents - brokerCutCents;
  
  // Total charge: base + platform fee
  const totalChargeCents = basePriceCents + platformServiceFeeCents;
  
  // Convert to dollars for display
  const basePrice = (basePriceCents / 100).toFixed(2);
  const platformServiceFee = (platformServiceFeeCents / 100).toFixed(2);
  const brokerCut = (brokerCutCents / 100).toFixed(2);
  const sitterPayout = (sitterPayoutCents / 100).toFixed(2);
  const totalCharge = (totalChargeCents / 100).toFixed(2);
  
  return {
    pricePerDayCents,
    totalDays,
    basePriceCents,
    platformServiceFeeCents,
    brokerCutCents,
    sitterPayoutCents,
    totalChargeCents,
    basePrice,
    platformServiceFee,
    brokerCut,
    sitterPayout,
    totalCharge,
  };
}

/**
 * Validate fee calculation integrity
 * 
 * Ensures that:
 * 1. Sitter payout + broker cut = base price
 * 2. Base price + platform fee = total charge
 * 3. All amounts are positive
 */
export function validateFeeCalculation(fees: TransparentFeeCalculation): boolean {
  // Check sitter payout + broker cut = base price
  const payoutPlusBroker = fees.sitterPayoutCents + fees.brokerCutCents;
  if (payoutPlusBroker !== fees.basePriceCents) {
    console.error('[Fee Validation] Payout + Broker ≠ Base Price', {
      sitterPayout: fees.sitterPayoutCents,
      brokerCut: fees.brokerCutCents,
      sum: payoutPlusBroker,
      basePrice: fees.basePriceCents,
    });
    return false;
  }
  
  // Check base + platform fee = total
  const basePlusPlatform = fees.basePriceCents + fees.platformServiceFeeCents;
  if (basePlusPlatform !== fees.totalChargeCents) {
    console.error('[Fee Validation] Base + Platform ≠ Total', {
      base: fees.basePriceCents,
      platform: fees.platformServiceFeeCents,
      sum: basePlusPlatform,
      total: fees.totalChargeCents,
    });
    return false;
  }
  
  // Check all amounts are positive
  if (
    fees.basePriceCents <= 0 ||
    fees.platformServiceFeeCents <= 0 ||
    fees.brokerCutCents <= 0 ||
    fees.sitterPayoutCents <= 0 ||
    fees.totalChargeCents <= 0
  ) {
    console.error('[Fee Validation] Negative or zero amount detected', fees);
    return false;
  }
  
  return true;
}
