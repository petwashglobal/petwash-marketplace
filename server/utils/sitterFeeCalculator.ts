/**
 * THE SITTER SUITE™ - Financial Fee Calculator
 * Israeli Tax Law 2026 Compliant
 * 
 * FLAT 15% COMMISSION MODEL (all platforms unified):
 * - Owner pays: Base Price + 15% Platform Fee + 18% VAT on platform fee (via Nayax)
 * - Sitter receives: 85% of Base Price (after 15% platform commission)
 * - ⁦PetWash™⁩ keeps: 15% of Base Price (platform commission)
 * - VAT (18%) applied on platform fee per Israeli law
 * - Withholding tax (ניכוי מס במקור) deducted from sitter payout at settlement
 * 
 * Payment Flow (Pet Wash™ escrow model):
 * 1. Owner pays base + 15% platform fee + VAT to PetWash via Nayax
 * 2. Platform holds funds in 72-hour escrow
 * 3. Upon job completion:
 *    - Platform deducts 15% commission
 *    - Platform deducts withholding tax (20% default, or per provider certificate)
 *    - Sitter receives net payout after deductions
 * 4. Digital receipt (קבלה דיגיטלית) emailed to customer
 * 5. Transaction recorded in internal accounting system
 * 
 * Israeli VAT Rate: 18% (as of 2025-2026)
 * Withholding Tax Default: 20% (ניכוי מס במקור)
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
 * Calculate transparent fees for ⁦The Sitter Suite™⁩ booking
 * Israeli law 2026 compliant - VAT included in customer total
 * FLAT 15% commission (industry standard)
 * 
 * @param pricePerDayCents - Sitter's daily rate in agorot (cents)
 * @param totalDays - Number of days for booking
 * @returns Complete fee breakdown with all amounts including VAT
 * 
 * @example
 * const fees = calculateTransparentFees(15000, 3); // ₪150/day × 3 days
 * // Base: ₪450
 * // Platform fee (15%): ₪67.50
 * // Subtotal before VAT: ₪517.50
 * // VAT (18% on platform fee): ₪12.15
 * // Total charge to owner: ₪529.65
 * // Platform commission (15% of base): ₪67.50
 * // Sitter payout (before withholding): ₪382.50
 */
export function calculateTransparentFees(
  pricePerDayCents: number,
  totalDays: number
): TransparentFeeCalculation {
  const basePriceCents = pricePerDayCents * totalDays;
  
  const platformServiceFeeCents = Math.round(basePriceCents * 0.15);
  
  const subtotalBeforeVatCents = basePriceCents + platformServiceFeeCents;
  
  const vatCents = Math.round(platformServiceFeeCents * ISRAELI_VAT_RATE);
  
  const totalChargeCents = basePriceCents + platformServiceFeeCents + vatCents;
  
  const brokerCutCents = platformServiceFeeCents;
  
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
 * 1. Sitter payout + broker cut = base price (85% + 15% = 100%)
 * 2. Base price + platform fee = subtotal before VAT
 * 3. Base + platform fee + VAT on platform fee = total charge
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

  const basePlusPlatformPlusVat = fees.basePriceCents + fees.platformServiceFeeCents + fees.vatCents;
  if (basePlusPlatformPlusVat !== fees.totalChargeCents) {
    console.error('[Fee Validation] Base + Platform + VAT ≠ Total', {
      base: fees.basePriceCents,
      platform: fees.platformServiceFeeCents,
      vat: fees.vatCents,
      sum: basePlusPlatformPlusVat,
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
