/**
 * BookingJourneyLoader — CEO DEEP-LOGIC §84 loader for kind=booking.
 *
 * Reads the canonical `bookings` row keyed by booking id and projects
 * it through resolveBookingJourney with the correct per-actor role.
 * §86 discipline: the same row produces DIFFERENT projections for
 * the customer vs the provider — the loader picks the actor's role
 * automatically from userId / providerId.
 *
 * Party discipline: only customerUid or providerUid may see the
 * booking's projection through this endpoint. Anyone else is refused
 * NOT_A_PARTY.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { bookings } from '@shared/schema';
import type { JourneyLoader, LoaderOutcome } from '../JourneyStateService';
import {
  resolveBookingJourney,
  type BookingCanonicalStatus,
} from '../BookingJourneyResolver';

/**
 * Map the DB `status` free-text onto the resolver's canonical enum.
 * The resolver's fallback path handles unknowns by treating them as
 * REQUESTED — the honest surface for an unrecognised state.
 */
function toCanonical(dbStatus: string | null | undefined): BookingCanonicalStatus {
  switch ((dbStatus ?? '').toLowerCase()) {
    case 'draft':
    case 'requested':
    case 'pending':                return 'REQUESTED';
    case 'quoted':
    case 'awaiting_provider':      return 'QUOTED';
    case 'provider_proposed_change':
    case 'change_proposed':        return 'PROVIDER_PROPOSED_CHANGE';
    case 'accepted':               return 'ACCEPTED';
    case 'confirmed':              return 'CONFIRMED';
    case 'ready_to_start':
    case 'ready':                  return 'READY_TO_START';
    case 'in_progress':
    case 'started':                return 'IN_PROGRESS';
    case 'completed':              return 'COMPLETED';
    case 'cancelled':
    case 'canceled':               return 'CANCELLED';
    case 'declined':               return 'DECLINED';
    case 'expired':                return 'EXPIRED';
    default:                       return 'REQUESTED';
  }
}

/** DB paymentStatus + captured / due amounts → resolver money fields. */
function moneyFieldsFrom(row: {
  paymentStatus: string | null;
  total: string | null;
  subtotal: string | null;
}): { paymentCapturedCents?: number; amountDueCents?: number } {
  const totalNum = Number(row.total ?? row.subtotal ?? '0');
  const totalCents = Number.isFinite(totalNum) ? Math.round(totalNum * 100) : 0;
  const ps = (row.paymentStatus ?? '').toLowerCase();
  if (ps === 'paid' || ps === 'captured' || ps === 'succeeded') {
    return { paymentCapturedCents: totalCents };
  }
  if (ps === 'pending' || ps === 'unpaid' || ps === 'requires_payment' || !ps) {
    return { amountDueCents: totalCents };
  }
  return { amountDueCents: totalCents };
}

export const bookingJourneyLoader: JourneyLoader = async ({ id, actorUid }): Promise<LoaderOutcome> => {
  try {
    const row = (await db.select().from(bookings).where(eq(bookings.id, id)).limit(1))[0];
    if (!row) return { code: 'NOT_FOUND' };

    const isCustomer = row.userId === actorUid;
    const isProvider = !!row.providerId && row.providerId === actorUid;
    if (!isCustomer && !isProvider) return { code: 'NOT_A_PARTY' };

    const money = moneyFieldsFrom({
      paymentStatus: row.paymentStatus,
      total: row.total,
      subtotal: row.subtotal,
    });

    const journey = resolveBookingJourney({
      snapshot: {
        bookingId: String(row.id),
        status: toCanonical(row.status),
        customerUid: row.userId,
        providerUid: row.providerId ?? '',
        // Provider has 24h to respond by convention until BusinessDecisionRegistry
        // provides the exact SLA — until then we surface the raw window.
        requestExpiresAt: undefined,
        paymentCapturedCents: money.paymentCapturedCents,
        amountDueCents: money.amountDueCents,
        currency: 'ILS',
        pickupHandoffVerified: !!row.startedAt,
        returnHandoffVerified: !!row.completedAt,
        hasCustomerRating: !!row.customerReviewId,
        unreadForActor: 0,
        threadId: undefined,
      },
      actorUid,
      actorRole: isCustomer ? 'CUSTOMER' : 'PROVIDER',
    });
    return { code: 'OK', journey };
  } catch {
    return { code: 'NOT_FOUND' };
  }
};
