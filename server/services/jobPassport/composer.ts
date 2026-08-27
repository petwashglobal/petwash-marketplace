/**
 * JobPassport composer — CEO 2026-08-27 §6, §60.
 *
 * READ-ONLY. Composes the canonical JobPassport DTO by delegating to
 * existing authorities (sitter_bookings, walk_bookings, booking_requests,
 * users, provider_applications, contractor_earnings, chatThreads,
 * etc.). Never mutates. Never invents money. Never authorises.
 *
 * §33 legacy vertical tables: this file does NOT create a new booking
 * table. It adapts. Where existing objects can't be correlated the
 * composer surfaces the gap honestly (e.g. money.state='NOT_REQUIRED'
 * with a hint) instead of guessing.
 *
 * §75 execution order — this file starts with SITTER_SUITE + WALK
 * (both already have accept/decline cores in
 * server/services/booking-response/). Academy / Shop / K9000 / eGift
 * follow-ups will add cases to the switch inside composeJobPassport.
 */

import { eq } from 'drizzle-orm';
import { db } from '../../db';
import {
  sitterBookings,
  sitterProfiles,
  walkBookings,
  walkerProfiles,
  users,
  bookingRequests,
  contractorEarnings,
} from '@shared/schema';
import { logger } from '../../lib/logger';
import {
  type PlatformCode,
  getPlatform,
  platformFromBookingAuthority,
} from '@shared/lib/jobPassport/platformRegistry';
import type { ActorIdentity } from '@shared/lib/jobPassport/actorRegistry';
import {
  generateJobRef,
  truncateUid,
} from '@shared/lib/jobPassport/idNamespace';
import type {
  JobPassport,
  JobPassportEnvelope,
  BookingState,
  FulfillmentState,
  JobMoney,
  JobFulfiller,
  JobVerification,
  AllowedAction,
} from '@shared/lib/jobPassport/JobPassport';
import { composeAllowedActions } from './allowedActions';

/**
 * Public entry point. `input.sourceHint` names the table the caller
 * knows the booking lives in — normally derived from the passed
 * bookingId shape (BR-... → booking_requests, SIT-... → sitter, etc.).
 *
 * `input.viewer` is the AUTHENTICATED actor asking for the passport —
 * NEVER trusted from client body. The caller has already resolved the
 * Firebase UID + role from validateFirebaseToken.
 *
 * Returns null when the booking doesn't exist OR the viewer isn't a
 * participant (privacy 404 pattern — never confirm existence).
 */
export async function composeJobPassport(input: {
  sourceHint: 'sitter_bookings' | 'walk_bookings' | 'booking_requests';
  bookingId: string;
  viewer: ActorIdentity;
}): Promise<JobPassportEnvelope | null> {
  try {
    switch (input.sourceHint) {
      case 'sitter_bookings':
        return await composeSitterPassport(input.bookingId, input.viewer);
      case 'walk_bookings':
        return await composeWalkPassport(input.bookingId, input.viewer);
      case 'booking_requests':
        return await composeUnifiedPassport(input.bookingId, input.viewer);
    }
  } catch (err: any) {
    // Never leak error.message to caller — same discipline as walk-session.ts.
    logger.error('[JobPassport] compose failed', {
      sourceHint: input.sourceHint,
      bookingIdTail: input.bookingId.slice(-8),
      viewerUidTail: truncateUid(input.viewer.uid),
      error: err?.message,
    });
    return null;
  }
}

// ─── SITTER_SUITE ────────────────────────────────────────────────────

async function composeSitterPassport(
  bookingId: string,
  viewer: ActorIdentity,
): Promise<JobPassportEnvelope | null> {
  const [booking] = await db
    .select()
    .from(sitterBookings)
    .where(eq(sitterBookings.bookingId, bookingId));
  if (!booking) return null;

  // Load the assigned sitter profile so we can name the fulfiller +
  // resolve their Firebase UID (§8 assigned-provider freeze).
  const [sitter] = await db
    .select()
    .from(sitterProfiles)
    .where(eq(sitterProfiles.id, booking.sitterId));

  // Participant gate — the viewer must be either the owner or the
  // assigned sitter. Privacy 404 for everyone else.
  const isOwner = viewer.kind === 'CUSTOMER' && viewer.uid === booking.ownerId;
  const isSitter = viewer.kind === 'PROVIDER' && sitter && viewer.uid === sitter.userId;
  const isAdmin = viewer.kind === 'PETWASH_STAFF';
  if (!isOwner && !isSitter && !isAdmin) return null;

  const platform = getPlatform('SITTER_SUITE')!;
  const correlationId = `sitter:${booking.bookingId}`;
  const jobRef = generateJobRef({ platform: 'SITTER_SUITE', stableId: correlationId });

  // Customer display name — best-effort, safe to omit.
  const [owner] = await db
    .select({ first: users.firstName, last: users.lastName })
    .from(users)
    .where(eq(users.id, booking.ownerId))
    .limit(1);

  const bookingState = mapSitterStatusToBookingState(String(booking.status));
  const fulfillmentState = mapSitterStatusToFulfillmentState(String(booking.status));

  const fulfiller: JobFulfiller = sitter
    ? {
        kind: 'PROVIDER',
        providerUid: sitter.userId,
        providerPublicId: String(sitter.id),
        displayName: `${sitter.firstName} ${sitter.lastName}`.trim(),
        verifiedBadge: true, // sitter_profiles existence implies approval
        serviceApproved: true,
        suspended: false,
      }
    : { kind: 'PROVIDER' };

  // Money — resolve from the booking-side cents + join contractor_earnings
  // for the provider-side truth. Never infer PAID from booking.status;
  // rely on booking.paymentStatus / booking.nayaxTransactionId.
  const money = await resolveMoneySitter(booking, fulfiller.providerUid ?? null);

  const verification = defaultVerificationSitter(fulfillmentState);

  const passport: JobPassport = {
    jobRef,
    correlationId,
    platform: 'SITTER_SUITE',
    serviceType: platform.serviceTypes[0],
    customer: {
      userId: booking.ownerId,
      displayName: [owner?.first, owner?.last].filter(Boolean).join(' ') || undefined,
    },
    fulfiller,
    pets: [], // sitter_bookings snapshot has pet data in quote_breakdown — a
              // follow-up will lift it into a proper pets[] via petPrivacy.
    location: {
      type: 'CUSTOMER_HOME',
      display: '[address per privacy policy]',
    },
    schedule: {
      startsAt: new Date(booking.startDate).toISOString(),
      endsAt: new Date(booking.endDate).toISOString(),
      timezone: 'Asia/Jerusalem',
    },
    booking: {
      canonicalId: booking.bookingId,
      source: 'sitter_bookings',
      sourceId: booking.bookingId,
      status: bookingState,
    },
    fulfillment: {
      state: fulfillmentState,
      startedAt: undefined,
      completedAt: booking.confirmedAt ? new Date(booking.confirmedAt).toISOString() : undefined,
    },
    money,
    verification,
    allowedActions: composeAllowedActions({
      platform: 'SITTER_SUITE',
      bookingState,
      fulfillmentState,
      moneyState: money.state,
      viewer,
      isOwner,
      isFulfiller: isSitter,
    }),
    auditRefs: [], // §30 — populate from audit_events in a follow-up
    composedAt: new Date().toISOString(),
  };

  return {
    passport,
    viewFor: {
      actor: viewer,
      showsProviderMoney: !!isSitter || !!isAdmin,
      showsLiveTracking: false, // sitter has no live tracking
    },
  };
}

function mapSitterStatusToBookingState(s: string): BookingState {
  if (s === 'pending_provider' || s === 'payment_pending' || s === 'payment_failed') return 'REQUESTED';
  if (s === 'confirmed') return 'CONFIRMED';
  if (s === 'in_progress') return 'CONFIRMED';
  if (s === 'completed') return 'COMPLETED';
  if (s === 'cancelled' || s === 'declined') return 'CANCELLED';
  return 'REQUESTED';
}

function mapSitterStatusToFulfillmentState(s: string): FulfillmentState {
  if (s === 'in_progress') return 'IN_PROGRESS';
  if (s === 'provider_marked_complete') return 'PROVIDER_COMPLETED';
  if (s === 'completed') return 'CUSTOMER_CONFIRMED';
  return 'NOT_STARTED';
}

async function resolveMoneySitter(booking: any, providerUid: string | null): Promise<JobMoney> {
  const totalCents = Number(booking.totalChargeCents ?? 0);
  const paid = String(booking.paymentStatus ?? '') === 'captured' || !!booking.nayaxTransactionId;
  const providerExpected = Number(booking.sitterPayoutCents ?? 0);

  let providerAvailable = 0;
  let providerPaid = 0;
  if (providerUid) {
    // Latest contractor_earnings row wins — same lens as providerEarnings.ts.
    try {
      const [ce] = await db
        .select({
          payoutStatus: contractorEarnings.payoutStatus,
          amountCents: contractorEarnings.amountCents,
        })
        .from(contractorEarnings)
        .where(eq(contractorEarnings.bookingId, booking.bookingId))
        .limit(1);
      if (ce) {
        if (ce.payoutStatus === 'released') providerAvailable = Number(ce.amountCents ?? 0);
        if (ce.payoutStatus === 'paid_out') providerPaid = Number(ce.amountCents ?? 0);
      }
    } catch { /* non-fatal */ }
  }

  return {
    state: paid ? 'PAID' : totalCents > 0 ? 'PAYMENT_REQUIRED' : 'NOT_REQUIRED',
    currency: 'ILS',
    totalCents,
    amountPaidCents: paid ? totalCents : 0,
    amountDueCents: paid ? 0 : totalCents,
    providerExpectedCents: providerExpected || undefined,
    providerAvailableCents: providerAvailable || undefined,
    providerPaidCents: providerPaid || undefined,
    legs: [], // per §21 — only populate with legs we have real evidence for
  };
}

function defaultVerificationSitter(state: FulfillmentState): JobVerification {
  return {
    startMethod: 'CUSTOMER_CONFIRMATION',
    completionMethod: 'CUSTOMER_CONFIRMATION',
    handoffState: state === 'IN_PROGRESS' ? 'ISSUED' : 'NONE',
  };
}

// ─── WALK_MY_PET ─────────────────────────────────────────────────────

async function composeWalkPassport(
  bookingId: string,
  viewer: ActorIdentity,
): Promise<JobPassportEnvelope | null> {
  const [booking] = await db
    .select()
    .from(walkBookings)
    .where(eq(walkBookings.bookingId, bookingId));
  if (!booking) return null;

  const [walker] = await db
    .select()
    .from(walkerProfiles)
    .where(eq(walkerProfiles.walkerId, booking.walkerId));

  const isOwner = viewer.kind === 'CUSTOMER' && viewer.uid === booking.ownerId;
  const isWalker = viewer.kind === 'PROVIDER' && walker && viewer.uid === walker.userId;
  const isAdmin = viewer.kind === 'PETWASH_STAFF';
  if (!isOwner && !isWalker && !isAdmin) return null;

  const platform = getPlatform('WALK_MY_PET')!;
  const correlationId = `walk:${booking.bookingId}`;
  const jobRef = generateJobRef({ platform: 'WALK_MY_PET', stableId: correlationId });

  const [owner] = await db
    .select({ first: users.firstName, last: users.lastName })
    .from(users)
    .where(eq(users.id, booking.ownerId))
    .limit(1);

  const bookingState = mapWalkStatusToBookingState(String(booking.status));
  const fulfillmentState: FulfillmentState = 'NOT_STARTED';

  const fulfiller: JobFulfiller = walker
    ? {
        kind: 'PROVIDER',
        providerUid: walker.userId,
        providerPublicId: walker.walkerId,
        displayName: `${walker.firstName} ${walker.lastName}`.trim(),
        verifiedBadge: true,
        serviceApproved: true,
        suspended: false,
      }
    : { kind: 'PROVIDER' };

  // §24 walk today accepts WITHOUT a payment rail. Honest state: money
  // is NOT_REQUIRED (no rail configured) rather than PAID (which would
  // be a lie). A future PR that lands a real rail flips this.
  const totalCents = Math.round(parseFloat(booking.totalCost ?? '0') * 100);
  const money: JobMoney = {
    state: 'NOT_REQUIRED',
    currency: 'ILS',
    totalCents,
    amountPaidCents: 0,
    amountDueCents: 0,
    providerExpectedCents: Math.round(parseFloat(booking.walkerPayout ?? '0') * 100) || undefined,
    legs: [],
  };

  const verification: JobVerification = {
    startMethod: 'PIN',
    completionMethod: 'CUSTOMER_CONFIRMATION',
    handoffState: 'NONE',
  };

  const passport: JobPassport = {
    jobRef,
    correlationId,
    platform: 'WALK_MY_PET',
    serviceType: platform.serviceTypes[0],
    customer: {
      userId: booking.ownerId,
      displayName: [owner?.first, owner?.last].filter(Boolean).join(' ') || undefined,
    },
    fulfiller,
    pets: [],
    location: {
      type: 'WALK_START',
      display: '[pickup per privacy policy]',
    },
    schedule: {
      startsAt: new Date(booking.scheduledDate).toISOString(),
      endsAt: new Date(new Date(booking.scheduledDate).getTime() + (booking.durationMinutes || 60) * 60000).toISOString(),
      timezone: 'Asia/Jerusalem',
    },
    booking: {
      canonicalId: booking.bookingId,
      source: 'walk_bookings',
      sourceId: booking.bookingId,
      status: bookingState,
    },
    fulfillment: { state: fulfillmentState },
    money,
    verification,
    allowedActions: composeAllowedActions({
      platform: 'WALK_MY_PET',
      bookingState,
      fulfillmentState,
      moneyState: money.state,
      viewer,
      isOwner,
      isFulfiller: isWalker,
    }),
    auditRefs: [],
    composedAt: new Date().toISOString(),
  };

  return {
    passport,
    viewFor: {
      actor: viewer,
      showsProviderMoney: !!isWalker || !!isAdmin,
      showsLiveTracking: platform.liveTrackingSupported,
    },
  };
}

function mapWalkStatusToBookingState(s: string): BookingState {
  if (s === 'pending_provider' || s === 'payment_pending') return 'REQUESTED';
  if (s === 'confirmed') return 'CONFIRMED';
  if (s === 'completed') return 'COMPLETED';
  if (s === 'cancelled') return 'CANCELLED';
  return 'REQUESTED';
}

// ─── UNIFIED_REQUEST (booking_requests) ─────────────────────────────

async function composeUnifiedPassport(
  requestId: string,
  viewer: ActorIdentity,
): Promise<JobPassportEnvelope | null> {
  const [req] = await db
    .select()
    .from(bookingRequests)
    .where(eq(bookingRequests.requestId, requestId));
  if (!req) return null;

  const isOwner = viewer.kind === 'CUSTOMER' && viewer.uid === req.ownerId;
  const isProvider = viewer.kind === 'PROVIDER' && viewer.uid === req.providerId;
  const isAdmin = viewer.kind === 'PETWASH_STAFF';
  if (!isOwner && !isProvider && !isAdmin) return null;

  const platform = getPlatform('UNIFIED_REQUEST')!;
  const correlationId = `br:${req.requestId}`;
  const jobRef = generateJobRef({ platform: 'UNIFIED_REQUEST', stableId: correlationId });

  const [owner] = await db
    .select({ first: users.firstName, last: users.lastName })
    .from(users)
    .where(eq(users.id, req.ownerId))
    .limit(1);

  const bookingState = mapUnifiedStatusToBookingState(String(req.status));
  const fulfillmentState = mapUnifiedStatusToFulfillmentState(String(req.status));

  const totalCents = Number(req.totalCents ?? 0);
  const money: JobMoney = {
    // booking_requests tracks payoutStatus; we honour §22 and never
    // report PAID off booking status alone. A follow-up will delegate
    // to providerEarnings for the CE join truth.
    state: totalCents > 0 ? 'PAYMENT_REQUIRED' : 'NOT_REQUIRED',
    currency: 'ILS',
    totalCents,
    amountPaidCents: 0,
    amountDueCents: totalCents,
    legs: [],
  };

  const passport: JobPassport = {
    jobRef,
    correlationId,
    platform: 'UNIFIED_REQUEST',
    serviceType: String(req.serviceType ?? platform.serviceTypes[0]),
    customer: {
      userId: req.ownerId,
      displayName: [owner?.first, owner?.last].filter(Boolean).join(' ') || undefined,
    },
    fulfiller: {
      kind: 'PROVIDER',
      providerUid: req.providerId ?? undefined,
    },
    pets: [],
    location: {
      type: 'UNKNOWN',
      display: '[address per privacy policy]',
    },
    schedule: {
      startsAt: new Date().toISOString(),
      timezone: 'Asia/Jerusalem',
    },
    booking: {
      canonicalId: req.requestId,
      source: 'booking_requests',
      sourceId: req.requestId,
      status: bookingState,
    },
    fulfillment: { state: fulfillmentState },
    money,
    verification: {
      startMethod: 'SERVER_STATE',
      completionMethod: 'CUSTOMER_CONFIRMATION',
      handoffState: 'NONE',
    },
    allowedActions: composeAllowedActions({
      platform: 'UNIFIED_REQUEST',
      bookingState,
      fulfillmentState,
      moneyState: money.state,
      viewer,
      isOwner,
      isFulfiller: isProvider,
    }),
    auditRefs: [],
    composedAt: new Date().toISOString(),
  };

  return {
    passport,
    viewFor: {
      actor: viewer,
      showsProviderMoney: !!isProvider || !!isAdmin,
      showsLiveTracking: platform.liveTrackingSupported,
    },
  };
}

function mapUnifiedStatusToBookingState(s: string): BookingState {
  if (s === 'pending') return 'REQUESTED';
  if (s === 'accepted') return 'ACCEPTED';
  if (s === 'confirmed' || s === 'payment_pending' || s === 'in_progress') return 'CONFIRMED';
  if (s === 'completed' || s === 'reviewed' || s === 'provider_marked_complete') return 'COMPLETED';
  if (s === 'cancelled' || s === 'declined') return 'CANCELLED';
  return 'REQUESTED';
}

function mapUnifiedStatusToFulfillmentState(s: string): FulfillmentState {
  if (s === 'in_progress') return 'IN_PROGRESS';
  if (s === 'provider_marked_complete') return 'PROVIDER_COMPLETED';
  if (s === 'completed' || s === 'reviewed') return 'CUSTOMER_CONFIRMED';
  return 'NOT_STARTED';
}

// Re-export for callers that only need to know the target platform
// from a raw booking authority string.
export { platformFromBookingAuthority };
