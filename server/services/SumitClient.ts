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
 *
 * Mission-5: SUMIT_SANDBOX = 'true' routes calls to SUMIT's sandbox
 * environment. When unset/false, calls go to production. Default is
 * SANDBOX-ON so a misconfigured deploy never accidentally hits prod
 * SUMIT — operator must explicitly opt-in to production by setting
 * SUMIT_SANDBOX='false' (the only allowed string for prod).
 */
function readEnv() {
  const explicitSandbox = process.env.SUMIT_SANDBOX;
  // Sandbox defaults to TRUE. Only the explicit string 'false' opts
  // into production. Any other value (including unset) → sandbox.
  const sandbox = explicitSandbox !== 'false';
  const defaultBase = sandbox
    ? 'https://sandbox-api.sumit.co.il'
    : 'https://api.sumit.co.il';
  return {
    baseUrl: process.env.SUMIT_API_BASE_URL || defaultBase,
    apiKey: process.env.SUMIT_API_KEY,
    companyId: process.env.SUMIT_COMPANY_ID,
    webhookSecret: process.env.SUMIT_WEBHOOK_SECRET,
    enabled: process.env.SUMIT_ENABLED === 'true',
    sandbox,
  };
}

/**
 * Pull the SUMIT-assigned document id out of an arbitrarily-shaped JSON
 * response. SUMIT's exact field name is not verified in this PR — try
 * common variants in priority order. If none match, return undefined
 * (caller treats as a partial success and surfaces the raw response in
 * the outbound audit row).
 */
function extractDocumentId(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const b = body as Record<string, unknown>;
  // Try known/likely shapes:
  const candidates = [
    b.DocumentNumber,
    b.documentNumber,
    (b.Document as Record<string, unknown> | undefined)?.DocumentNumber,
    (b.Document as Record<string, unknown> | undefined)?.Number,
    b.DocumentID,
    b.documentId,
    b.ID,
    b.id,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (typeof c === 'number' && Number.isFinite(c)) return String(c);
  }
  return undefined;
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
   * POST /accounting/documents/create/
   *
   * Mission-5: real HTTP call to SUMIT (sandbox by default).
   *
   * BODY SHAPE WARNING (see also docs/finance/sumit-api-known-vs-assumed-2026-05-23.md):
   * The exact field names below are based on the public SUMIT capability
   * surface + the SDD's documented body-embedded Credentials pattern,
   * NOT the authenticated swagger spec (which is gated behind a SUMIT
   * login this environment cannot reach). When the real swagger lands:
   *   - verify the top-level keys (PascalCase per .NET convention?
   *     camelCase? snake_case?)
   *   - verify the document-type enum (TaxInvoice / חשבונית מס mapping)
   *   - verify the items array vs single-line shorthand
   * Until verified, this MUST run against SUMIT_SANDBOX=true. The
   * dispatcher (Mission-4 SumitDispatcher) is responsible for never
   * letting a production send fire without explicit operator approval.
   */
  async createDocument(input: SumitDocumentInput): Promise<SumitDocumentResult> {
    const env = readEnv();
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
          'SumitClient not wired — set SUMIT_ENABLED=true plus all credentials',
      };
    }

    // Body shape: body-embedded Credentials per SDD.
    // The "Items" array uses one line per invoice. Quantity 1, unit price
    // = amount-before-vat (SUMIT applies VAT per item per its own rules).
    const body = {
      Credentials: {
        CompanyID: env.companyId,
        APIKey: env.apiKey,
      },
      // 1 = TaxInvoice (חשבונית מס). VERIFY against swagger when
      // available — could also be 2/3/n.
      DocumentType: 1,
      Customer: {
        Name: input.customer.name,
        SearchMode: 0,
        ExternalIdentifier: input.customer.businessNumber || undefined,
        EmailAddress: input.customer.email || undefined,
      },
      Items: [
        {
          Item: { Name: input.description },
          Quantity: 1,
          UnitPrice: input.amountBeforeVat,
          Currency: input.currency,
          // VAT rules per SUMIT's per-item config; we leave them to compute.
        },
      ],
      // Idempotency hint — exact field name unverified. Sending both
      // common variants (ExternalIdentifier on the doc root, plus a
      // header) for resilience until verified.
      ExternalIdentifier: input.idempotencyKey,
    };

    const url = `${env.baseUrl}/accounting/documents/create/`;
    const startMs = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // Idempotency-Key header — RFC-style; SUMIT may or may not
          // honor it. Belt-and-braces with the body field above.
          'Idempotency-Key': input.idempotencyKey,
          'X-PetWash-Sandbox': env.sandbox ? 'true' : 'false',
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      const msg = (networkErr as Error).message;
      logger.error('[SumitClient] network error', {
        supplierInvoiceId: input.supplierInvoiceId,
        url,
        elapsedMs: Date.now() - startMs,
        err: msg,
      });
      return {
        wired: false,
        idempotencyKey: input.idempotencyKey,
        reason: `Network error: ${msg}`,
      };
    }

    let parsedBody: unknown = null;
    try {
      parsedBody = await res.json();
    } catch {
      // SUMIT may return an empty/non-JSON body on some error paths.
    }

    if (!res.ok) {
      logger.warn('[SumitClient] non-2xx', {
        supplierInvoiceId: input.supplierInvoiceId,
        status: res.status,
        url,
        sandbox: env.sandbox,
        elapsedMs: Date.now() - startMs,
      });
      return {
        wired: true,
        idempotencyKey: input.idempotencyKey,
        reason: `SUMIT returned ${res.status}`,
        rawResponse: parsedBody,
      };
    }

    // Extract the SUMIT-assigned document id. Field name unverified;
    // try common variants in order.
    const sumitDocumentId = extractDocumentId(parsedBody);

    logger.info('[SumitClient] document created', {
      supplierInvoiceId: input.supplierInvoiceId,
      sumitDocumentId,
      sandbox: env.sandbox,
      elapsedMs: Date.now() - startMs,
    });

    return {
      wired: true,
      idempotencyKey: input.idempotencyKey,
      sumitDocumentId,
      rawResponse: parsedBody,
    };
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
