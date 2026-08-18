/**
 * serviceSessionAdapter — projects the various live-execution universes
 * (booking_requests / walk_bookings / pettrek_trips) into the canonical
 * ServiceSessionDTO shape at READ time.
 *
 * Per CEO 2026-08-18 §12 + §13 + §32 ("Adapt first, do not create a
 * fourth store"):
 *
 *   - THIS FIRST SLICE ships the booking_requests projection only.
 *     Callers get a canonical shape from the canonical booking record,
 *     with lastLocation / startLocation NULL (no live-GPS data on that
 *     table). It is deliberately safe to ship BEFORE the walk_bookings
 *     and pettrek_trips branches — the DTO already carries a `source`
 *     field so the client can distinguish "no live data yet" from
 *     "walk in progress with a stale ping".
 *
 *   - The `TODO` branches for walk_bookings and pettrek_trips are
 *     intentionally left as clear extension points, not stubs. When a
 *     later PR adds those universes, the DTO shape stays; only this
 *     file changes.
 *
 * Authorization is enforced HERE — the endpoint at
 * server/routes/service-sessions.ts calls `resolveServiceSession` and
 * bails on the `unauthorized` outcome. No caller invents its own
 * ownership rule.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { bookingRequests } from '@shared/schema';
import type {
  ServiceSessionDTO,
  ServiceSessionStatus,
} from '@shared/lib/serviceSession';
import { logger } from './logger';

export type ResolveOutcome =
  | { ok: true; session: ServiceSessionDTO }
  | { ok: false; reason: 'not_found' | 'unauthorized' | 'invalid_ref' };

/**
 * Canonical booking-status → service-session-status bucket mapping.
 * Kept HERE (not in shared/lib/bookingStatusLabels) because it is a
 * lifecycle projection, not a display label. Every real DTO consumer
 * cares about the bucket, not the raw booking status.
 */
function bucketBookingStatus(status: string | null | undefined): ServiceSessionStatus {
  const s = (status || '').toLowerCase();
  if (s === 'in_progress') return 'in_progress';
  if (s === 'provider_marked_complete') return 'awaiting_report';
  if (s === 'completed' || s === 'reviewed') return 'completed';
  if (s === 'cancelled' || s === 'declined') return 'cancelled';
  // draft / pending / accepted / meet_greet_* / payment_pending / confirmed
  // → the booking exists but the live service hasn't started yet.
  return 'scheduled';
}

/**
 * Load a booking_requests row by its public requestId, project into the
 * canonical DTO, and enforce that the caller is the customer OR the
 * assigned provider. Everyone else gets `unauthorized`.
 */
async function resolveFromBookingRequests(
  bookingRef: string,
  callerUid: string,
): Promise<ResolveOutcome> {
  const [row] = await db
    .select()
    .from(bookingRequests)
    .where(eq(bookingRequests.requestId, bookingRef))
    .limit(1);

  if (!row) return { ok: false, reason: 'not_found' };

  const customerId = (row.ownerId || null) as string | null;
  const providerId = (row.providerId || null) as string | null;
  const authorized = callerUid === customerId || callerUid === providerId;
  if (!authorized) return { ok: false, reason: 'unauthorized' };

  const status = bucketBookingStatus(row.status);
  const isActive = status === 'in_progress' || status === 'awaiting_report';

  const session: ServiceSessionDTO = {
    sessionId: `br-${row.requestId}`,
    bookingRef,
    source: 'booking_requests',
    serviceType: (row.serviceType || null) as string | null,
    status,
    customerId,
    providerId,
    scheduledStartAt: row.startDate ? new Date(row.startDate).toISOString() : null,
    scheduledEndAt: row.endDate ? new Date(row.endDate).toISOString() : null,
    startedAt: row.serviceStartedAt ? new Date(row.serviceStartedAt).toISOString() : null,
    endedAt: row.serviceCompletedAt ? new Date(row.serviceCompletedAt).toISOString() : null,
    isActive,
    // booking_requests has no live-GPS layer; leave null so the client
    // renders "no live location" rather than a stale ping.
    lastLocation: null,
    startLocation: null,
    // First-slice returns 'none' — booking_requests.photoUpdates jsonb is
    // read by a separate report screen, not surfaced here yet.
    reportStatus: 'none',
  };

  return { ok: true, session };
}

/**
 * Public entry point. Tries the underlying universes in this order:
 *   1. booking_requests (requestId match)
 *   2. walk_bookings   — TODO in a follow-up PR
 *   3. pettrek_trips    — TODO in a follow-up PR
 *
 * The `unauthorized` outcome takes precedence over `not_found` so the
 * caller cannot enumerate other users' bookings by trial-and-error.
 */
export async function resolveServiceSession(
  bookingRef: string,
  callerUid: string,
): Promise<ResolveOutcome> {
  if (!bookingRef || typeof bookingRef !== 'string') {
    return { ok: false, reason: 'invalid_ref' };
  }
  if (!callerUid) return { ok: false, reason: 'unauthorized' };

  try {
    const br = await resolveFromBookingRequests(bookingRef, callerUid);
    if (br.ok || br.reason === 'unauthorized') return br;
    // 'not_found' → fall through to the next source once implemented.
  } catch (e: any) {
    logger.warn('[serviceSessionAdapter] booking_requests projection failed', {
      bookingRef, err: e?.message,
    });
    // Don't return not_found on infra error — the caller will 500 which is
    // the correct signal that this endpoint could not answer, distinct from
    // "the booking truly does not exist".
    throw e;
  }

  // TODO: walk_bookings + pettrek_trips branches — see file header.
  return { ok: false, reason: 'not_found' };
}
