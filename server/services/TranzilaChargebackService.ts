/**
 * PetWash™ TranzilaChargebackService
 *
 * OPERATIONS service — manages PetWash's response to Tranzila chargeback cases.
 * Distinct from TranzilaChargebackMapper, which ingests inbound webhook events.
 *
 * Responsibilities:
 *   - Query chargeback case status from Tranzila (when API supports it)
 *   - Record evidence submission deadlines and alert ops team
 *   - Link chargeback cases to PetWash booking and payment records
 *   - Provide data for the admin chargeback dashboard
 *   - Mark cases as evidence-submitted after ops team acts in Tranzila console
 *
 * OWNERSHIP:
 *   Tranzila owns the chargeback dispute workflow and communicates with
 *   card schemes (Visa/Mastercard). PetWash does not replicate that UI.
 *   This service manages PetWash's internal response state.
 *
 * ARCHITECTURE RULE:
 *   Nayax chargebacks are handled by the Nayax integration, not here.
 *   This service ONLY handles Tranzila-originated chargeback cases.
 *
 * TODO (before enabling in production):
 *   1. Confirm Tranzila chargeback query API availability with account rep.
 *   2. Implement _callTranzilaGetChargebackStatus() using real API.
 *   3. Wire evidence deadline notification to ops team (email/Slack/Octopus alert).
 */

import { db } from '../db';
import { tranzilaChargebacks, tranzilaTransactions } from '../../shared/schema-tranzila';
import { eq, and, lte, isNull } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { TRANZILA_CHARGEBACK_ALERTS_ENABLED } from '../lib/payment-flags';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChargebackSummary {
  chargebackCaseId: string;
  processorTransactionId: string;
  pwPaymentId: string | null;
  customerId: string | null;
  bookingId: string | null;
  disputedAmountCents: number;
  status: string;
  reasonCode: string | null;
  openedAt: Date;
  evidenceDeadlineAt: Date | null;
  resolvedAt: Date | null;
  /** Hours until evidence deadline. Negative = overdue. null = no deadline set. */
  hoursUntilDeadline: number | null;
}

export interface EvidenceSubmittedResult {
  outcome: 'recorded' | 'not_found' | 'already_resolved' | 'error';
  chargebackCaseId?: string;
  error?: string;
}

export interface ChargebackListResult {
  total: number;
  rows: ChargebackSummary[];
  openCount: number;
  overdueCount: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class TranzilaChargebackService {
  /**
   * List open chargeback cases for the admin dashboard.
   *
   * Returns all non-resolved cases with computed deadline hours.
   * Sorted by evidence deadline ASC (most urgent first).
   */
  static async listOpenCases(): Promise<ChargebackListResult> {
    try {
      const rows = await db
        .select()
        .from(tranzilaChargebacks)
        .where(
          and(
            // Exclude terminal states
            // Drizzle: notInArray not always available — use OR of negation
          ),
        )
        .orderBy(tranzilaChargebacks.evidenceDeadlineAt);

      const now = Date.now();
      const summaries: ChargebackSummary[] = rows
        .filter((r) => !['won', 'lost', 'cancelled'].includes(r.status ?? ''))
        .map((r) => ({
          chargebackCaseId: r.chargebackCaseId,
          processorTransactionId: r.processorTransactionId,
          pwPaymentId: r.pwPaymentId ?? null,
          customerId: r.customerId ?? null,
          bookingId: r.bookingId ?? null,
          disputedAmountCents: r.disputedAmountCents,
          status: r.status ?? 'opened',
          reasonCode: r.reasonCode ?? null,
          openedAt: r.openedAt,
          evidenceDeadlineAt: r.evidenceDeadlineAt ?? null,
          resolvedAt: r.resolvedAt ?? null,
          hoursUntilDeadline: r.evidenceDeadlineAt
            ? Math.round((r.evidenceDeadlineAt.getTime() - now) / 3_600_000)
            : null,
        }));

      const overdueCount = summaries.filter(
        (s) => s.hoursUntilDeadline !== null && s.hoursUntilDeadline < 0,
      ).length;

      return {
        total: summaries.length,
        rows: summaries,
        openCount: summaries.length,
        overdueCount,
      };
    } catch (err: any) {
      logger.error('[TranzilaChargebackService] listOpenCases failed', { error: err?.message });
      return { total: 0, rows: [], openCount: 0, overdueCount: 0 };
    }
  }

  /**
   * Record that ops has submitted evidence for a chargeback case in the
   * Tranzila console.  Updates the PetWash mirror status to 'evidence_submitted'.
   *
   * This does NOT call the Tranzila API — it records the ops team's action
   * so PetWash audit trail reflects the correct state.
   *
   * Idempotent: calling again on an already evidence_submitted case is a no-op.
   */
  static async recordEvidenceSubmitted(
    chargebackCaseId: string,
    submittedByAdminUid: string,
    notes?: string,
  ): Promise<EvidenceSubmittedResult> {
    try {
      const existing = await db
        .select()
        .from(tranzilaChargebacks)
        .where(eq(tranzilaChargebacks.chargebackCaseId, chargebackCaseId))
        .limit(1);

      if (existing.length === 0) {
        return { outcome: 'not_found', chargebackCaseId };
      }

      const row = existing[0];
      const RESOLVED = ['won', 'lost', 'cancelled'] as const;
      if (RESOLVED.includes(row.status as any)) {
        return { outcome: 'already_resolved', chargebackCaseId };
      }

      await db
        .update(tranzilaChargebacks)
        .set({
          status: 'evidence_submitted',
          chargebackStatus: 'evidence_submitted',
          processorPayloadRaw: {
            ...(typeof row.processorPayloadRaw === 'object' && row.processorPayloadRaw !== null
              ? row.processorPayloadRaw
              : {}),
            evidenceSubmittedByAdminUid: submittedByAdminUid,
            evidenceSubmittedAt: new Date().toISOString(),
            evidenceNotes: notes ?? null,
          } as any,
          updatedAt: new Date(),
        })
        .where(eq(tranzilaChargebacks.chargebackCaseId, chargebackCaseId));

      logger.info('[TranzilaChargebackService] Evidence submission recorded', {
        chargebackCaseId,
        submittedByAdminUid,
      });

      return { outcome: 'recorded', chargebackCaseId };
    } catch (err: any) {
      logger.error('[TranzilaChargebackService] recordEvidenceSubmitted failed', {
        chargebackCaseId,
        error: err?.message,
      });
      return { outcome: 'error', chargebackCaseId, error: err?.message ?? 'Unknown error' };
    }
  }

  /**
   * Scan all open chargeback cases for approaching evidence deadlines and
   * emit structured warning logs consumed by Octopus monitoring.
   *
   * Called periodically by a cron job or admin trigger.
   * Only runs when TRANZILA_CHARGEBACK_ALERTS_ENABLED is true.
   */
  static async emitDeadlineAlerts(warningHoursThreshold = 48): Promise<{ alerted: number }> {
    if (!TRANZILA_CHARGEBACK_ALERTS_ENABLED) {
      return { alerted: 0 };
    }

    const deadlineThreshold = new Date(Date.now() + warningHoursThreshold * 3_600_000);

    try {
      const urgentRows = await db
        .select()
        .from(tranzilaChargebacks)
        .where(
          and(
            lte(tranzilaChargebacks.evidenceDeadlineAt, deadlineThreshold),
            isNull(tranzilaChargebacks.resolvedAt),
          ),
        );

      const now = Date.now();
      let alerted = 0;

      for (const row of urgentRows) {
        const RESOLVED = ['won', 'lost', 'cancelled', 'evidence_submitted'];
        if (RESOLVED.includes(row.status ?? '')) continue;

        const hoursLeft = row.evidenceDeadlineAt
          ? Math.round((row.evidenceDeadlineAt.getTime() - now) / 3_600_000)
          : null;

        logger.warn('[TranzilaChargebackService] 🚨 CHARGEBACK DEADLINE APPROACHING', {
          chargebackCaseId: row.chargebackCaseId,
          processorTransactionId: row.processorTransactionId,
          pwPaymentId: row.pwPaymentId,
          customerId: row.customerId,
          bookingId: row.bookingId,
          disputedAmountILS: (row.disputedAmountCents / 100).toFixed(2),
          status: row.status,
          reasonCode: row.reasonCode,
          evidenceDeadlineAt: row.evidenceDeadlineAt?.toISOString(),
          hoursUntilDeadline: hoursLeft,
          action: 'Log into Tranzila console → Chargeback Management → submit evidence before deadline',
        });

        alerted++;
      }

      return { alerted };
    } catch (err: any) {
      logger.error('[TranzilaChargebackService] emitDeadlineAlerts failed', { error: err?.message });
      return { alerted: 0 };
    }
  }

  /**
   * Lookup the PetWash transaction and booking linked to a chargeback case.
   * Used by the admin detail panel when investigating a case.
   */
  static async getLinkedContext(chargebackCaseId: string): Promise<{
    chargeback: typeof tranzilaChargebacks.$inferSelect | null;
    processorTransaction: typeof tranzilaTransactions.$inferSelect | null;
  }> {
    const cbRows = await db
      .select()
      .from(tranzilaChargebacks)
      .where(eq(tranzilaChargebacks.chargebackCaseId, chargebackCaseId))
      .limit(1);

    if (cbRows.length === 0) {
      return { chargeback: null, processorTransaction: null };
    }

    const cb = cbRows[0];

    const txRows = cb.processorTransactionId
      ? await db
          .select()
          .from(tranzilaTransactions)
          .where(eq(tranzilaTransactions.processorTransactionId, cb.processorTransactionId))
          .limit(1)
      : [];

    return {
      chargeback: cb,
      processorTransaction: txRows[0] ?? null,
    };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Query Tranzila API for the latest chargeback case status.
   *
   * TODO: implement when Tranzila provides a chargeback query API.
   * Until available, status is maintained purely via webhooks.
   */
  private static async _callTranzilaGetChargebackStatus(_caseId: string): Promise<{
    success: boolean;
    status?: string;
    error?: string;
  }> {
    logger.warn(
      '[TranzilaChargebackService] _callTranzilaGetChargebackStatus not yet implemented — status sourced from webhooks only',
    );
    return { success: false, error: 'Tranzila chargeback query API not yet implemented.' };
  }
}

export default TranzilaChargebackService;
