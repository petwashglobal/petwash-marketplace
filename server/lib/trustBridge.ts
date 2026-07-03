/**
 * trustBridge — one reusable way to turn a fraud/safety SIGNAL into a
 * REVIEW-REQUIRED TRUST case.
 *
 * The platform already has rich detectors (WalletFraudDetection: IP-geo, device,
 * velocity; chatRiskScanner; addressMatch) and a solid incident engine
 * (incidentService + human-readable case IDs). What was missing is a single,
 * de-duped, non-throwing bridge so any detector can OPEN a case instead of only
 * logging/scoring. Every case is explicitly non-punitive and for human review —
 * never an automatic block, ban, or payout change.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { incidentReports } from '@shared/schema-incidents';
import { openIncident } from '../services/incidentService';
import { logger } from './logger';
import type { IncidentSeverityX } from '@shared/incident-engine';

export interface TrustSignal {
  /** an incident-engine type (e.g. 'pass_replay_attempt', 'linked_account_address_match') */
  type: string;
  severity?: IncidentSeverityX;
  description: string;
  memberId?: string;
  providerId?: string;
  bookingId?: string;
  stationId?: string;
  paymentId?: string;
  /**
   * De-dupe: if an OPEN case of this type already exists for the given key(s),
   * skip (return null) instead of opening a duplicate. Only the keys present are
   * matched. Omit to always open (use for naturally-bounded, rare signals).
   */
  dedupeBy?: { memberId?: string; providerId?: string; bookingId?: string };
}

/**
 * Open a review-required TRUST case from a signal. Non-blocking; NEVER throws
 * (fraud detection must never break the request path). Returns the case id, or
 * null when de-duped or on error.
 */
export async function openTrustCase(signal: TrustSignal): Promise<string | null> {
  try {
    const d = signal.dedupeBy;
    if (d && (d.memberId || d.providerId || d.bookingId)) {
      const conds = [
        eq(incidentReports.incidentType, signal.type as any),
        eq(incidentReports.status, 'open'),
      ];
      if (d.memberId) conds.push(eq(incidentReports.memberId, d.memberId));
      if (d.providerId) conds.push(eq(incidentReports.providerId, d.providerId));
      if (d.bookingId) conds.push(eq(incidentReports.bookingId, d.bookingId));
      const existing = await db
        .select({ id: incidentReports.id })
        .from(incidentReports)
        .where(and(...conds))
        .limit(1);
      if (existing.length) return null; // an open case already covers this — don't flood
    }

    const inc = await openIncident({
      type: signal.type as any,
      severity: signal.severity ?? 'low',
      description: `REVIEW REQUIRED — non-punitive, do NOT auto-terminate. ${signal.description}`,
      memberId: signal.memberId,
      providerId: signal.providerId,
      bookingId: signal.bookingId,
      stationId: signal.stationId,
      paymentId: signal.paymentId,
      reportedBy: 'system:trust-bridge',
    });
    return inc.incidentId;
  } catch (e: any) {
    logger.warn('[TrustBridge] openTrustCase failed (non-blocking)', { type: signal.type, error: e?.message });
    return null;
  }
}
