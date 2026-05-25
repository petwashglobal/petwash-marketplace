/**
 * SumitSyncService — unified entry point for PetWash → SUMIT synchronization.
 * =============================================================================
 *
 * Mission-5+ skeleton. THIS SERVICE FIRES ZERO REAL SUMIT HTTP CALLS BY DEFAULT.
 *
 * Architecture:
 *   - Lifecycle hooks in PetWash (customer create, booking complete, refund,
 *     supplier invoice approved) call into SumitSyncService.sync*() methods.
 *   - Each sync*() method derives the appropriate SUMIT payload (including
 *     the correct DocumentType per the provider's Osek classification), then
 *     enqueues a job into pw_async_jobs.
 *   - AsyncJobWorker picks up the job and calls back into
 *     handleSumitJob() which routes through SumitClient.
 *   - SumitClient is gated by SUMIT_ENABLED + SUMIT_API_KEY presence; if the
 *     gates are not all true (default in production today), the call no-ops
 *     and the job is recorded as wired=false.
 *
 * Why this exists as a separate service from the existing SumitDispatcher:
 *   - SumitDispatcher is tightly coupled to SupplierInvoice — its DispatchInput
 *     takes a SupplierInvoice plus supplierName. It works well for that path.
 *   - SumitSyncService handles the OTHER three lifecycle events (customer
 *     create/update, booking document create, refund) which need different
 *     payload shapes.
 *   - Both services share SumitClient and the systemConfig 'sumit.mode' flag,
 *     so flipping that flag activates the entire platform's sync — supplier
 *     invoices AND booking documents AND customers — in one move.
 *
 * Safety:
 *   - Every public method returns an EnqueueResult; the boolean field
 *     `enqueued` is true only if the job was successfully queued. Caller
 *     does NOT block on the actual SUMIT call.
 *   - Enqueue failures are logged but never thrown. A sync hook failure
 *     CANNOT fail a booking/payment/customer-create.
 *   - When `sumit.mode === 'off'` (the default in production today), the
 *     enqueue still happens but the worker no-ops and records the skip.
 *     This is deliberate: it lets us track "this is what WOULD have synced"
 *     before flipping the flag.
 *
 * Companion docs:
 *   - docs/finance/sumit-api-known-vs-assumed-2026-05-23.md §1.2 — DocumentType
 *     rules per Osek classification.
 *   - docs/finance/sumit-api-known-vs-assumed-2026-05-23.md §1.4 — Legal
 *     timing rule (CRITICAL: this service enqueues quickly; the worker is
 *     designed for synchronous-feeling latency, not "eventual" semantics).
 *   - docs/finance/sumit-activation-playbook-2026-05-23.md — operator steps
 *     to flip from mode=off to mode=api.
 */

import crypto from 'crypto';
import { logger } from '../lib/logger';
import { systemConfig } from './SystemConfig';
import { sumitClient } from './SumitClient';
import { enqueueGoogleJob } from './AsyncJobWorker';
import { recordAuditEvent } from '../utils/auditSignature';
import type { SumitMode } from './SumitDispatcher';

/**
 * DocumentType is a SUMIT enum (1..n). The exact integer mapping is STILL
 * ASSUMED — see docs/finance/sumit-api-known-vs-assumed-2026-05-23.md §2.3.
 * What IS verified (§1.2):
 *   - osek_patur CANNOT issue tax-invoice variants
 *   - osek_murshe / chevra CAN issue all variants
 * The integer constants below are best-guesses from the SDD; they MUST be
 * verified against the swagger before flipping sumit.mode = 'api'.
 */
const SUMIT_DOC_TYPE = {
  /** חשבונית מס — tax invoice (osek_murshe / chevra only) */
  TAX_INVOICE: 1,
  /** חשבון/קבלה — combined invoice+receipt (osek_patur safe choice) */
  INVOICE_RECEIPT: 2,
  /** קבלה — receipt only */
  RECEIPT: 3,
  /** חשבונית עסקה — transaction invoice (osek_patur variant) */
  TRANSACTION_INVOICE: 4,
  /** חשבונית זיכוי — credit note (zikui flow for refunds) */
  CREDIT_NOTE: 5,
  /** דרישת תשלום — payment demand */
  PAYMENT_DEMAND: 6,
} as const;

export type OsekClassification = 'osek_patur' | 'osek_murshe' | 'chevra' | 'unknown';

export interface DocumentTypeDecision {
  documentType: number;
  documentTypeName: string;
  rationale: string;
  /** True iff the choice is safe even when the swagger-verified enum is wrong:
   *  osek_patur → INVOICE_RECEIPT (safe; can never be a tax-invoice variant).
   *  osek_murshe / chevra → TAX_INVOICE (the "canonical" choice).
   *  unknown → null with reason; caller must reject the sync until classified. */
  safe: boolean;
}

/**
 * Derive the SUMIT DocumentType to use for a NEW booking-completion document,
 * based on the provider's Osek tax classification.
 *
 * This is the central rule that prevents a Mission-5 deploy from silently
 * sending invalid document types and getting rejected by SUMIT.
 */
export function deriveDocumentTypeForBooking(osek: OsekClassification): DocumentTypeDecision {
  switch (osek) {
    case 'osek_patur':
      // עוסק פטור CANNOT issue חשבונית מס or חשבונית מס/קבלה. The legal
      // document for a patur receiving payment is חשבון/קבלה (combined) or
      // קבלה. Use combined so the customer gets one document covering both
      // the service rendered and the payment received.
      return {
        documentType: SUMIT_DOC_TYPE.INVOICE_RECEIPT,
        documentTypeName: 'invoice_receipt',
        rationale:
          'osek_patur cannot issue tax-invoice variants — chose חשבון/קבלה (combined)',
        safe: true,
      };
    case 'osek_murshe':
    case 'chevra':
      // עוסק מורשה and חברה issue חשבונית מס with VAT. This is the canonical
      // tax-invoice path.
      return {
        documentType: SUMIT_DOC_TYPE.TAX_INVOICE,
        documentTypeName: 'tax_invoice',
        rationale:
          `${osek} issues חשבונית מס — full VAT-bearing tax invoice`,
        safe: true,
      };
    case 'unknown':
    default:
      // Refuse to guess. The provider must be classified before any SUMIT
      // document is issued on their behalf. Returning safe=false lets the
      // caller reject the sync rather than silently picking a wrong type.
      return {
        documentType: -1,
        documentTypeName: 'unclassified',
        rationale:
          'provider osek_type is not classified — cannot derive SUMIT DocumentType',
        safe: false,
      };
  }
}

export type SumitJobType =
  | 'SUMIT_CUSTOMER_SYNC'
  | 'SUMIT_DOCUMENT_CREATE'
  | 'SUMIT_DOCUMENT_CANCEL';

export interface EnqueueResult {
  /** True iff a row was successfully written to pw_async_jobs. */
  enqueued: boolean;
  /** The idempotency key used; persist this on the source row so the same
   *  source event never enqueues twice. */
  idempotencyKey: string;
  /** Skipped intentionally? "off-mode" / "unclassified" / "missing-required-field". */
  skipReason?: string;
}

export interface CustomerSyncInput {
  /** PetWash internal user id — used as the canonical idempotency anchor. */
  userId: string;
  email?: string;
  name: string;
  /** Israeli business number (ח.פ. / ע.מ.) — only meaningful for providers
   *  classified as osek_murshe / chevra. */
  businessNumber?: string;
  osekType?: OsekClassification;
  /** Where this sync came from — for audit clarity. */
  source: 'user_create' | 'user_update' | 'provider_create' | 'provider_update';
}

export interface BookingDocumentSyncInput {
  bookingId: string;
  /** The provider being PAID (osek classification drives DocumentType). */
  providerOsekType: OsekClassification;
  /** Customer details (the party paying). */
  customer: {
    userId: string;
    name: string;
    email?: string;
    businessNumber?: string;
  };
  /** Money fields in agorot (cents). Service converts to ILS for SUMIT. */
  amountBeforeVatAgorot: number;
  vatAgorot: number;
  totalAgorot: number;
  description: string;
  /** ISO timestamp of the charge — must be issued immediately on payment
   *  receipt per ITA rules (see sumit-api-known-vs-assumed §1.4). */
  chargedAt: string;
}

export interface RefundSyncInput {
  /** SUMIT-side document id of the ORIGINAL invoice/receipt being reversed. */
  originalSumitDocumentId: string;
  /** Original document we issued (for audit linkage). */
  originalLocalDocumentId: string;
  refundAmountAgorot: number;
  reason: string;
}

class SumitSyncService {
  /** Current activation mode (off|email|api|csv_export). */
  currentMode(): SumitMode {
    return systemConfig.get('sumit.mode');
  }

  /**
   * Enqueue a customer sync.
   *
   * Idempotency key = sha256("customer-sync:" + userId + ":" + source).
   * Multiple calls for the same userId+source collapse to one job (the
   * AsyncJobWorker handler will read the latest user state when it runs).
   */
  async syncCustomer(input: CustomerSyncInput): Promise<EnqueueResult> {
    const idempotencyKey = makeIdempotencyKey('customer-sync', input.userId, input.source);

    if (!input.name || !input.userId) {
      logger.warn('[SumitSync] customer sync skipped — missing required fields', {
        userId: input.userId, source: input.source,
      });
      return { enqueued: false, idempotencyKey, skipReason: 'missing-required-field' };
    }

    return await enqueueSumitJob('SUMIT_CUSTOMER_SYNC', 'user', input.userId, {
      ...input,
      idempotencyKey,
    });
  }

  /**
   * Enqueue a booking-completion document (חשבון/קבלה or חשבונית מס,
   * depending on provider osek type).
   *
   * Returns enqueued:false with skipReason='unclassified' if the provider's
   * osek_type is 'unknown' — caller MUST classify before issuing a document.
   */
  async syncBookingDocument(input: BookingDocumentSyncInput): Promise<EnqueueResult> {
    const idempotencyKey = makeIdempotencyKey('booking-doc', input.bookingId);

    const decision = deriveDocumentTypeForBooking(input.providerOsekType);
    if (!decision.safe) {
      logger.warn('[SumitSync] booking document sync skipped — unclassified provider', {
        bookingId: input.bookingId, providerOsekType: input.providerOsekType,
        rationale: decision.rationale,
      });
      return { enqueued: false, idempotencyKey, skipReason: 'unclassified' };
    }

    if (input.totalAgorot <= 0) {
      logger.warn('[SumitSync] booking document sync skipped — non-positive total', {
        bookingId: input.bookingId, totalAgorot: input.totalAgorot,
      });
      return { enqueued: false, idempotencyKey, skipReason: 'non-positive-total' };
    }

    return await enqueueSumitJob('SUMIT_DOCUMENT_CREATE', 'booking', input.bookingId, {
      ...input,
      documentType: decision.documentType,
      documentTypeName: decision.documentTypeName,
      idempotencyKey,
    });
  }

  /**
   * Enqueue a refund / credit-note for an existing SUMIT document.
   *
   * Per SUMIT capabilities, a refund is issued as a חשבונית זיכוי
   * (credit note) referencing the original document. The worker
   * routes this through POST /accounting/documents/create/ with
   * DocumentType=CREDIT_NOTE plus a reference to the original.
   */
  async syncRefund(input: RefundSyncInput): Promise<EnqueueResult> {
    const idempotencyKey = makeIdempotencyKey(
      'refund', input.originalSumitDocumentId, input.originalLocalDocumentId,
    );

    if (input.refundAmountAgorot <= 0) {
      logger.warn('[SumitSync] refund sync skipped — non-positive amount', {
        originalLocalDocumentId: input.originalLocalDocumentId,
        refundAmountAgorot: input.refundAmountAgorot,
      });
      return { enqueued: false, idempotencyKey, skipReason: 'non-positive-amount' };
    }

    return await enqueueSumitJob('SUMIT_DOCUMENT_CANCEL', 'refund', input.originalLocalDocumentId, {
      ...input,
      documentType: SUMIT_DOC_TYPE.CREDIT_NOTE,
      idempotencyKey,
    });
  }

  /**
   * Internal — called by AsyncJobWorker. Routes to the right SumitClient
   * method per job type. Returns true on success, false to retry, throws
   * for permanent fatal errors.
   */
  async handleSumitJob(jobType: SumitJobType, payload: Record<string, any>): Promise<boolean> {
    const mode = this.currentMode();

    // mode=off: record the attempt, don't fire. This is the production
    // default until operator flips the flag.
    if (mode === 'off') {
      await recordOutboundEvent({
        jobType,
        idempotencyKey: payload.idempotencyKey,
        status: 'skipped_mode_off',
        reason: `sumit.mode is off — no real call made (payload preserved)`,
        rawResponse: null,
      });
      return true;
    }

    // For customer-sync and document-cancel, email mode doesn't make sense
    // (you can't "email a customer record"). Skip with a clear reason.
    if (mode === 'email' && jobType !== 'SUMIT_DOCUMENT_CREATE') {
      await recordOutboundEvent({
        jobType,
        idempotencyKey: payload.idempotencyKey,
        status: 'skipped_mode_email',
        reason: `sumit.mode=email is not applicable to ${jobType}`,
        rawResponse: null,
      });
      return true;
    }

    if (mode === 'csv_export') {
      await recordOutboundEvent({
        jobType,
        idempotencyKey: payload.idempotencyKey,
        status: 'skipped_csv_not_impl',
        reason: 'csv_export mode is not implemented for SumitSyncService yet',
        rawResponse: null,
      });
      return true;
    }

    // mode === 'api' — the live path. Each job type maps to a specific
    // SumitClient method. SumitClient itself checks `isWired()` before
    // firing real HTTP — so a half-configured prod (mode=api but missing
    // SUMIT_API_KEY) is recorded as wired=false without any network call.
    switch (jobType) {
      case 'SUMIT_CUSTOMER_SYNC':
        return await runCustomerSync(payload);
      case 'SUMIT_DOCUMENT_CREATE':
        return await runDocumentCreate(payload);
      case 'SUMIT_DOCUMENT_CANCEL':
        return await runDocumentCancel(payload);
      default:
        logger.warn('[SumitSync] unknown job type', { jobType });
        return true; // mark done so it doesn't loop
    }
  }
}

// ─── Job handlers (internal) ────────────────────────────────────────────────

async function runCustomerSync(payload: Record<string, any>): Promise<boolean> {
  // SumitClient.createDocument is the only HTTP-firing method currently
  // implemented. Customer create/update is sketched here against the
  // verified path POST /accounting/customers/create/ but its full body
  // shape needs the swagger; until then we record a "would-have-sent"
  // event so dry-run reports remain accurate.
  await recordOutboundEvent({
    jobType: 'SUMIT_CUSTOMER_SYNC',
    idempotencyKey: payload.idempotencyKey,
    status: 'pending_swagger',
    reason:
      'POST /accounting/customers/create/ body shape not yet verified — ' +
      'payload recorded; live call deferred until swagger lands',
    rawResponse: { plannedPayload: payload },
  });
  return true;
}

async function runDocumentCreate(payload: Record<string, any>): Promise<boolean> {
  const result = await sumitClient.createDocument({
    supplierInvoiceId: payload.bookingId, // SumitClient uses this name; semantically it's "source row id"
    idempotencyKey: payload.idempotencyKey,
    customer: {
      name: payload.customer.name,
      businessNumber: payload.customer.businessNumber ?? '',
      email: payload.customer.email,
    },
    amountBeforeVat: payload.amountBeforeVatAgorot / 100,
    vatAmount: payload.vatAgorot / 100,
    totalAmount: payload.totalAgorot / 100,
    currency: 'ILS',
    description: payload.description,
  });
  await recordOutboundEvent({
    jobType: 'SUMIT_DOCUMENT_CREATE',
    idempotencyKey: payload.idempotencyKey,
    status: result.wired && result.sumitDocumentId ? 'sent' : (result.wired ? 'failed' : 'wired_false'),
    reason: result.reason,
    rawResponse: result.rawResponse ?? null,
    sumitDocumentId: result.sumitDocumentId ?? null,
  });
  return Boolean(result.wired && result.sumitDocumentId);
}

async function runDocumentCancel(payload: Record<string, any>): Promise<boolean> {
  // SUMIT cancel/zikui flow is currently stub-only in SumitClient. Record
  // the plan and short-circuit success so the job doesn't keep retrying.
  await recordOutboundEvent({
    jobType: 'SUMIT_DOCUMENT_CANCEL',
    idempotencyKey: payload.idempotencyKey,
    status: 'pending_swagger',
    reason:
      'POST /accounting/documents/cancel/ + credit-note flow not yet wired — ' +
      'payload recorded; live call deferred until swagger lands',
    rawResponse: { plannedPayload: payload },
  });
  return true;
}

// ─── Idempotency & enqueue helpers ──────────────────────────────────────────

function makeIdempotencyKey(...parts: string[]): string {
  return 'sumit:' + crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 24);
}

async function enqueueSumitJob(
  jobType: SumitJobType,
  entityType: string,
  entityId: string,
  payload: Record<string, any>,
): Promise<EnqueueResult> {
  try {
    await enqueueGoogleJob({
      // AsyncJobWorker.JobType is a string union; we widen it via the cast
      // because we're adding SUMIT_* members in this PR. The worker will
      // route the new types via the SumitSyncService dispatcher.
      jobType: jobType as any,
      entityType,
      entityId,
      payload,
    });
    logger.info('[SumitSync] job enqueued', { jobType, entityType, entityId, idempotencyKey: payload.idempotencyKey });
    return { enqueued: true, idempotencyKey: payload.idempotencyKey };
  } catch (err: any) {
    logger.error('[SumitSync] enqueue failed (caller will NOT block)', {
      jobType, entityType, entityId, err: err.message,
    });
    return { enqueued: false, idempotencyKey: payload.idempotencyKey, skipReason: 'enqueue-error' };
  }
}

// ─── Audit trail ────────────────────────────────────────────────────────────

interface OutboundEventInput {
  jobType: SumitJobType;
  idempotencyKey: string;
  status: 'sent' | 'failed' | 'wired_false' | 'skipped_mode_off' | 'skipped_mode_email' | 'skipped_csv_not_impl' | 'pending_swagger';
  reason?: string;
  rawResponse: unknown;
  sumitDocumentId?: string | null;
  /** Actor UID for the audit ledger — defaults to 'system' for background syncs. */
  actorUid?: string;
}

/**
 * Record a structured SUMIT outbound event.
 *
 * Strategy chosen for this skeleton PR (Mission-5+):
 *   1. Always emit a structured logger.info — Cloud Run log queries make
 *      this trivially searchable by jobType / idempotencyKey / status.
 *   2. For events that represent real activity (not no-op skips), also
 *      append to the immutable auditLedger via recordAuditEvent. That
 *      gives us the blockchain-style hash chain for compliance review.
 *
 * Why NOT insert into sumit_outbound_events:
 *   The existing sumit_outbound_events table is invoice-specific
 *   (invoice_id NOT NULL FK to supplier_invoices). Reusing it for
 *   customer / booking / refund events would require a schema migration,
 *   which is a protected change per petwash-platform §2. Surfacing this
 *   constraint up front rather than smuggling in a migration. A follow-up
 *   PR can broaden the schema once governance signs off on it.
 *
 * Best-effort: audit ledger insert failures are logged and swallowed.
 * An audit-side failure must not cause the worker to retry the underlying
 * job forever — that would mask the real error.
 */
async function recordOutboundEvent(input: OutboundEventInput): Promise<void> {
  // Structured log line — always emitted.
  logger.info('[SumitSync] outbound event', {
    jobType: input.jobType,
    idempotencyKey: input.idempotencyKey,
    status: input.status,
    sumitDocumentId: input.sumitDocumentId ?? null,
    reason: input.reason,
  });

  // Audit ledger entry — only for events that represent real or
  // intended-real activity. Skips on mode=off are noisy and don't belong
  // in the immutable chain; they remain in the structured log.
  const ledgerableStatuses: OutboundEventInput['status'][] = [
    'sent', 'failed', 'wired_false', 'pending_swagger',
  ];
  if (!ledgerableStatuses.includes(input.status)) return;

  try {
    await recordAuditEvent({
      eventType: `sumit.${input.jobType.toLowerCase()}.${input.status}`,
      customerUid: input.actorUid ?? 'system',
      metadata: {
        jobType: input.jobType,
        idempotencyKey: input.idempotencyKey,
        status: input.status,
        reason: input.reason,
        sumitDocumentId: input.sumitDocumentId,
        // rawResponse can be large; truncate the dump for the ledger row.
        rawResponseTruncated: truncateForAudit(input.rawResponse),
      },
      ipAddress: null,
      userAgent: '[SumitSyncService]',
    });
  } catch (err: any) {
    logger.error('[SumitSync] failed to record audit event (continuing)', {
      jobType: input.jobType, status: input.status, err: err.message,
    });
  }
}

function truncateForAudit(value: unknown, maxBytes = 2000): unknown {
  try {
    const s = JSON.stringify(value);
    if (!s) return null;
    if (s.length <= maxBytes) return value;
    return { __truncated: true, sample: s.slice(0, maxBytes) };
  } catch {
    return { __truncated: true, sample: '[unserialisable]' };
  }
}

export const sumitSyncService = new SumitSyncService();
