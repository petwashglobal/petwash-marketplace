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
import { bookingRequests, walkBookings, walkerProfiles, pettrekTrips, pettrekProviders } from '@shared/schema';
import type {
  ServiceSessionDTO,
  ServiceSessionStatus,
  ServiceLocation,
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
export function bucketBookingStatus(status: string | null | undefined): ServiceSessionStatus {
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

  try {
    const wb = await resolveFromWalkBookings(bookingRef, callerUid);
    if (wb.ok || wb.reason === 'unauthorized') return wb;
  } catch (e: any) {
    logger.warn('[serviceSessionAdapter] walk_bookings projection failed', {
      bookingRef, err: e?.message,
    });
    throw e;
  }

  try {
    const pt = await resolveFromPettrekTrips(bookingRef, callerUid);
    if (pt.ok || pt.reason === 'unauthorized') return pt;
  } catch (e: any) {
    logger.warn('[serviceSessionAdapter] pettrek_trips projection failed', {
      bookingRef, err: e?.message,
    });
    throw e;
  }

  return { ok: false, reason: 'not_found' };
}

/**
 * walk_bookings universe:
 *   • bookingRef matches walk_bookings.bookingId
 *   • authorization joins walker_profiles.walkerId to derive the walker's
 *     Firebase UID (walk_bookings.walkerId is a WALKER-UUID, not a UID)
 *   • lastKnownLocation + checkInLocation jsonb columns become the DTO's
 *     lastLocation / startLocation
 */
export function bucketWalkStatus(status: string | null | undefined, endedAt: Date | null): ServiceSessionStatus {
  const s = (status || '').toLowerCase();
  if (s === 'in_progress') return 'in_progress';
  if (s === 'completed') return endedAt ? 'completed' : 'awaiting_report';
  if (s === 'cancelled') return 'cancelled';
  return 'scheduled';
}

export function jsonbToLocation(raw: unknown): ServiceLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const lat = typeof o.latitude === 'number' ? o.latitude : Number(o.latitude);
  const lon = typeof o.longitude === 'number' ? o.longitude : Number(o.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const ts = typeof o.timestamp === 'string' ? o.timestamp : (o.timestamp instanceof Date ? o.timestamp.toISOString() : null);
  const acc = typeof o.accuracy === 'number' ? o.accuracy : (o.accuracy != null ? Number(o.accuracy) : null);
  return {
    latitude: lat,
    longitude: lon,
    recordedAt: ts ?? new Date(0).toISOString(),
    accuracyM: Number.isFinite(acc as number) ? (acc as number) : null,
  };
}

function composeWalkScheduledStart(scheduledDate: unknown, hhmm: string | null | undefined): string | null {
  if (!scheduledDate) return null;
  const dateStr = typeof scheduledDate === 'string'
    ? scheduledDate
    : (scheduledDate instanceof Date ? scheduledDate.toISOString().slice(0, 10) : null);
  if (!dateStr) return null;
  const time = (hhmm || '00:00').match(/^\d{2}:\d{2}$/) ? hhmm : '00:00';
  const iso = new Date(`${dateStr}T${time}:00`);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

async function resolveFromWalkBookings(
  bookingRef: string,
  callerUid: string,
): Promise<ResolveOutcome> {
  const [row] = await db
    .select()
    .from(walkBookings)
    .where(eq(walkBookings.bookingId, bookingRef))
    .limit(1);

  if (!row) return { ok: false, reason: 'not_found' };

  const customerId = (row.ownerId || null) as string | null;

  // Resolve walker's Firebase UID via walker_profiles.walkerId → userId.
  let providerId: string | null = null;
  if (row.walkerId) {
    const [walker] = await db
      .select({ userId: walkerProfiles.userId })
      .from(walkerProfiles)
      .where(eq(walkerProfiles.walkerId, row.walkerId))
      .limit(1);
    providerId = (walker?.userId || null) as string | null;
  }

  const authorized = callerUid === customerId || (providerId != null && callerUid === providerId);
  if (!authorized) return { ok: false, reason: 'unauthorized' };

  const startedAt = row.actualStartTime ? new Date(row.actualStartTime).toISOString() : null;
  const endedAt = row.actualEndTime ? new Date(row.actualEndTime).toISOString() : null;
  const status = bucketWalkStatus(row.status, row.actualEndTime ?? null);
  const isActive = status === 'in_progress' || status === 'awaiting_report';

  const scheduledStartAt = composeWalkScheduledStart(row.scheduledDate, row.scheduledStartTime);
  const scheduledEndAt = (() => {
    if (!scheduledStartAt || !row.durationMinutes) return null;
    const end = new Date(new Date(scheduledStartAt).getTime() + row.durationMinutes * 60_000);
    return end.toISOString();
  })();

  const session: ServiceSessionDTO = {
    sessionId: `wb-${row.bookingId}`,
    bookingRef,
    source: 'walk_bookings',
    serviceType: 'dog_walking',
    status,
    customerId,
    providerId,
    scheduledStartAt,
    scheduledEndAt,
    startedAt,
    endedAt,
    isActive,
    lastLocation: jsonbToLocation(row.lastKnownLocation),
    startLocation: jsonbToLocation(row.checkInLocation),
    reportStatus: 'none',
  };

  return { ok: true, session };
}

/**
 * pettrek_trips universe:
 *   • bookingRef matches pettrek_trips.tripId
 *   • authorization joins pettrek_providers.id (integer FK) → userId
 *     for the assigned provider (nullable — a dispatched-but-not-yet-
 *     accepted trip has no assigned provider yet, in which case only
 *     the customer is authorized)
 *   • lastKnown lat/lon columns are decimal-strings; startLocation
 *     comes from pickup coordinates because the pettrek table has no
 *     dedicated check-in blob (yet)
 *
 * NOTE: the pettrek router is behind a permanent legal 403 block in
 * production (server/routes/pettrek.ts) — this branch is dead in the
 * live app today. It exists so the adapter's shape is complete when
 * the legal gate is removed. Cost is a table lookup on a booking-ref
 * miss.
 */
export function bucketPettrekStatus(status: string | null | undefined): ServiceSessionStatus {
  const s = (status || '').toLowerCase();
  if (s === 'in_progress') return 'in_progress';
  if (s === 'completed') return 'completed';
  if (s === 'canceled' || s === 'cancelled') return 'cancelled';
  // requested | dispatched | accepted → scheduled
  return 'scheduled';
}

async function resolveFromPettrekTrips(
  bookingRef: string,
  callerUid: string,
): Promise<ResolveOutcome> {
  const [row] = await db
    .select()
    .from(pettrekTrips)
    .where(eq(pettrekTrips.tripId, bookingRef))
    .limit(1);

  if (!row) return { ok: false, reason: 'not_found' };

  const customerId = (row.customerId || null) as string | null;

  let providerId: string | null = null;
  if (row.providerId != null) {
    const [prov] = await db
      .select({ userId: pettrekProviders.userId })
      .from(pettrekProviders)
      .where(eq(pettrekProviders.id, row.providerId))
      .limit(1);
    providerId = (prov?.userId || null) as string | null;
  }

  const authorized = callerUid === customerId || (providerId != null && callerUid === providerId);
  if (!authorized) return { ok: false, reason: 'unauthorized' };

  const startedAt = row.actualPickupTime ? new Date(row.actualPickupTime).toISOString() : null;
  const endedAt = row.actualDropoffTime ? new Date(row.actualDropoffTime).toISOString() : null;
  const status = bucketPettrekStatus(row.status);
  const isActive = status === 'in_progress' || status === 'awaiting_report';

  const lastLat = row.lastKnownLatitude != null ? Number(row.lastKnownLatitude) : NaN;
  const lastLon = row.lastKnownLongitude != null ? Number(row.lastKnownLongitude) : NaN;
  const lastLocation: ServiceLocation | null = (Number.isFinite(lastLat) && Number.isFinite(lastLon))
    ? {
        latitude: lastLat,
        longitude: lastLon,
        recordedAt: row.lastGPSUpdate ? new Date(row.lastGPSUpdate).toISOString() : new Date(0).toISOString(),
        accuracyM: null,
      }
    : null;

  const pickupLat = Number(row.pickupLatitude);
  const pickupLon = Number(row.pickupLongitude);
  const startLocation: ServiceLocation | null = (Number.isFinite(pickupLat) && Number.isFinite(pickupLon))
    ? {
        latitude: pickupLat,
        longitude: pickupLon,
        recordedAt: startedAt ?? (row.scheduledPickupTime ? new Date(row.scheduledPickupTime).toISOString() : new Date(0).toISOString()),
        accuracyM: null,
      }
    : null;

  const session: ServiceSessionDTO = {
    sessionId: `pt-${row.tripId}`,
    bookingRef,
    source: 'pettrek_trips',
    serviceType: 'pet_transport',
    status,
    customerId,
    providerId,
    scheduledStartAt: row.scheduledPickupTime ? new Date(row.scheduledPickupTime).toISOString() : null,
    scheduledEndAt: row.scheduledDropoffTime ? new Date(row.scheduledDropoffTime).toISOString() : null,
    startedAt,
    endedAt,
    isActive,
    lastLocation,
    startLocation,
    reportStatus: 'none',
  };

  return { ok: true, session };
}
