/**
 * SumitReceiptService — issue a consumer חשבונית מס/קבלה (tax-invoice/receipt) for a
 * COMPLETED customer payment, via SUMIT.
 *
 * Design rules:
 *  • FAIL-SAFE: never throws. A receipt failure must NEVER break or reverse the
 *    payment that already succeeded — callers fire-and-forget.
 *  • NO-OP unless SUMIT is wired (SUMIT_ENABLED=true + credentials). Sandbox by
 *    default (SUMIT_SANDBOX), so until the body shape is verified against the real
 *    SUMIT swagger this only issues SANDBOX documents — verify those before
 *    setting SUMIT_SANDBOX=false in production.
 *  • IDEMPOTENT via the caller-supplied idempotencyKey (same payment ⇒ same doc).
 *  • VAT-INCLUSIVE input: callers pass the gross amount the customer actually paid;
 *    we split it into net + VAT at ISRAEL_VAT_RATE.
 */
import { sumitClient } from './SumitClient';
import { ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';
import { logger } from '../lib/logger';

export interface CustomerReceiptInput {
  /** stable idempotency key for this cash-in (e.g. `nayax-<txId>`) */
  idempotencyKey: string;
  /** audit linkage persisted on the SUMIT side (e.g. voucherId / txId) */
  sourceRef: string;
  customerName: string;
  customerEmail?: string;
  /** GROSS amount the customer paid, VAT-inclusive, in ILS */
  totalAmountIls: number;
  description: string;
}

export interface CustomerReceiptResult {
  ok: boolean;
  sumitDocumentId?: string;
  reason?: string;
}

export class SumitReceiptService {
  static async issueCustomerReceipt(input: CustomerReceiptInput): Promise<CustomerReceiptResult> {
    try {
      const health = sumitClient.health();
      if (!health.wired) {
        // Expected today (SUMIT off / sandbox creds missing) — silent no-op.
        return { ok: false, reason: health.reason };
      }

      const total = Math.round(input.totalAmountIls * 100) / 100;
      if (!(total > 0)) return { ok: false, reason: 'non-positive amount' };
      const beforeVat = Math.round((total / (1 + ISRAEL_VAT_RATE)) * 100) / 100;
      const vatAmount = Math.round((total - beforeVat) * 100) / 100;

      const result = await sumitClient.createDocument({
        supplierInvoiceId: input.sourceRef,
        idempotencyKey: input.idempotencyKey,
        customer: {
          name: input.customerName?.trim() || 'PetWash Customer',
          businessNumber: '', // consumer receipt — no business number
          email: input.customerEmail,
        },
        amountBeforeVat: beforeVat,
        vatAmount,
        totalAmount: total,
        currency: 'ILS',
        description: input.description,
      });

      if (result.wired && result.sumitDocumentId) {
        logger.info('[SumitReceipt] Customer receipt issued', { sourceRef: input.sourceRef, docId: result.sumitDocumentId });
        return { ok: true, sumitDocumentId: result.sumitDocumentId };
      }
      return { ok: false, reason: result.reason || 'SUMIT returned no document id' };
    } catch (err: any) {
      // Best-effort: log and swallow so the payment flow is never affected.
      logger.error('[SumitReceipt] issueCustomerReceipt failed (non-fatal)', { sourceRef: input.sourceRef, err: err?.message });
      return { ok: false, reason: err?.message || 'unknown error' };
    }
  }
}
