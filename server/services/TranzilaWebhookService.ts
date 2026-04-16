/**
 * PetWash™ TranzilaWebhookService
 *
 * Idempotent dispatcher for all Tranzila webhook events.
 *
 * CONTRACT:
 *   - Verifies HMAC-SHA256 signature before dispatching ANY event.
 *     Returns verified=false if secret is not configured → fail-closed, not fail-open.
 *   - Each event type dispatches to the correct mapper.
 *   - All dispatches are logged with structured context for audit trail.
 *   - Handlers must be idempotent — calling with the same event twice is safe.
 *
 * SUPPORTED EVENTS (10 total):
 *   Charge flow:
 *     payment_success        — charge approved by Tranzila
 *     payment_failed         — charge declined or errored
 *     refund_success         — refund confirmed by Tranzila
 *     refund_failed          — refund declined or errored
 *   Payment request:
 *     payment_request_paid   — customer paid the Tranzila-hosted payment link
 *     payment_request_cancelled — request cancelled or expired
 *   Chargeback:
 *     chargeback_opened      — new chargeback case from bank/card scheme
 *     chargeback_updated     — case status updated (evidence_needed, won, lost, etc.)
 *   Settlement:
 *     settlement_imported    — settlement batch available for reconciliation
 *   Documents:
 *     document_issued        — Tranzila issued an accounting document
 *
 * SIGNATURE VERIFICATION:
 *   TODO (before production): implement HMAC-SHA256 using TRANZILA_WEBHOOK_SECRET.
 *   Current state: fails closed (rejects all) when secret is missing.
 *   Signature bypass is opt-in via TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true.
 *   That flag is FORBIDDEN in production and staging (startup guard in index.ts).
 */

import crypto from 'crypto';
import { logger } from '../lib/logger';
import { db } from '../db';
import { tranzilaTransactions } from '../../shared/schema-tranzila';
import { and, eq, ne } from 'drizzle-orm';
import TranzilaDocumentMapper from './TranzilaDocumentMapper';
import TranzilaPaymentRequestMapper from './TranzilaPaymentRequestMapper';
import TranzilaChargebackMapper from './TranzilaChargebackMapper';
import { nanoid } from 'nanoid';

const WEBHOOK_SECRET = process.env.TRANZILA_WEBHOOK_SECRET;

export type TranzilaWebhookEventType =
  | 'payment_success'
  | 'payment_failed'
  | 'refund_success'
  | 'refund_failed'
  | 'payment_request_paid'
  | 'payment_request_cancelled'
  | 'chargeback_opened'
  | 'chargeback_updated'
  | 'settlement_imported'
  | 'document_issued';

export interface TranzilaWebhookPayload {
  event: TranzilaWebhookEventType;
  /** Tranzila processor transaction ID (present for charge/refund/document events) */
  tran_num?: string;
  /** Tranzila payment request ID (present for payment_request_* events) */
  payment_request_id?: string;
  /** Tranzila chargeback case ID (present for chargeback_* events) */
  chargeback_case_id?: string;
  /** Tranzila settlement batch reference */
  settlement_batch_reference?: string;
  /** Amount in ILS (Tranzila uses decimal) */
  sum?: number | string;
  /** Tranzila response code (000 = success) */
  Response?: string;
  /** Tranzila document number */
  doc_number?: string;
  /** Tranzila document type */
  doc_type?: string;
  /** Tranzila document URL */
  doc_url?: string;
  /** Chargeback reason code */
  reason_code?: string;
  reason_description?: string;
  /** Chargeback evidence deadline (ISO string) */
  evidence_deadline?: string;
  /** Chargeback status */
  chargeback_status?: string;
  /** Timestamp of the event (ISO string) */
  event_at?: string;
  /** Any additional fields from Tranzila */
  [key: string]: unknown;
}

export interface TranzilaWebhookDispatchResult {
  verified: boolean;
  eventType?: TranzilaWebhookEventType;
  outcome?: string;
  processorTransactionId?: string;
  error?: string;
}

export class TranzilaWebhookService {
  // ── Signature verification ─────────────────────────────────────────────────

  /**
   * Verify the HMAC-SHA256 signature on an inbound Tranzila webhook.
   *
   * Tranzila sends the signature in the X-Tranzila-Signature header.
   * The signature is computed over the raw request body bytes.
   *
   * Returns false when:
   *   - TRANZILA_WEBHOOK_SECRET is not configured (fail-closed)
   *   - Signature header is missing or malformed
   *   - Computed digest does not match
   *
   * TODO: implement and validate against Tranzila's actual signing scheme
   * before enabling any Tranzila flag in production.
   */
  static verifySignature(rawBody: string | Buffer, signatureHeader: string | undefined): { ok: boolean; rejectReason?: string } {
    if (!WEBHOOK_SECRET) {
      logger.error('[TranzilaWebhookService] TRANZILA_WEBHOOK_SECRET not set — ' +
        'rejecting all webhooks (fail-closed)', {
        audit: 'webhook_rejected',
        reason: 'missing_secret',
      });
      return { ok: false, rejectReason: 'missing_secret' };
    }

    if (!signatureHeader) {
      logger.warn('[TranzilaWebhookService] Missing X-Tranzila-Signature header — rejecting', {
        audit: 'webhook_rejected',
        reason: 'missing_signature',
      });
      return { ok: false, rejectReason: 'missing_signature' };
    }

    // Bypass is OPT-IN via explicit env flag — never opt-out based on NODE_ENV.
    // Set TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true ONLY in isolated local dev.
    // FORBIDDEN in production and staging (startup guard in server/index.ts).
    if (process.env.TRANZILA_WEBHOOK_BYPASS_SIGNATURE === 'true') {
      logger.warn(
        '[TranzilaWebhookService] ⚠️  TRANZILA_WEBHOOK_BYPASS_SIGNATURE=true: ' +
        'signature verification bypassed. MUST NOT be set in staging or production.',
        { audit: 'webhook_bypass_active' },
      );
      return { ok: true };
    }

    try {
      const expectedDigest = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
      const expected = `sha256=${expectedDigest}`;

      // Pad both sides to equal length before timingSafeEqual to avoid
      // throwing on length mismatch (which itself would be a timing oracle).
      const sig = Buffer.alloc(expected.length, 0);
      Buffer.from(signatureHeader).copy(sig);
      const exp = Buffer.from(expected);

      const match = sig.length === exp.length && crypto.timingSafeEqual(sig, exp);
      if (!match) {
        logger.warn('[TranzilaWebhookService] X-Tranzila-Signature does not match — rejecting', {
          audit: 'webhook_rejected',
          reason: 'invalid_signature',
        });
        return { ok: false, rejectReason: 'invalid_signature' };
      }
      return { ok: true };
    } catch {
      logger.error('[TranzilaWebhookService] Signature comparison threw — rejecting', {
        audit: 'webhook_rejected',
        reason: 'signature_error',
      });
      return { ok: false, rejectReason: 'signature_error' };
    }
  }

  // ── Main dispatcher ────────────────────────────────────────────────────────

  /**
   * Dispatch an inbound Tranzila webhook event to the correct handler.
   *
   * Call this AFTER verifySignature returns true.
   * Returns the handler outcome for the HTTP response.
   */
  static async dispatch(
    payload: TranzilaWebhookPayload,
  ): Promise<TranzilaWebhookDispatchResult> {
    const { event } = payload;

    logger.info('[TranzilaWebhookService] Dispatching webhook event', {
      event,
      tran_num: payload.tran_num,
      payment_request_id: payload.payment_request_id,
      chargeback_case_id: payload.chargeback_case_id,
    });

    switch (event) {
      case 'payment_success':
        return TranzilaWebhookService._handlePaymentSuccess(payload);

      case 'payment_failed':
        return TranzilaWebhookService._handlePaymentFailed(payload);

      case 'refund_success':
        return TranzilaWebhookService._handleRefundSuccess(payload);

      case 'refund_failed':
        return TranzilaWebhookService._handleRefundFailed(payload);

      case 'payment_request_paid':
        return TranzilaWebhookService._handlePaymentRequestPaid(payload);

      case 'payment_request_cancelled':
        return TranzilaWebhookService._handlePaymentRequestCancelled(payload);

      case 'chargeback_opened':
        return TranzilaWebhookService._handleChargebackOpened(payload);

      case 'chargeback_updated':
        return TranzilaWebhookService._handleChargebackUpdated(payload);

      case 'settlement_imported':
        return TranzilaWebhookService._handleSettlementImported(payload);

      case 'document_issued':
        return TranzilaWebhookService._handleDocumentIssued(payload);

      default:
        logger.warn('[TranzilaWebhookService] Unknown event type — ignored', { event });
        return { verified: true, eventType: event as TranzilaWebhookEventType, outcome: 'unknown_event' };
    }
  }

  // ── Private handlers ───────────────────────────────────────────────────────

  private static async _handlePaymentSuccess(
    payload: TranzilaWebhookPayload,
  ): Promise<TranzilaWebhookDispatchResult> {
    const processorTransactionId = payload.tran_num;
    if (!processorTransactionId) {
      logger.error('[TranzilaWebhookService] payment_success missing tran_num');
      return { verified: true, eventType: 'payment_success', outcome: 'error', error: 'Missing tran_num' };
    }

    // Extract processor auth number (Tranzila 'auth_num' — bank authorization number).
    // Prefer payload.auth_num; fall back to payload.AuthNum if Tranzila uses that casing.
    const processorAuthNumber =
      (payload.auth_num as string | undefined) ??
      (payload.AuthNum as string | undefined) ??
      undefined;

    // Update tranzila_transactions row to confirmed
    const existing = await db
      .select()
      .from(tranzilaTransactions)
      .where(eq(tranzilaTransactions.processorTransactionId, processorTransactionId))
      .limit(1);

    if (existing.length === 0) {
      logger.warn('[TranzilaWebhookService] payment_success received for unknown transaction — storing as new', {
        processorTransactionId,
      });
      // Create a minimal row — full row will have been created by the charge call
      // This branch handles cases where the API response came AFTER the webhook (race)
      const idempotencyKey = `webhook-ps-${processorTransactionId}-${nanoid(6)}`;
      await db.insert(tranzilaTransactions).values({
        idempotencyKey,
        processorTransactionId,
        transactionKind: 'charge',
        productType: 'unknown',
        amountCents: typeof payload.sum === 'number'
          ? Math.round(payload.sum * 100)
          : parseInt(String(payload.sum ?? '0'), 10) * 100,
        status: 'confirmed',
        processorAuthNumber: processorAuthNumber ?? null,
        processorConfirmedAt: payload.event_at ? new Date(payload.event_at) : new Date(),
        processorPayloadRaw: payload as any,
      });
    } else {
      await db
        .update(tranzilaTransactions)
        .set({
          status: 'confirmed',
          processorAuthNumber: processorAuthNumber ?? undefined,
          processorConfirmedAt: payload.event_at ? new Date(payload.event_at) : new Date(),
          processorPayloadRaw: payload as any,
          updatedAt: new Date(),
        })
        .where(eq(tranzilaTransactions.processorTransactionId, processorTransactionId));
    }

    // If document info is embedded in this webhook, ingest it
    if (payload.doc_number && existing.length > 0) {
      const tx = existing[0];
      await TranzilaDocumentMapper.ingest({
        idempotencyKey: tx.idempotencyKey,
        processorTransactionId,
        processorDocumentNumber: payload.doc_number,
        processorDocumentType: payload.doc_type ?? 'receipt',
        processorDocumentUrl: payload.doc_url as string | undefined,
        processorDocumentIssuedAt: payload.event_at,
        pwPaymentId: tx.pwPaymentId ?? undefined,
        customerId: tx.customerId ?? undefined,
        bookingId: tx.bookingId ?? undefined,
        grossCents: tx.amountCents,
        vatCents: 0, // TODO: extract from payload when Tranzila provides it
      });
    }

    logger.info('[TranzilaWebhookService] payment_success processed', { processorTransactionId, processorAuthNumber });
    return { verified: true, eventType: 'payment_success', outcome: 'confirmed', processorTransactionId };
  }

  private static async _handlePaymentFailed(
    payload: TranzilaWebhookPayload,
  ): Promise<TranzilaWebhookDispatchResult> {
    const processorTransactionId = payload.tran_num;
    if (processorTransactionId) {
      await db
        .update(tranzilaTransactions)
        .set({ status: 'declined', processorPayloadRaw: payload as any, updatedAt: new Date() })
        .where(eq(tranzilaTransactions.processorTransactionId, processorTransactionId));
    }
    logger.warn('[TranzilaWebhookService] payment_failed received', {
      processorTransactionId,
      Response: payload.Response,
    });
    return { verified: true, eventType: 'payment_failed', outcome: 'declined', processorTransactionId };
  }

  private static async _handleRefundSuccess(
    payload: TranzilaWebhookPayload,
  ): Promise<TranzilaWebhookDispatchResult> {
    const processorTransactionId = payload.tran_num;
    if (processorTransactionId) {
      // DB-LEVEL IDEMPOTENCY GUARD:
      // Only update rows that are NOT already marked 'refunded'.
      // This prevents a second delivery of the same refund_success event from
      // being applied twice — even if Redis dedup is bypassed or unavailable.
      // A duplicate delivery updates zero rows and is logged as a no-op.
      const result = await db
        .update(tranzilaTransactions)
        .set({
          status: 'refunded',
          processorRefundStatus: 'confirmed',
          processorPayloadRaw: payload as any,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tranzilaTransactions.processorTransactionId, processorTransactionId),
            ne(tranzilaTransactions.status, 'refunded'),        // DB-level guard
            ne(tranzilaTransactions.processorRefundStatus, 'confirmed'), // belt-and-suspenders
          ),
        );

      // Drizzle returns the affected rows — log if the guard fired (duplicate detected)
      const affectedRows = (result as any)?.rowCount ?? (result as any)?.rowsAffected ?? -1;
      if (affectedRows === 0) {
        logger.warn(
          '[TranzilaWebhookService] refund_success duplicate — row already refunded, no DB write',
          { audit: 'webhook_rejected', reason: 'duplicate_refund', processorTransactionId },
        );
        return { verified: true, eventType: 'refund_success', outcome: 'already_refunded', processorTransactionId };
      }
    }
    logger.info('[TranzilaWebhookService] refund_success processed', { processorTransactionId });
    return { verified: true, eventType: 'refund_success', outcome: 'refunded', processorTransactionId };
  }

  private static async _handleRefundFailed(
    payload: TranzilaWebhookPayload,
  ): Promise<TranzilaWebhookDispatchResult> {
    const processorTransactionId = payload.tran_num;
    if (processorTransactionId) {
      await db
        .update(tranzilaTransactions)
        .set({
          processorRefundStatus: 'failed',
          processorPayloadRaw: payload as any,
          updatedAt: new Date(),
        })
        .where(eq(tranzilaTransactions.processorTransactionId, processorTransactionId));
    }
    logger.error('[TranzilaWebhookService] refund_failed received', { processorTransactionId });
    return { verified: true, eventType: 'refund_failed', outcome: 'refund_failed', processorTransactionId };
  }

  private static async _handlePaymentRequestPaid(
    payload: TranzilaWebhookPayload,
  ): Promise<TranzilaWebhookDispatchResult> {
    const paymentRequestId = payload.payment_request_id;
    if (!paymentRequestId) {
      return { verified: true, eventType: 'payment_request_paid', outcome: 'error', error: 'Missing payment_request_id' };
    }
    const result = await TranzilaPaymentRequestMapper.applyWebhookEvent({
      paymentRequestId,
      status: 'paid',
      processorTransactionId: payload.tran_num,
      amountCents: typeof payload.sum === 'number'
        ? Math.round(payload.sum * 100)
        : parseInt(String(payload.sum ?? '0'), 10) * 100,
      eventAt: payload.event_at,
      rawPayload: payload,
    });
    return { verified: true, eventType: 'payment_request_paid', outcome: result.outcome };
  }

  private static async _handlePaymentRequestCancelled(
    payload: TranzilaWebhookPayload,
  ): Promise<TranzilaWebhookDispatchResult> {
    const paymentRequestId = payload.payment_request_id;
    if (!paymentRequestId) {
      return { verified: true, eventType: 'payment_request_cancelled', outcome: 'error', error: 'Missing payment_request_id' };
    }
    const status = (payload.chargeback_status as 'cancelled' | 'expired') ?? 'cancelled';
    const result = await TranzilaPaymentRequestMapper.applyWebhookEvent({
      paymentRequestId,
      status,
      eventAt: payload.event_at,
      rawPayload: payload,
    });
    return { verified: true, eventType: 'payment_request_cancelled', outcome: result.outcome };
  }

  private static async _handleChargebackOpened(
    payload: TranzilaWebhookPayload,
  ): Promise<TranzilaWebhookDispatchResult> {
    const chargebackCaseId = payload.chargeback_case_id;
    const processorTransactionId = payload.tran_num;
    if (!chargebackCaseId || !processorTransactionId) {
      return { verified: true, eventType: 'chargeback_opened', outcome: 'error', error: 'Missing IDs' };
    }
    const result = await TranzilaChargebackMapper.applyWebhookEvent({
      chargebackCaseId,
      processorTransactionId,
      status: 'opened',
      disputedAmountCents: typeof payload.sum === 'number'
        ? Math.round(payload.sum * 100)
        : parseInt(String(payload.sum ?? '0'), 10) * 100,
      reasonCode: payload.reason_code as string | undefined,
      reasonDescription: payload.reason_description as string | undefined,
      openedAt: payload.event_at,
      evidenceDeadlineAt: payload.evidence_deadline as string | undefined,
      rawPayload: payload,
    });
    return { verified: true, eventType: 'chargeback_opened', outcome: result.outcome };
  }

  private static async _handleChargebackUpdated(
    payload: TranzilaWebhookPayload,
  ): Promise<TranzilaWebhookDispatchResult> {
    const chargebackCaseId = payload.chargeback_case_id;
    const processorTransactionId = payload.tran_num;
    if (!chargebackCaseId || !processorTransactionId) {
      return { verified: true, eventType: 'chargeback_updated', outcome: 'error', error: 'Missing IDs' };
    }
    type ValidStatus = 'opened' | 'evidence_needed' | 'evidence_submitted' | 'won' | 'lost' | 'cancelled';
    const cbStatus = (payload.chargeback_status as ValidStatus) ?? 'evidence_needed';
    const result = await TranzilaChargebackMapper.applyWebhookEvent({
      chargebackCaseId,
      processorTransactionId,
      status: cbStatus,
      disputedAmountCents: typeof payload.sum === 'number'
        ? Math.round(payload.sum * 100)
        : parseInt(String(payload.sum ?? '0'), 10) * 100,
      reasonCode: payload.reason_code as string | undefined,
      evidenceDeadlineAt: payload.evidence_deadline as string | undefined,
      resolvedAt: payload.event_at,
      rawPayload: payload,
    });
    return { verified: true, eventType: 'chargeback_updated', outcome: result.outcome };
  }

  private static async _handleSettlementImported(
    payload: TranzilaWebhookPayload,
  ): Promise<TranzilaWebhookDispatchResult> {
    // Settlement import is handled via the admin endpoint — webhook just notifies.
    // Log with structured context so the admin team knows a new batch is available.
    logger.info('[TranzilaWebhookService] settlement_imported notification received', {
      settlement_batch_reference: payload.settlement_batch_reference,
      event_at: payload.event_at,
      action: 'Admin must import via POST /api/admin/finance/tranzila/settlement/import',
    });
    return { verified: true, eventType: 'settlement_imported', outcome: 'notified' };
  }

  private static async _handleDocumentIssued(
    payload: TranzilaWebhookPayload,
  ): Promise<TranzilaWebhookDispatchResult> {
    const processorTransactionId = payload.tran_num;
    const processorDocumentNumber = payload.doc_number;
    if (!processorDocumentNumber || !processorTransactionId) {
      return { verified: true, eventType: 'document_issued', outcome: 'error', error: 'Missing doc_number or tran_num' };
    }

    const existing = await db
      .select()
      .from(tranzilaTransactions)
      .where(eq(tranzilaTransactions.processorTransactionId, processorTransactionId))
      .limit(1);

    const tx = existing[0];
    const result = await TranzilaDocumentMapper.ingest({
      idempotencyKey: tx?.idempotencyKey ?? `doc-${processorTransactionId}`,
      processorTransactionId,
      processorDocumentNumber,
      processorDocumentType: payload.doc_type ?? 'receipt',
      processorDocumentUrl: payload.doc_url as string | undefined,
      processorDocumentIssuedAt: payload.event_at,
      pwPaymentId: tx?.pwPaymentId ?? undefined,
      customerId: tx?.customerId ?? undefined,
      bookingId: tx?.bookingId ?? undefined,
      grossCents: tx?.amountCents ?? 0,
      vatCents: 0,
    });
    return { verified: true, eventType: 'document_issued', outcome: result.outcome };
  }
}

export default TranzilaWebhookService;
