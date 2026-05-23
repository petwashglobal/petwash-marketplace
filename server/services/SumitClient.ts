/**
 * SUMIT Client (sumit.co.il)
 *
 * Read-only stub. NOT wired to any caller. NOT mounted on any route.
 * NO feature flag flips this on yet. health() returns wired:false until
 * a future PR (PR-S4) adds the admin "Send to SUMIT" button + flag.
 *
 * Why exist now: gives a single, audited place where every future SUMIT
 * call will live (createDocument, multivendorcharge, webhook verification)
 * so wiring it later is a one-PR change, not a refactor.
 *
 * Companion: docs/finance/sumit-readiness-check-2026-05-23.md
 * Design:    docs/design/2026-05-22-supplier-invoice-sumit-fraud-control.md
 *
 * Required env for production (validated for presence only in
 * server/lib/payment-provider-mode.ts; not read until SUMIT_ENABLED=true):
 *   SUMIT_API_KEY         — merchant API key, body-embedded per SDD
 *   SUMIT_COMPANY_ID      — marketplace company id
 *   SUMIT_WEBHOOK_SECRET  — HMAC secret for inbound webhooks
 *   SUMIT_API_BASE_URL    — (optional) default https://api.sumit.co.il
 *   SUMIT_APP_NAME        — (optional) X-App-Name header value
 */

import crypto from 'crypto';
import { logger } from '../lib/logger';

/**
 * Env is read on every call (not cached at module load) so tests can
 * mutate process.env per case and ops can flip SUMIT_ENABLED without a
 * process restart. Cost is negligible — these are property reads.
 */
function readEnv() {
  return {
    baseUrl: process.env.SUMIT_API_BASE_URL || 'https://api.sumit.co.il',
    apiKey: process.env.SUMIT_API_KEY,
    companyId: process.env.SUMIT_COMPANY_ID,
    webhookSecret: process.env.SUMIT_WEBHOOK_SECRET,
    enabled: process.env.SUMIT_ENABLED === 'true',
  };
}

/**
 * The client is "wired" only when ALL of these are true:
 *  - SUMIT_ENABLED=true
 *  - SUMIT_API_KEY present
 *  - SUMIT_COMPANY_ID present
 *  - SUMIT_WEBHOOK_SECRET present
 *
 * At time of writing (May 2026) none of the env is set in production
 * and no caller exists, so isWired() always returns false.
 */
function isWired(): boolean {
  const e = readEnv();
  return e.enabled && Boolean(e.apiKey) && Boolean(e.companyId) && Boolean(e.webhookSecret);
}

export interface SumitHealth {
  wired: boolean;
  reason: string;
  baseUrl: string;
  companyIdConfigured: boolean;
  webhookSecretConfigured: boolean;
}

export interface SumitDocumentInput {
  /** PetWash supplier_invoices.id — used for idempotency + audit linkage */
  supplierInvoiceId: string;
  /** stable idempotency key — same input must produce same SUMIT document */
  idempotencyKey: string;
  /** customer / vendor details required by SUMIT */
  customer: {
    name: string;
    businessNumber: string;
    email?: string;
  };
  /** line items + totals already validated by the screening pipeline */
  amountBeforeVat: number;
  vatAmount: number;
  totalAmount: number;
  currency: 'ILS';
  description: string;
}

export interface SumitDocumentResult {
  wired: boolean;
  /** SUMIT-assigned document id (only when wired:true and call succeeded) */
  sumitDocumentId?: string;
  /** echoed back for the caller to persist on supplier_invoices.sumit_idempotency_key */
  idempotencyKey: string;
  /** wired:false reason string when not actually sent */
  reason?: string;
  /** raw response body for the outbound audit log */
  rawResponse?: unknown;
}

/**
 * Stub client. No HTTP calls fire in this PR. Every method that would talk
 * to api.sumit.co.il is currently a no-op that returns wired:false + the
 * reason. PR-S4 will replace these stubs with real fetch() calls behind
 * the ff.supplier_invoice_control.sumit_send.enabled feature flag.
 */
export class SumitClient {
  health(): SumitHealth {
    const e = readEnv();
    const wired = isWired();
    return {
      wired,
      reason: wired
        ? 'SUMIT_ENABLED=true and all credentials present'
        : 'SUMIT not enabled or credentials missing (expected in current PR)',
      baseUrl: e.baseUrl,
      companyIdConfigured: Boolean(e.companyId),
      webhookSecretConfigured: Boolean(e.webhookSecret),
    };
  }

  /**
   * Will POST /accounting/documents/create/ when wired. For now it logs
   * the intent and returns wired:false. The caller must NOT persist
   * sumit_document_id when wired:false.
   */
  async createDocument(input: SumitDocumentInput): Promise<SumitDocumentResult> {
    if (!isWired()) {
      logger.info('[SumitClient] createDocument called while not wired', {
        supplierInvoiceId: input.supplierInvoiceId,
        idempotencyKey: input.idempotencyKey,
        totalAmount: input.totalAmount,
      });
      return {
        wired: false,
        idempotencyKey: input.idempotencyKey,
        reason:
          'SumitClient stub — not wired. Real send arrives with PR-S4 once ff.supplier_invoice_control.sumit_send.enabled is ON.',
      };
    }

    throw new Error(
      'SumitClient.createDocument live path not implemented yet — see PR-S4'
    );
  }

  /**
   * HMAC-verify an inbound SUMIT webhook payload. Returns false when
   * SUMIT_WEBHOOK_SECRET is unset so the receiver can short-circuit and
   * 401 the request. Constant-time compare to defeat timing attacks.
   */
  verifyWebhookSignature(rawBody: string | Buffer, headerSignature: string | undefined): boolean {
    const { webhookSecret } = readEnv();
    if (!webhookSecret) {
      logger.warn('[SumitClient] webhook verify called without SUMIT_WEBHOOK_SECRET');
      return false;
    }
    if (!headerSignature) {
      return false;
    }

    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    let receivedBuf: Buffer;
    try {
      receivedBuf = Buffer.from(headerSignature, 'hex');
    } catch {
      return false;
    }
    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  }
}

export const sumitClient = new SumitClient();
