/**
 * PetWash™ Unified Payment Tables — Spec Section 8
 *
 * pw_payments   — one row per customer-facing money movement (all 4 flows)
 * pw_provider_payouts — one row per provider settlement
 *
 * DESIGN RULES:
 *  - These tables do NOT replace existing tables (nayax_transactions,
 *    credit_transactions, general_ledger). They are the unified financial
 *    record that links all flows for reconciliation + ITA reporting.
 *  - All monetary columns are stored as INTEGER CENTS (ILS × 100).
 *    Divide by 100 for display. Never store float for money.
 *  - transaction_type values must match TRANSACTION_TYPES in finance-flow-types.ts
 *  - commercial_model: 'MARKETPLACE_COMMISSION' | 'PRINCIPAL'
 *      MARKETPLACE_COMMISSION = platform keeps commission, passes rest to provider
 *      PRINCIPAL = platform is the seller, provider is a sub-contractor
 */

import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Unified Payments Table ─────────────────────────────────────────────────────

export const pwPayments = pgTable("pw_payments", {
  id: serial("id").primaryKey(),

  // ── Identity & idempotency ──────────────────────────────────────────────────
  paymentId: varchar("payment_id").unique().notNull(),          // PW-PAY-{year}-{nanoid8}
  idempotencyKey: varchar("idempotency_key").unique(),          // caller-supplied key

  // ── Flow classification ─────────────────────────────────────────────────────
  /** One of the TRANSACTION_TYPES values from shared/finance-flow-types.ts */
  transactionType: varchar("transaction_type").notNull(),
  /** k9000 | sitter-suite | walk-my-pet | pettrek | pet-wash-hub | paw-finder | plush-lab | wallet | egift */
  vertical: varchar("vertical").notNull(),
  /** MARKETPLACE_COMMISSION | PRINCIPAL */
  commercialModel: varchar("commercial_model").notNull(),

  // ── Parties ─────────────────────────────────────────────────────────────────
  customerId: varchar("customer_id"),                           // Firebase UID — null for anonymous K9000
  providerId: varchar("provider_id"),                          // null for direct-sale flows
  machineId: varchar("machine_id"),                            // K9000 only

  // ── Amounts (all INTEGER CENTS, ILS × 100) ──────────────────────────────────
  grossCents: integer("gross_cents").notNull(),                 // Amount collected from customer (incl. VAT)
  vatCents: integer("vat_cents").notNull(),                     // VAT owed by PetWash on this transaction
  platformFeeCents: integer("platform_fee_cents").notNull().default(0),   // Commission or full gross (direct)
  processorFeeCents: integer("processor_fee_cents").notNull().default(0), // Nayax fee
  providerGrossCents: integer("provider_gross_cents").notNull().default(0), // Provider pre-VAT share
  providerPayoutCents: integer("provider_payout_cents").notNull().default(0), // Provider net after their VAT
  netRevenueCents: integer("net_revenue_cents").notNull(),       // PetWash net revenue

  // ── VAT metadata ────────────────────────────────────────────────────────────
  vatRate: varchar("vat_rate").notNull().default("0.18"),       // String to avoid float precision loss
  /** deferred_liability | taxable_sale — for wallet/egift only */
  vatMode: varchar("vat_mode"),
  requiresProviderTaxInvoice: boolean("requires_provider_tax_invoice").notNull().default(false),

  // ── References ──────────────────────────────────────────────────────────────
  bookingId: varchar("booking_id"),
  nayaxTransactionId: varchar("nayax_transaction_id"),
  walletLedgerEntryId: varchar("wallet_ledger_entry_id"),
  generalLedgerEntryId: varchar("general_ledger_entry_id"),
  receiptId: varchar("receipt_id"),                             // digital_receipts.receipt_number

  // ── State machine ────────────────────────────────────────────────────────────
  /**
   * CREATED → AUTHORISED → CAPTURED → SETTLED
   *                                 ↘ REFUNDED | REVERSED | CANCELLED
   * CAPTURED → CREDITED_TO_WALLET (wallet top-up flow)
   * SETTLED  → CONSUMED (wallet redemption flow)
   */
  status: varchar("status").notNull().default("created"),

  // ── Audit ────────────────────────────────────────────────────────────────────
  metadata: jsonb("metadata"),                                  // arbitrary context (nayax raw, webhook body, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  settledAt: timestamp("settled_at"),
  reversedAt: timestamp("reversed_at"),
}, (t) => ({
  paymentIdIdx:       uniqueIndex("idx_pw_pay_payment_id").on(t.paymentId),
  idempotencyIdx:     uniqueIndex("idx_pw_pay_idempotency").on(t.idempotencyKey),
  customerIdx:        index("idx_pw_pay_customer").on(t.customerId),
  providerIdx:        index("idx_pw_pay_provider").on(t.providerId),
  verticalIdx:        index("idx_pw_pay_vertical").on(t.vertical),
  txTypeIdx:          index("idx_pw_pay_tx_type").on(t.transactionType),
  statusIdx:          index("idx_pw_pay_status").on(t.status),
  bookingIdx:         index("idx_pw_pay_booking").on(t.bookingId),
  nayaxIdx:           index("idx_pw_pay_nayax").on(t.nayaxTransactionId),
  createdAtIdx:       index("idx_pw_pay_created_at").on(t.createdAt),
}));

export const insertPwPaymentSchema = createInsertSchema(pwPayments).omit({
  id: true,
  createdAt: true,
});
export type InsertPwPayment = z.infer<typeof insertPwPaymentSchema>;
export type PwPayment = typeof pwPayments.$inferSelect;

// ── Provider Payouts Table ────────────────────────────────────────────────────

export const pwProviderPayouts = pgTable("pw_provider_payouts", {
  id: serial("id").primaryKey(),

  payoutId: varchar("payout_id").unique().notNull(),            // PW-POUT-{year}-{nanoid8}
  paymentId: varchar("payment_id").notNull(),                   // FK → pw_payments.payment_id

  // ── Parties ─────────────────────────────────────────────────────────────────
  providerId: varchar("provider_id").notNull(),
  vertical: varchar("vertical").notNull(),
  commercialModel: varchar("commercial_model").notNull(),       // MARKETPLACE_COMMISSION | PRINCIPAL

  // ── Amounts (CENTS) ──────────────────────────────────────────────────────────
  grossCents: integer("gross_cents").notNull(),                 // Provider's share before their VAT
  vatInShareCents: integer("vat_in_share_cents").notNull(),     // VAT embedded in provider's share
  netCents: integer("net_cents").notNull(),                     // Provider receives this (gross - vatInShare)
  commissionCents: integer("commission_cents").notNull(),       // Platform commission deducted
  commissionRate: varchar("commission_rate").notNull(),         // e.g. "0.15"

  // ── Provider tax invoice requirement ────────────────────────────────────────
  /** True if provider must issue PetWash a tax invoice (חשבונית מס) */
  requiresTaxInvoice: boolean("requires_tax_invoice").notNull().default(true),
  /** True if provider is עוסק פטור — cannot issue tax invoice */
  providerIsExempt: boolean("provider_is_exempt").notNull().default(false),
  providerTaxInvoiceId: varchar("provider_tax_invoice_id"),

  // ── State ───────────────────────────────────────────────────────────────────
  /** pending | held_in_escrow | ready_for_payout | paid | cancelled | reversed */
  status: varchar("status").notNull().default("pending"),

  // ── Timing ──────────────────────────────────────────────────────────────────
  escrowReleaseAt: timestamp("escrow_release_at"),              // 72h post-service by default
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  metadata: jsonb("metadata"),
}, (t) => ({
  payoutIdIdx:   uniqueIndex("idx_pw_pout_payout_id").on(t.payoutId),
  paymentIdIdx:  index("idx_pw_pout_payment_id").on(t.paymentId),
  providerIdx:   index("idx_pw_pout_provider").on(t.providerId),
  statusIdx:     index("idx_pw_pout_status").on(t.status),
  releaseIdx:    index("idx_pw_pout_release").on(t.escrowReleaseAt),
}));

export const insertPwProviderPayoutSchema = createInsertSchema(pwProviderPayouts).omit({
  id: true,
  createdAt: true,
});
export type InsertPwProviderPayout = z.infer<typeof insertPwProviderPayoutSchema>;
export type PwProviderPayout = typeof pwProviderPayouts.$inferSelect;
