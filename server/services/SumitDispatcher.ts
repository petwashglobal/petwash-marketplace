/**
 * SUMIT dispatcher — Mission-4 strategy router.
 *
 * Reads SystemConfig 'sumit.mode' and routes a send to the appropriate
 * integration:
 *   off        → reject; no side effects.
 *   email      → SumitEmailDispatcher (live; uses guarded SendGrid).
 *   api        → SumitClient HTTP call (currently returns wired:false
 *                until the SUMIT swagger spec lands).
 *   csv_export → not implemented yet; reject with explanatory reason.
 *
 * This sits ABOVE SupplierInvoiceSumitSendService.send() — that service
 * still owns: idempotency-key derivation, sumit_outbound_events row
 * write, supplier_invoices column updates, recordAuditEvent. We provide
 * only the per-mode "deliver this payload" step.
 */

import { systemConfig } from './SystemConfig';
import { sumitEmailDispatcher } from './SumitEmailDispatcher';
import { sumitClient } from './SumitClient';
import { logger } from '../lib/logger';
import type { SupplierInvoice } from '../../shared/schema';

export type SumitMode = 'off' | 'email' | 'api' | 'csv_export';

export interface DispatchInput {
  invoice: SupplierInvoice;
  supplierName: string;
  idempotencyKey: string;
}

export interface DispatchResult {
  /** True iff the document was successfully handed off via the active mode. */
  sent: boolean;
  /** Mode that was used (echoed for the audit row). */
  mode: SumitMode;
  /**
   * Identifier suitable for persisting on supplier_invoices.sumit_document_id.
   * Shape varies by mode:
   *   email      → "email:<idempotencyKey>"
   *   api        → SUMIT's assigned document id (when wired)
   *   csv_export → "csv:<idempotencyKey>" (later)
   *   off / failure → null
   */
  sumitDocumentId: string | null;
  reason?: string;
  rawResponse?: unknown;
}

class SumitDispatcher {
  currentMode(): SumitMode {
    return systemConfig.get('sumit.mode');
  }

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    const mode = this.currentMode();

    if (mode === 'off') {
      return {
        sent: false,
        mode,
        sumitDocumentId: null,
        reason: 'SUMIT activation mode is off (SystemConfig sumit.mode = off)',
      };
    }

    if (mode === 'email') {
      const r = await sumitEmailDispatcher.send({
        invoice: input.invoice,
        supplierName: input.supplierName,
        idempotencyKey: input.idempotencyKey,
      });
      return {
        sent: r.sent,
        mode,
        sumitDocumentId: r.sent ? r.pseudoDocumentId : null,
        reason: r.reason,
      };
    }

    if (mode === 'api') {
      // The SUMIT swagger spec is still gated behind an authenticated
      // session that this environment cannot reach (403 from
      // app.sumit.co.il/help/developers/swagger/*). Until the spec is
      // available, SumitClient.createDocument returns wired:false and
      // does NOT make an HTTP call. When the spec lands, real HTTP fires
      // here with no change to dispatch logic.
      const r = await sumitClient.createDocument({
        supplierInvoiceId: String(input.invoice.id),
        idempotencyKey: input.idempotencyKey,
        customer: {
          name: input.supplierName,
          businessNumber: input.invoice.ocrBusinessNumber ?? '',
        },
        amountBeforeVat: Number(input.invoice.ocrAmountBeforeVat ?? 0),
        vatAmount: Number(input.invoice.ocrVatAmount ?? 0),
        totalAmount: Number(input.invoice.ocrTotalAmount ?? 0),
        currency: 'ILS',
        description:
          input.invoice.ocrInvoiceNumber
            ? `Supplier invoice #${input.invoice.ocrInvoiceNumber}`
            : `Supplier invoice ${input.invoice.id}`,
      });
      return {
        sent: r.wired && Boolean(r.sumitDocumentId),
        mode,
        sumitDocumentId: r.sumitDocumentId ?? null,
        reason: r.reason,
        rawResponse: r.rawResponse,
      };
    }

    if (mode === 'csv_export') {
      logger.info('[SumitDispatcher] csv_export requested but not implemented', {
        invoiceId: input.invoice.id,
      });
      return {
        sent: false,
        mode,
        sumitDocumentId: null,
        reason: 'csv_export mode is not implemented yet — switch sumit.mode to email or api',
      };
    }

    return {
      sent: false,
      mode: 'off',
      sumitDocumentId: null,
      reason: `Unknown sumit.mode value: ${mode}`,
    };
  }
}

export const sumitDispatcher = new SumitDispatcher();
