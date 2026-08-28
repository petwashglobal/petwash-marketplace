/**
 * Fiscal event registry — CEO 2026-08-27 fiscal directive §21-22, §73.
 *
 * ONE place mapping a PetWash operational event → the CPA-approved
 * `PetWashPaymentClass` in `server/services/sumitDocumentMapping.ts`.
 *
 * This file INVENTS NO TAX LOGIC. Every entry names the payment class
 * whose CPA-approved SumitDocumentMapping already exists. If the
 * mapping in sumitDocumentMapping.ts changes, this registry doesn't
 * need editing — the mapping key is stable.
 *
 * Read carefully:
 *   • §21 "Route must NEVER say 'this feels like an invoice'". Instead
 *     the route names its EVENT and this registry translates event →
 *     PaymentClass; `getSumitDocumentMapping(paymentClass)` decides the
 *     document type + VAT.
 *   • §73 "Client cannot request 'make this InvoiceAndReceipt'".
 *     Client says "I completed event X". Registry decides.
 *   • §22 must honour the current CPA event map. Nothing here is new.
 */

// ─── Event codes (§21) ──────────────────────────────────────────────

/**
 * Every commercial event PetWash issues today. NEW events must be
 * added here AND paired with the CPA-approved mapping — never at a
 * route level.
 */
export const FISCAL_EVENT_CODES = [
  // K9000 — sale-immediate at self-service station.
  'K9000_WASH_COMPLETED',
  'K9000_PUBLIC_CARD_COMPLETED',
  // Shop — retail item delivered.
  'SHOP_ORDER_PAID',
  'SHOP_ORDER_REFUNDED',
  // Wallet — stored value (VAT deferred).
  'WALLET_TOPUP_PAID',
  'WALLET_TOPUP_REFUNDED',
  // eGift — voucher created (stored value), consumed (tax event).
  'EGIFT_PURCHASE_PAID',
  'EGIFT_PURCHASE_REFUNDED',
  'EGIFT_REDEEMED_FOR_SERVICE',
  // Marketplace bookings — commission model today.
  'SITTER_BOOKING_PAID',
  'SITTER_BOOKING_REFUNDED',
  'WALK_BOOKING_PAID',
  'WALK_BOOKING_REFUNDED',
  'ACADEMY_BOOKING_PAID',
  'ACADEMY_BOOKING_REFUNDED',
  'PETTREK_BOOKING_PAID',
  'PETTREK_BOOKING_REFUNDED',
] as const;
export type FiscalEventCode = (typeof FISCAL_EVENT_CODES)[number];

// ─── PaymentClass values (mirrors sumitDocumentMapping.ts) ─────────
// Values MUST match `PetWashPaymentClass` in server/services/
// sumitDocumentMapping.ts exactly — enforced by the regression test.

export type MirroredPaymentClass =
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

// ─── Event → PaymentClass mapping ───────────────────────────────────

/**
 * The one and only translation from PetWash operational event to the
 * CPA-approved payment class.
 *
 * Rules encoded here:
 *   • K9000 wash → K9000_WASH (self-service internal-wallet cover).
 *   • K9000 public card → K9000_PUBLIC_CARD (walk-up Nayax; same
 *     fiscal treatment, different clearing).
 *   • Shop paid → SHOP_ITEM (PetWash principal; full VAT).
 *   • Wallet top-up → WALLET_TOPUP (stored value, no VAT at purchase).
 *   • eGift purchase → EGIFT_PURCHASE (voucher, no VAT).
 *   • eGift redeemed for a service → EGIFT_REDEMPTION (tax event lands
 *     here; CPA order #5).
 *   • Marketplace bookings (sitter/walk/academy/pettrek) →
 *     PROVIDER_BOOKING_COMMISSION (disclosed-agent commission today).
 *     A future CPA re-classification to principal-model can flip the
 *     right-hand side to PROVIDER_BOOKING_PRINCIPAL here without a
 *     route change.
 *   • Any *_REFUNDED event → REFUND (CreditInvoice referencing the
 *     original SUMIT document).
 */
export function paymentClassForEvent(event: FiscalEventCode): MirroredPaymentClass {
  switch (event) {
    case 'K9000_WASH_COMPLETED': return 'K9000_WASH';
    case 'K9000_PUBLIC_CARD_COMPLETED': return 'K9000_PUBLIC_CARD';
    case 'SHOP_ORDER_PAID': return 'SHOP_ITEM';
    case 'WALLET_TOPUP_PAID': return 'WALLET_TOPUP';
    case 'EGIFT_PURCHASE_PAID': return 'EGIFT_PURCHASE';
    case 'EGIFT_REDEEMED_FOR_SERVICE': return 'EGIFT_REDEMPTION';
    case 'SITTER_BOOKING_PAID':
    case 'WALK_BOOKING_PAID':
    case 'ACADEMY_BOOKING_PAID':
    case 'PETTREK_BOOKING_PAID':
      return 'PROVIDER_BOOKING_COMMISSION';
    case 'SHOP_ORDER_REFUNDED':
    case 'WALLET_TOPUP_REFUNDED':
    case 'EGIFT_PURCHASE_REFUNDED':
    case 'SITTER_BOOKING_REFUNDED':
    case 'WALK_BOOKING_REFUNDED':
    case 'ACADEMY_BOOKING_REFUNDED':
    case 'PETTREK_BOOKING_REFUNDED':
      return 'REFUND';
  }
}

// ─── Idempotency key (§25) ──────────────────────────────────────────

/**
 * §25 stable idempotency key: `${eventCode}:${businessObjectId}:${economicVersion}`.
 * Same callback twice → one SUMIT document. Reissue after
 * partial-refund adjustment → NEW economic version → NEW fiscal
 * event, still keyed off original document.
 *
 * economicVersion defaults to `v1` and MUST bump only when the money
 * changes in a way the SUMIT doc must reflect (partial refund,
 * corrective credit).
 */
export function fiscalEventKey(input: {
  event: FiscalEventCode;
  businessObjectId: string;
  economicVersion?: string;
}): string {
  const ver = input.economicVersion ?? 'v1';
  return `${input.event}:${input.businessObjectId}:${ver}`;
}
