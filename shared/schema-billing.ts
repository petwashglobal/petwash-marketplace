/**
 * PetWash™ Billing Records Schema
 *
 * Central accounting model.  Every financial event (capture, hold, release,
 * refund, dispute) creates exactly ONE immutable BillingRecord row.
 *
 * MONETARY UNIT: agorot (Israeli agora = ILS × 100).
 *   Store as INTEGER.  Never float.  Divide by 100 for display.
 *
 * DOCUMENT PURPOSE TAXONOMY (do not mix):
 *   booking_confirmation  — service summary for customer     (non-tax)
 *   receipt               — proof of money received         (LEGAL — accounting system)
 *   tax_invoice           — VAT invoice (חשבונית מס)        (LEGAL — accounting system)
 *   escrow_statement      — held/released funds summary     (non-tax, internal)
 *   payout_statement      — provider settlement summary     (non-tax, internal)
 *   refund_statement      — reversal/adjustment             (non-tax, internal)
 *   credit_note           — reduction of tax invoice        (LEGAL — accounting system)
 *
 * PAYMENT FLOW STATES (state machine — see EscrowStateMachine.ts):
 *   authorized → captured → held_in_escrow → released
 *                         ↘ refunded / partially_refunded
 *                         ↘ disputed / chargeback
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
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Enums (string literals — no DB enum to allow zero-migration evolution) ────

export type DocumentPurpose =
  | "booking_confirmation"
  | "receipt"
  | "tax_invoice"
  | "escrow_statement"
  | "payout_statement"
  | "refund_statement"
  | "credit_note";

export type PaymentFlowStatus =
  | "authorized"
  | "captured"
  | "held_in_escrow"
  | "released"
  | "refunded"
  | "partially_refunded"
  | "chargeback"
  | "disputed"
  | "cancelled";

export type IssuingEntity = "platform" | "provider";

export type ProcessorName = "stripe" | "nayax" | "manual";

export type PaymentMethodType = "card" | "bank_transfer" | "cash" | "wallet" | "egift" | "other";

// ── billing_records ───────────────────────────────────────────────────────────

export const billingRecords = pgTable("billing_records", {
  id: serial("id").primaryKey(),

  // ── Identity ────────────────────────────────────────────────────────────────
  recordId:        varchar("record_id").unique().notNull(),      // BLR-{year}-{nanoid8}
  idempotencyKey:  varchar("idempotency_key").unique(),          // caller-supplied, prevents duplicates

  // ── Context ─────────────────────────────────────────────────────────────────
  bookingId:       varchar("booking_id"),
  customerId:      varchar("customer_id"),                       // Firebase UID, null for anonymous
  providerId:      varchar("provider_id"),                       // null for platform-only flows
  machineId:       varchar("machine_id"),                        // K9000 only

  // ── Document classification ─────────────────────────────────────────────────
  documentPurpose: varchar("document_purpose").notNull(),        // DocumentPurpose
  issuingEntity:   varchar("issuing_entity").notNull(),          // IssuingEntity
  paymentFlowStatus: varchar("payment_flow_status").notNull(),   // PaymentFlowStatus

  // ── Amounts (ALL in AGOROT = ILS × 100, INTEGER only) ───────────────────────
  currency:            varchar("currency").notNull().default("ILS"),
  subtotalAgorot:      integer("subtotal_agorot").notNull(),     // gross before VAT
  vatAgorot:           integer("vat_agorot").notNull(),          // VAT portion
  totalAgorot:         integer("total_agorot").notNull(),        // subtotal + VAT
  discountAgorot:      integer("discount_agorot").notNull().default(0),
  platformFeeAgorot:   integer("platform_fee_agorot"),           // platform commission before VAT
  platformFeeVatAgorot: integer("platform_fee_vat_agorot"),      // VAT on platform fee
  providerPayoutAgorot: integer("provider_payout_agorot"),       // amount released to provider after fees

  // ── Payment instrument ───────────────────────────────────────────────────────
  paymentMethod:      varchar("payment_method"),                 // PaymentMethodType
  processorName:      varchar("processor_name"),                 // ProcessorName
  processorReference: varchar("processor_reference"),            // Nayax TXN ID / Stripe charge ID

  // ── Escrow lifecycle timestamps ──────────────────────────────────────────────
  capturedAt:      timestamp("captured_at"),
  escrowHeldUntil: timestamp("escrow_held_until"),
  releasedAt:      timestamp("released_at"),
  refundedAt:      timestamp("refunded_at"),

  // ── Document references (filled by accounting system — NEVER by frontend) ───
  receiptNumber:     varchar("receipt_number"),                  // from certified accounting system
  invoiceNumber:     varchar("invoice_number"),                  // from certified accounting system (sequential)
  allocationNumber:  varchar("allocation_number"),               // מספר הקצאה from ITA (B2B above threshold)
  creditNoteNumber:  varchar("credit_note_number"),              // if reversed

  // ── B2B / allocation metadata ────────────────────────────────────────────────
  isB2B:                boolean("is_b2b").notNull().default(false),
  customerTaxId:        varchar("customer_tax_id"),              // ח.פ / ע.מ of business customer
  requiresAllocation:   boolean("requires_allocation").notNull().default(false),  // threshold exceeded?
  allocationRequested:  boolean("allocation_requested").notNull().default(false),
  allocationConfirmed:  boolean("allocation_confirmed").notNull().default(false),

  // ── Archive (7-year legal retention) ────────────────────────────────────────
  archiveStatus:    varchar("archive_status").notNull().default("PENDING"), // PENDING | ARCHIVED | FAILED
  driveFileId:      text("drive_file_id"),
  pdfSha256:        text("pdf_sha256"),
  archivedAt:       timestamp("archived_at"),
  retentionUntil:   timestamp("retention_until"),               // capturedAt + 7 years

  // ── Metadata & audit ────────────────────────────────────────────────────────
  payload:          jsonb("payload").notNull().default({}),      // full JSON snapshot at time of record
  notes:            text("notes"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  recordIdIdx:         uniqueIndex("idx_blr_record_id").on(t.recordId),
  idempotencyIdx:      uniqueIndex("idx_blr_idempotency").on(t.idempotencyKey),
  bookingIdx:          index("idx_blr_booking").on(t.bookingId),
  customerIdx:         index("idx_blr_customer").on(t.customerId),
  providerIdx:         index("idx_blr_provider").on(t.providerId),
  purposeIdx:          index("idx_blr_purpose").on(t.documentPurpose),
  statusIdx:           index("idx_blr_status").on(t.paymentFlowStatus),
  processorRefIdx:     index("idx_blr_processor_ref").on(t.processorReference),
  archiveIdx:          index("idx_blr_archive").on(t.archiveStatus),
}));

export const insertBillingRecordSchema = createInsertSchema(billingRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBillingRecord = z.infer<typeof insertBillingRecordSchema>;
export type BillingRecord = typeof billingRecords.$inferSelect;


// ── billing_audit_log ─────────────────────────────────────────────────────────
// Immutable append-only log of every state transition.
// Never update or delete rows.

export const billingAuditLog = pgTable("billing_audit_log", {
  id:            serial("id").primaryKey(),
  auditId:       varchar("audit_id").unique().notNull(),         // AUD-{nanoid12}
  recordId:      varchar("record_id").notNull(),                 // → billing_records.record_id
  eventType:     varchar("event_type").notNull(),                // state transition name
  fromStatus:    varchar("from_status"),
  toStatus:      varchar("to_status").notNull(),
  actorType:     varchar("actor_type").notNull(),                // system | admin | webhook | provider | customer
  actorId:       varchar("actor_id"),
  deltaAgorot:   integer("delta_agorot"),                        // amount change if relevant
  entryHash:     varchar("entry_hash").notNull(),                // SHA-256 of (prevHash + event data)
  prevHash:      varchar("prev_hash"),                           // hash of previous audit entry for this record
  payload:       jsonb("payload").notNull().default({}),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  auditIdIdx:    uniqueIndex("idx_aud_audit_id").on(t.auditId),
  recordIdIdx:   index("idx_aud_record").on(t.recordId),
  eventTypeIdx:  index("idx_aud_event").on(t.eventType),
}));

export type BillingAuditEntry = typeof billingAuditLog.$inferSelect;
