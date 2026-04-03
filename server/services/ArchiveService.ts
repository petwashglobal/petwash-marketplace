/**
 * PetWash™ Archive Service
 *
 * Stores the full document package for every billing record:
 *   - PDF buffer (SHA-256 verified)
 *   - JSON snapshot of the billing record at time of archival
 *   - Metadata record in billing_records.archive_* columns
 *
 * Retention: minimum 7 years from payment capture date (Israeli law).
 * Storage backend: Google Drive (primary) + DB metadata reference.
 *
 * IMPORTANT: Only booking_confirmation and escrow_statement are internal PDFs.
 * receipt / tax_invoice / credit_note PDFs come from the external accounting
 * system and are stored by reference (driveFileId from accounting system).
 */

import { createHash } from "crypto";
import { db } from "../db";
import { billingRecords, billingAuditLog } from "@shared/schema-billing";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { nanoid } from "nanoid";

export interface ArchivePackage {
  recordId:    string;
  pdfBuffer:   Buffer;
  jsonSnapshot: Record<string, unknown>;
}

/**
 * Archives a document package to Google Drive (if configured) and updates
 * the billing record with archive metadata.
 *
 * If Drive is not configured, marks as ARCHIVED in DB only with a local hash.
 * In production, Drive must be configured before deployment.
 */
export async function archiveDocument(pkg: ArchivePackage): Promise<void> {
  const { recordId, pdfBuffer, jsonSnapshot } = pkg;

  const pdfSha256 = createHash("sha256").update(pdfBuffer).digest("hex");

  // Verify the record exists
  const [record] = await db
    .select()
    .from(billingRecords)
    .where(eq(billingRecords.recordId, recordId))
    .limit(1);

  if (!record) {
    throw new Error(`[ArchiveService] BillingRecord ${recordId} not found`);
  }

  if (record.archiveStatus === "ARCHIVED") {
    logger.info("[ArchiveService] Already archived, skipping", { recordId });
    return;
  }

  let driveFileId: string | null = null;

  // Attempt Google Drive upload if GoogleSheetsService / Drive is available
  try {
    const { GoogleDriveService } = await import("./GoogleDriveService");
    const fileName = `PetWash-${record.documentPurpose}-${recordId}-${Date.now()}.pdf`;
    driveFileId = await GoogleDriveService.uploadPDF(pdfBuffer, fileName);
    logger.info("[ArchiveService] PDF uploaded to Drive", { recordId, driveFileId });
  } catch (err: any) {
    // Drive not configured or unavailable — archive metadata only
    logger.warn("[ArchiveService] Drive upload unavailable, archiving metadata only", {
      recordId,
      reason: err?.message,
    });
  }

  await db
    .update(billingRecords)
    .set({
      archiveStatus: "ARCHIVED",
      driveFileId:   driveFileId ?? `LOCAL:${pdfSha256.slice(0, 16)}`,
      pdfSha256,
      archivedAt:    new Date(),
      updatedAt:     new Date(),
      payload: {
        ...(typeof record.payload === "object" ? record.payload : {}),
        archivedSnapshot: jsonSnapshot,
      },
    })
    .where(eq(billingRecords.recordId, recordId));

  // Audit entry
  const auditId = `AUD-${nanoid(12).toUpperCase()}`;
  const now = new Date().toISOString();
  const prevHash = await getLastAuditHash(recordId);
  const entryHash = computeArchiveHash(prevHash, auditId, recordId, pdfSha256, now);

  await db.insert(billingAuditLog).values({
    auditId,
    recordId,
    eventType:   "document_archived",
    fromStatus:  record.paymentFlowStatus,
    toStatus:    record.paymentFlowStatus,
    actorType:   "system",
    actorId:     null,
    deltaAgorot: null,
    entryHash,
    prevHash,
    payload: {
      pdfSha256,
      driveFileId,
      retentionUntil: record.retentionUntil?.toISOString(),
    },
  });

  logger.info("[ArchiveService] Document archived", {
    recordId,
    purpose: record.documentPurpose,
    pdfSha256: pdfSha256.slice(0, 12) + "...",
    driveFileId,
    retentionUntil: record.retentionUntil,
  });
}

/**
 * Mark a record archive as FAILED with error context.
 */
export async function markArchiveFailed(recordId: string, error: string): Promise<void> {
  const [record] = await db
    .select()
    .from(billingRecords)
    .where(eq(billingRecords.recordId, recordId))
    .limit(1);

  if (!record) return;

  const currentAttempts =
    (typeof record.payload === "object" && (record.payload as any).archiveAttempts)
      ? (record.payload as any).archiveAttempts
      : 0;

  await db
    .update(billingRecords)
    .set({
      archiveStatus: "FAILED",
      updatedAt:     new Date(),
      payload: {
        ...(typeof record.payload === "object" ? record.payload : {}),
        archiveAttempts: currentAttempts + 1,
        lastArchiveError: error,
      },
    })
    .where(eq(billingRecords.recordId, recordId));

  logger.error("[ArchiveService] Archive failed", { recordId, error });
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function getLastAuditHash(recordId: string): Promise<string | null> {
  const [last] = await db
    .select({ entryHash: billingAuditLog.entryHash })
    .from(billingAuditLog)
    .where(eq(billingAuditLog.recordId, recordId))
    .orderBy(billingAuditLog.id)
    .limit(1);
  return last?.entryHash ?? null;
}

function computeArchiveHash(
  prevHash: string | null,
  auditId: string,
  recordId: string,
  pdfSha256: string,
  createdAt: string
): string {
  const canonical = [prevHash ?? "GENESIS", auditId, recordId, pdfSha256, createdAt].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Verify archive integrity: recompute SHA-256 from buffer and compare to stored hash.
 * Returns true if the PDF matches the stored hash (tamper detection).
 */
export function verifyPdfIntegrity(pdfBuffer: Buffer, storedSha256: string): boolean {
  const computed = createHash("sha256").update(pdfBuffer).digest("hex");
  return computed === storedSha256;
}
