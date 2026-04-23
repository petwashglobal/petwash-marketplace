/**
 * PetWash™ Treasury Settings Schema
 * ===================================
 * Single-row table that holds the company's verified bank account identity.
 *
 * SECURITY RULES (Israel Financial Regulation + Internal Policy):
 *  - This table is BACKEND-ONLY. Never expose to frontend, browser, logs, or public repo.
 *  - Sensitive columns (iban_encrypted, account_number_encrypted) store AES-256-GCM
 *    ciphertext produced by secretFieldCrypto.encryptField().
 *    The encryption key MUST live in secrets manager (TREASURY_FIELD_ENCRYPTION_KEY).
 *  - All API endpoints that read this table MUST return masked values only.
 *    Masking is enforced by TreasuryConfigService — never bypass it.
 *  - Every read and write is recorded in the treasury_access_log table.
 *  - Structural changes are recorded in treasury_settings_audit.
 *  - Required admin role: 'super_admin' OR 'finance' (enforced in the route layer).
 *
 * Israeli Regulatory Context:
 *  - Bank Mizrahi-Tefahot is regulated under the Israeli Banking Law (חוק הבנקאות).
 *  - IBAN format: IL + 2 check digits + 3-digit bank code + 3-digit branch + 13-digit account.
 *  - The treasury account serves as the sole company beneficiary for all provider payouts
 *    and settlement transfers (per Israel Payment Services Law 2023 requirements).
 *  - Encryption at rest is required by the Israeli Privacy Protection Regulations
 *    (Data Security) 5777-2017, Article 9 ("Protection of sensitive databases").
 *  - Access to account details by staff is governed by the company's internal Information
 *    Security Policy and must comply with the Bank of Israel's Cyber Directive (06/2017).
 *  - Audit logs must be retained for 7 years per the Accounting Records Law
 *    (חוק מסמכי חשבונות), תשמ"ו-1976.
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
// Sensitive fields are stored encrypted; plain-text columns are retained for
// backward compatibility with the v1 migration but must not be set after v2.

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
  // Non-sensitive fields stored in plain text.
  /** Israeli bank name (e.g. 'Mizrahi-Tefahot') */
  bankName: varchar('bank_name', { length: 80 }).notNull(),
  /** Israeli bank code (e.g. '20' for Mizrahi-Tefahot; up to 10 chars to accommodate edge cases) */
  bankCode: varchar('bank_code', { length: 10 }).notNull(),
  /** Branch number (e.g. '422') — low sensitivity, stored plain */
  branchNumber: varchar('branch_number', { length: 10 }).notNull(),
  /** Account holder name exactly as it appears on the bank certificate */
  accountHolderName: varchar('account_holder_name', { length: 120 }).notNull(),
  /** SWIFT/BIC code stored in plain text (publicly registered code, low sensitivity) */
  swift: varchar('swift', { length: 11 }).notNull(),

  // ── Encrypted sensitive fields (v2) ──────────────────────────────────────
  // These store the output of secretFieldCrypto.encryptField() — AES-256-GCM ciphertext.
  // Format: enc:v1:<iv_hex>:<authTag_hex>:<cipher_hex>
  // Set/read ONLY by TreasuryConfigService. Never set directly.

  /**
   * AES-256-GCM encrypted IBAN (no spaces, e.g. enc:v1:...).
   * Decrypt with secretFieldCrypto.decryptField() inside TreasuryConfigService only.
   */
  ibanEncrypted: text('iban_encrypted'),

  /**
   * AES-256-GCM encrypted account number (e.g. enc:v1:...).
   * Decrypt with secretFieldCrypto.decryptField() inside TreasuryConfigService only.
   */
  accountNumberEncrypted: text('account_number_encrypted'),

  // ── Masked display cache (computed on write, updated on rotate) ───────────
  // These allow admin UI to display safely without decrypting in the route layer.
  /** e.g. 'IL41 **** **** **** **** 526' — updated on every seed/rotate */
  ibanMaskedCache: varchar('iban_masked_cache', { length: 50 }),
  /** e.g. '***526' — updated on every seed/rotate */
  accountNumberMaskedCache: varchar('account_number_masked_cache', { length: 20 }),
  /** e.g. 'MIZB****' — updated on every seed/rotate */
  swiftMaskedCache: varchar('swift_masked_cache', { length: 20 }),

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
   *   'ROTATE'           — new treasury record created, old deactivated
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

// ── treasury_settings_audit ───────────────────────────────────────────────────
// Structural change audit — records create / verify / suspend / rotate events
// with before/after masked snapshots for compliance and auditor review.
// Never stores raw bank details — masked values only.

export const treasurySettingsAudit = pgTable('treasury_settings_audit', {
  id: serial('id').primaryKey(),
  /** ID of the treasury_settings row this event relates to */
  treasurySettingId: serial('treasury_setting_id').notNull(),
  /** Action performed: 'created' | 'verified' | 'suspended' | 'rotated' | 'metadata_updated' */
  action: varchar('action', { length: 40 }).notNull(),
  /** Firebase UID of the person who triggered this event */
  performedByUid: varchar('performed_by_uid', { length: 128 }).notNull(),
  /** Display email of the actor */
  performedByEmail: varchar('performed_by_email', { length: 255 }).notNull(),
  /**
   * JSON snapshot of the PREVIOUS masked state (before the action).
   * Only contains masked values — never raw IBAN, account number, or SWIFT.
   */
  previousMaskedSnapshot: text('previous_masked_snapshot'),
  /**
   * JSON snapshot of the NEW masked state (after the action).
   * Only contains masked values — never raw IBAN, account number, or SWIFT.
   */
  newMaskedSnapshot: text('new_masked_snapshot'),
  /** Optional human note (from the admin who performed the action) */
  note: text('note'),
  performedAt: timestamp('performed_at').defaultNow().notNull(),
}, (t) => ({
  settingIdx: index('idx_treasury_audit_setting').on(t.treasurySettingId),
  timeIdx: index('idx_treasury_audit_time').on(t.performedAt),
}));

export type TreasurySettingsAudit = typeof treasurySettingsAudit.$inferSelect;

