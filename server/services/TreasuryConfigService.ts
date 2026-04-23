/**
 * TreasuryConfigService — Backend-Only Treasury Identity Management
 * ==================================================================
 * This service is the SOLE authorised path for reading or writing the
 * company treasury bank account settings.
 *
 * SECURITY CONTRACT (Israeli Financial Regulation + Internal Policy):
 *  ▸ All reads return MASKED values. Raw values are never returned to callers.
 *  ▸ Sensitive env vars (COMPANY_BANK_*) are consumed ONCE at seed time and
 *    then treated as write-only in this file. No method returns them.
 *  ▸ Every read, write, and payout validation is recorded in treasury_access_log.
 *  ▸ Application logs MUST NOT contain IBAN, account numbers, SWIFT, or branch.
 *    The logger calls in this file are carefully written to exclude them.
 *  ▸ This module must never be imported by any frontend-facing code.
 *    If you see this import in a client/ file, remove it immediately.
 *
 * Required environment variables (set in secrets manager / .env — never in code):
 *   COMPANY_BANK_IBAN            — normalised, no spaces, e.g. IL410200000082008526526
 *   COMPANY_BANK_SWIFT           — e.g. MIZBILIT
 *   COMPANY_BANK_NAME            — e.g. Mizrahi-Tefahot
 *   COMPANY_BANK_CODE            — e.g. 20
 *   COMPANY_BANK_BRANCH_NUMBER   — e.g. 422
 *   COMPANY_BANK_ACCOUNT_NUMBER  — e.g. 082526
 *   COMPANY_BANK_ACCOUNT_HOLDER  — e.g. PET WASH LTD
 *   COMPANY_BANK_ACCOUNT_OPENED  — ISO date e.g. 2025-10-19
 *   COMPANY_BANK_CERT_DATE       — ISO date the bank cert was issued e.g. 2025-11-02
 *
 * Israeli regulatory context:
 *  ▸ Bank Mizrahi-Tefahot is regulated under חוק הבנקאות (רישוי), תשמ"א-1981.
 *  ▸ All outgoing bank transfers from this account to providers are subject to
 *    the Payment Services Law (Israel, 2023) and require the source account to
 *    be formally registered as the company's treasury account.
 *  ▸ Treasury access audit logs must be retained for 7 years per the Accounting
 *    Records Law (חוק מסמכי חשבונות), תשמ"ו-1976.
 */

import { db } from '../db';
import { treasurySettings, treasuryAccessLog } from '@shared/schema-treasury';
import type { TreasurySettings } from '@shared/schema-treasury';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Masked representation safe for admin UI display. Raw values are never returned. */
export interface MaskedTreasury {
  id: number;
  legalEntityName: string;
  legalEntityNameHe: string | null;
  companyNumber: string;
  bankName: string;
  bankCode: string;
  /** e.g. '***' — last digit only */
  branchNumberMasked: string;
  /** e.g. '***526' — last 3 digits only */
  accountNumberMasked: string;
  /** e.g. 'IL41 **** **** **** **** 526' */
  ibanMasked: string;
  /** e.g. 'MIZB****' */
  swiftMasked: string;
  accountHolderName: string;
  accountOpenedAt: Date | null;
  sourceDocumentDate: Date | null;
  verificationStatus: string;
  verifiedByName: string | null;
  verifiedAt: Date | null;
  verificationNote: string | null;
  isActivePayoutSource: boolean;
  isActiveForReconciliation: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TreasuryActor {
  uid: string;
  email: string;
  role: string;
  ip?: string;
  userAgent?: string;
}

export interface PayoutSourceValidation {
  valid: boolean;
  reason: string;
  /** True only when the treasury is in 'verified' state and flagged as active payout source */
  readyForTransfer: boolean;
}

// ── Masking helpers ───────────────────────────────────────────────────────────

/**
 * Mask an IBAN for safe display.
 * Input:  'IL410200000082008526526'  (normalised, no spaces)
 * Output: 'IL41 **** **** **** **** 526'
 *
 * Only the country code + check digits (4 chars) and last 3 digits are shown.
 * The middle portion is fully masked to prevent reconstruction of the account number.
 */
function maskIban(iban: string): string {
  if (!iban || iban.length < 8) return '****';
  const clean = iban.replace(/\s/g, '');
  const prefix = clean.slice(0, 4);           // IL41
  const suffix = clean.slice(-3);             // 526
  const middleLen = Math.max(0, clean.length - 7);
  const middleGroups = Math.ceil(middleLen / 4);
  const masked = Array(middleGroups).fill('****').join(' ');
  return `${prefix} ${masked} ${suffix}`;
}

/**
 * Mask an account number — show only last 3 digits.
 * Input:  '082526'
 * Output: '***526'
 */
function maskAccountNumber(acct: string): string {
  if (!acct || acct.length < 4) return '***';
  return '***' + acct.slice(-3);
}

/**
 * Mask a branch number — show only last digit.
 * Input:  '422'
 * Output: '**2'
 */
function maskBranchNumber(branch: string): string {
  if (!branch || branch.length < 2) return '***';
  return '*'.repeat(Math.max(0, branch.length - 1)) + branch.slice(-1);
}

/**
 * Mask a SWIFT/BIC code — show first 4 chars only.
 * Input:  'MIZBILIT'
 * Output: 'MIZB****'
 */
function maskSwift(swift: string): string {
  if (!swift || swift.length < 5) return '****';
  return swift.slice(0, 4) + '*'.repeat(swift.length - 4);
}

/** Apply all masking rules to a raw treasury row. */
function applyMask(row: TreasurySettings): MaskedTreasury {
  return {
    id: row.id,
    legalEntityName: row.legalEntityName,
    legalEntityNameHe: row.legalEntityNameHe ?? null,
    companyNumber: row.companyNumber,
    bankName: row.bankName,
    bankCode: row.bankCode,
    branchNumberMasked: maskBranchNumber(row.branchNumber),
    accountNumberMasked: maskAccountNumber(row.accountNumber),
    ibanMasked: maskIban(row.iban),
    swiftMasked: maskSwift(row.swift),
    accountHolderName: row.accountHolderName,
    accountOpenedAt: row.accountOpenedAt ?? null,
    sourceDocumentDate: row.sourceDocumentDate ?? null,
    verificationStatus: row.verificationStatus,
    verifiedByName: row.verifiedByName ?? null,
    verifiedAt: row.verifiedAt ?? null,
    verificationNote: row.verificationNote ?? null,
    isActivePayoutSource: row.isActivePayoutSource,
    isActiveForReconciliation: row.isActiveForReconciliation,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Audit logging helper ──────────────────────────────────────────────────────

async function auditLog(
  actor: TreasuryActor,
  action: TreasuryAccessLog['action'],
  description: string,
): Promise<void> {
  try {
    await db.insert(treasuryAccessLog).values({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action,
      // description must never contain IBAN, account number, or other secrets
      description,
      ipAddress: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
  } catch (err) {
    // Audit failures must never silently swallow — log (without sensitive data) and rethrow
    logger.error('[TreasuryConfig] CRITICAL: failed to write audit log', {
      action,
      actorUid: actor.uid,
      // deliberately NOT logging description here in case caller accidentally included secrets
    });
    throw err;
  }
}

// Alias for the action type so callers don't import the DB type directly
type TreasuryAccessLog = typeof treasuryAccessLog.$inferSelect;

// ── Public API ────────────────────────────────────────────────────────────────

export class TreasuryConfigService {

  /**
   * Seed the treasury_settings row from environment variables.
   *
   * This is an upsert operation — safe to call on every server startup if
   * you want the DB to stay in sync with the env configuration.
   *
   * MUST be called from server-side startup code only (e.g. server/index.ts).
   * MUST NOT be called from any request handler.
   *
   * If any required env var is missing, the seed is skipped and a startup
   * warning is emitted. The system can still operate in read-only mode
   * (payouts will be blocked until treasury is configured and verified).
   */
  static async seedFromEnv(actor: TreasuryActor): Promise<void> {
    const iban            = process.env.COMPANY_BANK_IBAN;
    const swift           = process.env.COMPANY_BANK_SWIFT;
    const bankName        = process.env.COMPANY_BANK_NAME;
    const bankCode        = process.env.COMPANY_BANK_CODE;
    const branchNumber    = process.env.COMPANY_BANK_BRANCH_NUMBER;
    const accountNumber   = process.env.COMPANY_BANK_ACCOUNT_NUMBER;
    const accountHolder   = process.env.COMPANY_BANK_ACCOUNT_HOLDER;
    const openedAt        = process.env.COMPANY_BANK_ACCOUNT_OPENED;
    const certDate        = process.env.COMPANY_BANK_CERT_DATE;

    const missing = [
      !iban && 'COMPANY_BANK_IBAN',
      !swift && 'COMPANY_BANK_SWIFT',
      !bankName && 'COMPANY_BANK_NAME',
      !bankCode && 'COMPANY_BANK_CODE',
      !branchNumber && 'COMPANY_BANK_BRANCH_NUMBER',
      !accountNumber && 'COMPANY_BANK_ACCOUNT_NUMBER',
      !accountHolder && 'COMPANY_BANK_ACCOUNT_HOLDER',
    ].filter(Boolean);

    if (missing.length > 0) {
      // Log variable names only — NOT any values
      logger.warn('[TreasuryConfig] Treasury seed skipped — missing env vars', {
        missingVars: missing,
        note: 'Set these in secrets manager or .env — never in source code',
      });
      return;
    }

    const newValues = {
        legalEntityName: 'PET WASH LTD',
        legalEntityNameHe: 'פט וואש בע"מ',
        companyNumber: '517145033',
        bankName: bankName!,
        bankCode: bankCode!,
        branchNumber: branchNumber!,
        accountNumber: accountNumber!,
        iban: iban!.replace(/\s/g, ''),  // normalise: strip any spaces
        swift: swift!,
        accountHolderName: accountHolder!,
        accountOpenedAt: openedAt ? new Date(openedAt) : null,
        sourceDocumentDate: certDate ? new Date(certDate) : null,
        verificationStatus: 'pending',
        isActivePayoutSource: false,    // must be manually enabled by a verified finance officer
        isActiveForReconciliation: false,
        lastModifiedByUid: actor.uid,
    };

    // Select-then-upsert: Drizzle does not support arbitrary SQL expressions as
    // conflict targets, so we check for an existing row first.
    const existing = await db.select({ id: treasurySettings.id }).from(treasurySettings).limit(1);
    if (existing.length > 0) {
      // Update the existing singleton row — preserve verification status & flags
      await db
        .update(treasurySettings)
        .set({
          bankName: newValues.bankName,
          bankCode: newValues.bankCode,
          branchNumber: newValues.branchNumber,
          accountNumber: newValues.accountNumber,
          iban: newValues.iban,
          swift: newValues.swift,
          accountHolderName: newValues.accountHolderName,
          accountOpenedAt: newValues.accountOpenedAt,
          sourceDocumentDate: newValues.sourceDocumentDate,
          updatedAt: new Date(),
          lastModifiedByUid: actor.uid,
        })
        .where(eq(treasurySettings.id, existing[0].id));
    } else {
      await db.insert(treasurySettings).values(newValues);
    }

    logger.info('[TreasuryConfig] Treasury settings seeded/updated from env vars', {
      companyNumber: '517145033',
      bankName,
      // No IBAN, account number, or branch in logs
    });

    await auditLog(actor, 'SEED', 'Treasury settings seeded from environment variables at server startup');
  }

  /**
   * Return the masked treasury settings for admin display.
   * Never returns raw IBAN, account number, or SWIFT.
   */
  static async getMasked(actor: TreasuryActor): Promise<MaskedTreasury | null> {
    const rows = await db.select().from(treasurySettings).limit(1);
    if (rows.length === 0) return null;

    await auditLog(actor, 'READ', 'Admin viewed masked treasury settings');

    return applyMask(rows[0]);
  }

  /**
   * Update non-sensitive metadata fields only.
   * Sensitive bank details (IBAN, account, branch, SWIFT) cannot be changed
   * via this method — they must be updated by re-seeding from env vars.
   */
  static async updateMetadata(
    actor: TreasuryActor,
    fields: {
      verificationNote?: string;
      certificateStoragePath?: string;
      accountOpenedAt?: Date;
      sourceDocumentDate?: Date;
    },
  ): Promise<MaskedTreasury | null> {
    const rows = await db.select().from(treasurySettings).limit(1);
    if (rows.length === 0) return null;

    await db
      .update(treasurySettings)
      .set({
        ...fields,
        updatedAt: new Date(),
        lastModifiedByUid: actor.uid,
      })
      .where(eq(treasurySettings.id, rows[0].id));

    await auditLog(actor, 'UPDATE', 'Treasury metadata updated (document provenance fields)');

    const updated = await db.select().from(treasurySettings).limit(1);
    return updated.length > 0 ? applyMask(updated[0]) : null;
  }

  /**
   * Mark the treasury account as verified by a human finance officer.
   * This also enables it as the active payout source and reconciliation account.
   *
   * Only callable by 'super_admin' or 'finance' roles.
   * The route layer enforces this — this method trusts the caller has already verified.
   */
  static async markVerified(
    actor: TreasuryActor,
    opts: { note?: string } = {},
  ): Promise<MaskedTreasury | null> {
    const rows = await db.select().from(treasurySettings).limit(1);
    if (rows.length === 0) return null;

    await db
      .update(treasurySettings)
      .set({
        verificationStatus: 'verified',
        verifiedByUid: actor.uid,
        verifiedByName: actor.email,   // store email as the display name
        verifiedAt: new Date(),
        verificationNote: opts.note ?? 'Verified by finance officer',
        isActivePayoutSource: true,
        isActiveForReconciliation: true,
        updatedAt: new Date(),
        lastModifiedByUid: actor.uid,
      })
      .where(eq(treasurySettings.id, rows[0].id));

    logger.info('[TreasuryConfig] Treasury account verified and activated', {
      verifiedByUid: actor.uid,
      companyNumber: rows[0].companyNumber,
      // No bank details in logs
    });

    await auditLog(
      actor,
      'VERIFY',
      `Treasury account verified and activated as payout source. Note: ${opts.note ?? 'none'}`,
    );

    const updated = await db.select().from(treasurySettings).limit(1);
    return updated.length > 0 ? applyMask(updated[0]) : null;
  }

  /**
   * Suspend the treasury account (e.g. bank investigation, fraud alert).
   * Automatically disables it as payout source and reconciliation account.
   */
  static async suspend(
    actor: TreasuryActor,
    reason: string,
  ): Promise<MaskedTreasury | null> {
    const rows = await db.select().from(treasurySettings).limit(1);
    if (rows.length === 0) return null;

    await db
      .update(treasurySettings)
      .set({
        verificationStatus: 'suspended',
        isActivePayoutSource: false,
        isActiveForReconciliation: false,
        verificationNote: reason,
        updatedAt: new Date(),
        lastModifiedByUid: actor.uid,
      })
      .where(eq(treasurySettings.id, rows[0].id));

    logger.warn('[TreasuryConfig] Treasury account SUSPENDED', {
      actorUid: actor.uid,
      // reason is safe to log as it comes from the finance officer, not the bank system
      reason,
    });

    await auditLog(actor, 'SUSPEND', `Treasury account suspended. Reason: ${reason}`);

    const updated = await db.select().from(treasurySettings).limit(1);
    return updated.length > 0 ? applyMask(updated[0]) : null;
  }

  /**
   * Validate that the treasury is configured and ready to be used as a payout source.
   *
   * Call this in ProviderPayoutService BEFORE initiating any bank transfer.
   * A transfer MUST NOT proceed unless this returns `readyForTransfer: true`.
   *
   * This method does NOT log every payout call — callers log contextually.
   * Use auditPayoutValidation() for individual payout audit entries.
   */
  static async validatePayoutSource(): Promise<PayoutSourceValidation> {
    const rows = await db.select().from(treasurySettings).limit(1);

    if (rows.length === 0) {
      return {
        valid: false,
        reason: 'Treasury settings not configured. Set COMPANY_BANK_* env vars and call seedFromEnv.',
        readyForTransfer: false,
      };
    }

    const t = rows[0];

    if (t.verificationStatus === 'suspended') {
      return {
        valid: false,
        reason: 'Treasury account is suspended. Contact finance department.',
        readyForTransfer: false,
      };
    }

    if (t.verificationStatus !== 'verified') {
      return {
        valid: false,
        reason: `Treasury account is in status '${t.verificationStatus}'. A finance officer must verify it before payouts can proceed.`,
        readyForTransfer: false,
      };
    }

    if (!t.isActivePayoutSource) {
      return {
        valid: false,
        reason: 'Treasury account is verified but not marked as active payout source.',
        readyForTransfer: false,
      };
    }

    if (!t.iban || !t.swift || !t.accountNumber) {
      return {
        valid: false,
        reason: 'Treasury account is missing required bank details. Re-seed from environment variables.',
        readyForTransfer: false,
      };
    }

    return {
      valid: true,
      reason: 'Treasury account verified and ready',
      readyForTransfer: true,
    };
  }

  /**
   * Record a payout validation event in the audit log.
   * Called by ProviderPayoutService for every payout attempt.
   */
  static async auditPayoutValidation(
    actor: TreasuryActor,
    payoutId: string,
    result: PayoutSourceValidation,
  ): Promise<void> {
    const action = result.readyForTransfer ? 'PAYOUT_VALIDATED' : 'PAYOUT_BLOCKED';
    const description = result.readyForTransfer
      ? `Payout ${payoutId} validated against treasury. Transfer authorised.`
      : `Payout ${payoutId} BLOCKED. Reason: ${result.reason}`;

    await auditLog(actor, action, description);
  }

  /**
   * Return paginated access log entries for the admin audit view.
   * Results are safe to display — they never contain raw bank details.
   */
  static async getAccessLog(
    actor: TreasuryActor,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<TreasuryAccessLog[]> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;

    const rows = await db
      .select()
      .from(treasuryAccessLog)
      .orderBy(sql`performed_at DESC`)
      .limit(limit)
      .offset(offset);

    // Log the audit-log read itself (meta-audit)
    await auditLog(actor, 'READ', `Admin viewed treasury access log (limit=${limit}, offset=${offset})`);

    return rows;
  }
}
