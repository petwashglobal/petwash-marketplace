/**
 * THE SITTER SUITE™ - Financial Fee Calculator
 * Israeli Tax Law 2026 Compliant
 * 
 * Subcontractor (Wolt/Airbnb) broker model:
 * - Owner pays: Base Price + 10% Platform Service Fee + 18% VAT (via Nayax)
 * - Sitter receives: 92.5% of Base Price (after 7.5% broker cut)
 * - PetWash™ keeps: 7.5% of Base Price (hidden broker commission)
 * - VAT (18%) applied on full charge per Israeli law
 * - Withholding tax (ניכוי מס במקור) deducted from sitter payout at settlement
 * 
 * Payment Flow (Like Wolt Israel / Booking.com):
 * 1. Owner pays full amount including VAT to PetWash via Nayax
 * 2. Platform holds funds in 72-hour escrow
 * 3. Upon job completion:
 *    - Platform deducts 7.5% broker commission
 *    - Platform deducts withholding tax (20% default, or per provider certificate)
 *    - Sitter receives net payout after deductions
 * 4. Digital receipt (קבלה דיגיטלית) emailed to customer
 * 5. Transaction recorded in internal accounting system
 * 
 * Israeli VAT Rate: 18% (as of 2025-2026)
 * Withholding Tax Default: 20% (ניכוי מס במקור)
 */

const ISRAELI_VAT_RATE = 0.18;

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
 * Calculate transparent fees for The Sitter Suite™ booking
 * Israeli law 2026 compliant - VAT included in customer total
 * 
 * @param pricePerDayCents - Sitter's daily rate in agorot (cents)
 * @param totalDays - Number of days for booking
 * @returns Complete fee breakdown with all amounts including VAT
 * 
 * @example
 * const fees = calculateTransparentFees(15000, 3); // ₪150/day × 3 days
 * // Base: ₪450
 * // Platform fee (10%): ₪45
 * // Subtotal before VAT: ₪495
 * // VAT (18%): ₪89.10
 * // Total charge to owner: ₪584.10
 * // Broker cut (7.5% of base): ₪33.75
 * // Sitter payout (before withholding): ₪416.25
 */
export function calculateTransparentFees(
  pricePerDayCents: number,
  totalDays: number
): TransparentFeeCalculation {
  const basePriceCents = pricePerDayCents * totalDays;
  
  const platformServiceFeeCents = Math.round(basePriceCents * 0.10);
  
  const subtotalBeforeVatCents = basePriceCents + platformServiceFeeCents;
  
  const vatCents = Math.round(subtotalBeforeVatCents * ISRAELI_VAT_RATE);
  
  const totalChargeCents = subtotalBeforeVatCents + vatCents;
  
  const brokerCutCents = Math.round(basePriceCents * 0.075);
  
  const sitterPayoutCents = basePriceCents - brokerCutCents;
  
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
 * Validate fee calculation integrity
 * 
 * Ensures that:
 * 1. Sitter payout + broker cut = base price
 * 2. Base price + platform fee = subtotal before VAT
 * 3. Subtotal + VAT = total charge
 * 4. All amounts are positive
 */
export function validateFeeCalculation(fees: TransparentFeeCalculation): boolean {
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
  
  const basePlusPlatform = fees.basePriceCents + fees.platformServiceFeeCents;
  if (basePlusPlatform !== fees.subtotalBeforeVatCents) {
    console.error('[Fee Validation] Base + Platform ≠ Subtotal', {
      base: fees.basePriceCents,
      platform: fees.platformServiceFeeCents,
      sum: basePlusPlatform,
      subtotal: fees.subtotalBeforeVatCents,
    });
    return false;
  }

  const subtotalPlusVat = fees.subtotalBeforeVatCents + fees.vatCents;
  if (subtotalPlusVat !== fees.totalChargeCents) {
    console.error('[Fee Validation] Subtotal + VAT ≠ Total', {
      subtotal: fees.subtotalBeforeVatCents,
      vat: fees.vatCents,
      sum: subtotalPlusVat,
      total: fees.totalChargeCents,
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
