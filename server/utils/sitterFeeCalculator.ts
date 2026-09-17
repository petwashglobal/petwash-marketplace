/**
 * THE SITTER SUITE™ - Financial Fee Calculator
 * Israeli Tax Law 2026 Compliant
 *
 * ONE MONEY MODEL (CEO 2026-09-14, confirmed 2026-09-17 — "same as Mad Paws,
 * Rover"), shared with every marketplace flow via shared/marketplaceMoney.ts:
 * - Owner pays: the sitter's rate + the Pet Wash service fee (15%) on top.
 * - Sitter receives: the full rate.
 * - PetWash™ keeps: the 15% fee. The 18% VAT Pet Wash owes is INSIDE that fee
 *   (extracted 18/118) — never added on top, never charged on the sitter's money.
 * - The sitter is the legal seller of the stay and invoices the owner for the
 *   rate; Pet Wash invoices only its fee.
 *
 * HISTORY:
 * - Before 2026-07-31 this charged base + 15% + VAT AND deducted 15% from the
 *   sitter (~30% real take), and the capture path fed the stored total back in
 *   as a per-day rate, charging fees twice.
 * - 2026-07-31 → 2026-09-17 it took 15% OUT of the rate (sitter netted 85%),
 *   while booking_requests put the fee on top — two models on one platform.
 * - 2026-09-17: fee on top, one shared split, and the card is charged the
 *   STORED total (acceptSitterBookingCore → processBookingPayment.chargeCents),
 *   never a recomputation — so the double-fee trap above cannot come back.
 *
 * Payment Flow (PetWash™ escrow model):
 * 1. Owner pays rate + fee to PetWash.
 * 2. Platform holds funds in escrow.
 * 3. Upon job completion and a Pet Wash admin's approval: sitter is paid the
 *    rate, less withholding tax (ניכוי מס במקור) per certificate.
 * 4. Digital receipt (קבלה דיגיטלית) emailed to customer.
 * 5. Transaction recorded in internal accounting system.
 */

import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';
import { splitMarketplaceJob } from '@shared/marketplaceMoney';

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
 * One money model (shared/marketplaceMoney.ts): owner pays rate + 15% fee on top,
 * sitter is owed the full rate, VAT is extracted from the fee (18/118).
 *
 * @param pricePerDayCents - Sitter's daily rate in agorot (cents)
 * @param totalDays - Number of days for booking
 * @returns Complete fee breakdown
 *
 * @example
 * const fees = calculateTransparentFees(15000, 3); // ₪150/day × 3 days
 * // Sitter's rate: ₪450 · owner pays ₪517.50 · sitter is owed ₪450
 * // PetWash fee: ₪67.50, of which ₪10.30 is VAT (18/118) → ₪57.20 net
 */
export function calculateTransparentFees(
  pricePerDayCents: number,
  totalDays: number
): TransparentFeeCalculation {
  const basePriceCents = pricePerDayCents * totalDays;

  // ONE MONEY MODEL (shared/marketplaceMoney.ts): the Pet Wash fee sits ON TOP
  // of the sitter's rate, the sitter is owed the whole rate, and the 18% VAT is
  // inside the fee. The split lives in one place so this cannot drift again.
  const split = splitMarketplaceJob(basePriceCents);

  const platformServiceFeeCents = split.serviceFeeCents;
  const brokerCutCents = split.serviceFeeCents;

  // The sitter is owed the full rate.
  const sitterPayoutCents = split.providerPayoutCents;

  // Everything the customer pays before VAT is separated out — VAT is only ever
  // inside Pet Wash's fee, so "before VAT" is the total minus that VAT.
  const vatCents = split.serviceFeeVatCents;
  const totalChargeCents = split.customerTotalCents;
  const subtotalBeforeVatCents = totalChargeCents - vatCents;

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
 * Validate fee calculation integrity (one money model).
 *
 * Ensures:
 * 1. Sitter payout = the full rate
 * 2. Owner's total = rate + fee
 * 3. VAT ≤ fee (it is extracted from the fee, never added on top)
 * 4. All amounts are positive
 */
export function validateFeeCalculation(fees: TransparentFeeCalculation): boolean {
  // The sitter is owed the whole rate — nothing is taken out of it.
  if (fees.sitterPayoutCents !== fees.basePriceCents) {
    console.error('[Fee Validation] Sitter payout ≠ rate (the fee must never come out of the sitter)', {
      sitterPayout: fees.sitterPayoutCents,
      basePrice: fees.basePriceCents,
    });
    return false;
  }

  // Customer pays the rate + the fee, to the agora.
  if (fees.totalChargeCents !== fees.basePriceCents + fees.platformServiceFeeCents) {
    console.error('[Fee Validation] Owner total ≠ rate + fee', {
      total: fees.totalChargeCents,
      basePrice: fees.basePriceCents,
      fee: fees.platformServiceFeeCents,
    });
    return false;
  }
  if (fees.subtotalBeforeVatCents !== fees.totalChargeCents - fees.vatCents) {
    console.error('[Fee Validation] Subtotal ≠ total − VAT', {
      subtotal: fees.subtotalBeforeVatCents,
      total: fees.totalChargeCents,
      vat: fees.vatCents,
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
