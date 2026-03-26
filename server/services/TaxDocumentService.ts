/**
 * PetWash™ TaxDocumentService — Spec Section 5 & 8
 * ==================================================
 * Issues first-class accounting documents for every financial event.
 *
 * Document types (pw_tax_documents.document_type):
 *   RECEIPT              — anonymous K9000 walk-in receipt
 *   TOPUP_RECEIPT        — stored-value top-up (no VAT event, liability only)
 *   TAX_INVOICE          — חשבונית מס for service consumption (VAT event now)
 *   CREDIT_NOTE          — זיכוי on refund / reversal
 *   COMMISSION_INVOICE   — platform commission charged to provider
 *   CHARGEBACK_NOTICE    — chargeback dispute record
 *   ADJUSTMENT_NOTE      — manual admin adjustment memo
 *
 * RULES:
 *   - One document per financial event (never skip)
 *   - Documents are immutable once issued (void + reissue pattern)
 *   - Sequence number is monotonically assigned per document type per year
 *   - vatNumber must be confirmed with accountant (current: 516788400)
 */

import { nanoid } from 'nanoid';
import { db } from '../db';
import { pwTaxDocuments } from '@shared/schema-payments';
import { sql, eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { allocateTaxSequenceNumber, getTaxSeqLockKey } from './TaxSequenceService';
import { enqueueGoogleJob } from './AsyncJobWorker';

export type TaxDocumentType =
  | 'RECEIPT'
  | 'TOPUP_RECEIPT'
  | 'TAX_INVOICE'
  | 'CREDIT_NOTE'
  | 'COMMISSION_INVOICE'
  | 'CHARGEBACK_NOTICE'
  | 'ADJUSTMENT_NOTE';

export interface IssueTaxDocumentParams {
  documentType: TaxDocumentType;
  relatedPaymentId?: string;
  relatedPayoutId?: string;
  bookingId?: string;
  customerId?: string;
  providerId?: string;
  machineId?: string;
  grossCents: number;
  vatCents: number;
  netCents: number;
  payload?: Record<string, unknown>;
}

const COMPANY_VAT_NUMBER = process.env.COMPANY_VAT_NUMBER || '516788400';

function genTaxDocId(): string {
  return `TAX-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
}

/**
 * Issue a new tax document.
 * Returns the taxDocId of the created record.
 * Never throws — logs and returns null on failure so the calling flow is not blocked.
 */
export async function issueTaxDocument(params: IssueTaxDocumentParams): Promise<string | null> {
  const taxDocId = genTaxDocId();

  try {
    // Outer advisory lock held across sequence allocation AND INSERT.
    // pg_advisory_lock is reentrant: allocateTaxSequenceNumber acquires the same
    // key internally and its finally decrements the refcount 2→1 (lock stays held).
    // The INSERT completes while refcount=1. The outer finally drops it to 0.
    // This closes the race window where two concurrent requests could read the
    // same MAX before either inserts, producing duplicate ITA sequence numbers.
    const lockYear = new Date().getFullYear();
    const outerLockKey = getTaxSeqLockKey(params.documentType, lockYear);
    await db.execute(sql`SELECT pg_advisory_lock(${outerLockKey})`);

    let year = 0;
    let sequenceNumber = 0;
    try {
      ({ year, sequenceNumber } = await allocateTaxSequenceNumber(
        params.documentType as any,
      ));

      await db.insert(pwTaxDocuments).values({
        taxDocId,
        documentType:     params.documentType,
        relatedPaymentId: params.relatedPaymentId ?? null,
        relatedPayoutId:  params.relatedPayoutId ?? null,
        bookingId:        params.bookingId ?? null,
        customerId:       params.customerId ?? null,
        providerId:       params.providerId ?? null,
        machineId:        params.machineId ?? null,
        grossCents:       params.grossCents,
        vatCents:         params.vatCents,
        netCents:         params.netCents,
        vatNumber:        COMPANY_VAT_NUMBER,
        sequenceYear:     year,
        sequenceNumber,
        payload:          params.payload ?? {},
        status:           'issued',
        issuedAt:         new Date(),
        // archiveStatus defaults to 'PENDING' — Drive upload queued below
      } as any);
    } finally {
      await db.execute(sql`SELECT pg_advisory_unlock(${outerLockKey})`).catch(() => {});
    }

    logger.info('[TaxDocument] Document issued', {
      taxDocId,
      documentType: params.documentType,
      relatedPaymentId: params.relatedPaymentId,
      grossCents: params.grossCents,
      vatCents: params.vatCents,
      sequenceYear: year,
      sequenceNumber,
    });

    // Queue Drive PDF archival asynchronously — never blocks this call
    enqueueGoogleJob({
      jobType:    'ARCHIVE_TAX_DOCUMENT_TO_DRIVE',
      entityType: 'TAX_DOCUMENT',
      entityId:   taxDocId,
    }).catch(() => {/* already logged inside enqueueGoogleJob */});

    return taxDocId;
  } catch (err: any) {
    logger.error('[TaxDocument] Failed to issue document — flow continues', {
      taxDocId,
      documentType: params.documentType,
      relatedPaymentId: params.relatedPaymentId,
      err: err.message,
    });
    return null;
  }
}

/**
 * Void an existing document and issue a replacement.
 * Used for amendments (e.g. price correction after invoice issued).
 */
export async function voidAndReissue(
  originalTaxDocId: string,
  replacement: IssueTaxDocumentParams,
  reason: string,
): Promise<{ voidedId: string; newId: string | null }> {
  await db
    .update(pwTaxDocuments)
    .set({ status: 'voided', voidedAt: new Date() })
    .where(eq(pwTaxDocuments.taxDocId, originalTaxDocId));

  logger.info('[TaxDocument] Document voided', { originalTaxDocId, reason });

  const newId = await issueTaxDocument({
    ...replacement,
    payload: { ...(replacement.payload ?? {}), voidedReplaces: originalTaxDocId, voidReason: reason },
  });

  return { voidedId: originalTaxDocId, newId };
}

/**
 * Look up the tax document linked to a payment.
 */
export async function getTaxDocByPaymentId(paymentId: string): Promise<typeof pwTaxDocuments.$inferSelect | null> {
  const [doc] = await db
    .select()
    .from(pwTaxDocuments)
    .where(eq(pwTaxDocuments.relatedPaymentId, paymentId))
    .limit(1);
  return doc ?? null;
}
