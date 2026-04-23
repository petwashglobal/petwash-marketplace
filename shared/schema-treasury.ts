/**
 * PetWash™ Treasury Settings Schema
 * ===================================
 * Single-row table that holds the company's verified bank account identity.
 *
 * SECURITY RULES (Israel Financial Regulation + Internal Policy):
 *  - This table is BACKEND-ONLY. Never expose to frontend, browser, logs, or public repo.
 *  - Sensitive columns (iban, account_number, branch_number, swift) are populated
 *    exclusively from server-side environment variables during the initial-seed step.
 *    They are NEVER hardcoded in source code.
 *  - All API endpoints that read this table MUST return masked values only.
 *    Masking is enforced by TreasuryConfigService — never bypass it.
 *  - Every read and write is recorded in the treasury_access_log table.
 *  - Required admin role: 'super_admin' OR 'finance' (enforced in the route layer).
 *
 * Israeli Regulatory Context:
 *  - Bank Mizrahi-Tefahot is regulated under the Israeli Banking Law (חוק הבנקאות).
 *  - IBAN format: IL + 2 check digits + 3-digit bank code + 3-digit branch + 13-digit account.
 *  - The treasury account serves as the sole company beneficiary for all provider payouts
 *    and settlement transfers (per Israel Payment Services Law 2023 requirements).
 *  - Access to account details by staff is governed by the company's internal Information
 *    Security Policy and must comply with the Bank of Israel's Cyber Directive (06/2017).
 */

import {
  pgTable,
  serial,
  varchar,
  boolean,
  timestamp,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ── treasury_settings ─────────────────────────────────────────────────────────
// One row only. All DML must go through TreasuryConfigService.
// Sensitive string columns have a max length matching Israeli bank field sizes.

export const treasurySettings = pgTable('treasury_settings', {
  id: serial('id').primaryKey(),

  // ── Legal entity identity ──────────────────────────────────────────────────
  /** Company full English name as registered with the Registrar of Companies */
  legalEntityName: varchar('legal_entity_name', { length: 120 }).notNull(),
  /** Company full Hebrew name as registered */
  legalEntityNameHe: varchar('legal_entity_name_he', { length: 120 }),
  /** ח.פ. — Israeli company registration number (9 digits) */
  companyNumber: varchar('company_number', { length: 20 }).notNull(),

  // ── Bank account identity ─────────────────────────────────────────────────
  // These fields MUST be populated from environment variables (COMPANY_BANK_*)
  // by TreasuryConfigService.seedFromEnv() only. Never set them directly in code.

  /** Israeli bank name (e.g. 'Mizrahi-Tefahot') */
  bankName: varchar('bank_name', { length: 80 }).notNull(),
  /** Israeli bank code (e.g. '20' for Mizrahi-Tefahot; up to 10 chars to accommodate edge cases) */
  bankCode: varchar('bank_code', { length: 10 }).notNull(),
  /** Branch number (e.g. '422') */
  branchNumber: varchar('branch_number', { length: 10 }).notNull(),
  /** Account number (e.g. '082526') */
  accountNumber: varchar('account_number', { length: 20 }).notNull(),
  /**
   * Full IBAN in normalised form (no spaces), e.g. 'IL410200000082008526526'.
   * Stored without spaces so it can be used directly in SEPA/bank API calls.
   * Display formatting (IL41 **** **** ...) is applied by the masking helper.
   */
  iban: varchar('iban', { length: 34 }).notNull(),
  /** BIC / SWIFT code (e.g. 'MIZBILIT') */
  swift: varchar('swift', { length: 11 }).notNull(),
  /** Account holder name exactly as it appears on the bank certificate */
  accountHolderName: varchar('account_holder_name', { length: 120 }).notNull(),

  // ── Document provenance ───────────────────────────────────────────────────
  /** Date the bank account was opened — from the bank certificate */
  accountOpenedAt: timestamp('account_opened_at'),
  /** Date the bank certificate/letter was issued */
  sourceDocumentDate: timestamp('source_document_date'),
  /**
   * Reference to the bank certificate document in secure storage.
   * This is a storage path/key, never a public URL.
   */
  certificateStoragePath: text('certificate_storage_path'),

  // ── Verification status ───────────────────────────────────────────────────
  /**
   * Current verification state.
   *   'pending'    — seeded from env, not yet reviewed by a human approver
   *   'verified'   — manually reviewed and approved by an authorised finance officer
   *   'suspended'  — account placed on hold (bank investigation, fraud alert, etc.)
   */
  verificationStatus: varchar('verification_status', { length: 20 })
    .notNull()
    .default('pending'),
  /** Firebase UID of the finance officer who verified the account */
  verifiedByUid: varchar('verified_by_uid', { length: 128 }),
  /** Display name of the verifier (for admin UI only, never logs) */
  verifiedByName: varchar('verified_by_name', { length: 120 }),
  verifiedAt: timestamp('verified_at'),
  /** Optional note from the verifier (e.g. "Reviewed against original PDF 2025-11-02") */
  verificationNote: text('verification_note'),

  // ── Usage flags ───────────────────────────────────────────────────────────
  /** When true, ProviderPayoutService will use this account as payout source */
  isActivePayoutSource: boolean('is_active_payout_source').notNull().default(false),
  /** When true, this account is referenced in all settlement and reconciliation reports */
  isActiveForReconciliation: boolean('is_active_for_reconciliation').notNull().default(false),

  // ── Audit ─────────────────────────────────────────────────────────────────
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  /** Firebase UID of the admin who last modified this row */
  lastModifiedByUid: varchar('last_modified_by_uid', { length: 128 }),
}, (_t) => ({}));

export const insertTreasurySettingsSchema = createInsertSchema(treasurySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTreasurySettings = z.infer<typeof insertTreasurySettingsSchema>;
export type TreasurySettings = typeof treasurySettings.$inferSelect;

// ── treasury_access_log ───────────────────────────────────────────────────────
// Immutable audit trail — no updates or deletes ever.
// Every read and write to treasury_settings creates a row here.

export const treasuryAccessLog = pgTable('treasury_access_log', {
  id: serial('id').primaryKey(),
  /** Firebase UID of the person who performed the action */
  actorUid: varchar('actor_uid', { length: 128 }).notNull(),
  /** Email of the actor — stored for human-readable audits */
  actorEmail: varchar('actor_email', { length: 255 }).notNull(),
  /** Role of the actor at the time of the action */
  actorRole: varchar('actor_role', { length: 40 }).notNull(),
  /**
   * Action performed:
   *   'READ'             — viewed masked treasury settings
   *   'SEED'             — initial seed from environment variables
   *   'UPDATE'           — field(s) updated
   *   'VERIFY'           — status changed to 'verified'
   *   'SUSPEND'          — status changed to 'suspended'
   *   'PAYOUT_VALIDATED' — ProviderPayoutService checked treasury identity before transfer
   *   'PAYOUT_BLOCKED'   — ProviderPayoutService blocked a transfer (treasury not ready)
   */
  action: varchar('action', { length: 40 }).notNull(),
  /**
   * High-level summary. MUST NOT contain IBAN, account numbers, or other secrets.
   * Good: "Verification status changed to verified by finance officer"
   * Bad:  "IBAN IL41020000... verified"
   */
  description: text('description').notNull(),
  /** Originating request IP address */
  ipAddress: varchar('ip_address', { length: 45 }),
  /** User-Agent string (helps detect automated vs manual access) */
  userAgent: text('user_agent'),
  performedAt: timestamp('performed_at').defaultNow().notNull(),
}, (t) => ({
  actorIdx: index('idx_treasury_log_actor').on(t.actorUid),
  actionIdx: index('idx_treasury_log_action').on(t.action),
  timeIdx: index('idx_treasury_log_time').on(t.performedAt),
}));

export type TreasuryAccessLog = typeof treasuryAccessLog.$inferSelect;
