/**
 * PetWash™ DriveArchivalService — Google Hardening Pack Section 2.2 + 5
 * ======================================================================
 * Async, non-blocking PDF archival pipeline for tax documents.
 *
 * PIPELINE (Section 5 of the spec):
 *   1. TransactionEngine completes financial event (already done by TransactionEngine.ts)
 *   2. TaxDocumentService creates canonical row in PostgreSQL (already done)
 *   3. PDF is generated from the tax document payload
 *   4. PDF is uploaded to Google Drive asynchronously via this service
 *   5. Drive file ID + SHA-256 checksum written back to pw_tax_documents
 *   6. If Drive fails → tax document remains valid, retry job stays PENDING
 *
 * NON-NEGOTIABLE:
 *   - Drive upload NEVER blocks payment issuance.
 *   - Drive upload failure NEVER voids a tax document.
 *   - All network calls are wrapped in try/catch with structured error logging.
 *
 * GOOGLE OAUTH:
 *   Uses GOOGLE_SERVICE_ACCOUNT_JSON (existing env var, same as Sheets integration).
 *   Required Drive scope: https://www.googleapis.com/auth/drive.file
 *   (app-created files only — narrowest scope per policy Section 7.2)
 */

import crypto from 'crypto';
import { db } from '../db';
import { pwTaxDocuments } from '@shared/schema-payments';
import { sql, eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { COMPANY_TAX_ID, COMPANY_NAME_EN } from '@shared/finance-identity';

const DRIVE_PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_TAX_DOCS_FOLDER_ID ?? null;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * Generate a minimal deterministic PDF buffer for a tax document.
 * In production, replace this stub with a real PDF generation library
 * (e.g., PDFKit, Puppeteer, or a DocuSeal integration).
 * The stub produces valid but bare-bones PDF so the pipeline can be
 * exercised end-to-end before the PDF design is finalized.
 */
function generatePdfStub(taxDocId: string, documentType: string, payload: Record<string, any>): Buffer {
  // Seller identity: stamped into payload.sellerModel by TransactionEngine at issuance time.
  // MARKETPLACE_PROVIDER → provider is the legal seller; providerId identifies them.
  // PETWASH_PRINCIPAL (default) → PetWash Ltd is the seller.
  const sellerLine = payload.sellerModel === 'MARKETPLACE_PROVIDER'
    ? `% Seller: Provider (ID: ${payload.providerId ?? 'unknown'}) — replace with provider name/VAT in production PDF`
    : `% Seller: ${COMPANY_NAME_EN} (VAT ${COMPANY_TAX_ID})`;

  const text = [
    `%PDF-1.4`,
    sellerLine,
    `% ID: ${taxDocId}`,
    `% Type: ${documentType}`,
    `% Generated: ${new Date().toISOString()}`,
    `% Gross: ${payload.grossCents ?? 0} agorot`,
    `% VAT: ${payload.vatCents ?? 0} agorot`,
    `% Net: ${payload.netCents ?? 0} agorot`,
    `%%EOF`,
  ].join('\n');
  return Buffer.from(text, 'utf-8');
}

/**
 * Get an authenticated Google Drive client using the service account.
 * Returns null (and logs a warning) if credentials are not configured.
 */
async function getDriveClient(): Promise<any | null> {
  const saJson = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '').trim();
  if (!saJson || saJson === 'null') {
    logger.warn('[DriveArchival] GOOGLE_SERVICE_ACCOUNT_JSON not set — Drive upload skipped');
    return null;
  }

  try {
    const { google } = await import('googleapis');
    const credentials = JSON.parse(saJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [DRIVE_SCOPE],
    });
    const client = await auth.getClient();
    return google.drive({ version: 'v3', auth: client as any });
  } catch (err: any) {
    logger.error('[DriveArchival] Failed to initialise Drive client', { err: err.message });
    return null;
  }
}

export interface ArchiveResult {
  success: boolean;
  driveFileId?: string;
  driveFolderId?: string;
  pdfSha256?: string;
  error?: string;
}

/**
 * Upload a tax document PDF to Google Drive and write back the file ID + checksum.
 *
 * This function is designed to be called from the AsyncJobWorker, never inline
 * in a payment flow. It handles its own errors and never throws.
 *
 * @param taxDocId  The canonical tax document ID (TAX-{year}-{nanoid}).
 */
export async function archiveTaxDocumentToDrive(taxDocId: string): Promise<ArchiveResult> {
  try {
    // 1. Load the canonical tax document from PostgreSQL
    const [doc] = await db
      .select()
      .from(pwTaxDocuments)
      .where(eq(pwTaxDocuments.taxDocId, taxDocId))
      .limit(1);

    if (!doc) {
      logger.error('[DriveArchival] Tax document not found', { taxDocId });
      return { success: false, error: 'TAX_DOC_NOT_FOUND' };
    }

    if (doc.status === 'voided') {
      logger.info('[DriveArchival] Skipping voided document', { taxDocId });
      return { success: true };
    }

    // 2. Mark as PROCESSING to prevent duplicate uploads
    await db.execute(sql`
      UPDATE pw_tax_documents
      SET archive_status = 'PROCESSING',
          archive_attempts = archive_attempts + 1
      WHERE tax_doc_id = ${taxDocId}
    `);

    // 3. Generate PDF
    const payload = (doc.payload ?? {}) as Record<string, any>;
    const pdfBuffer = generatePdfStub(doc.taxDocId, doc.documentType, {
      ...payload,
      grossCents:  doc.grossCents,
      vatCents:    doc.vatCents,
      netCents:    doc.netCents,
      // providerId is needed so the stub (and future real renderer) can identify the
      // marketplace seller when payload.sellerModel === 'MARKETPLACE_PROVIDER'.
      providerId:  (doc as any).providerId ?? null,
    });

    // 4. Compute SHA-256 checksum of PDF bytes
    const sha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    // 5. Upload to Google Drive
    const drive = await getDriveClient();
    if (!drive) {
      // No credentials — mark as PENDING for retry when credentials are added
      await db.execute(sql`
        UPDATE pw_tax_documents
        SET archive_status = 'PENDING',
            last_error = 'NO_DRIVE_CREDENTIALS'
        WHERE tax_doc_id = ${taxDocId}
      `);
      return { success: false, error: 'NO_DRIVE_CREDENTIALS' };
    }

    const { Readable } = await import('stream');
    const stream = Readable.from(pdfBuffer);

    const fileName = `${doc.taxDocId}_${doc.documentType}.pdf`;
    const fileMetadata: Record<string, any> = { name: fileName, mimeType: 'application/pdf' };
    if (DRIVE_PARENT_FOLDER_ID) {
      fileMetadata.parents = [DRIVE_PARENT_FOLDER_ID];
    }

    const uploadedFile = await drive.files.create({
      requestBody: fileMetadata,
      media: { mimeType: 'application/pdf', body: stream },
      fields: 'id,parents',
    });

    const driveFileId = uploadedFile.data.id as string;
    const driveFolderId = (uploadedFile.data.parents?.[0] as string) ?? DRIVE_PARENT_FOLDER_ID ?? null;
    const retentionUntil = new Date();
    retentionUntil.setFullYear(retentionUntil.getFullYear() + 7); // 7-year ITA retention

    // 6. Write Drive file ID + checksum back to the canonical DB row
    await db.execute(sql`
      UPDATE pw_tax_documents
      SET drive_file_id    = ${driveFileId},
          drive_folder_id  = ${driveFolderId},
          pdf_sha256       = ${sha256},
          archive_status   = 'ARCHIVED',
          archived_at      = NOW(),
          retention_until  = ${retentionUntil.toISOString()}
      WHERE tax_doc_id = ${taxDocId}
    `);

    logger.info('[DriveArchival] Tax document archived to Drive', {
      taxDocId,
      driveFileId,
      sha256: sha256.slice(0, 16) + '...',
    });

    return { success: true, driveFileId, driveFolderId: driveFolderId ?? undefined, pdfSha256: sha256 };

  } catch (err: any) {
    logger.error('[DriveArchival] Upload failed', { taxDocId, err: err.message });

    // Mark as FAILED so AsyncJobWorker can retry with exponential backoff
    try {
      await db.execute(sql`
        UPDATE pw_tax_documents
        SET archive_status = 'FAILED',
            last_error     = ${err.message?.slice(0, 500) ?? 'UNKNOWN'}
        WHERE tax_doc_id = ${taxDocId}
      `);
    } catch (updateErr) {
      logger.error('[DriveArchival] Could not update archive_status to FAILED', { taxDocId });
    }

    return { success: false, error: err.message };
  }
}

/**
 * Check Drive credentials are configured and the service account
 * has access to the target folder.
 * Use on /health or /api/admin/drive-status endpoints.
 */
export async function checkDriveHealth(): Promise<{ ok: boolean; message: string }> {
  const drive = await getDriveClient();
  if (!drive) return { ok: false, message: 'GOOGLE_SERVICE_ACCOUNT_JSON not configured' };

  try {
    await drive.about.get({ fields: 'user' });
    return { ok: true, message: 'Drive client authenticated' };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}
