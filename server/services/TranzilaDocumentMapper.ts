/**
 * PetWash™ TranzilaDocumentMapper
 *
 * Maps Tranzila processor document details into PetWash's pw_tax_documents table.
 *
 * OWNERSHIP CONTRACT:
 *   Tranzila generates the documents (document number, PDF, digital signature).
 *   PetWash does NOT re-generate or duplicate what Tranzila provides.
 *   This mapper ingests and stores the processor reference and status into PetWash
 *   internal records so they are available for audit, reconciliation, and admin UI.
 *
 * DEPENDENCIES:
 *   - TRANZILA_DOCUMENT_INGESTION_ENABLED flag must be true.
 *   - CPA written confirmation on VAT timing is required before live use.
 *
 * IDEMPOTENCY:
 *   - Uses processorDocumentNumber as unique key. Calling twice with the same
 *     document number is safe — the second call is a no-op.
 */

import { db } from '../db';
import { pwTaxDocuments } from '../../shared/schema-payments';
import { tranzilaTransactions } from '../../shared/schema-tranzila';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { TRANZILA_DOCUMENT_INGESTION_ENABLED } from '../lib/payment-flags';
import { nanoid } from 'nanoid';

// ── Tranzila document type → PetWash document type mapping ──────────────────
// Keep this mapping in a single place. Do not inline elsewhere.
const TRANZILA_DOC_TYPE_MAP: Record<string, string> = {
  receipt:              'RECEIPT',
  tax_invoice:          'TAX_INVOICE',
  tax_invoice_receipt:  'TAX_INVOICE',   // combined — treat as TAX_INVOICE for PetWash
  credit_invoice:       'CREDIT_NOTE',
  proforma:             'RECEIPT',       // proforma → receipt until CPA confirms treatment
};

function mapDocumentType(processorDocumentType: string | null | undefined): string {
  if (!processorDocumentType) return 'RECEIPT';
  const mapped = TRANZILA_DOC_TYPE_MAP[processorDocumentType.toLowerCase()];
  if (!mapped) {
    logger.warn('[TranzilaDocumentMapper] Unknown processorDocumentType — defaulting to RECEIPT', {
      processorDocumentType,
    });
    return 'RECEIPT';
  }
  return mapped;
}

export interface TranzilaDocumentIngestParams {
  /** idempotency key of the tranzila_transactions row */
  idempotencyKey: string;
  /** Tranzila processor transaction ID */
  processorTransactionId: string;
  /** Tranzila document number */
  processorDocumentNumber: string;
  /** Tranzila document type string (e.g. 'tax_invoice') */
  processorDocumentType: string;
  /** URL or reference to document PDF in Tranzila portal */
  processorDocumentUrl?: string;
  /** Timestamp Tranzila reports the document was issued (ISO string or Date) */
  processorDocumentIssuedAt?: Date | string;
  /** PetWash payment ID (FK → pw_payments) */
  pwPaymentId?: string;
  customerId?: string;
  providerId?: string;
  bookingId?: string;
  /** Gross amount in CENTS */
  grossCents: number;
  /** VAT amount in CENTS */
  vatCents: number;
}

export interface TranzilaDocumentIngestResult {
  /** 'created' | 'already_exists' | 'disabled' | 'error' */
  outcome: 'created' | 'already_exists' | 'disabled' | 'error';
  taxDocId?: string;
  error?: string;
}

export class TranzilaDocumentMapper {
  /**
   * Ingest a Tranzila-generated document into pw_tax_documents.
   *
   * Called by TranzilaWebhookService after a payment_success or document_issued event.
   * Safe to call multiple times — idempotent on processorDocumentNumber.
   *
   * Returns 'disabled' if TRANZILA_DOCUMENT_INGESTION_ENABLED is false.
   * Returns 'already_exists' if document was already ingested.
   * Returns 'created' with taxDocId on success.
   */
  static async ingest(params: TranzilaDocumentIngestParams): Promise<TranzilaDocumentIngestResult> {
    if (!TRANZILA_DOCUMENT_INGESTION_ENABLED) {
      logger.info('[TranzilaDocumentMapper] Document ingestion disabled — skipping', {
        processorDocumentNumber: params.processorDocumentNumber,
      });
      return { outcome: 'disabled' };
    }

    try {
      // Idempotency check — look for existing row by external doc ID
      const existing = await db
        .select({ taxDocId: pwTaxDocuments.taxDocId })
        .from(pwTaxDocuments)
        .where(eq(pwTaxDocuments.externalDocId, params.processorDocumentNumber))
        .limit(1);

      if (existing.length > 0) {
        logger.info('[TranzilaDocumentMapper] Document already ingested — skipping', {
          processorDocumentNumber: params.processorDocumentNumber,
          taxDocId: existing[0].taxDocId,
        });
        return { outcome: 'already_exists', taxDocId: existing[0].taxDocId };
      }

      const taxDocId = `TAX-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
      const pwDocumentType = mapDocumentType(params.processorDocumentType);
      const issuedAt = params.processorDocumentIssuedAt
        ? new Date(params.processorDocumentIssuedAt)
        : new Date();

      await db.insert(pwTaxDocuments).values({
        taxDocId,
        documentType: pwDocumentType,
        relatedPaymentId: params.pwPaymentId ?? null,
        customerId: params.customerId ?? null,
        providerId: params.providerId ?? null,
        bookingId: params.bookingId ?? null,
        grossCents: params.grossCents,
        vatCents: params.vatCents,
        netCents: params.grossCents - params.vatCents,
        currency: 'ILS',
        externalDocId: params.processorDocumentNumber,
        payload: {
          processor: 'tranzila',
          processorTransactionId: params.processorTransactionId,
          processorDocumentNumber: params.processorDocumentNumber,
          processorDocumentType: params.processorDocumentType,
          processorDocumentUrl: params.processorDocumentUrl ?? null,
        },
        status: 'issued',
        issuedAt,
        archiveStatus: 'PENDING',
        archiveAttempts: 0,
      });

      // Back-fill the pw_tax_doc_id on the tranzila_transactions row
      await db
        .update(tranzilaTransactions)
        .set({ pwTaxDocId: taxDocId })
        .where(eq(tranzilaTransactions.idempotencyKey, params.idempotencyKey));

      logger.info('[TranzilaDocumentMapper] Document ingested successfully', {
        taxDocId,
        processorDocumentNumber: params.processorDocumentNumber,
        pwDocumentType,
      });

      return { outcome: 'created', taxDocId };
    } catch (err: any) {
      logger.error('[TranzilaDocumentMapper] Failed to ingest document', {
        processorDocumentNumber: params.processorDocumentNumber,
        error: err?.message,
      });
      return { outcome: 'error', error: err?.message ?? 'Unknown error' };
    }
  }
}

export default TranzilaDocumentMapper;
