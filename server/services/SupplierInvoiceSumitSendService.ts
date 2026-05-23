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
import { sumitDispatcher } from './SumitDispatcher';
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

    const idempotencyKey = invoice.sumitIdempotencyKey ?? this.buildIdempotencyKey(invoice);
    const description =
      invoice.ocrInvoiceNumber
        ? `Supplier invoice #${invoice.ocrInvoiceNumber}`
        : `Supplier invoice ${invoice.id}`;

    // Mission-4: route through the dispatcher (mode = off/email/api/csv_export).
    // The dispatcher already short-circuits when sumit.mode === 'off'. We map
    // its result back into the shape this service has always exposed so the
    // route + UI contract stays unchanged.
    let dispatchResult: Awaited<ReturnType<typeof sumitDispatcher.dispatch>>;
    let errorMessage: string | null = null;
    let responseStatusCode: number | null = null;
    try {
      dispatchResult = await sumitDispatcher.dispatch({
        invoice,
        supplierName:
          invoice.ocrSupplierName ?? `Supplier ${invoice.supplierId ?? 'unknown'}`,
        idempotencyKey,
      });
      responseStatusCode = dispatchResult.sent ? 200 : 0;
      if (!dispatchResult.sent && dispatchResult.reason) {
        errorMessage = dispatchResult.reason;
      }
    } catch (e) {
      errorMessage = (e as Error).message;
      dispatchResult = {
        sent: false,
        mode: sumitDispatcher.currentMode(),
        sumitDocumentId: null,
        reason: errorMessage,
      };
      responseStatusCode = -1;
    }

    // Adapter back to the legacy `outboundResult` shape the rest of the
    // function uses. Keep this thin so the dispatcher stays the single
    // source of truth for per-mode delivery.
    const outboundResult = {
      wired: dispatchResult.sent,
      idempotencyKey,
      sumitDocumentId: dispatchResult.sumitDocumentId ?? undefined,
      reason: dispatchResult.reason,
      rawResponse: dispatchResult.rawResponse,
    };

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
        mode: dispatchResult.mode,
        errorMessage: errorMessage ?? outboundResult.reason ?? null,
      },
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
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
