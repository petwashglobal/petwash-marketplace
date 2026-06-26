/**
 * Deal Gate schema (CEO master spec 2026-06-27) — the money/legal booking backbone.
 *
 * ADDITIVE layer over the existing booking system. These tables RECORD the Deal
 * Gate: two-sided legal acceptance, per-booking payment, policy-driven refunds,
 * the exact price breakdown the user accepted, and an audit event for every status
 * change. Risky money actions are gated by DEAL_GATE_FLAGS (default OFF) — the
 * tables still record the shadow "would apply" amount so admin/testing can see it
 * without charging live money.
 *
 * Migration: migrations/0081_deal_gate.sql. All money columns are INTEGER CENTS.
 */
import { pgTable, serial, varchar, integer, timestamp, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── §C. Canonical booking status set (full Deal Gate lifecycle) ────────────────
export const DEAL_GATE_STATUSES = [
  "DRAFT",
  "ENQUIRY_SENT",
  "PENDING_PROVIDER",
  "PROVIDER_ASKED_QUESTION",
  "MEET_GREET_REQUESTED",
  "MEET_GREET_SCHEDULED",
  "MEET_GREET_COMPLETED",
  "PROVIDER_ACCEPTED",
  "CUSTOMER_CONFIRMATION_REQUIRED",
  "PAYMENT_AUTHORISATION_PENDING",
  "PAYMENT_AUTHORISED",
  "PAYMENT_FAILED",
  "PAID_CONFIRMED",
  "ACTIVE",
  "COMPLETED",
  "EXPIRED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_PROVIDER",
  "CANCELLED_BY_PETWASH",
  "NO_SHOW_CUSTOMER",
  "NO_SHOW_PROVIDER",
  "DISPUTED",
  "REFUND_PENDING",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "CLOSED",
] as const;
export type DealGateStatus = (typeof DEAL_GATE_STATUSES)[number];

/** Maps the legacy bookingStateMachine statuses → the canonical Deal Gate set,
 *  so existing rows render under the new vocabulary without a data migration. */
export const LEGACY_STATUS_TO_DEAL_GATE: Record<string, DealGateStatus> = {
  pending: "PENDING_PROVIDER",
  accepted: "PROVIDER_ACCEPTED",
  declined: "CANCELLED_BY_PROVIDER",
  meet_greet_requested: "MEET_GREET_REQUESTED",
  meet_greet_scheduled: "MEET_GREET_SCHEDULED",
  meet_greet_completed: "MEET_GREET_COMPLETED",
  payment_pending: "PAYMENT_AUTHORISATION_PENDING",
  confirmed: "PAID_CONFIRMED",
  in_progress: "ACTIVE",
  provider_marked_complete: "ACTIVE",
  completed: "COMPLETED",
  reviewed: "COMPLETED",
  cancelled: "CANCELLED_BY_CUSTOMER",
  disputed: "DISPUTED",
};

export const PAYMENT_PROVIDERS = ["SUMIT", "UPAY", "NAYAX", "WALLET", "MANUAL"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const REFUND_STATUSES = [
  "not_required", "pending_review", "approved", "processing",
  "refunded", "partially_refunded", "declined", "failed",
] as const;

// ── §B. deal_acceptances ───────────────────────────────────────────────────────
export const dealAcceptances = pgTable("deal_acceptances", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").notNull(),
  customerUserId: varchar("customer_user_id").notNull(),
  providerUserId: varchar("provider_user_id"),
  customerAcceptedAt: timestamp("customer_accepted_at"),
  providerAcceptedAt: timestamp("provider_accepted_at"),
  customerTermsVersion: varchar("customer_terms_version"),
  providerTermsVersion: varchar("provider_terms_version"),
  cancellationPolicyVersion: varchar("cancellation_policy_version"),
  priceBreakdownVersion: varchar("price_breakdown_version"),
  paymentProvider: varchar("payment_provider"),
  paymentTransactionId: varchar("payment_transaction_id"),
  paymentAuthorisedAt: timestamp("payment_authorised_at"),
  paymentCapturedAt: timestamp("payment_captured_at"),
  amountTotalCents: integer("amount_total_cents"),
  currency: varchar("currency").notNull().default("ILS"),
  ipAddress: varchar("ip_address"),
  deviceInfo: varchar("device_info"),
  language: varchar("language").default("he"),
  status: varchar("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uqBooking: uniqueIndex("uq_deal_acceptances_booking").on(t.bookingId),
  idxCustomer: index("idx_deal_acceptances_customer").on(t.customerUserId),
}));

// ── §D. booking_payments ───────────────────────────────────────────────────────
export const bookingPayments = pgTable("booking_payments", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").notNull(),
  customerUserId: varchar("customer_user_id").notNull(),
  providerUserId: varchar("provider_user_id"),
  paymentProvider: varchar("payment_provider").notNull(),
  externalTransactionId: varchar("external_transaction_id"),
  pwPaymentId: varchar("pw_payment_id"),
  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency").notNull().default("ILS"),
  status: varchar("status").notNull().default("created"),
  authorisedAt: timestamp("authorised_at"),
  capturedAt: timestamp("captured_at"),
  failedAt: timestamp("failed_at"),
  failureReason: varchar("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  idxBooking: index("idx_booking_payments_booking").on(t.bookingId),
  uqExt: uniqueIndex("uq_booking_payments_ext").on(t.paymentProvider, t.externalTransactionId),
}));

// ── §D. booking_refunds ────────────────────────────────────────────────────────
export const bookingRefunds = pgTable("booking_refunds", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").notNull(),
  paymentId: varchar("payment_id"),
  requestedBy: varchar("requested_by"),
  reason: varchar("reason"),
  originalAmountCents: integer("original_amount_cents").notNull().default(0),
  cancellationFeeCents: integer("cancellation_fee_cents").notNull().default(0),
  paymentFeeCents: integer("payment_fee_cents").notNull().default(0),
  platformFeeCents: integer("platform_fee_cents").notNull().default(0),
  providerCompensationCents: integer("provider_compensation_cents").notNull().default(0),
  refundAmountCents: integer("refund_amount_cents").notNull().default(0),
  refundProvider: varchar("refund_provider"),
  externalRefundId: varchar("external_refund_id"),
  shadowOnly: boolean("shadow_only").notNull().default(true),
  status: varchar("status").notNull().default("pending_review"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  policyVersion: varchar("policy_version"),
  accountingDocumentId: varchar("accounting_document_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  idxBooking: index("idx_booking_refunds_booking").on(t.bookingId),
}));

// ── §E. booking_price_breakdowns ───────────────────────────────────────────────
export const bookingPriceBreakdowns = pgTable("booking_price_breakdowns", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").notNull(),
  serviceAmountCents: integer("service_amount_cents").notNull().default(0),
  providerAmountCents: integer("provider_amount_cents").notNull().default(0),
  petwashPlatformFeeCents: integer("petwash_platform_fee_cents").notNull().default(0),
  paymentCardFeeCents: integer("payment_card_fee_cents").notNull().default(0),
  discountAmountCents: integer("discount_amount_cents").notNull().default(0),
  cancellationFeeIfLateCents: integer("cancellation_fee_if_late_cents").notNull().default(0),
  noShowFeeIfApplicableCents: integer("no_show_fee_if_applicable_cents").notNull().default(0),
  vatAmountCents: integer("vat_amount_cents").notNull().default(0),
  totalAmountCents: integer("total_amount_cents").notNull().default(0),
  currency: varchar("currency").notNull().default("ILS"),
  version: varchar("version").notNull().default("v1"),
  acceptedByCustomerAt: timestamp("accepted_by_customer_at"),
  acceptedByProviderAt: timestamp("accepted_by_provider_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idxBooking: index("idx_booking_price_breakdowns_booking").on(t.bookingId),
}));

// ── §L. booking_status_events ──────────────────────────────────────────────────
export const bookingStatusEvents = pgTable("booking_status_events", {
  id: serial("id").primaryKey(),
  bookingId: varchar("booking_id").notNull(),
  oldStatus: varchar("old_status"),
  newStatus: varchar("new_status").notNull(),
  changedBy: varchar("changed_by"),
  actorRole: varchar("actor_role"),
  reason: varchar("reason"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  idxBooking: index("idx_booking_status_events_booking").on(t.bookingId, t.createdAt),
}));

// ── Insert schemas ─────────────────────────────────────────────────────────────
export const insertDealAcceptanceSchema = createInsertSchema(dealAcceptances).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBookingPaymentSchema = createInsertSchema(bookingPayments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBookingRefundSchema = createInsertSchema(bookingRefunds).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBookingPriceBreakdownSchema = createInsertSchema(bookingPriceBreakdowns).omit({ id: true, createdAt: true });
export const insertBookingStatusEventSchema = createInsertSchema(bookingStatusEvents).omit({ id: true, createdAt: true });

export type DealAcceptance = typeof dealAcceptances.$inferSelect;
export type BookingPayment = typeof bookingPayments.$inferSelect;
export type BookingRefund = typeof bookingRefunds.$inferSelect;
export type BookingPriceBreakdown = typeof bookingPriceBreakdowns.$inferSelect;
export type BookingStatusEvent = typeof bookingStatusEvents.$inferSelect;

export const dealGateSchemas = {
  dealAcceptances, bookingPayments, bookingRefunds, bookingPriceBreakdowns, bookingStatusEvents,
};
