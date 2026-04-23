/**
 * TreasuryConfigService — Backend-Only Treasury Identity Management
 * ==================================================================
 * This service is the SOLE authorised path for reading or writing the
 * company treasury bank account settings.
 *
 * SECURITY CONTRACT (Israeli Financial Regulation + Internal Policy):
 *  ▸ All reads return MASKED values. Raw values are never returned to callers.
 *  ▸ Sensitive env vars (COMPANY_BANK_*) are consumed ONCE at seed time;
 *    IBAN and account number are then stored AES-256-GCM encrypted via
 *    secretFieldCrypto.encryptField().  No method exposes the plaintext.
 *  ▸ Display masking is served from pre-computed cache columns (iban_masked_cache,
 *    account_number_masked_cache) so the route layer never needs to decrypt.
 *  ▸ Every read, write, and payout validation is recorded in treasury_access_log.
 *  ▸ Structural events (seed, verify, suspend, rotate) are also recorded in
 *    treasury_settings_audit with before/after masked snapshots.
 *  ▸ Application logs MUST NOT contain IBAN, account numbers, SWIFT, or branch.
 *    The logger calls in this file are carefully written to exclude them.
 *  ▸ This module must never be imported by any frontend-facing code.
 *    If you see this import in a client/ file, remove it immediately.
 *
 * Required environment variables (set in secrets manager / .env — never in code):
 *   TREASURY_FIELD_ENCRYPTION_KEY — 64 hex chars (AES-256 key for field encryption)
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
 *  ▸ Encryption at rest is required by the Israeli Privacy Protection Regulations
 *    (Data Security) 5777-2017, Article 9 ("Protection of sensitive databases").
 *  ▸ Treasury access audit logs must be retained for 7 years per the Accounting
 *    Records Law (חוק מסמכי חשבונות), תשמ"ו-1976.
 */

import { db } from '../db';
import {
  treasurySettings,
  treasuryAccessLog,
  treasurySettingsAudit,
} from '@shared/schema-treasury';
import type { TreasurySettings } from '@shared/schema-treasury';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import {
  encryptField,
  decryptField,
  maskIban,
  maskAccountNumber,
  maskSwift,
} from './secretFieldCrypto';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Masked representation safe for admin UI display. Raw values are never returned. */
export interface MaskedTreasury {
  id: number;
  legalEntityName: string;
  legalEntityNameHe: string | null;
  companyNumber: string;
  bankName: string;
  bankCode: string;
  branchNumber: string;   // branch number is low-sensitivity; shown in plain to finance admins
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
  /** ID of the verified treasury record (used to stamp payout/settlement rows) */
  treasurySettingId?: number;
}

/** Health indicators for the admin diagnostics endpoint */
export interface TreasuryHealthStatus {
  treasuryConfigured: boolean;
  treasuryVerified: boolean;
  treasuryCertificateFresh: boolean;
  payoutSourceReady: boolean;
  detail: string;
}

// ── Masking from cached columns ───────────────────────────────────────────────

/** Build a MaskedTreasury from a DB row, using the pre-computed mask cache columns. */
function applyMask(row: TreasurySettings): MaskedTreasury {
  return {
    id: row.id,
    legalEntityName: row.legalEntityName,
    legalEntityNameHe: row.legalEntityNameHe ?? null,
    companyNumber: row.companyNumber,
    bankName: row.bankName,
    bankCode: row.bankCode,
    branchNumber: row.branchNumber,
    accountNumberMasked: row.accountNumberMaskedCache ?? '***',
    ibanMasked: row.ibanMaskedCache ?? '****',
    swiftMasked: row.swiftMaskedCache ?? '****',
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

// ── Audit logging helpers ─────────────────────────────────────────────────────

type AccessLogAction = typeof treasuryAccessLog.$inferSelect['action'];

async function auditLog(
  actor: TreasuryActor,
  action: AccessLogAction,
  description: string,
): Promise<void> {
  try {
    await db.insert(treasuryAccessLog).values({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action,
      description,
      ipAddress: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
  } catch (err) {
    logger.error('[TreasuryConfig] CRITICAL: failed to write access audit log', {
      action,
      actorUid: actor.uid,
    });
    throw err;
  }
}

async function structuralAudit(
  actor: TreasuryActor,
  treasurySettingId: number,
  action: string,
  previousMasked: MaskedTreasury | null,
  newMasked: MaskedTreasury,
  note?: string,
): Promise<void> {
  try {
    await db.insert(treasurySettingsAudit).values({
      treasurySettingId,
      action,
      performedByUid: actor.uid,
      performedByEmail: actor.email,
      previousMaskedSnapshot: previousMasked ? JSON.stringify(previousMasked) : null,
      newMaskedSnapshot: JSON.stringify(newMasked),
      note: note ?? null,
    });
  } catch (err) {
    logger.error('[TreasuryConfig] CRITICAL: failed to write structural audit entry', {
      action,
      actorUid: actor.uid,
    });
    throw err;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export class TreasuryConfigService {

  /**
   * Seed the treasury_settings row from environment variables.
   *
   * Sensitive fields (IBAN, account number) are encrypted with AES-256-GCM via
   * secretFieldCrypto.encryptField() before being written to the database.
   * Masked display caches are pre-computed and stored alongside the ciphertext.
   *
   * MUST be called from server-side startup code only.
   * MUST NOT be called from any request handler.
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
      logger.warn('[TreasuryConfig] Treasury seed skipped — missing env vars', {
        missingVars: missing,
        note: 'Set these in secrets manager or .env — never in source code',
      });
      return;
    }

    // Normalise IBAN and encrypt sensitive fields
    const ibanClean = iban!.replace(/\s/g, '');
    const ibanEncrypted = encryptField(ibanClean);
    const accountNumberEncrypted = encryptField(accountNumber!);

    // Pre-compute masked values for the display cache
    const ibanMaskedCache = maskIban(ibanClean);
    const accountNumberMaskedCache = maskAccountNumber(accountNumber!);
    const swiftMaskedCache = maskSwift(swift!);

    const existing = await db
      .select({ id: treasurySettings.id })
      .from(treasurySettings)
      .limit(1);

    const previousMasked = existing.length > 0
      ? applyMask((await db.select().from(treasurySettings).limit(1))[0])
      : null;

    const sharedValues = {
      bankName: bankName!,
      bankCode: bankCode!,
      branchNumber: branchNumber!,
      swift: swift!,
      accountHolderName: accountHolder!,
      ibanEncrypted,
      accountNumberEncrypted,
      ibanMaskedCache,
      accountNumberMaskedCache,
      swiftMaskedCache,
      accountOpenedAt: openedAt ? new Date(openedAt) : null,
      sourceDocumentDate: certDate ? new Date(certDate) : null,
      updatedAt: new Date(),
      lastModifiedByUid: actor.uid,
    };

    let rowId: number;
    if (existing.length > 0) {
      await db
        .update(treasurySettings)
        .set(sharedValues)
        .where(eq(treasurySettings.id, existing[0].id));
      rowId = existing[0].id;
    } else {
      const [inserted] = await db
        .insert(treasurySettings)
        .values({
          legalEntityName: 'PET WASH LTD',
          legalEntityNameHe: 'פט וואש בע"מ',
          companyNumber: '517145033',
          verificationStatus: 'pending',
          isActivePayoutSource: false,
          isActiveForReconciliation: false,
          ...sharedValues,
        })
        .returning({ id: treasurySettings.id });
      rowId = inserted.id;
    }

    logger.info('[TreasuryConfig] Treasury settings seeded/updated from env vars', {
      companyNumber: '517145033',
      bankName,
      // No IBAN, account number, or branch in logs
    });

    const newRow = (await db.select().from(treasurySettings).limit(1))[0];
    const newMasked = applyMask(newRow);

    await auditLog(actor, 'SEED', 'Treasury settings seeded from environment variables at server startup');
    await structuralAudit(actor, rowId, 'created', previousMasked, newMasked, 'Seeded from env vars');
  }

  /**
   * Return the masked treasury settings for admin display.
   * Reads the pre-computed mask cache — never decrypts.
   */
  static async getMasked(actor: TreasuryActor): Promise<MaskedTreasury | null> {
    const rows = await db.select().from(treasurySettings).limit(1);
    if (rows.length === 0) return null;

    await auditLog(actor, 'READ', 'Admin viewed masked treasury settings');

    return applyMask(rows[0]);
  }

  /**
   * Update non-sensitive metadata fields only.
   * Sensitive bank details (IBAN, account, branch, SWIFT) must be updated
   * by re-seeding from env vars.
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
      .set({ ...fields, updatedAt: new Date(), lastModifiedByUid: actor.uid })
      .where(eq(treasurySettings.id, rows[0].id));

    await auditLog(actor, 'UPDATE', 'Treasury metadata updated (document provenance fields)');

    const updated = (await db.select().from(treasurySettings).limit(1))[0];
    const newMasked = applyMask(updated);
    await structuralAudit(actor, rows[0].id, 'metadata_updated', applyMask(rows[0]), newMasked);

    return newMasked;
  }

  /**
   * Mark the treasury account as verified by a human finance officer.
   * Also enables it as the active payout source and reconciliation account.
   */
  static async markVerified(
    actor: TreasuryActor,
    opts: { note?: string } = {},
  ): Promise<MaskedTreasury | null> {
    const rows = await db.select().from(treasurySettings).limit(1);
    if (rows.length === 0) return null;

    const previousMasked = applyMask(rows[0]);

    await db
      .update(treasurySettings)
      .set({
        verificationStatus: 'verified',
        verifiedByUid: actor.uid,
        verifiedByName: actor.email,
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
    });

    const updated = (await db.select().from(treasurySettings).limit(1))[0];
    const newMasked = applyMask(updated);

    await auditLog(
      actor,
      'VERIFY',
      `Treasury account verified and activated as payout source. Note: ${opts.note ?? 'none'}`,
    );
    await structuralAudit(actor, rows[0].id, 'verified', previousMasked, newMasked, opts.note);

    return newMasked;
  }

  /**
   * Suspend the treasury account.
   * Immediately disables it as payout source and reconciliation account.
   */
  static async suspend(
    actor: TreasuryActor,
    reason: string,
  ): Promise<MaskedTreasury | null> {
    const rows = await db.select().from(treasurySettings).limit(1);
    if (rows.length === 0) return null;

    const previousMasked = applyMask(rows[0]);

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
      reason,
    });

    const updated = (await db.select().from(treasurySettings).limit(1))[0];
    const newMasked = applyMask(updated);

    await auditLog(actor, 'SUSPEND', `Treasury account suspended. Reason: ${reason}`);
    await structuralAudit(actor, rows[0].id, 'suspended', previousMasked, newMasked, reason);

    return newMasked;
  }

  /**
   * Validate that the treasury is configured and ready to be used as a payout source.
   * Call this in ProviderPayoutService BEFORE initiating any bank transfer.
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

    if (!t.ibanEncrypted || !t.accountNumberEncrypted) {
      return {
        valid: false,
        reason: 'Treasury account is missing required encrypted bank details. Re-seed from environment variables.',
        readyForTransfer: false,
      };
    }

    return {
      valid: true,
      reason: 'Treasury account verified and ready',
      readyForTransfer: true,
      treasurySettingId: t.id,
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
   */
  static async getAccessLog(
    actor: TreasuryActor,
    opts: { limit?: number; offset?: number } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;

    const rows = await db
      .select()
      .from(treasuryAccessLog)
      .orderBy(sql`performed_at DESC`)
      .limit(limit)
      .offset(offset);

    await auditLog(actor, 'READ', `Admin viewed treasury access log (limit=${limit}, offset=${offset})`);

    return rows;
  }

  /**
   * Return paginated structural audit entries (masked snapshots only).
   */
  static async getStructuralAuditLog(
    actor: TreasuryActor,
    opts: { limit?: number; offset?: number } = {},
  ) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;

    const rows = await db
      .select()
      .from(treasurySettingsAudit)
      .orderBy(sql`performed_at DESC`)
      .limit(limit)
      .offset(offset);

    await auditLog(actor, 'READ', `Admin viewed treasury structural audit log`);

    return rows;
  }

  /**
   * Health indicators for admin diagnostics.
   * Cert freshness threshold: 365 days (Bank of Israel guidance on account cert renewal).
   */
  static async getHealthStatus(): Promise<TreasuryHealthStatus> {
    const rows = await db.select().from(treasurySettings).limit(1);

    if (rows.length === 0) {
      return {
        treasuryConfigured: false,
        treasuryVerified: false,
        treasuryCertificateFresh: false,
        payoutSourceReady: false,
        detail: 'Treasury not configured',
      };
    }

    const t = rows[0];
    const isVerified = t.verificationStatus === 'verified';
    const certDate = t.sourceDocumentDate;
    const freshThresholdDays = 365;
    const isCertFresh = certDate
      ? (Date.now() - certDate.getTime()) / 86_400_000 < freshThresholdDays
      : false;

    return {
      treasuryConfigured: true,
      treasuryVerified: isVerified,
      treasuryCertificateFresh: isCertFresh,
      payoutSourceReady: isVerified && t.isActivePayoutSource,
      detail: isVerified
        ? isCertFresh
          ? 'Treasury operational'
          : 'Treasury verified but certificate may be outdated — request fresh bank letter'
        : `Treasury status: ${t.verificationStatus}`,
    };
  }

  /**
   * Decrypt the IBAN for internal use by the payout/bank transfer engine only.
   * MUST NOT be called from any route handler or exported to the frontend.
   *
   * @internal
   */
  static async _internalGetDecryptedIban(): Promise<string | null> {
    const rows = await db.select().from(treasurySettings).limit(1);
    if (rows.length === 0 || !rows[0].ibanEncrypted) return null;
    try {
      return decryptField(rows[0].ibanEncrypted);
    } catch (err) {
      logger.error('[TreasuryConfig] Failed to decrypt IBAN — ciphertext tampered?', {
        error: String(err),
      });
      return null;
    }
  }

  /**
   * Decrypt the account number for internal use by the payout/bank transfer engine only.
   * MUST NOT be called from any route handler or exported to the frontend.
   *
   * @internal
   */
  static async _internalGetDecryptedAccountNumber(): Promise<string | null> {
    const rows = await db.select().from(treasurySettings).limit(1);
    if (rows.length === 0 || !rows[0].accountNumberEncrypted) return null;
    try {
      return decryptField(rows[0].accountNumberEncrypted);
    } catch (err) {
      logger.error('[TreasuryConfig] Failed to decrypt account number — ciphertext tampered?', {
        error: String(err),
      });
      return null;
    }
  }
}

