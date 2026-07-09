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
    case 'K9000_WASH':
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
