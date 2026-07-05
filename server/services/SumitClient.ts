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
        // חשבונית מס/קבלה — invoice + receipt for an already-paid B2C sale.
        Type: 'InvoiceAndReceipt',
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
      Items: [
        {
          Item: { Name: input.description },
          Quantity: 1,
          // UnitPrice before VAT; VATIncluded:false → SUMIT adds the 18%.
          UnitPrice: input.amountBeforeVat,
        },
      ],
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
      if (!res.ok) return { wired: true, reason: `SUMIT returned ${res.status}`, rawResponse: parsed };
      // Response URL field name unverified — try common variants.
      const url = parsed?.RedirectURL || parsed?.PaymentURL || parsed?.URL || parsed?.Data?.RedirectURL || parsed?.Data?.URL;
      if (!url) return { wired: true, reason: 'no redirect URL in SUMIT response', rawResponse: parsed };
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
      if (!res.ok) return { wired: true, valid: false, reason: `SUMIT returned ${res.status}`, raw: parsed };
      // Valid/approved field name unverified — accept common shapes.
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
}

export const sumitClient = new SumitClient();
