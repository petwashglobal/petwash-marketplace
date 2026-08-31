/**
 * PayoutJourneyLoader — CEO DEEP-LOGIC §84 loader for kind=payout.
 *
 * Reads the canonical `provider_payout_entries` row keyed by the
 * entry's id (payoutId) and projects it through
 * resolvePayoutJourney with the provider's actor. §86 discipline:
 * only the earning provider sees the projection; anyone else
 * (customer, staff, admin) is refused NOT_A_PARTY on this endpoint.
 *
 * Status mapping: provider_payout_entries.status is free-text
 * defaulting to 'earned' — mapped onto the resolver's tighter
 * PayoutStatus enum (PENDING_HOLD / READY_TO_TRANSFER /
 * TRANSFERRING / PAID / FAILED / RECONCILING).
 */
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { providerPayoutEntries } from '@shared/schema';
import type { JourneyLoader, LoaderOutcome } from '../JourneyStateService';
import {
  resolvePayoutJourney,
  type PayoutStatus,
} from '../PayoutJourneyResolver';

/**
 * DB status → resolver enum. Unknown → PENDING_HOLD (the safest
 * default: the provider expects money to arrive but isn't invited
 * to take action). Never guess PAID / FAILED / etc.
 */
function toCanonical(dbStatus: string | null | undefined): PayoutStatus {
  switch ((dbStatus ?? '').toLowerCase()) {
    case 'earned':
    case 'held':
    case 'pending':
    case 'pending_hold':          return 'PENDING_HOLD';
    case 'ready':
    case 'ready_to_transfer':     return 'READY_TO_TRANSFER';
    case 'transferring':
    case 'in_flight':             return 'TRANSFERRING';
    case 'paid':
    case 'settled':               return 'PAID';
    case 'failed':
    case 'rejected':              return 'FAILED';
    case 'reconciling':
    case 'reconciliation':        return 'RECONCILING';
    default:                      return 'PENDING_HOLD';
  }
}

export const payoutJourneyLoader: JourneyLoader = async ({ id, actorUid }): Promise<LoaderOutcome> => {
  try {
    // payoutId in the URL is the serial primary key; drizzle infers
    // it as number. Parse and validate — a caller passing a
    // non-numeric id gets NOT_FOUND, never a crash.
    const asNumber = Number(id);
    if (!Number.isFinite(asNumber) || asNumber <= 0) return { code: 'NOT_FOUND' };
    const row = (
      await db.select().from(providerPayoutEntries)
        .where(eq(providerPayoutEntries.id, asNumber))
        .limit(1)
    )[0];
    if (!row) return { code: 'NOT_FOUND' };
    if (row.providerUid !== actorUid) return { code: 'NOT_A_PARTY' };

    const journey = resolvePayoutJourney({
      snapshot: {
        payoutId: String(row.id),
        status: toCanonical(row.status),
        providerUid: row.providerUid,
        amountCents: Number(row.netCents ?? 0),
        currency: 'ILS',
        // holdReleasesAt + reconciliationNoteCode aren't on the
        // current schema — leave undefined until they land.
      },
      actorUid,
    });
    return { code: 'OK', journey };
  } catch {
    return { code: 'NOT_FOUND' };
  }
};
