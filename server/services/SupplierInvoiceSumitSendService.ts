/**
 * Supplier-Invoice → SUMIT Send Service (PR-S4).
 *
 * Triggered by the admin "Send to SUMIT" click on an invoice that has
 * already reached `status='ready_for_accountant'`. Wraps SumitClient,
 * writes the outbound audit row, persists SUMIT linkage fields on
 * supplier_invoices, and records a recordAuditEvent line for every
 * human-driven send (per petwash-platform §2).
 *
 * No autonomous calls. Every invocation here is the direct result of
 * a Firebase-authenticated admin click. Gemini never reaches this
 * service.
 *
 * The whole flow is double-gated:
 *   1. ff.supplier_invoice_control.enabled (parent screening flag)
 *   2. ff.supplier_invoice_control.sumit_send.enabled (THIS flag)
 * The route returns 404 unless BOTH are ON. The service additionally
 * delegates to sumitClient.health().wired — when SUMIT's own env is
 * not set, this service refuses to send and surfaces wired:false to
 * the caller (the admin UI shows "configure SUMIT credentials first").
 */

import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
  supplierInvoices,
  sumitOutboundEvents,
  type SupplierInvoice,
} from '../../shared/schema';
import { sumitClient } from './SumitClient';
import { recordAuditEvent } from '../utils/auditSignature';
import { logger } from '../lib/logger';

export interface SumitSendInput {
  invoiceId: number;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  ipAddress: string;
  userAgent: string;
}

export interface SumitSendResult {
  /** Did SUMIT actually accept the document? */
  sent: boolean;
  /** SUMIT-assigned document id when sent:true */
  sumitDocumentId?: string;
  /** Current persisted sumit_status on the invoice */
  sumitStatus: 'pending' | 'sent' | 'confirmed' | 'failed';
  /** Human-readable reason; populated when sent:false */
  reason?: string;
  /** True if SUMIT integration itself is not wired (env missing) */
  wired: boolean;
}

class SupplierInvoiceSumitSendService {
  /**
   * Deterministic idempotency key. Same invoice + same file hash always
   * produces the same key so SUMIT can dedupe on retries. Truncated SHA-256
   * to stay under the DB column length (varchar(80)).
   */
  private buildIdempotencyKey(invoice: SupplierInvoice): string {
    const seed = `inv:${invoice.id}:${invoice.fileHash}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 48);
    return `petwash_sumit_${invoice.id}_${hash}`;
  }

  async send(input: SumitSendInput): Promise<SumitSendResult> {
    const invoice = await db
      .select()
      .from(supplierInvoices)
      .where(eq(supplierInvoices.id, input.invoiceId))
      .limit(1)
      .then(rows => rows[0]);

    if (!invoice) {
      const err = new Error('Invoice not found') as Error & { code?: string };
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (invoice.status !== 'ready_for_accountant') {
      const err = new Error(
        `Cannot send to SUMIT: invoice status is '${invoice.status}', expected 'ready_for_accountant'`
      ) as Error & { code?: string };
      err.code = 'INVALID_STATE';
      throw err;
    }

    if (invoice.sumitStatus === 'sent' || invoice.sumitStatus === 'confirmed') {
      const err = new Error(
        `Invoice already sent to SUMIT (status='${invoice.sumitStatus}', doc=${invoice.sumitDocumentId})`
      ) as Error & { code?: string };
      err.code = 'INVALID_STATE';
      throw err;
    }

    const health = sumitClient.health();
    if (!health.wired) {
      logger.warn('[SumitSend] Admin clicked send but SUMIT is not wired', {
        invoiceId: invoice.id,
        actorEmail: input.actorEmail,
      });
      return {
        sent: false,
        sumitStatus: invoice.sumitStatus as SumitSendResult['sumitStatus'] ?? 'pending',
        reason: health.reason,
        wired: false,
      };
    }

    const idempotencyKey = invoice.sumitIdempotencyKey ?? this.buildIdempotencyKey(invoice);
    const description =
      invoice.ocrInvoiceNumber
        ? `Supplier invoice #${invoice.ocrInvoiceNumber}`
        : `Supplier invoice ${invoice.id}`;

    let outboundResult: Awaited<ReturnType<typeof sumitClient.createDocument>>;
    let errorMessage: string | null = null;
    let responseStatusCode: number | null = null;
    try {
      outboundResult = await sumitClient.createDocument({
        supplierInvoiceId: String(invoice.id),
        idempotencyKey,
        customer: {
          name: invoice.ocrSupplierName ?? `Supplier ${invoice.supplierId ?? 'unknown'}`,
          businessNumber: invoice.ocrBusinessNumber ?? '',
        },
        amountBeforeVat: Number(invoice.ocrAmountBeforeVat ?? 0),
        vatAmount: Number(invoice.ocrVatAmount ?? 0),
        totalAmount: Number(invoice.ocrTotalAmount ?? 0),
        currency: 'ILS',
        description,
      });
      responseStatusCode = outboundResult.wired ? 200 : 0;
    } catch (e) {
      errorMessage = (e as Error).message;
      outboundResult = { wired: false, idempotencyKey, reason: errorMessage };
      responseStatusCode = -1;
    }

    // Always write an outbound event — succeeded or failed.
    await db.insert(sumitOutboundEvents).values({
      invoiceId: invoice.id,
      eventType: 'create_document',
      direction: 'outbound',
      sumitDocumentId: outboundResult.sumitDocumentId ?? null,
      idempotencyKey,
      requestPayload: {
        description,
        currency: 'ILS',
        amountBeforeVat: Number(invoice.ocrAmountBeforeVat ?? 0),
        vatAmount: Number(invoice.ocrVatAmount ?? 0),
        totalAmount: Number(invoice.ocrTotalAmount ?? 0),
      },
      responseStatusCode,
      responseBody: outboundResult.rawResponse ? (outboundResult.rawResponse as object) : null,
      errorMessage,
      actor: input.actorEmail,
    });

    const succeeded = outboundResult.wired && Boolean(outboundResult.sumitDocumentId);
    const nextStatus: 'sent' | 'failed' = succeeded ? 'sent' : 'failed';

    await db
      .update(supplierInvoices)
      .set({
        sumitDocumentId: outboundResult.sumitDocumentId ?? invoice.sumitDocumentId,
        sumitStatus: nextStatus,
        sumitSentAt: succeeded ? new Date() : invoice.sumitSentAt,
        sumitIdempotencyKey: idempotencyKey,
        sumitLastError: succeeded ? null : (errorMessage ?? outboundResult.reason ?? 'unknown'),
        updatedAt: new Date(),
      })
      .where(eq(supplierInvoices.id, invoice.id));

    await recordAuditEvent({
      eventType: succeeded ? 'supplier_invoice_sumit_sent' : 'supplier_invoice_sumit_send_failed',
      customerUid: input.actorUid,
      metadata: {
        invoiceId: invoice.id,
        supplierId: invoice.supplierId,
        actorEmail: input.actorEmail,
        actorRole: input.actorRole,
        sumitDocumentId: outboundResult.sumitDocumentId ?? null,
        idempotencyKey,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        errorMessage: errorMessage ?? outboundResult.reason ?? null,
      },
    });

    return {
      sent: succeeded,
      sumitDocumentId: outboundResult.sumitDocumentId,
      sumitStatus: nextStatus,
      reason: succeeded ? undefined : (errorMessage ?? outboundResult.reason),
      wired: outboundResult.wired,
    };
  }
}

export const supplierInvoiceSumitSendService = new SupplierInvoiceSumitSendService();
