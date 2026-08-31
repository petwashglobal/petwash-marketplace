/**
 * K9000JourneyLoader — CEO DEEP-LOGIC §84 loader for kind=k9000_session.
 *
 * Reads the canonical `k9000_wash_events` row keyed by session id and
 * projects it through resolveK9000Journey with the customer's actor
 * role. §86 discipline: a K9000 wash event has ONE party (the
 * customer whose userId is on the row); staff-side projections are
 * not exposed through this endpoint.
 *
 * Status mapping: k9000_wash_events.status is a compact enum
 * (completed | failed | reversed) whereas the resolver understands
 * the full station-payment lifecycle (initiated / authorized /
 * vend_pending / vend_success / settled / voided / failed /
 * refunded). Unknown → 'initiated' (honest surface — the resolver
 * treats it as SYSTEM-side wait, not user-actionable).
 */
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { k9000WashEvents } from '@shared/schema';
import type { JourneyLoader, LoaderOutcome } from '../JourneyStateService';
import {
  resolveK9000Journey,
  type K9000SessionStatus,
} from '../K9000JourneyResolver';

/** DB status → resolver status. Unknown maps to the safest wait state. */
function toCanonical(dbStatus: string | null | undefined): K9000SessionStatus {
  switch ((dbStatus ?? '').toLowerCase()) {
    case 'completed':          return 'vend_success';
    case 'failed':             return 'failed';
    case 'reversed':           return 'refunded';
    default:                   return 'initiated';
  }
}

export const k9000JourneyLoader: JourneyLoader = async ({ id, actorUid }): Promise<LoaderOutcome> => {
  try {
    const row = (await db.select().from(k9000WashEvents).where(eq(k9000WashEvents.id, id)).limit(1))[0];
    if (!row) return { code: 'NOT_FOUND' };
    // Party discipline — only the wash's customer sees the projection.
    // A K9000 event with no userId (walk-up Nayax card wash) has no
    // authenticated party, so refuse.
    if (!row.userId || row.userId !== actorUid) return { code: 'NOT_A_PARTY' };

    const journey = resolveK9000Journey({
      snapshot: {
        sessionId: String(row.id),
        status: toCanonical(row.status),
        customerUid: row.userId,
        stationId: row.stationId ?? '',
        amountCents: Number(row.amountCents ?? 0),
        currency: 'ILS',
      },
      actorUid,
    });
    return { code: 'OK', journey };
  } catch {
    return { code: 'NOT_FOUND' };
  }
};
