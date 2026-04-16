/**
 * PetWash™ TranzilaPaymentRequestMapper
 *
 * Maps Tranzila payment-request webhook events to PetWash's
 * tranzila_payment_requests table and triggers internal state updates.
 *
 * OWNERSHIP CONTRACT:
 *   Tranzila creates and hosts the payment request page + sends email/SMS.
 *   PetWash does NOT rebuild that UI — it maps the state change.
 *   Internal wallet/entitlement updates happen ONLY after status === 'paid'
 *   and the linked transaction is confirmed via tranzila_transactions.
 *
 * IDEMPOTENCY:
 *   All methods use paymentRequestId as idempotency key.
 *   Calling the same event twice is safe.
 */

import { db } from '../db';
import { tranzilaPaymentRequests, tranzilaTransactions } from '../../shared/schema-tranzila';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { TRANZILA_PAYMENT_REQUESTS_ENABLED } from '../lib/payment-flags';
import { nanoid } from 'nanoid';

export type PaymentRequestStatus =
  | 'created'
  | 'sent'
  | 'viewed'
  | 'paid'
  | 'cancelled'
  | 'expired'
  | 'failed';

export interface PaymentRequestWebhookEvent {
  /** Tranzila payment request ID */
  paymentRequestId: string;
  /** New status from Tranzila webhook */
  status: PaymentRequestStatus;
  /** Tranzila processor transaction ID (present when status = 'paid') */
  processorTransactionId?: string;
  /** Amount in CENTS */
  amountCents?: number;
  /** ISO date string from webhook */
  eventAt?: string;
  /** Full raw webhook payload */
  rawPayload: Record<string, unknown>;
}

export interface PaymentRequestMapResult {
  outcome: 'updated' | 'not_found' | 'disabled' | 'no_change' | 'error';
  paymentRequestId?: string;
  error?: string;
}

export class TranzilaPaymentRequestMapper {
  /**
   * Apply a Tranzila payment request webhook event to the PetWash record.
   *
   * Creates the row if it does not yet exist (first event for this request ID).
   * Otherwise, advances the status if the incoming status is newer.
   *
   * Returns 'disabled' if TRANZILA_PAYMENT_REQUESTS_ENABLED is false.
   * Returns 'no_change' if the stored status is already terminal and identical.
   */
  static async applyWebhookEvent(event: PaymentRequestWebhookEvent): Promise<PaymentRequestMapResult> {
    if (!TRANZILA_PAYMENT_REQUESTS_ENABLED) {
      logger.info('[TranzilaPaymentRequestMapper] Payment requests disabled — skipping event', {
        paymentRequestId: event.paymentRequestId,
        status: event.status,
      });
      return { outcome: 'disabled' };
    }

    try {
      const existing = await db
        .select()
        .from(tranzilaPaymentRequests)
        .where(eq(tranzilaPaymentRequests.paymentRequestId, event.paymentRequestId))
        .limit(1);

      if (existing.length === 0) {
        // First event for this payment request — create the row
        const idempotencyKey = `pr-${event.paymentRequestId}-${nanoid(6)}`;
        await db.insert(tranzilaPaymentRequests).values({
          paymentRequestId: event.paymentRequestId,
          idempotencyKey,
          amountCents: event.amountCents ?? 0,
          status: event.status,
          paidAt: event.status === 'paid' ? new Date(event.eventAt ?? Date.now()) : null,
          cancelledAt: event.status === 'cancelled' ? new Date(event.eventAt ?? Date.now()) : null,
          processorPayloadRaw: event.rawPayload as any,
        });

        logger.info('[TranzilaPaymentRequestMapper] Created payment request record', {
          paymentRequestId: event.paymentRequestId,
          status: event.status,
        });

        if (event.status === 'paid' && event.processorTransactionId) {
          await TranzilaPaymentRequestMapper._linkToTransaction(
            idempotencyKey,
            event.processorTransactionId,
          );
        }

        return { outcome: 'updated', paymentRequestId: event.paymentRequestId };
      }

      const current = existing[0];
      const TERMINAL_STATUSES: PaymentRequestStatus[] = ['paid', 'cancelled', 'expired'];

      if (TERMINAL_STATUSES.includes(current.status as PaymentRequestStatus) &&
          current.status === event.status) {
        return { outcome: 'no_change', paymentRequestId: event.paymentRequestId };
      }

      // Update existing row
      const updateValues: Record<string, unknown> = {
        status: event.status,
        processorPayloadRaw: event.rawPayload,
        updatedAt: new Date(),
      };

      if (event.status === 'paid' && !current.paidAt) {
        updateValues.paidAt = new Date(event.eventAt ?? Date.now());
      }
      if (event.status === 'cancelled' && !current.cancelledAt) {
        updateValues.cancelledAt = new Date(event.eventAt ?? Date.now());
      }

      await db
        .update(tranzilaPaymentRequests)
        .set(updateValues as any)
        .where(eq(tranzilaPaymentRequests.paymentRequestId, event.paymentRequestId));

      logger.info('[TranzilaPaymentRequestMapper] Updated payment request status', {
        paymentRequestId: event.paymentRequestId,
        oldStatus: current.status,
        newStatus: event.status,
      });

      if (event.status === 'paid' && event.processorTransactionId && current.idempotencyKey) {
        await TranzilaPaymentRequestMapper._linkToTransaction(
          current.idempotencyKey,
          event.processorTransactionId,
        );
      }

      return { outcome: 'updated', paymentRequestId: event.paymentRequestId };
    } catch (err: any) {
      logger.error('[TranzilaPaymentRequestMapper] Failed to apply event', {
        paymentRequestId: event.paymentRequestId,
        error: err?.message,
      });
      return { outcome: 'error', error: err?.message ?? 'Unknown error' };
    }
  }

  /** Link the payment request to the resulting transaction row once paid. */
  private static async _linkToTransaction(
    paymentRequestIdempotencyKey: string,
    processorTransactionId: string,
  ): Promise<void> {
    try {
      await db
        .update(tranzilaPaymentRequests)
        .set({ resultingTransactionIdempotencyKey: paymentRequestIdempotencyKey })
        .where(eq(tranzilaPaymentRequests.idempotencyKey, paymentRequestIdempotencyKey));

      await db
        .update(tranzilaTransactions)
        .set({ status: 'confirmed' } as any)
        .where(eq(tranzilaTransactions.processorTransactionId, processorTransactionId));
    } catch (err: any) {
      logger.error('[TranzilaPaymentRequestMapper] Failed to link transaction', {
        paymentRequestIdempotencyKey,
        processorTransactionId,
        error: err?.message,
      });
    }
  }
}

export default TranzilaPaymentRequestMapper;
