/**
 * PETWASH™ FINANCIAL DOCUMENT SERVICE
 *
 * Stores a rendered HTML record for every financial event on the platform.
 * PetWash is merchant of record:
 *   - Customers receive: booking_receipt, egift_receipt, membership_receipt,
 *                        cancellation_notice, refund_receipt, egift_redemption_receipt
 *   - Providers receive:  booking_earnings_notice, provider_payout_statement,
 *                         provider_rejection_notice
 *
 * Documents are immutable audit artefacts. One row per financial event per party.
 * Always call this BEFORE dispatching notifications (backend record first).
 *
 * Idempotency:
 *   Pass an idempotencyKey built from the event's natural key
 *   (e.g. `booking_receipt:${bookingId}:${userId}`).
 *   If a document with that key already exists, the existing documentReference
 *   is returned immediately — no duplicate row is written.
 */

import { db } from '../db';
import { financialDocuments } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { randomUUID } from 'crypto';

export type FinancialDocumentType =
  | 'booking_receipt'
  | 'booking_earnings_notice'
  | 'egift_receipt'
  | 'egift_redemption_receipt'
  | 'membership_receipt'
  | 'provider_payout_statement'
  | 'refund_receipt'
  | 'cancellation_notice'
  | 'provider_rejection_notice';

export interface CreateFinancialDocumentInput {
  userId: string;
  bookingId?: string;
  transactionId?: string;
  documentType: FinancialDocumentType;
  issuedByEntity?: string;
  documentPayloadJson: Record<string, unknown>;
  renderedHtml: string;
  /**
   * Optional idempotency key. If provided and a document with this key already
   * exists, the existing documentReference is returned without a new insert.
   * Recommended format: `{documentType}:{bookingId|transactionId}:{userId}`
   */
  idempotencyKey?: string;
}

const REFERENCE_PREFIXES: Record<FinancialDocumentType, string> = {
  booking_receipt:              'PW-RCP',
  booking_earnings_notice:      'PW-ERN',
  egift_receipt:                'PW-EGF',
  egift_redemption_receipt:     'PW-EGR',
  membership_receipt:           'PW-MBR',
  provider_payout_statement:    'PW-PAY',
  refund_receipt:               'PW-RFD',
  cancellation_notice:          'PW-CAN',
  provider_rejection_notice:    'PW-REJ',
};

function generateDocumentReference(type: FinancialDocumentType): string {
  const prefix = REFERENCE_PREFIXES[type];
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${ts}-${rnd}`;
}

export class FinancialDocumentService {
  /**
   * Create and persist a financial document.
   * Returns the documentReference for inclusion in notifications.
   * Never throws — errors are logged and a fallback reference is returned.
   *
   * If idempotencyKey is provided and a duplicate exists, returns existing ref.
   */
  static async create(input: CreateFinancialDocumentInput): Promise<string> {
    // ── Idempotency check ─────────────────────────────────────────────────────
    if (input.idempotencyKey) {
      try {
        const [existing] = await db
          .select({ documentReference: financialDocuments.documentReference })
          .from(financialDocuments)
          .where(eq(financialDocuments.idempotencyKey, input.idempotencyKey))
          .limit(1);

        if (existing) {
          logger.info('[FinancialDocumentService] Idempotent — returning existing document', {
            idempotencyKey: input.idempotencyKey,
            documentReference: existing.documentReference,
          });
          return existing.documentReference;
        }
      } catch (e: any) {
        logger.warn('[FinancialDocumentService] Idempotency check failed, proceeding with insert', {
          error: e?.message,
        });
      }
    }

    const documentReference = generateDocumentReference(input.documentType);
    const id = randomUUID();

    try {
      await db.insert(financialDocuments).values({
        id,
        documentReference,
        userId: input.userId,
        bookingId: input.bookingId ?? null,
        transactionId: input.transactionId ?? null,
        documentType: input.documentType,
        issuedByEntity: input.issuedByEntity ?? 'PetWash',
        documentPayloadJson: input.documentPayloadJson,
        renderedHtml: input.renderedHtml,
        renderedPdfUrl: null,
        idempotencyKey: input.idempotencyKey ?? null,
        issuedAt: new Date(),
        createdAt: new Date(),
      });

      logger.info('[FinancialDocumentService] Document created', {
        documentReference,
        documentType: input.documentType,
        userId: input.userId,
        bookingId: input.bookingId,
        transactionId: input.transactionId,
        idempotencyKey: input.idempotencyKey,
      });

      return documentReference;
    } catch (err: any) {
      // Handle unique constraint violation on idempotency_key (race condition)
      if (err?.message?.includes('idx_fin_doc_idempotency') || err?.code === '23505') {
        logger.info('[FinancialDocumentService] Race-condition duplicate blocked by unique index', {
          idempotencyKey: input.idempotencyKey,
        });
        return documentReference;
      }

      logger.error('[FinancialDocumentService] Failed to persist document', {
        error: err?.message,
        documentType: input.documentType,
        userId: input.userId,
      });
      return documentReference;
    }
  }

  /**
   * Retrieve all documents for a user (most recent first).
   */
  static async getForUser(userId: string, limit = 50) {
    try {
      const { desc } = await import('drizzle-orm');
      return await db
        .select()
        .from(financialDocuments)
        .where(eq(financialDocuments.userId, userId))
        .orderBy(desc(financialDocuments.issuedAt))
        .limit(limit);
    } catch (err: any) {
      logger.error('[FinancialDocumentService] getForUser failed', { error: err?.message });
      return [];
    }
  }

  /**
   * Retrieve a single document by its public reference (safe to expose in emails/receipts).
   */
  static async getByReference(documentReference: string) {
    try {
      const [row] = await db
        .select()
        .from(financialDocuments)
        .where(eq(financialDocuments.documentReference, documentReference))
        .limit(1);
      return row ?? null;
    } catch (err: any) {
      logger.error('[FinancialDocumentService] getByReference failed', { error: err?.message });
      return null;
    }
  }

  /**
   * Search documents by multiple criteria (admin use).
   */
  static async search(params: {
    userId?: string;
    bookingId?: string;
    transactionId?: string;
    documentType?: string;
    limit?: number;
  }) {
    try {
      const { and, desc } = await import('drizzle-orm');
      const conditions: any[] = [];
      if (params.userId) conditions.push(eq(financialDocuments.userId, params.userId));
      if (params.bookingId) conditions.push(eq(financialDocuments.bookingId, params.bookingId));
      if (params.transactionId) conditions.push(eq(financialDocuments.transactionId, params.transactionId));
      if (params.documentType) conditions.push(eq(financialDocuments.documentType, params.documentType));

      return await db
        .select()
        .from(financialDocuments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(financialDocuments.issuedAt))
        .limit(params.limit ?? 100);
    } catch (err: any) {
      logger.error('[FinancialDocumentService] search failed', { error: err?.message });
      return [];
    }
  }
}
