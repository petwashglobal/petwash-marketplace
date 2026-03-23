/**
 * PETWASH™ FINANCIAL DOCUMENT SERVICE
 *
 * Stores a rendered HTML record for every financial event on the platform.
 * PetWash is merchant of record:
 *   - Customers receive: booking_receipt, egift_receipt, membership_receipt
 *   - Providers receive:  booking_earnings_notice, provider_payout_statement
 *
 * Documents are immutable audit artefacts. One row per financial event per party.
 * Always call this BEFORE dispatching notifications (backend record first).
 */

import { db } from '../db';
import { financialDocuments } from '@shared/schema';
import { logger } from '../lib/logger';
import { randomUUID } from 'crypto';

export type FinancialDocumentType =
  | 'booking_receipt'
  | 'booking_earnings_notice'
  | 'egift_receipt'
  | 'membership_receipt'
  | 'provider_payout_statement';

export interface CreateFinancialDocumentInput {
  userId: string;
  bookingId?: string;
  transactionId?: string;
  documentType: FinancialDocumentType;
  issuedByEntity?: string;
  documentPayloadJson: Record<string, unknown>;
  renderedHtml: string;
}

const REFERENCE_PREFIXES: Record<FinancialDocumentType, string> = {
  booking_receipt:           'PW-RCP',
  booking_earnings_notice:   'PW-ERN',
  egift_receipt:             'PW-EGF',
  membership_receipt:        'PW-MBR',
  provider_payout_statement: 'PW-PAY',
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
   */
  static async create(input: CreateFinancialDocumentInput): Promise<string> {
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
        issuedAt: new Date(),
        createdAt: new Date(),
      });

      logger.info('[FinancialDocumentService] Document created', {
        documentReference,
        documentType: input.documentType,
        userId: input.userId,
        bookingId: input.bookingId,
        transactionId: input.transactionId,
      });

      return documentReference;
    } catch (err: any) {
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
      const rows = await db
        .select()
        .from(financialDocuments)
        .where(
          (await import('drizzle-orm')).eq(financialDocuments.userId, userId)
        )
        .orderBy((await import('drizzle-orm')).desc(financialDocuments.issuedAt))
        .limit(limit);
      return rows;
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
      const { eq } = await import('drizzle-orm');
      const rows = await db
        .select()
        .from(financialDocuments)
        .where(eq(financialDocuments.documentReference, documentReference))
        .limit(1);
      return rows[0] ?? null;
    } catch (err: any) {
      logger.error('[FinancialDocumentService] getByReference failed', { error: err?.message });
      return null;
    }
  }
}
