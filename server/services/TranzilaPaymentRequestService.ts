/**
 * PetWash™ TranzilaPaymentRequestService
 *
 * OUTBOUND service — creates and manages Tranzila payment requests (remote pay).
 * Distinct from TranzilaPaymentRequestMapper, which ingests inbound webhook events.
 *
 * A Tranzila payment request is a hosted payment link that Tranzila sends to the
 * customer by email or SMS. PetWash uses this for:
 *   - Offline / manual invoicing by support agents
 *   - Recovery flows for failed online charges
 *   - Provider-initiated payment collection
 *
 * OWNERSHIP:
 *   Tranzila hosts the payment page and sends the email/SMS.
 *   PetWash creates the request, stores the paymentRequestId, and tracks status
 *   via TranzilaPaymentRequestMapper (webhook ingest).
 *
 * FEATURE FLAG: TRANZILA_PAYMENT_REQUESTS_ENABLED must be true.
 *
 * DEPENDENCY: Tranzila credentials (TRANZILA_TERMINAL_NAME, TRANZILA_API_KEY)
 * must be set in environment before this service can execute live calls.
 *
 * TODO (before enabling in production):
 *   1. Confirm Tranzila payment-request API endpoint and auth scheme with account rep.
 *   2. Implement _callTranzilaCreatePaymentRequest() using real REST call.
 *   3. Store TRANZILA_API_KEY in secret manager — never in source.
 *   4. Get CPA sign-off on which product types trigger automatic VAT document issuance.
 */

import { db } from '../db';
import { tranzilaPaymentRequests } from '../../shared/schema-tranzila';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { TRANZILA_PAYMENT_REQUESTS_ENABLED } from '../lib/payment-flags';
import { nanoid } from 'nanoid';

// ── Credentials (read from env, never hardcoded) ─────────────────────────────
const TERMINAL_NAME = process.env.TRANZILA_TERMINAL_NAME;
const API_KEY       = process.env.TRANZILA_API_KEY;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreatePaymentRequestParams {
  /** PetWash idempotency key — unique per request attempt */
  idempotencyKey: string;
  /** Amount in CENTS (ILS × 100) */
  amountCents: number;
  /** Customer display name (shown on Tranzila payment page) */
  customerName: string;
  /** Customer email to receive the payment link */
  customerEmail?: string;
  /** Customer phone for SMS delivery */
  customerPhone?: string;
  /** Free-text description shown on the Tranzila payment page */
  description?: string;
  /**
   * PetWash domain context — sets what happens after payment is confirmed.
   * webhook handler routes the confirmation back via productType.
   */
  productType: 'egift_purchase' | 'wallet_topup' | 'marketplace_booking' | 'manual_collection';
  /** FK → bookings.id if applicable */
  bookingId?: string;
  /** FK → users.id (customer) */
  customerId?: string;
  /** FK → users.id (provider, if relevant) */
  providerId?: string;
  /** ISO 8601 expiry for the payment link — defaults to 7 days */
  expiresAt?: Date;
}

export interface CreatePaymentRequestResult {
  outcome: 'created' | 'disabled' | 'credentials_missing' | 'already_exists' | 'error';
  /** Tranzila's payment request ID (returned in their API response) */
  paymentRequestId?: string;
  /** The hosted payment URL to send to the customer */
  paymentUrl?: string;
  error?: string;
}

export interface CancelPaymentRequestResult {
  outcome: 'cancelled' | 'not_found' | 'already_terminal' | 'disabled' | 'error';
  paymentRequestId?: string;
  error?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class TranzilaPaymentRequestService {
  /**
   * Create a new Tranzila payment request (hosted payment link).
   *
   * Idempotent: if a request with the same idempotencyKey already exists in the
   * DB, returns the existing record without calling Tranzila again.
   *
   * After creation, the PetWash row is updated via TranzilaPaymentRequestMapper
   * when Tranzila posts a webhook event to /api/payments/tranzila/webhook.
   */
  static async create(params: CreatePaymentRequestParams): Promise<CreatePaymentRequestResult> {
    if (!TRANZILA_PAYMENT_REQUESTS_ENABLED) {
      logger.warn('[TranzilaPaymentRequestService] TRANZILA_PAYMENT_REQUESTS_ENABLED is false — skipping', {
        idempotencyKey: params.idempotencyKey,
      });
      return { outcome: 'disabled' };
    }

    if (!TERMINAL_NAME || !API_KEY) {
      logger.error('[TranzilaPaymentRequestService] Missing credentials — TRANZILA_TERMINAL_NAME or TRANZILA_API_KEY not set');
      return { outcome: 'credentials_missing', error: 'Tranzila credentials not configured.' };
    }

    // Idempotency: return existing row if already created
    const existing = await db
      .select()
      .from(tranzilaPaymentRequests)
      .where(eq(tranzilaPaymentRequests.idempotencyKey, params.idempotencyKey))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      logger.info('[TranzilaPaymentRequestService] Returning existing payment request (idempotent)', {
        idempotencyKey: params.idempotencyKey,
        paymentRequestId: row.paymentRequestId,
        status: row.status,
      });
      return {
        outcome: 'already_exists',
        paymentRequestId: row.paymentRequestId,
      };
    }

    // Call Tranzila API to create the payment request
    const apiResult = await TranzilaPaymentRequestService._callTranzilaCreatePaymentRequest(params);
    if (!apiResult.success) {
      logger.error('[TranzilaPaymentRequestService] Tranzila API call failed', {
        idempotencyKey: params.idempotencyKey,
        error: apiResult.error,
      });
      return { outcome: 'error', error: apiResult.error };
    }

    const paymentRequestId = apiResult.paymentRequestId!;

    // Persist to PetWash DB
    await db.insert(tranzilaPaymentRequests).values({
      paymentRequestId,
      idempotencyKey: params.idempotencyKey,
      amountCents: params.amountCents,
      status: 'created',
      customerId: params.customerId ?? null,
      processorPayloadRaw: {
        created_by: 'TranzilaPaymentRequestService',
        productType: params.productType,
        bookingId: params.bookingId ?? null,
        apiResponse: apiResult.rawResponse,
      } as any,
    });

    logger.info('[TranzilaPaymentRequestService] Payment request created', {
      paymentRequestId,
      idempotencyKey: params.idempotencyKey,
      productType: params.productType,
      amountCents: params.amountCents,
    });

    return {
      outcome: 'created',
      paymentRequestId,
      paymentUrl: apiResult.paymentUrl,
    };
  }

  /**
   * Request cancellation of an existing payment request via Tranzila API.
   *
   * Only cancels if the current status is not already terminal (paid/cancelled/expired).
   * PetWash status is updated synchronously on successful API cancellation.
   * A Tranzila webhook confirmation may still arrive — TranzilaPaymentRequestMapper
   * handles the no-change case idempotently.
   */
  static async cancel(paymentRequestId: string): Promise<CancelPaymentRequestResult> {
    if (!TRANZILA_PAYMENT_REQUESTS_ENABLED) {
      return { outcome: 'disabled' };
    }

    const existing = await db
      .select()
      .from(tranzilaPaymentRequests)
      .where(eq(tranzilaPaymentRequests.paymentRequestId, paymentRequestId))
      .limit(1);

    if (existing.length === 0) {
      return { outcome: 'not_found', paymentRequestId };
    }

    const row = existing[0];
    const TERMINAL = ['paid', 'cancelled', 'expired'] as const;
    if (TERMINAL.includes(row.status as any)) {
      return { outcome: 'already_terminal', paymentRequestId };
    }

    // TODO: implement real Tranzila cancel API call
    // Until implemented, mark as cancelled locally for test/admin use
    logger.warn('[TranzilaPaymentRequestService] cancel() API call not yet implemented — updating status locally', {
      paymentRequestId,
    });

    await db
      .update(tranzilaPaymentRequests)
      .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(tranzilaPaymentRequests.paymentRequestId, paymentRequestId));

    logger.info('[TranzilaPaymentRequestService] Payment request cancelled', { paymentRequestId });
    return { outcome: 'cancelled', paymentRequestId };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Actual Tranzila REST API call to create a payment request.
   *
   * TODO: implement using real Tranzila payment-request API.
   * API endpoint and auth scheme to be confirmed with Tranzila account rep.
   * Expected response structure: { payment_request_id, payment_url, ... }
   */
  private static async _callTranzilaCreatePaymentRequest(
    params: CreatePaymentRequestParams,
  ): Promise<{
    success: boolean;
    paymentRequestId?: string;
    paymentUrl?: string;
    rawResponse?: unknown;
    error?: string;
  }> {
    logger.error(
      '[TranzilaPaymentRequestService] _callTranzilaCreatePaymentRequest not yet implemented — returning failure (safe default)',
      {
        productType: params.productType,
        amountCents: params.amountCents,
        idempotencyKey: params.idempotencyKey,
      },
    );
    return {
      success: false,
      error: 'Tranzila payment-request API call not yet implemented. Wire real API call before enabling flag.',
    };
  }
}

export default TranzilaPaymentRequestService;
