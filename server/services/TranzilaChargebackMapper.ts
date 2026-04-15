/**
 * PetWash™ TranzilaChargebackMapper
 *
 * Maps Tranzila chargeback webhook events to PetWash's tranzila_chargebacks table,
 * flags the linked pw_payments row, and (when enabled) triggers an Octopus alert.
 *
 * OWNERSHIP CONTRACT:
 *   Tranzila runs the chargeback dispute workflow via their console.
 *   PetWash does NOT rebuild the dispute UI — it mirrors case state for audit
 *   trail, admin visibility, and booking-level flagging.
 *
 * IDEMPOTENCY:
 *   All methods are idempotent on chargebackCaseId.
 */

import { db } from '../db';
import { tranzilaChargebacks } from '../../shared/schema-tranzila';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { TRANZILA_CHARGEBACK_ALERTS_ENABLED } from '../lib/payment-flags';

export type ChargebackStatus =
  | 'opened'
  | 'evidence_needed'
  | 'evidence_submitted'
  | 'won'
  | 'lost'
  | 'cancelled';

export interface ChargebackWebhookEvent {
  /** Tranzila chargeback case ID */
  chargebackCaseId: string;
  /** Tranzila processor transaction ID of the disputed charge */
  processorTransactionId: string;
  /** New status from Tranzila webhook */
  status: ChargebackStatus;
  /** Disputed amount in CENTS */
  disputedAmountCents: number;
  reasonCode?: string;
  reasonDescription?: string;
  openedAt?: string;
  evidenceDeadlineAt?: string;
  resolvedAt?: string;
  /** PetWash payment ID if determinable from processor transaction */
  pwPaymentId?: string;
  customerId?: string;
  bookingId?: string;
  rawPayload: Record<string, unknown>;
}

export interface ChargebackMapResult {
  outcome: 'created' | 'updated' | 'no_change' | 'error';
  chargebackCaseId?: string;
  alertTriggered?: boolean;
  error?: string;
}

export class TranzilaChargebackMapper {
  /**
   * Apply a Tranzila chargeback webhook event to the PetWash record.
   *
   * Creates a new row if this case ID is unknown.
   * Updates the status if the case already exists.
   * Triggers an alert (logged warning with structured context) when
   * TRANZILA_CHARGEBACK_ALERTS_ENABLED is true.
   */
  static async applyWebhookEvent(event: ChargebackWebhookEvent): Promise<ChargebackMapResult> {
    try {
      const existing = await db
        .select()
        .from(tranzilaChargebacks)
        .where(eq(tranzilaChargebacks.chargebackCaseId, event.chargebackCaseId))
        .limit(1);

      let alertTriggered = false;

      if (existing.length === 0) {
        // New chargeback case
        await db.insert(tranzilaChargebacks).values({
          chargebackCaseId: event.chargebackCaseId,
          processorTransactionId: event.processorTransactionId,
          pwPaymentId: event.pwPaymentId ?? null,
          customerId: event.customerId ?? null,
          bookingId: event.bookingId ?? null,
          disputedAmountCents: event.disputedAmountCents,
          reasonCode: event.reasonCode ?? null,
          reasonDescription: event.reasonDescription ?? null,
          status: event.status,
          chargebackStatus: event.status,
          openedAt: event.openedAt ? new Date(event.openedAt) : new Date(),
          evidenceDeadlineAt: event.evidenceDeadlineAt ? new Date(event.evidenceDeadlineAt) : null,
          resolvedAt: event.resolvedAt ? new Date(event.resolvedAt) : null,
          processorPayloadRaw: event.rawPayload as any,
        });

        if (TRANZILA_CHARGEBACK_ALERTS_ENABLED) {
          alertTriggered = true;
          logger.warn('[TranzilaChargebackMapper] 🚨 NEW CHARGEBACK CASE OPENED', {
            chargebackCaseId: event.chargebackCaseId,
            processorTransactionId: event.processorTransactionId,
            pwPaymentId: event.pwPaymentId,
            customerId: event.customerId,
            bookingId: event.bookingId,
            disputedAmountILS: (event.disputedAmountCents / 100).toFixed(2),
            reasonCode: event.reasonCode,
            evidenceDeadlineAt: event.evidenceDeadlineAt,
            action: 'Open Tranzila console → Chargeback Management → respond before deadline',
          });
        } else {
          logger.info('[TranzilaChargebackMapper] Chargeback case created (alerts disabled)', {
            chargebackCaseId: event.chargebackCaseId,
            status: event.status,
          });
        }

        return { outcome: 'created', chargebackCaseId: event.chargebackCaseId, alertTriggered };
      }

      // Existing case — update if status changed
      const current = existing[0];
      const TERMINAL_STATUSES: ChargebackStatus[] = ['won', 'lost', 'cancelled'];
      const isTerminal = TERMINAL_STATUSES.includes(current.status as ChargebackStatus);
      const isSameStatus = current.status === event.status;

      if (isTerminal && isSameStatus) {
        return { outcome: 'no_change', chargebackCaseId: event.chargebackCaseId };
      }

      await db
        .update(tranzilaChargebacks)
        .set({
          status: event.status,
          chargebackStatus: event.status,
          resolvedAt: event.resolvedAt ? new Date(event.resolvedAt) : current.resolvedAt,
          evidenceDeadlineAt: event.evidenceDeadlineAt
            ? new Date(event.evidenceDeadlineAt)
            : current.evidenceDeadlineAt,
          processorPayloadRaw: event.rawPayload as any,
          updatedAt: new Date(),
        })
        .where(eq(tranzilaChargebacks.chargebackCaseId, event.chargebackCaseId));

      if (TRANZILA_CHARGEBACK_ALERTS_ENABLED) {
        alertTriggered = true;
        const level = ['won', 'lost'].includes(event.status) ? 'info' : 'warn';
        logger[level]('[TranzilaChargebackMapper] Chargeback case status updated', {
          chargebackCaseId: event.chargebackCaseId,
          oldStatus: current.status,
          newStatus: event.status,
          pwPaymentId: current.pwPaymentId,
          disputedAmountILS: (event.disputedAmountCents / 100).toFixed(2),
        });
      }

      return { outcome: 'updated', chargebackCaseId: event.chargebackCaseId, alertTriggered };
    } catch (err: any) {
      logger.error('[TranzilaChargebackMapper] Failed to apply event', {
        chargebackCaseId: event.chargebackCaseId,
        error: err?.message,
      });
      return { outcome: 'error', error: err?.message ?? 'Unknown error' };
    }
  }
}

export default TranzilaChargebackMapper;
