/**
 * SUMIT Client (sumit.co.il)
 *
 * ⚠️ LIVE (updated 2026-07-08): this header formerly said "read-only stub, not
 * wired". That is NO LONGER TRUE. SumitClient is imported by shop.ts,
 * payments-sumit.ts, sumit-webhook.ts, IsraeliDigitalReceiptService,
 * SumitReceiptService, PurchaseActivationService, admin-sumit and the SumitSync
 * services, and it fires live HTTP against https://api.sumit.co.il
 * (/accounting/documents/create/, /billing/payments/beginredirect/). Do NOT
 * treat it as a no-op — gutting or disabling it stops real fiscal documents
 * (official Israeli חשבונית/קבלה) from being issued.
 *
 * It is the single, audited place where every SUMIT call lives (createDocument,
 * multivendorcharge, webhook verification). Auth = body-embedded
 * Credentials:{CompanyID, APIKey}; single base host.
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
 * SANDBOX MODEL (verified from SUMIT public docs 2026-05-25): SUMIT does
 * NOT host a separate sandbox endpoint. There is one base URL —
 * https://api.sumit.co.il/ — and sandbox vs production is selected
 * entirely by which Company/APIKey credentials you send. A "testing
 * organization" with test credit cards is provisioned on the SUMIT side;
 * the API caller just uses those credentials.
 *
 * SUMIT_SANDBOX='true' (default) is therefore a CALLER-SIDE FLAG only:
 *   - logs every outbound call as sandbox so we can audit which env we
 *     thought we were talking to
 *   - sends X-PetWash-Sandbox:true header so SUMIT side can correlate
 *   - prevents an accidentally-set production credential from being
 *     interpreted as production until the operator explicitly opts in
 *     with SUMIT_SANDBOX='false'
 *
 * Previous versions of this file pointed sandbox at
 * `https://sandbox-api.sumit.co.il/` which does NOT EXIST IN DNS —
 * NXDOMAIN. Any caller in sandbox mode would have thrown ENOTFOUND.
 * Fixed: same base URL for both modes; the credential pair determines
 * which org / which cards are charged.
 */
function readEnv() {
  const explicitSandbox = process.env.SUMIT_SANDBOX;
  // Sandbox defaults to TRUE. Only the explicit string 'false' opts
  // into production. Any other value (including unset) → sandbox.
  const sandbox = explicitSandbox !== 'false';
  return {
    // SUMIT exposes ONE base URL. Override via SUMIT_API_BASE_URL is
    // retained for tests / mocks only — there is no real alternate host.
    baseUrl: process.env.SUMIT_API_BASE_URL || 'https://api.sumit.co.il',
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
 * Callers exist (IsraeliDigitalReceiptService issues customer receipts + credit
 * documents through this client). Until SUMIT_ENABLED=true and all creds are set
 * in prod, isWired() returns false and every method is a safe no-op — but it goes
 * live the instant those are set. Not inert.
 */
function isWired(): boolean {
  const e = readEnv();
  return e.enabled && Boolean(e.apiKey) && Boolean(e.companyId) && Boolean(e.webhookSecret);
}

/**
 * A short, safe preview of a SUMIT response for diagnostics — so the FIRST live
 * call reveals the real field shape (the request/response keys are UNVERIFIED
 * against SUMIT's authenticated spec). Never logs raw card data: a defensive
 * scrub drops any obvious PAN-like key, and the whole thing is length-capped.
 */
function safePreview(obj: unknown): string {
  try {
    const json = JSON.stringify(obj, (k, v) =>
      /pan|cardnumber|card_number|cvv|cvc|track/i.test(k) ? '[redacted]' : v,
    );
    if (!json) return String(obj);
    return json.length > 1500 ? json.slice(0, 1500) + '…(truncated)' : json;
  } catch {
    return '[unserializable]';
  }
}

/**
 * Last-resort extraction of a hosted-payment-page URL from an unknown SUMIT
 * response shape: recursively find the first https URL string. Only used after
 * every known field name misses, so an unexpected key still routes the customer
 * to SUMIT instead of a silent 502.
 */
function deepFindUrl(obj: unknown, depth = 0): string | undefined {
  if (obj == null || depth > 6) return undefined;
  if (typeof obj === 'string') {
    return /^https:\/\/\S+/i.test(obj.trim()) ? obj.trim() : undefined;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) { const u = deepFindUrl(v, depth + 1); if (u) return u; }
    return undefined;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      const u = deepFindUrl(v, depth + 1); if (u) return u;
    }
  }
  return undefined;
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
 * LIVE client (2026-07-09: corrected the stale "stub" note below). Every method
 * — createDocument, createCustomerReceipt, createCreditDocument, beginRedirect —
 * fires REAL fetch() HTTP against api.sumit.co.il when isWired() is true. It is a
 * no-op that returns {wired:false} ONLY while SUMIT is not wired (SUMIT_ENABLED
 * !== 'true' or a credential is missing). Do NOT treat this as inert: the moment
 * SUMIT_ENABLED=true and creds are set, these calls hit SUMIT for real. Callers
 * exist today (server/services/IsraeliDigitalReceiptService.ts).
 */
export class SumitClient {
  health(): SumitHealth {
    const e = readEnv();
    const wired = isWired();
    return {
      wired,
      reason: wired
        ? 'SUMIT_ENABLED=true and all credentials present'
        : 'SUMIT not enabled or credentials missing (set SUMIT_ENABLED=true + API key/company id/webhook secret to go live)',
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

    // Body shape verified against the OfficeGuy/SUMIT swagger (the public
    // ballasandballas/office_guy_api generated client, fetched 2026-06):
    //   { Credentials, Details: { Customer, Type, ... }, Items, Payments, VATIncluded }
    // — NOT a flat root with an integer DocumentType. `Details.Type` is a STRING
    // enum: "Invoice" = חשבונית מס (tax invoice), "InvoiceAndReceipt" = חשבונית
    // מס/קבלה (paid B2C), "Receipt" = קבלה, "CreditInvoice" = זיכוי, etc.
    // Customer lives INSIDE Details. Keys are OfficeGuy PascalCase JSON.
    // STILL verify exact key casing + the endpoint /api prefix in SANDBOX
    // (SUMIT_SANDBOX=true) before any production send — see
    // docs/finance/sumit-activation-checklist-2026-06-15.md.
    const body = {
      Credentials: {
        CompanyID: env.companyId,
        APIKey: env.apiKey,
      },
      Details: {
        // "Invoice" = חשבונית מס. For a document issued together with payment
        // use "InvoiceAndReceipt"; for a refund use "CreditInvoice".
        Type: 'Invoice',
        Customer: {
          Name: input.customer.name,
          // company_number = the customer's registered VAT/company number.
          CompanyNumber: input.customer.businessNumber || undefined,
          EmailAddress: input.customer.email || undefined,
          // external_identifier ties the SUMIT customer back to ours.
          ExternalIdentifier: input.customer.businessNumber || undefined,
        },
        Description: input.description,
        Currency: input.currency,
        // Enum NAME, not ISO code — 'he' is rejected by SUMIT
        // (verified live 2026-07-05, document #10000 walk).
        Language: 'Hebrew',
        // Document-level idempotency hint (plus the Idempotency-Key header below).
        // Swagger field is ExternalReference at Details level (ExternalIdentifier
        // exists only on Customer).
        ExternalReference: input.idempotencyKey,
      },
      Items: [
        {
          Item: { Name: input.description },
          Quantity: 1,
          // UnitPrice is in ILS, before VAT. VATIncluded:false → SUMIT adds VAT.
          UnitPrice: input.amountBeforeVat,
        },
      ],
      VATIncluded: false,
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
   * Issue a B2C customer tax-invoice-receipt (חשבונית מס/קבלה) for a paid
   * consumer transaction — a wash, a booking, a wallet top-up, an eGift, etc.
   *
   * Differs from createDocument() (which is the B2B *supplier* invoice path):
   *  - Type is 'InvoiceAndReceipt' (חשבונית מס/קבלה) because the customer has
   *    already paid, so the document is invoice + receipt in one.
   *  - The customer is an individual: no business/VAT number required.
   *  - A Payments line is included (the money is already in).
   *
   * Safety contract (the callers rely on this):
   *  - When not wired (no creds), returns {wired:false} WITHOUT any HTTP call.
   *    It must NEVER throw — a receipt failure must not roll back a real payment.
   *  - Idempotent: ExternalIdentifier + Idempotency-Key = the caller's stable key
   *    (our sequential receipt number), so a retry can't mint a second tax doc.
   *
   * BODY SHAPE: same unverified-until-sandbox caveat as createDocument() — the
   * OfficeGuy/SUMIT field casing + the Payments shape must be confirmed against
   * a real SUMIT_SANDBOX=true call before any production send. See
   * docs/finance/sumit-activation-checklist-2026-06-15.md.
   */
  async createCustomerReceipt(input: {
    idempotencyKey: string;
    customer: { name: string; email?: string; phone?: string; taxId?: string };
    description: string;
    amountBeforeVat: number;
    vatAmount: number;
    totalAmount: number;
    currency: 'ILS';
    /**
     * SUMIT document type per the CPA per-class mapping (getSumitDocumentMapping):
     * 'InvoiceAndReceipt' (principal sale), 'Receipt' (stored value — top-up/eGift,
     * no VAT), 'Invoice' (disclosed-agent commission). Defaults to InvoiceAndReceipt.
     */
    documentType?: 'InvoiceAndReceipt' | 'Receipt' | 'Invoice';
    /** Card metadata when the caller has it — enriches the receipt's payment line. */
    card?: { last4?: string; brand?: string };
    /** caller context for the audit log (platform, bookingId) */
    context?: Record<string, unknown>;
  }): Promise<SumitDocumentResult> {
    const env = readEnv();
    if (!isWired()) {
      logger.info('[SumitClient] createCustomerReceipt called while not wired (no-op)', {
        idempotencyKey: input.idempotencyKey,
        totalAmount: input.totalAmount,
        ...input.context,
      });
      return {
        wired: false,
        idempotencyKey: input.idempotencyKey,
        reason: 'SumitClient not wired — set SUMIT_ENABLED=true plus all credentials',
      };
    }

    const body = {
      Credentials: { CompanyID: env.companyId, APIKey: env.apiKey },
      Details: {
        // Document type per the CPA per-class mapping (default InvoiceAndReceipt =
        // חשבונית מס/קבלה for an already-paid principal sale). 'Receipt' for stored
        // value (top-up/eGift, no VAT), 'Invoice' for disclosed-agent commission.
        Type: input.documentType || 'InvoiceAndReceipt',
        Customer: {
          Name: input.customer.name,
          EmailAddress: input.customer.email || undefined,
          Phone: input.customer.phone || undefined,
          // Most consumers have no company number; send only if we have one.
          CompanyNumber: input.customer.taxId || undefined,
          ExternalIdentifier: input.idempotencyKey,
        },
        Description: input.description,
        Currency: input.currency,
        // Enum NAME, not ISO code — 'he' is rejected by SUMIT
        // (verified live 2026-07-05, document #10000 walk).
        Language: 'Hebrew',
        ExternalReference: input.idempotencyKey,
      },
      // The sale is already paid — record the payment so the doc is a receipt too.
      // A bare {Amount} is rejected ("יש להזין מוטב/מחויב"): SUMIT needs the
      // payment TYPE plus its (possibly empty) details object to post the
      // ledger line. Card is our only online rail; last4/brand enrich the doc
      // when the caller has them.
      Payments: [{
        Amount: input.totalAmount,
        Type: 'CreditCard',
        Details_CreditCard: {
          ...(input.card?.last4 ? { Last4Digits: input.card.last4 } : {}),
          ...(input.card?.brand ? { CardBrand: input.card.brand } : {}),
        },
      }],
    } as Record<string, any>;

    // Stored-value Receipt (wallet top-up / eGift purchase) is PAYMENT-ONLY with
    // NO VAT-bearing items — the payment records the money received and VAT is
    // deferred to redemption (CPA order #5). VERIFIED LIVE 2026-07-09: SUMIT doc
    // #30000 (Type=Receipt, Payments only) → Status 0, zero VAT, on a separate
    // number series from invoices. Every other type (InvoiceAndReceipt / Invoice)
    // carries the taxable line with VATIncluded:false so SUMIT adds the 18%.
    if ((input.documentType || 'InvoiceAndReceipt') !== 'Receipt') {
      body.Items = [{
        Item: { Name: input.description },
        Quantity: 1,
        UnitPrice: input.amountBeforeVat,
      }];
      body.VATIncluded = false;
    }

    const url = `${env.baseUrl}/accounting/documents/create/`;
    const startMs = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Idempotency-Key': input.idempotencyKey,
          'X-PetWash-Sandbox': env.sandbox ? 'true' : 'false',
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      const msg = (networkErr as Error).message;
      logger.error('[SumitClient] createCustomerReceipt network error', {
        idempotencyKey: input.idempotencyKey, url, err: msg, ...input.context,
      });
      return { wired: false, idempotencyKey: input.idempotencyKey, reason: `Network error: ${msg}` };
    }

    let parsedBody: unknown = null;
    try { parsedBody = await res.json(); } catch { /* SUMIT may return non-JSON on errors */ }

    if (!res.ok) {
      logger.warn('[SumitClient] createCustomerReceipt non-2xx', {
        idempotencyKey: input.idempotencyKey, status: res.status, sandbox: env.sandbox,
        elapsedMs: Date.now() - startMs, ...input.context,
      });
      return {
        wired: true,
        idempotencyKey: input.idempotencyKey,
        reason: `SUMIT returned ${res.status}`,
        rawResponse: parsedBody,
      };
    }

    const sumitDocumentId = extractDocumentId(parsedBody);
    logger.info('[SumitClient] customer receipt created', {
      idempotencyKey: input.idempotencyKey, sumitDocumentId, sandbox: env.sandbox,
      elapsedMs: Date.now() - startMs, ...input.context,
    });
    return { wired: true, idempotencyKey: input.idempotencyKey, sumitDocumentId, rawResponse: parsedBody };
  }

  /**
   * Issue a CREDIT document (חשבונית זיכוי/קבלה) for a refund — the fiscal
   * counterpart of createCustomerReceipt. Israeli law requires an explicit
   * credit document when money is returned after a receipt was issued; the
   * original must NOT be deleted. Type 'CreditInvoiceAndReceipt' + the original
   * SUMIT document id links the credit to what it reverses.
   *
   * Same safety contract as createCustomerReceipt: no-op {wired:false} when
   * unwired, NEVER throws (a credit-doc hiccup must not fail a refund the
   * customer is already owed). Shapes verified live 2026-07-05 (doc #10000).
   */
  async createCreditDocument(input: {
    idempotencyKey: string;
    originalSumitDocumentId?: string | number;
    customer: { name: string; email?: string; phone?: string };
    description: string;
    amountBeforeVat: number;
    vatAmount: number;
    totalAmount: number;
    currency: 'ILS';
    context?: Record<string, unknown>;
  }): Promise<SumitDocumentResult> {
    const env = readEnv();
    if (!isWired()) {
      return { wired: false, idempotencyKey: input.idempotencyKey, reason: 'SumitClient not wired' };
    }
    const originalId = input.originalSumitDocumentId != null ? Number(input.originalSumitDocumentId) : undefined;
    const body: Record<string, unknown> = {
      Credentials: { CompanyID: env.companyId, APIKey: env.apiKey },
      Details: {
        Type: 'CreditInvoiceAndReceipt',
        Customer: {
          Name: input.customer.name,
          EmailAddress: input.customer.email || undefined,
          Phone: input.customer.phone || undefined,
          ExternalIdentifier: input.idempotencyKey,
        },
        Description: input.description,
        Currency: input.currency,
        Language: 'Hebrew',
        ExternalReference: input.idempotencyKey,
      },
      Items: [{ Item: { Name: input.description }, Quantity: 1, UnitPrice: input.amountBeforeVat }],
      Payments: [{ Amount: input.totalAmount, Type: 'CreditCard', Details_CreditCard: {} }],
      VATIncluded: false,
      ...(originalId ? { OriginalDocumentID: originalId } : {}),
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
          'Idempotency-Key': input.idempotencyKey,
          'X-PetWash-Sandbox': env.sandbox ? 'true' : 'false',
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      const msg = (networkErr as Error).message;
      logger.error('[SumitClient] createCreditDocument network error', { idempotencyKey: input.idempotencyKey, err: msg, ...input.context });
      return { wired: false, idempotencyKey: input.idempotencyKey, reason: `Network error: ${msg}` };
    }
    let parsedBody: unknown = null;
    try { parsedBody = await res.json(); } catch { /* non-JSON on errors */ }
    if (!res.ok) {
      logger.warn('[SumitClient] createCreditDocument non-2xx', { idempotencyKey: input.idempotencyKey, status: res.status, elapsedMs: Date.now() - startMs, ...input.context });
      return { wired: true, idempotencyKey: input.idempotencyKey, reason: `SUMIT returned ${res.status}`, rawResponse: parsedBody };
    }
    const sumitDocumentId = extractDocumentId(parsedBody);
    logger.info('[SumitClient] credit document created', { idempotencyKey: input.idempotencyKey, sumitDocumentId, originalId, ...input.context });
    return { wired: true, idempotencyKey: input.idempotencyKey, sumitDocumentId, rawResponse: parsedBody };
  }

  /** Public accessor so callers can branch without firing a no-op call. */
  isWired(): boolean {
    return isWired();
  }

  /**
   * READ-ONLY connection test — proves SUMIT_API_KEY + SUMIT_COMPANY_ID
   * actually authenticate against api.sumit.co.il, WITHOUT creating any
   * document or moving any money. Calls /accounting/general/getvatrate/
   * (fetch the company VAT rate), the cheapest authenticated read SUMIT
   * exposes.
   *
   * Deliberately does NOT require SUMIT_ENABLED or SUMIT_WEBHOOK_SECRET — it
   * reads the credential pair directly so an operator can verify the key the
   * moment it is saved, BEFORE flipping the rail on. Never throws.
   *
   * Interpretation (the admin UI surfaces this verbatim):
   *   ok:true                 → key authenticated (HTTP 200)
   *   authRejected:true       → reached SUMIT but credentials rejected (401/403)
   *   ok:false + reachable    → reached SUMIT, non-auth error (request shape) —
   *                             the KEY is fine, the call shape isn't
   *   ok:false + !reachable   → could not reach SUMIT at all (network)
   */
  async connectionTest(): Promise<{
    ok: boolean;
    reachable: boolean;
    authRejected: boolean;
    httpStatus?: number;
    vatRate?: number;
    reason: string;
  }> {
    const env = readEnv();
    if (!env.apiKey || !env.companyId) {
      return {
        ok: false,
        reachable: false,
        authRejected: false,
        reason: `Missing ${!env.apiKey ? 'SUMIT_API_KEY' : 'SUMIT_COMPANY_ID'} — set it before testing`,
      };
    }

    const url = `${env.baseUrl}/accounting/general/getvatrate/`;
    // getvatrate takes a date; send today so SUMIT returns the current rate.
    const today = new Date().toISOString().slice(0, 10);
    const body = {
      Credentials: { CompanyID: env.companyId, APIKey: env.apiKey },
      Date: today,
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-PetWash-Sandbox': env.sandbox ? 'true' : 'false',
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      const msg = (networkErr as Error).message;
      logger.error('[SumitClient] connectionTest network error', { url, err: msg });
      return {
        ok: false,
        reachable: false,
        authRejected: false,
        reason: `Could not reach SUMIT: ${msg}`,
      };
    }

    let parsed: unknown = null;
    try { parsed = await res.json(); } catch { /* non-JSON on some error paths */ }

    if (res.status === 401 || res.status === 403) {
      logger.warn('[SumitClient] connectionTest auth rejected', { httpStatus: res.status });
      return {
        ok: false,
        reachable: true,
        authRejected: true,
        httpStatus: res.status,
        reason: `SUMIT rejected the credentials (HTTP ${res.status}) — check the API key / Company ID`,
      };
    }

    if (res.ok) {
      const b = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      const rawRate = b.VATRate ?? b.Rate ?? (b.Data as Record<string, unknown> | undefined)?.VATRate;
      const vatRate = typeof rawRate === 'number' ? rawRate : undefined;
      logger.info('[SumitClient] connectionTest OK', { httpStatus: res.status, vatRate });
      return {
        ok: true,
        reachable: true,
        authRejected: false,
        httpStatus: res.status,
        vatRate,
        reason: 'Key authenticated — SUMIT responded 200',
      };
    }

    // Reached SUMIT, not an auth rejection (e.g. 400/404/422). The key is
    // almost certainly valid; the request shape/date is what SUMIT disliked.
    logger.warn('[SumitClient] connectionTest non-auth error', { httpStatus: res.status });
    return {
      ok: false,
      reachable: true,
      authRejected: false,
      httpStatus: res.status,
      reason: `Reached SUMIT (HTTP ${res.status}) but the call was not accepted — the key likely works; the request shape needs a tweak`,
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

  /**
   * Begin a SUMIT hosted-page charge (POST /billing/payments/beginredirect/).
   * This is the PCI-safe, zero-card-form path: we send amount + items + a
   * RedirectURL, SUMIT returns a hosted payment-page URL, the customer pays
   * there (cleared via UPay), SUMIT issues the fiscal doc, and redirects back
   * to RedirectURL with ?Valid&Result&ID. ALWAYS re-verify server-side with
   * getTransaction() — the querystring is spoofable.
   *
   * Safety: no-op (wired:false) without creds; never throws.
   * FIELDS UNVERIFIED — confirm exact request keys in SANDBOX (SUMIT_SANDBOX=true)
   * before production (docs/finance/sumit-upay-wiring-readiness-2026-06-11.md §6).
   */
  async beginRedirect(input: {
    externalId: string;        // our order/idempotency id
    amountIls: number;         // VAT-inclusive gross
    description: string;
    redirectUrl: string;       // where SUMIT returns the customer
    customerName?: string;
    customerEmail?: string;
  }): Promise<{ wired: boolean; redirectUrl?: string; reason?: string; rawResponse?: unknown }> {
    const env = readEnv();
    if (!isWired()) return { wired: false, reason: 'SUMIT not enabled' };

    const body = {
      Credentials: { CompanyID: env.companyId, APIKey: env.apiKey },
      RedirectURL: input.redirectUrl,
      ExternalIdentifier: input.externalId,
      Customer: {
        Name: input.customerName || 'PetWash Customer',
        EmailAddress: input.customerEmail || undefined,
      },
      Items: [{ Item: { Name: input.description }, Quantity: 1, UnitPrice: input.amountIls }],
      VATIncluded: true, // gross amount already includes VAT
      // Enum NAME, not ISO code (same Accounting_Typed_Language enum as documents).
      Language: 'Hebrew',
    };
    try {
      const res = await fetch(`${env.baseUrl}/billing/payments/beginredirect/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Idempotency-Key': input.externalId },
        body: JSON.stringify(body),
      });
      let parsed: any = null;
      try { parsed = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) {
        // Log the raw error body so the FIRST live/sandbox call reveals exactly what
        // SUMIT rejected (missing field, bad casing) instead of a blind 502.
        logger.error('[SumitClient] beginRedirect non-2xx', { externalId: input.externalId, status: res.status, raw: safePreview(parsed) });
        return { wired: true, reason: `SUMIT returned ${res.status}`, rawResponse: parsed };
      }
      // Response URL field name is UNVERIFIED against SUMIT's authenticated spec.
      // Try every plausible key, then fall back to a deep scan for the first
      // https URL anywhere in the payload — so an unexpected field name still
      // works on the first real call rather than silently 502-ing the customer.
      const url =
        parsed?.RedirectURL || parsed?.PaymentURL || parsed?.URL || parsed?.PaymentPageURL || parsed?.PaymentPageUrl ||
        parsed?.RedirectUrl || parsed?.Url ||
        parsed?.Data?.RedirectURL || parsed?.Data?.URL || parsed?.Data?.PaymentURL || parsed?.Data?.PaymentPageURL ||
        parsed?.Payment?.RedirectURL || parsed?.Payment?.URL ||
        deepFindUrl(parsed);
      if (!url) {
        // Diagnostic gold: dump the actual shape so we learn the real field name
        // from ONE live test instead of guessing again.
        logger.error('[SumitClient] beginRedirect: no redirect URL found in response — raw shape follows', { externalId: input.externalId, raw: safePreview(parsed) });
        return { wired: true, reason: 'no redirect URL in SUMIT response', rawResponse: parsed };
      }
      return { wired: true, redirectUrl: String(url), rawResponse: parsed };
    } catch (err: any) {
      logger.error('[SumitClient] beginRedirect network error', { externalId: input.externalId, err: err?.message });
      return { wired: false, reason: `Network error: ${err?.message}` };
    }
  }

  /**
   * Re-verify a redirect payment server-side. The beginredirect querystring is
   * spoofable — this is the authoritative check before we treat a payment as real.
   * No-op without creds; never throws.
   *
   * ENDPOINT FIX (2026-06-23): was POST /billing/payments/gettransaction/ which is
   * NOT in the official OfficeGuy API (it would 404 → verification always failed).
   * Our redirect flow is /billing/payments/beginredirect/, so the namespace-correct
   * "get" is POST /billing/payments/get/ ("Get payment details"). ⚠️ The request
   * field (PaymentID vs TransactionID) + the Valid/Amount response field names are
   * still UNVERIFIED — confirm in SUMIT sandbox before go-live. We send both id
   * fields and accept multiple response shapes as defence-in-depth.
   */
  async getTransaction(transactionId: string): Promise<{ wired: boolean; valid: boolean; amountCents?: number; raw?: unknown; reason?: string }> {
    const env = readEnv();
    if (!isWired()) return { wired: false, valid: false, reason: 'SUMIT not enabled' };
    try {
      const res = await fetch(`${env.baseUrl}/billing/payments/get/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ Credentials: { CompanyID: env.companyId, APIKey: env.apiKey }, PaymentID: transactionId, TransactionID: transactionId }),
      });
      let parsed: any = null;
      try { parsed = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) {
        logger.error('[SumitClient] getTransaction non-2xx', { transactionId, status: res.status, raw: safePreview(parsed) });
        return { wired: true, valid: false, reason: `SUMIT returned ${res.status}`, raw: parsed };
      }
      // Valid/approved field name unverified — accept common shapes. Log the raw
      // shape so the first live verify confirms the real Valid/Amount field names
      // (turns a silent verify-fail into an immediate, fixable answer).
      logger.info('[SumitClient] getTransaction ok — raw shape for field confirmation', { transactionId, raw: safePreview(parsed) });
      const valid = parsed?.Valid === true || parsed?.Valid === 1 || parsed?.Data?.Valid === true ||
        String(parsed?.Status || parsed?.Data?.Status || '').toLowerCase() === 'approved';
      // Charged amount (gross, ILS) — field name UNVERIFIED, accept common shapes.
      // Returned in CENTS so callers can compare against purchases.amountCents
      // (defence-in-depth against price tampering). undefined when not present.
      const rawAmount =
        parsed?.Amount ?? parsed?.Sum ?? parsed?.Total ??
        parsed?.Data?.Amount ?? parsed?.Data?.Sum ?? parsed?.Data?.Total ??
        parsed?.Payment?.Amount ?? parsed?.payment?.amount;
      const amountNum = Number(rawAmount);
      const amountCents =
        rawAmount != null && Number.isFinite(amountNum) ? Math.round(amountNum * 100) : undefined;
      return { wired: true, valid, amountCents, raw: parsed };
    } catch (err: any) {
      logger.error('[SumitClient] getTransaction network error', { transactionId, err: err?.message });
      return { wired: false, valid: false, reason: `Network error: ${err?.message}` };
    }
  }

  /**
   * POST /billing/recurring/charge/ — charge a customer AND create a recurring
   * standing order (הוראת קבע) for subscription renewals (membership / packages).
   *
   * Requires an existing SUMIT CustomerID that has a SAVED payment method (set via
   * /billing/paymentmethods/setforcustomer on the first payment). SUMIT then
   * auto-charges per the recurring-product cadence configured in the account.
   *
   * `UpdateCustomerByEmail: true` is REQUIRED per SUMIT docs so the fiscal
   * document (חשבונית מס/קבלה) is emailed to the customer after each recurring
   * charge — otherwise renewals charge silently with no receipt.
   *
   * No-op until wired (SUMIT_ENABLED + creds); never throws. BODY SHAPE is
   * best-known but UNVERIFIED vs the live swagger — confirm in SUMIT_SANDBOX
   * before SUMIT_SANDBOX=false. This is the building block for auto-renewal;
   * the renewal scheduler + saved-card capture are wired separately.
   */
  async chargeRecurring(input: {
    idempotencyKey: string;
    sumitCustomerId: number | string;   // existing SUMIT customer with a saved card
    description: string;
    amountIls: number;                  // VAT-inclusive gross per cycle
    recurrenceMonths?: number;          // e.g. 12 (SUMIT charges per the recurring product)
  }): Promise<{ wired: boolean; sumitDocumentId?: string; recurringId?: string; reason?: string; rawResponse?: unknown }> {
    const env = readEnv();
    if (!isWired()) return { wired: false, reason: 'SUMIT not enabled' };

    const body = {
      Credentials: { CompanyID: env.companyId, APIKey: env.apiKey },
      Customer: { ID: input.sumitCustomerId },
      Items: [{ Item: { Name: input.description }, Quantity: 1, UnitPrice: input.amountIls }],
      VATIncluded: true,        // gross already includes VAT
      Language: 'he',
      ExternalIdentifier: input.idempotencyKey,
      // REQUIRED (SUMIT docs): email the fiscal doc after each recurring charge.
      UpdateCustomerByEmail: true,
      ...(input.recurrenceMonths ? { RecurrenceMonths: input.recurrenceMonths } : {}),
    };
    try {
      const res = await fetch(`${env.baseUrl}/billing/recurring/charge/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Idempotency-Key': input.idempotencyKey },
        body: JSON.stringify(body),
      });
      let parsed: any = null;
      try { parsed = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) return { wired: true, reason: `SUMIT returned ${res.status}`, rawResponse: parsed };
      const sumitDocumentId = extractDocumentId(parsed);
      const recurringRaw = parsed?.RecurringID ?? parsed?.RecurringPaymentID ?? parsed?.Data?.RecurringID;
      return {
        wired: true,
        sumitDocumentId,
        recurringId: recurringRaw != null ? String(recurringRaw) : undefined,
        rawResponse: parsed,
      };
    } catch (err: any) {
      logger.error('[SumitClient] chargeRecurring network error', { idempotencyKey: input.idempotencyKey, err: err?.message });
      return { wired: false, reason: `Network error: ${err?.message}` };
    }
  }

  /**
   * POST /billing/paymentmethods/setforcustomer — save a card to a SUMIT customer so it
   * can be charged later (chargeRecurring / chargeSavedCard) with no re-entry. The token
   * comes from SUMIT's own tokenization (hosted page / JS widget) — we NEVER see the PAN.
   *
   * FAIL-CLOSED + never throws: on any non-2xx, missing field, or network error we return
   * saved:false with a reason. Callers must treat saved:false as "no card on file" and
   * NOT mark anything payable. BODY SHAPE is best-known but UNVERIFIED vs the live swagger
   * — confirm on the first real save (SUMIT_SANDBOX=true first if possible). We read the
   * saved payment-method id from several common response shapes as defence-in-depth.
   */
  async setForCustomer(input: {
    sumitCustomerId: number | string;
    singlePaymentToken: string;   // one-time token from SUMIT tokenization — NOT a PAN
    customerName?: string;
    customerEmail?: string;
  }): Promise<{ wired: boolean; saved: boolean; paymentMethodId?: string; reason?: string; rawResponse?: unknown }> {
    const env = readEnv();
    if (!isWired()) return { wired: false, saved: false, reason: 'SUMIT not enabled' };
    if (!input.sumitCustomerId || !input.singlePaymentToken) {
      return { wired: true, saved: false, reason: 'sumitCustomerId and singlePaymentToken are required' };
    }
    const body = {
      Credentials: { CompanyID: env.companyId, APIKey: env.apiKey },
      Customer: {
        ID: input.sumitCustomerId,
        ...(input.customerName ? { Name: input.customerName } : {}),
        ...(input.customerEmail ? { EmailAddress: input.customerEmail } : {}),
      },
      SinglePaymentToken: input.singlePaymentToken,
    };
    try {
      const res = await fetch(`${env.baseUrl}/billing/paymentmethods/setforcustomer/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body),
      });
      let parsed: any = null;
      try { parsed = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) return { wired: true, saved: false, reason: `SUMIT returned ${res.status}`, rawResponse: parsed };
      const pmRaw =
        parsed?.PaymentMethodID ?? parsed?.PaymentMethodId ?? parsed?.ID ??
        parsed?.Data?.PaymentMethodID ?? parsed?.Data?.ID ?? parsed?.PaymentMethod?.ID;
      // SUMIT signals success via a non-error body; require a payment-method id OR an
      // explicit success flag before we treat the card as saved (fail-closed otherwise).
      const explicitOk = parsed?.Valid === true || String(parsed?.Status || '').toLowerCase() === 'success';
      if (pmRaw == null && !explicitOk) {
        return { wired: true, saved: false, reason: 'no payment-method id / success flag in SUMIT response', rawResponse: parsed };
      }
      return { wired: true, saved: true, paymentMethodId: pmRaw != null ? String(pmRaw) : undefined, rawResponse: parsed };
    } catch (err: any) {
      logger.error('[SumitClient] setForCustomer network error', { sumitCustomerId: input.sumitCustomerId, err: err?.message });
      return { wired: false, saved: false, reason: `Network error: ${err?.message}` };
    }
  }

  /**
   * POST /billing/payments/charge/ — a ONE-TIME charge against a SUMIT customer's saved
   * card (a booking is a single charge, not a subscription — so NOT chargeRecurring).
   * SUMIT issues the fiscal doc (חשבונית מס/קבלה) and emails it. We never see the PAN.
   *
   * FAIL-CLOSED + never throws: captured:true ONLY when SUMIT returns 2xx AND a document
   * id AND a validity signal. Any missing piece → captured:false so the caller keeps the
   * booking UNPAID (no fake "paid"). BODY SHAPE best-known but UNVERIFIED — confirm on the
   * first real ₪-small charge; the defensive multi-shape parsing is the safety net.
   */
  async chargeSavedCard(input: {
    idempotencyKey: string;
    sumitCustomerId: number | string;
    description: string;
    amountIls: number;   // VAT-inclusive gross
  }): Promise<{ wired: boolean; captured: boolean; sumitDocumentId?: string; transactionId?: string; reason?: string; rawResponse?: unknown }> {
    const env = readEnv();
    if (!isWired()) return { wired: false, captured: false, reason: 'SUMIT not enabled' };
    if (!input.sumitCustomerId) return { wired: true, captured: false, reason: 'sumitCustomerId required (no saved card)' };
    const body = {
      Credentials: { CompanyID: env.companyId, APIKey: env.apiKey },
      Customer: { ID: input.sumitCustomerId },     // charge the saved payment method
      Items: [{ Item: { Name: input.description }, Quantity: 1, UnitPrice: input.amountIls }],
      VATIncluded: true,
      Language: 'he',
      ExternalIdentifier: input.idempotencyKey,     // idempotency — SUMIT dedups repeat charges
      UpdateCustomerByEmail: true,                  // email the fiscal doc
    };
    try {
      const res = await fetch(`${env.baseUrl}/billing/payments/charge/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Idempotency-Key': input.idempotencyKey },
        body: JSON.stringify(body),
      });
      let parsed: any = null;
      try { parsed = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok) return { wired: true, captured: false, reason: `SUMIT returned ${res.status}`, rawResponse: parsed };
      const sumitDocumentId = extractDocumentId(parsed);
      const txnRaw = parsed?.TransactionID ?? parsed?.PaymentID ?? parsed?.ID ?? parsed?.Data?.TransactionID ?? parsed?.Data?.ID;
      const valid = parsed?.Valid === true || parsed?.Valid === 1 || parsed?.Data?.Valid === true ||
        String(parsed?.Status || parsed?.Data?.Status || '').toLowerCase() === 'approved' ||
        sumitDocumentId != null;
      if (!valid || (sumitDocumentId == null && txnRaw == null)) {
        return { wired: true, captured: false, reason: 'SUMIT did not confirm the charge (fail-closed)', rawResponse: parsed };
      }
      return {
        wired: true,
        captured: true,
        sumitDocumentId,
        transactionId: txnRaw != null ? String(txnRaw) : undefined,
        rawResponse: parsed,
      };
    } catch (err: any) {
      logger.error('[SumitClient] chargeSavedCard network error', { idempotencyKey: input.idempotencyKey, err: err?.message });
      return { wired: false, captured: false, reason: `Network error: ${err?.message}` };
    }
  }
}

export const sumitClient = new SumitClient();
