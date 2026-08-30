/**
 * RefundJourneyLoader — CEO DEEP-LOGIC §84 loader for kind=refund.
 *
 * Reads the canonical `refund_transactions` row keyed by refundId
 * and projects it into the pure Refund resolver.
 *
 * Party discipline: the customer whose userId matches actorUid is
 * the only party allowed to see the refund's journey. Anyone else
 * (including staff via this endpoint — staff surfaces have their
 * own read paths) is refused NOT_A_PARTY.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { refundTransactions } from '@shared/schema';
import type { JourneyLoader, LoaderOutcome } from '../JourneyStateService';
import {
  resolveRefundJourney,
  type RefundStatus,
} from '../RefundJourneyResolver';

function toResolverStatus(dbStatus: string | null | undefined): RefundStatus {
  switch ((dbStatus ?? '').toLowerCase()) {
    case 'pending':   return 'REQUESTED';
    case 'approved':  return 'APPROVED';
    case 'executing': return 'ISSUED';
    case 'succeeded': return 'SETTLED';
    case 'failed':
    case 'rejected':  return 'DECLINED';
    default:          return 'REQUESTED';
  }
}

type Kind = 'booking' | 'shop_order' | 'gift' | 'k9000_session' | 'wallet_topup';
function toOriginKind(sourceType: string | null | undefined): Kind {
  const t = (sourceType ?? '').toLowerCase();
  if (t === 'booking' || t === 'shop_order' || t === 'gift' || t === 'k9000_session' || t === 'wallet_topup') {
    return t;
  }
  return 'booking';
}

export const refundJourneyLoader: JourneyLoader = async ({ id, actorUid }): Promise<LoaderOutcome> => {
  try {
    const row = (await db.select().from(refundTransactions).where(eq(refundTransactions.refundId, id)).limit(1))[0];
    if (!row) return { code: 'NOT_FOUND' };
    if (row.userId !== actorUid) return { code: 'NOT_A_PARTY' };

    const journey = resolveRefundJourney({
      snapshot: {
        refundId: row.refundId,
        status: toResolverStatus(row.status),
        customerUid: row.userId,
        originEntityRef: { kind: toOriginKind(row.sourceType), id: row.sourceId },
        amountCents: row.refundCents ?? 0,
        currency: 'ILS',
      },
      actorUid,
    });
    return { code: 'OK', journey };
  } catch {
    return { code: 'NOT_FOUND' };
  }
};
