/**
 * SUMIT document mapping — the CPA-approved per-class decision table (2026-07-09).
 *
 * SUMIT is the issuer of record; this is the single source of truth for WHICH SUMIT
 * document type + VAT treatment each PetWash payment class produces. Encoded exactly
 * to the accountant's mapping (רו״ח קופרברג) — no invented tax logic; every value
 * here traces to a CPA order:
 *   #3/#4 disclosed-agent: marketplace VAT on the 15% commission only; K9000/shop =
 *         PetWash principal → full VAT.
 *   #4    per-class doc types (InvoiceAndReceipt / Receipt / Invoice / CreditInvoice).
 *   #5    eGift is NOT a sale at purchase → Receipt, no VAT; the tax event is at
 *         redemption/breakage.
 *   wallet top-up = stored value → Receipt, no VAT (tax when redeemed for a service).
 *   refund/credit → CreditInvoice linked to the original document (void-not-delete).
 *
 * This module is PURE — it computes nothing about a specific sale and has no side
 * effects. Callers use it to pick the SUMIT document Type + how to treat VAT. The
 * mapping activates only when SUMIT is the issuer (isWired()); the self-issued
 * local PW- path is unchanged until go-live.
 */

export type PetWashPaymentClass =
  | 'K9000_WASH'
  | 'K9000_PUBLIC_CARD'
  | 'SHOP_ITEM'
  | 'WALLET_TOPUP'
  | 'EGIFT_PURCHASE'
  | 'EGIFT_REDEMPTION'
  | 'PROVIDER_BOOKING_COMMISSION'
  | 'PROVIDER_BOOKING_PRINCIPAL'
  | 'REFUND'
  | 'CREDIT_ADJUSTMENT';

/** SUMIT document types we issue (the `Details.Type` value on the SUMIT API). */
export type SumitDocumentType = 'InvoiceAndReceipt' | 'Receipt' | 'Invoice' | 'CreditInvoice';

/**
 * How VAT is treated for this class:
 *  - FULL_VAT               → 18% on the whole amount (PetWash principal sale).
 *  - NO_VAT_STORED_VALUE    → no VAT now; the payment buys stored value (top-up/eGift).
 *  - VAT_AT_REDEMPTION      → full VAT, charged when the stored value is consumed.
 *  - VAT_ON_COMMISSION_ONLY → disclosed-agent: VAT only on PetWash's 15% commission.
 *  - CREDIT                 → a credit/negation of a prior document.
 */
export type SumitVatMode =
  | 'FULL_VAT'
  | 'NO_VAT_STORED_VALUE'
  | 'VAT_AT_REDEMPTION'
  | 'VAT_ON_COMMISSION_ONLY'
  | 'CREDIT';

/** Who the document is issued for / in what capacity. */
export type SumitIssuerRole =
  | 'PETWASH_PRINCIPAL'
  | 'PETWASH_STORED_VALUE'
  | 'PETWASH_DISCLOSED_AGENT';

export interface SumitDocumentMapping {
  documentType: SumitDocumentType;
  vatMode: SumitVatMode;
  issuer: SumitIssuerRole;
  /** CreditInvoice must reference the original SUMIT document it credits. */
  requiresOriginalDocumentId?: boolean;
}

/**
 * The CPA-approved table. Throws on an unknown class so a mis-typed caller fails
 * loudly rather than silently issuing the wrong tax document.
 */
export function getSumitDocumentMapping(paymentClass: PetWashPaymentClass): SumitDocumentMapping {
  switch (paymentClass) {
    // PetWash principal sales — full VAT, invoice + receipt.
    // K9000_PUBLIC_CARD = a walk-up public credit-card wash at the K9000, CLEARED BY
    // NAYAX (not our checkout). Fiscally IDENTICAL to K9000_WASH (PetWash is the
    // principal operator; the price is a full-VAT wash sale) — the only difference
    // is the money was cleared externally by Nayax, which does not change the VAT or
    // document type. So it reuses the exact K9000_WASH CPA treatment; no new tax logic.
    case 'K9000_WASH':
    case 'K9000_PUBLIC_CARD':
    case 'SHOP_ITEM':
      return { documentType: 'InvoiceAndReceipt', vatMode: 'FULL_VAT', issuer: 'PETWASH_PRINCIPAL' };

    // Stored value — no VAT at purchase; the tax event is deferred to consumption.
    case 'WALLET_TOPUP':
    case 'EGIFT_PURCHASE':
      return { documentType: 'Receipt', vatMode: 'NO_VAT_STORED_VALUE', issuer: 'PETWASH_STORED_VALUE' };

    // eGift/credit consumed for a taxable service — full VAT at redemption.
    case 'EGIFT_REDEMPTION':
      return { documentType: 'InvoiceAndReceipt', vatMode: 'VAT_AT_REDEMPTION', issuer: 'PETWASH_PRINCIPAL' };

    // Disclosed-agent marketplace booking — VAT only on PetWash's commission.
    case 'PROVIDER_BOOKING_COMMISSION':
      return { documentType: 'Invoice', vatMode: 'VAT_ON_COMMISSION_ONLY', issuer: 'PETWASH_DISCLOSED_AGENT' };

    // Principal-model booking (only if the CPA chose principal for a service) — full VAT.
    case 'PROVIDER_BOOKING_PRINCIPAL':
      return { documentType: 'InvoiceAndReceipt', vatMode: 'FULL_VAT', issuer: 'PETWASH_PRINCIPAL' };

    // Refunds / adjustments — credit note linked to the original document.
    case 'REFUND':
    case 'CREDIT_ADJUSTMENT':
      return {
        documentType: 'CreditInvoice',
        vatMode: 'CREDIT',
        issuer: 'PETWASH_PRINCIPAL',
        requiresOriginalDocumentId: true,
      };

    default: {
      // Exhaustiveness guard — a new class must be mapped explicitly by the CPA.
      const _never: never = paymentClass;
      throw new Error(`Unknown PetWash payment class (no CPA SUMIT mapping): ${_never}`);
    }
  }
}

// ─── Funding-aware CPA lookup (§18-20 CEO 2026-08-27) ───────────────
//
// FUNDING SOURCE ≠ COMMERCIAL EVENT.
//
//   eGift is a FUNDING SOURCE.
//   K9000 / SHOP / SITTER / WALK / ACADEMY / PETTREK are COMMERCIAL
//   EVENTS.
//
// The commercial mapping OWNS the tax answer. Funding an existing
// commercial event with eGift value does NOT re-classify the sale.
// Concretely:
//
//   Shop towel ₪50 funded by eGift ₪20 + card ₪30
//     → commercial sale stays SHOP_ITEM ₪50 (FULL_VAT, PetWash principal).
//   Walk booking ₪100 funded by eGift ₪40 + card ₪60
//     → commercial event stays PROVIDER_BOOKING_COMMISSION
//       (VAT_ON_COMMISSION_ONLY, PetWash disclosed agent).
//
// The pre-existing EGIFT_REDEMPTION class only applies when eGift value
// is consumed as a STANDALONE PetWash principal service (K9000/PetWash-
// side wash paid entirely from stored value) — that stays PETWASH_PRINCIPAL /
// VAT_AT_REDEMPTION as the CPA already ruled.

/**
 * Funding rails an eGift-funded transaction can use as legs. This is a
 * client-visible taxonomy; the CPA answer NEVER depends on which rail
 * covered which cents — it depends on the COMMERCIAL class.
 */
export type FundingRail = 'CARD' | 'WALLET' | 'EGIFT' | 'PROMO' | 'REFERRAL' | 'WASH_CREDIT' | 'CASH';

/**
 * Given the COMMERCIAL event's payment class + the mix of funding rails
 * a caller intends to use, return the CPA-authoritative SUMIT mapping.
 *
 * §19 marketplace protection: PROVIDER_BOOKING_COMMISSION funded by
 * eGift stays disclosed-agent; the mapping ALWAYS reflects the
 * commercial event. This function's ONLY job is to enforce that rule
 * explicitly so no caller can accidentally reach for EGIFT_REDEMPTION
 * on a marketplace booking.
 *
 * Marketplace + eGift MUST NOT be activated on the fiscal path until
 * the CEO has explicitly approved the new funding-vs-commercial split.
 * Callers can compute the mapping for design/preview, but the wired
 * money paths (composer + admin explorer) still consume ONLY
 * getSumitDocumentMapping() until CEO clears MARKETPLACE_EGIFT_FISCAL_ACTIVATION.
 */
export function getFundingAwareSumitMapping(input: {
  commercialClass: PetWashPaymentClass;
  fundingRails: FundingRail[];
}): SumitDocumentMapping & { activationBlocked?: 'MARKETPLACE_EGIFT_FISCAL_ACTIVATION' } {
  const base = getSumitDocumentMapping(input.commercialClass);
  const hasEgift = input.fundingRails.includes('EGIFT');
  const isMarketplace = input.commercialClass === 'PROVIDER_BOOKING_COMMISSION'
    || input.commercialClass === 'PROVIDER_BOOKING_PRINCIPAL';

  // Fiscal-path activation guard: marketplace + eGift is NOT yet wired
  // on the money path per CEO 2026-08-27 §20. Return the honest CPA
  // answer AND flag activationBlocked so callers show, not act on it.
  if (isMarketplace && hasEgift) {
    return { ...base, activationBlocked: 'MARKETPLACE_EGIFT_FISCAL_ACTIVATION' };
  }
  return base;
}

