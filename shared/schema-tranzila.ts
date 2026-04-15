/**
 * PetWash™ — Tranzila Processor Integration Schema
 *
 * OWNERSHIP CONTRACT (immutable — change requires CPA + engineering sign-off):
 *   Nayax    → K9000 physical terminal card payments ONLY
 *   Tranzila → digital purchase rail + processor-side accounting documents
 *   PetWash  → source of truth for entitlement, wallet state, audit ledger, and internal mapping
 *   NO Nayax and Tranzila fields may appear on the same transaction row.
 *
 * DESIGN RULES:
 *   - These tables are the PetWash mirror of Tranzila processor state.
 *     They do NOT replace pw_payments, pw_tax_documents, or pw_provider_payouts.
 *     They are linked FROM those tables via payment_id / payout_id.
 *   - All monetary columns: INTEGER CENTS (ILS × 100). Never float for money.
 *   - All handlers must be idempotent on processor_transaction_id.
 *   - processorPayloadRaw stores the full Tranzila API/webhook payload for reconciliation.
 *   - No field may be altered after the row is set to a terminal status
 *     (confirmed / failed / refunded / disputed_closed / settled).
 *
 * Tables:
 *   tranzila_transactions      — one row per charge/refund Tranzila processed
 *   tranzila_payment_requests  — one row per Tranzila payment-request (remote pay)
 *   tranzila_chargebacks       — one row per chargeback case from Tranzila
 *   tranzila_settlement_batches — one row per Tranzila settlement batch import
 */

import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  text,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// tranzila_transactions
//
// One row per Tranzila processor transaction (charge OR refund).
// Created when PetWash sends a charge/refund request to Tranzila.
// Updated when Tranzila confirms, declines, or webhooks back.
// ─────────────────────────────────────────────────────────────────────────────

export const tranzilaTransactions = pgTable('tranzila_transactions', {
  id: serial('id').primaryKey(),

  // ── Identity & idempotency ────────────────────────────────────────────────
  /** Internal idempotency key — caller-supplied, must be unique per charge attempt. */
  idempotencyKey: varchar('idempotency_key').unique().notNull(),
  /** Tranzila tran_num — unique transaction ID from Tranzila. Null until confirmed. */
  processorTransactionId: varchar('processor_transaction_id').unique(),

  // ── PetWash cross-references ──────────────────────────────────────────────
  /** FK → pw_payments.payment_id */
  pwPaymentId: varchar('pw_payment_id'),
  /** FK → pw_provider_payouts.payout_id (refunds only) */
  pwPayoutId: varchar('pw_payout_id'),
  bookingId: varchar('booking_id'),
  customerId: varchar('customer_id'),

  // ── Transaction classification ────────────────────────────────────────────
  /**
   * charge | refund | void | auth | capture
   * Tranzila REST uses different endpoints per operation type.
   */
  transactionKind: varchar('transaction_kind').notNull(),
  /**
   * egift_purchase | wallet_topup | marketplace_booking | payment_request_settlement
   * Maps to the PetWash product being purchased. Set by PetWash, not Tranzila.
   */
  productType: varchar('product_type').notNull(),

  // ── Amounts (CENTS, ILS × 100) ────────────────────────────────────────────
  amountCents: integer('amount_cents').notNull(),
  currency: varchar('currency').notNull().default('ILS'),

  // ── Processor document — accounting artefact issued by Tranzila ──────────
  /**
   * Tranzila document number returned after charge (e.g. receipt, tax invoice).
   * Populated from Tranzila API response or webhook payload.
   * PetWash DOES NOT generate this number — it maps what Tranzila provides.
   */
  processorDocumentNumber: varchar('processor_document_number'),
  /**
   * Tranzila document type string as returned by their API.
   * e.g. 'receipt' | 'tax_invoice' | 'tax_invoice_receipt' | 'credit_invoice'
   * PetWash maps this → pw_tax_documents.document_type in TranzilaDocumentMapper.
   */
  processorDocumentType: varchar('processor_document_type'),
  /** URL or reference to retrieve the document PDF from Tranzila portal */
  processorDocumentUrl: varchar('processor_document_url'),
  /** Timestamp Tranzila reports the document was issued */
  processorDocumentIssuedAt: timestamp('processor_document_issued_at'),

  // ── Refund tracking (Tranzila refund transactions only) ───────────────────
  /** Processor ID of the original charge this refund applies to */
  processorRefundForTransactionId: varchar('processor_refund_for_transaction_id'),
  processorRefundId: varchar('processor_refund_id'),
  /**
   * pending | confirmed | failed
   * Distinct from transaction status — tracks refund lifecycle.
   */
  processorRefundStatus: varchar('processor_refund_status'),

  // ── State ─────────────────────────────────────────────────────────────────
  /**
   * pending       — PetWash sent request to Tranzila, awaiting response
   * confirmed     — Tranzila approved (Response=000)
   * declined      — Tranzila declined (Response != 000)
   * failed        — Network or system error — charge did not reach Tranzila
   * voided        — Authorisation voided before capture
   * refunded      — Full or partial refund confirmed by Tranzila
   */
  status: varchar('status').notNull().default('pending'),

  // ── Settlement ────────────────────────────────────────────────────────────
  /** FK → tranzila_settlement_batches.settlement_batch_id when reconciled */
  settlementBatchId: varchar('settlement_batch_id'),
  settlementStatus: varchar('settlement_status'),         // unsettled | in_batch | settled
  processorConfirmedAt: timestamp('processor_confirmed_at'),

  // ── Raw processor payload ─────────────────────────────────────────────────
  /** Full Tranzila API response body — stored for reconciliation and debugging. */
  processorPayloadRaw: jsonb('processor_payload_raw'),

  // ── Linked pw_tax_documents row ───────────────────────────────────────────
  /** FK → pw_tax_documents.tax_doc_id — set when TranzilaDocumentMapper creates the row */
  pwTaxDocId: varchar('pw_tax_doc_id'),

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  idempotencyIdx:         uniqueIndex('idx_trz_tx_idempotency').on(t.idempotencyKey),
  processorTxIdx:         uniqueIndex('idx_trz_tx_processor_id').on(t.processorTransactionId),
  pwPaymentIdx:           index('idx_trz_tx_pw_payment').on(t.pwPaymentId),
  customerIdx:            index('idx_trz_tx_customer').on(t.customerId),
  statusIdx:              index('idx_trz_tx_status').on(t.status),
  productTypeIdx:         index('idx_trz_tx_product_type').on(t.productType),
  settlementBatchIdx:     index('idx_trz_tx_settlement').on(t.settlementBatchId),
  createdAtIdx:           index('idx_trz_tx_created_at').on(t.createdAt),
}));

export const insertTranzilaTransactionSchema = createInsertSchema(tranzilaTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTranzilaTransaction = z.infer<typeof insertTranzilaTransactionSchema>;
export type TranzilaTransaction = typeof tranzilaTransactions.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// tranzila_payment_requests
//
// Tranzila's "payment request" / remote payment feature:
//   Merchant creates a payment request → Tranzila sends email/SMS to customer
//   with a secure hosted payment link → Customer pays → Tranzila webhooks PetWash.
//
// Use cases in PetWash:
//   - Provider invoicing a customer outside a marketplace booking
//   - Instalment / deferred payment arrangement
//   - Admin-initiated payment request for manual top-up or purchase
// ─────────────────────────────────────────────────────────────────────────────

export const tranzilaPaymentRequests = pgTable('tranzila_payment_requests', {
  id: serial('id').primaryKey(),

  // ── Identity ──────────────────────────────────────────────────────────────
  /** Tranzila payment request ID (returned when request is created via API) */
  paymentRequestId: varchar('payment_request_id').unique().notNull(),
  /** PetWash internal idempotency key used when creating the request */
  idempotencyKey: varchar('idempotency_key').unique().notNull(),

  // ── PetWash cross-references ──────────────────────────────────────────────
  customerId: varchar('customer_id'),
  providerId: varchar('provider_id'),
  bookingId: varchar('booking_id'),
  /** The resulting tranzila_transactions.idempotency_key once paid */
  resultingTransactionIdempotencyKey: varchar('resulting_transaction_idempotency_key'),

  // ── Request details ───────────────────────────────────────────────────────
  amountCents: integer('amount_cents').notNull(),
  currency: varchar('currency').notNull().default('ILS'),
  /** Description shown to customer on the payment page */
  description: text('description'),

  // ── Delivery ──────────────────────────────────────────────────────────────
  /** email | sms | both */
  deliveryChannel: varchar('delivery_channel').notNull().default('email'),
  recipientEmail: varchar('recipient_email'),
  recipientPhone: varchar('recipient_phone'),
  /** Tranzila-hosted URL sent to customer */
  paymentUrl: varchar('payment_url'),

  // ── State ─────────────────────────────────────────────────────────────────
  /**
   * created     — request created in Tranzila, not yet sent
   * sent        — Tranzila sent email/SMS to customer
   * viewed      — customer opened the payment page (Tranzila webhook)
   * paid        — customer completed payment (Tranzila webhook)
   * cancelled   — cancelled by merchant before payment
   * expired     — payment window elapsed without payment
   * failed      — delivery or creation failure
   */
  status: varchar('status').notNull().default('created'),

  // ── Timing ────────────────────────────────────────────────────────────────
  expiresAt: timestamp('expires_at'),
  paidAt: timestamp('paid_at'),
  cancelledAt: timestamp('cancelled_at'),

  // ── Raw payload ───────────────────────────────────────────────────────────
  processorPayloadRaw: jsonb('processor_payload_raw'),

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  paymentRequestIdx:    uniqueIndex('idx_trz_pr_request_id').on(t.paymentRequestId),
  idempotencyIdx:       uniqueIndex('idx_trz_pr_idempotency').on(t.idempotencyKey),
  customerIdx:          index('idx_trz_pr_customer').on(t.customerId),
  providerIdx:          index('idx_trz_pr_provider').on(t.providerId),
  statusIdx:            index('idx_trz_pr_status').on(t.status),
  expiresAtIdx:         index('idx_trz_pr_expires_at').on(t.expiresAt),
}));

export const insertTranzilaPaymentRequestSchema = createInsertSchema(tranzilaPaymentRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTranzilaPaymentRequest = z.infer<typeof insertTranzilaPaymentRequestSchema>;
export type TranzilaPaymentRequest = typeof tranzilaPaymentRequests.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// tranzila_chargebacks
//
// One row per chargeback case reported by Tranzila.
// Tranzila provides a chargeback monitoring / management module that sends
// webhook events when cases are opened or updated.
//
// PetWash responsibility:
//   - Mirror the case record here for audit trail
//   - Flag the linked pw_payments row and booking
//   - Trigger admin alert via Octopus
//   - NOT to run the chargeback dispute workflow itself — that happens in Tranzila console
// ─────────────────────────────────────────────────────────────────────────────

export const tranzilaChargebacks = pgTable('tranzila_chargebacks', {
  id: serial('id').primaryKey(),

  // ── Identity ──────────────────────────────────────────────────────────────
  /** Tranzila chargeback case ID */
  chargebackCaseId: varchar('chargeback_case_id').unique().notNull(),

  // ── Linked Tranzila transaction ───────────────────────────────────────────
  processorTransactionId: varchar('processor_transaction_id').notNull(),
  /** FK → tranzila_transactions.idempotency_key — for joining without processor ID ambiguity */
  tranzilaTransactionIdempotencyKey: varchar('tranzila_transaction_idempotency_key'),

  // ── PetWash cross-references ──────────────────────────────────────────────
  pwPaymentId: varchar('pw_payment_id'),
  customerId: varchar('customer_id'),
  bookingId: varchar('booking_id'),

  // ── Chargeback details ────────────────────────────────────────────────────
  /** Disputed amount in CENTS */
  disputedAmountCents: integer('disputed_amount_cents').notNull(),
  currency: varchar('currency').notNull().default('ILS'),
  /** Reason code from card scheme / bank */
  reasonCode: varchar('reason_code'),
  reasonDescription: text('reason_description'),

  // ── State ─────────────────────────────────────────────────────────────────
  /**
   * opened           — Tranzila notified PetWash of new chargeback
   * evidence_needed  — merchant must submit response by deadline
   * evidence_submitted — PetWash responded to bank via Tranzila console
   * won              — chargeback resolved in merchant's favour
   * lost             — chargeback resolved in cardholder's favour
   * cancelled        — withdrawn by cardholder before resolution
   */
  status: varchar('status').notNull().default('opened'),
  chargebackStatus: varchar('chargeback_status').notNull().default('opened'),

  // ── Timing ────────────────────────────────────────────────────────────────
  openedAt: timestamp('opened_at').notNull(),
  evidenceDeadlineAt: timestamp('evidence_deadline_at'),
  resolvedAt: timestamp('resolved_at'),

  // ── Admin handling ────────────────────────────────────────────────────────
  /** UID of admin who handled this case in PetWash backoffice */
  handledByAdminUid: varchar('handled_by_admin_uid'),
  adminNotes: text('admin_notes'),

  // ── Raw payload ───────────────────────────────────────────────────────────
  processorPayloadRaw: jsonb('processor_payload_raw'),

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  caseIdIdx:      uniqueIndex('idx_trz_cb_case_id').on(t.chargebackCaseId),
  processorTxIdx: index('idx_trz_cb_processor_tx').on(t.processorTransactionId),
  pwPaymentIdx:   index('idx_trz_cb_pw_payment').on(t.pwPaymentId),
  customerIdx:    index('idx_trz_cb_customer').on(t.customerId),
  statusIdx:      index('idx_trz_cb_status').on(t.status),
  openedAtIdx:    index('idx_trz_cb_opened_at').on(t.openedAt),
}));

export const insertTranzilaChargebackSchema = createInsertSchema(tranzilaChargebacks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTranzilaChargeback = z.infer<typeof insertTranzilaChargebackSchema>;
export type TranzilaChargeback = typeof tranzilaChargebacks.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// tranzila_settlement_batches
//
// Tranzila settlements are periodic bank transfers from Tranzila to PetWash.
// Tranzila's management dashboard exports settlement reports.
//
// PetWash imports these to:
//   a) Confirm which transactions actually cleared to the bank
//   b) Run reconciliation against pw_payments processor fee estimates
//   c) Provide audit evidence for ITA purposes
// ─────────────────────────────────────────────────────────────────────────────

export const tranzilaSettlementBatches = pgTable('tranzila_settlement_batches', {
  id: serial('id').primaryKey(),

  // ── Identity ──────────────────────────────────────────────────────────────
  /** PetWash-assigned ID: TRZSETT-{YYYYMMDD}-{nanoid6} */
  settlementBatchId: varchar('settlement_batch_id').unique().notNull(),
  /** Tranzila's own batch reference if provided */
  processorBatchReference: varchar('processor_batch_reference'),

  // ── Period ────────────────────────────────────────────────────────────────
  /** YYYY-MM-DD start of settlement period */
  periodFrom: varchar('period_from').notNull(),
  /** YYYY-MM-DD end of settlement period */
  periodTo: varchar('period_to').notNull(),

  // ── Amounts (CENTS) ───────────────────────────────────────────────────────
  /** Gross charged to customers in this batch */
  totalGrossCents: integer('total_gross_cents').notNull().default(0),
  /** Tranzila processing fees deducted in this batch */
  totalProcessorFeesCents: integer('total_processor_fees_cents').notNull().default(0),
  /** Net amount transferred to PetWash bank account */
  totalNetCents: integer('total_net_cents').notNull().default(0),
  currency: varchar('currency').notNull().default('ILS'),
  /** Number of transactions included */
  transactionCount: integer('transaction_count').notNull().default(0),
  /** Number of refunds included */
  refundCount: integer('refund_count').notNull().default(0),

  // ── State ─────────────────────────────────────────────────────────────────
  /**
   * imported      — batch imported from Tranzila report, not yet reconciled
   * reconciling   — reconciliation in progress
   * reconciled    — all transactions matched to pw_payments
   * discrepancy   — one or more transactions could not be matched
   * closed        — final state after discrepancy review
   */
  status: varchar('status').notNull().default('imported'),

  // ── Discrepancy tracking ──────────────────────────────────────────────────
  unmatchedCount: integer('unmatched_count').notNull().default(0),
  discrepancyCents: integer('discrepancy_cents').notNull().default(0),

  // ── Raw report ────────────────────────────────────────────────────────────
  reportPayload: jsonb('report_payload'),
  /** SHA-256 of the imported report file for integrity check */
  reportHash: varchar('report_hash'),

  // ── Audit ─────────────────────────────────────────────────────────────────
  importedByAdminUid: varchar('imported_by_admin_uid'),
  importedAt: timestamp('imported_at').defaultNow().notNull(),
  reconciledAt: timestamp('reconciled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  batchIdIdx:   uniqueIndex('idx_trz_sett_batch_id').on(t.settlementBatchId),
  processorRef: index('idx_trz_sett_processor_ref').on(t.processorBatchReference),
  statusIdx:    index('idx_trz_sett_status').on(t.status),
  periodIdx:    index('idx_trz_sett_period').on(t.periodFrom, t.periodTo),
}));

export const insertTranzilaSettlementBatchSchema = createInsertSchema(tranzilaSettlementBatches).omit({
  id: true,
  createdAt: true,
});
export type InsertTranzilaSettlementBatch = z.infer<typeof insertTranzilaSettlementBatchSchema>;
export type TranzilaSettlementBatch = typeof tranzilaSettlementBatches.$inferSelect;
