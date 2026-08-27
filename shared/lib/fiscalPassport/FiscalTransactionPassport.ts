/**
 * FiscalTransactionPassport DTO — CEO 2026-08-27 fiscal directive §1, §50-51, §92.
 *
 * READ MODEL. Not a new money store. The composer at
 * server/services/fiscalPassport/composer.ts projects this over
 * existing authorities (shop_orders, sitter_bookings, walk_bookings,
 * trainer_bookings, k9000_wash_events, egift_guest_orders,
 * booking_requests, wallet ledger, contractor_earnings).
 *
 * §50 discipline: FIVE separate state axes — never overloaded into one
 * `status`. Callers of the composer render each axis independently.
 */

import type { PlatformCode } from '../jobPassport/platformRegistry';
import type { TransactionLineItem } from './lineItemCatalog';
import type { FiscalEventCode, MirroredPaymentClass } from './eventRegistry';

// ─── State axes (§50, §51) ──────────────────────────────────────────

export const COMMERCIAL_STATES = [
  'DRAFT',            // pre-payment
  'BOOKED',           // booking confirmed pre-fulfilment
  'FULFILLED',        // fulfilment complete
  'CANCELLED',
] as const;
export type CommercialState = (typeof COMMERCIAL_STATES)[number];

export const PAYMENT_STATES = [
  'NOT_REQUIRED',
  'PAYMENT_REQUIRED',
  'PAYMENT_PENDING',
  'PAID',
  'REFUND_PENDING',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const FISCAL_DOCUMENT_STATES = [
  'NOT_REQUIRED',
  'PENDING',
  'ISSUING',
  'ISSUED',
  'ISSUE_FAILED',
  'CREDIT_PENDING',
  'CREDITED',
  'RECONCILIATION_REQUIRED',
] as const;
export type FiscalDocumentState = (typeof FISCAL_DOCUMENT_STATES)[number];

export const FULFILMENT_STATES = [
  'NOT_APPLICABLE',
  'NOT_STARTED',
  'IN_PROGRESS',
  'PROVIDER_COMPLETED',
  'CUSTOMER_CONFIRMED',
  'CANCELLED',
] as const;
export type FulfilmentState = (typeof FULFILMENT_STATES)[number];

export const PAYOUT_STATES = [
  'NOT_APPLICABLE',
  'PENDING',
  'AVAILABLE',
  'PAID',
  'FAILED',
  'REVERSED',
] as const;
export type PayoutState = (typeof PAYOUT_STATES)[number];

// ─── Funding legs (§14) ─────────────────────────────────────────────

export type FundingRail = 'CARD' | 'WALLET' | 'EGIFT' | 'PRESTIGE_BENEFIT' | 'CASH_STATION' | 'MACHINE_NAYAX';

export interface FundingLeg {
  rail: FundingRail;
  amountCents: number;
  currency: 'ILS';
  /** External reference for the specific funding leg — Nayax tx id
   *  for CARD/MACHINE_NAYAX, wallet ledger row id for WALLET, etc.
   *  NEVER used for authorisation — display / reconciliation only. */
  externalRef?: string;
  /** Human-facing label the customer sees. */
  label: string;
}

// ─── Actors ─────────────────────────────────────────────────────────

export interface FiscalActor {
  kind: 'CUSTOMER' | 'PROVIDER' | 'PETWASH_MERCHANT' | 'MACHINE' | 'PETWASH_STAFF';
  /** Firebase UID when the actor is human. */
  uid?: string;
  publicId?: string;
  displayName?: string;
}

// ─── Money block (§1) ───────────────────────────────────────────────

export interface FiscalMoney {
  currency: 'ILS';
  subtotalCents: number;
  vatAmountCents?: number;   // absent when vatMode = NO_VAT_STORED_VALUE
  totalCents: number;
  amountPaidCents: number;
  amountRefundedCents: number;
  amountOutstandingCents: number;
}

// ─── Payment truth (§24) ────────────────────────────────────────────

export interface FiscalPaymentBlock {
  state: PaymentState;
  rail?: FundingRail;
  /** External provider (Nayax / SUMIT / wallet) transaction id. */
  providerTransactionId?: string;
  nayaxTransactionId?: string;
  sumitPaymentId?: string;
  /** For pre-capture holds. */
  authorizationRef?: string;
}

// ─── Fiscal document ref (§26, §36) ─────────────────────────────────

export interface FiscalDocumentRef {
  /** TRUE when the event's CPA-approved mapping requires a document. */
  required: boolean;
  documentType?: 'InvoiceAndReceipt' | 'Receipt' | 'Invoice' | 'CreditInvoice';
  state: FiscalDocumentState;
  sumitDocumentId?: string;
  documentNumber?: string;
  documentDate?: string;
  documentUrl?: string;
  /** Credit documents (§36) reference the original SUMIT document. */
  originalDocumentId?: string;
  /** Refunds record the credit document that was issued. */
  creditDocumentId?: string;
}

// ─── Provider money (§22, §32) ──────────────────────────────────────

export interface ProviderMoneyBlock {
  expectedCents: number;
  pendingCents: number;
  availableCents: number;
  paidCents: number;
  payoutReference?: string;
}

// ─── Reconciliation (§54-58, §87) ───────────────────────────────────

export interface ReconciliationBlock {
  paymentMatched: boolean;
  documentMatched: boolean;
  ledgerMatched: boolean;
  payoutMatched?: boolean;
  /** Structured warnings the composer surfaces without side effects. */
  warnings: Array<
    | 'PAID_NO_FISCAL_DOCUMENT'
    | 'FISCAL_DOCUMENT_NO_PAYMENT'
    | 'SUMIT_AMOUNT_MISMATCH'
    | 'SUMIT_DUPLICATE_DOCUMENT'
    | 'NAYAX_UNMATCHED_TRANSACTION'
    | 'WALLET_UNMATCHED_DEBIT'
    | 'REFUND_NO_CREDIT_DOCUMENT'
    | 'PROVIDER_PAYOUT_UNMATCHED'
  >;
}

// ─── The passport itself ────────────────────────────────────────────

export interface FiscalTransactionPassport {
  correlationId: string;
  transactionRef: string;

  jobRef?: string;
  orderRef?: string;
  bookingRef?: string;

  eventType: FiscalEventCode;
  /** CPA-approved payment class this event maps to. */
  paymentClass: MirroredPaymentClass;
  platform: PlatformCode;
  serviceType: string;

  customer: FiscalActor;
  supplierOrFulfiller: FiscalActor;

  items: TransactionLineItem[];

  money: FiscalMoney;
  fundingLegs: FundingLeg[];
  payment: FiscalPaymentBlock;
  fiscalDocument: FiscalDocumentRef;

  /** Only present when the actor is provider / staff / admin. */
  providerMoney?: ProviderMoneyBlock;

  commercialState: CommercialState;
  fulfilmentState: FulfilmentState;
  payoutState: PayoutState;

  reconciliation: ReconciliationBlock;

  /** ISO composed at. */
  composedAt: string;
}

export interface FiscalPassportViewFor {
  actor: FiscalActor;
  showsProviderMoney: boolean;
  showsExternalIds: boolean; // admin/staff true; customer false (§71)
}

export interface FiscalPassportEnvelope {
  passport: FiscalTransactionPassport;
  viewFor: FiscalPassportViewFor;
}
