/**
 * Booking lifecycle state machine.
 *
 * Single source of truth for which transitions are allowed and which
 * actor (owner / provider / system / admin) may trigger each one.
 *
 * Mirrors the canonical status enum in `shared/schema.ts`
 * (`booking_request_status`).
 *
 * USAGE
 * -----
 *   import { canTransition, applyTransition, BookingStatus } from
 *     '@shared/lib/bookingStateMachine';
 *
 *   const result = canTransition({
 *     from: booking.status,
 *     to: 'accepted',
 *     actor: 'provider',
 *   });
 *   if (!result.ok) {
 *     return res.status(result.statusCode).json({
 *       error: result.error,
 *       code: result.code,
 *     });
 *   }
 *
 * The module is pure — no DB, no React, no logger. It can be imported
 * from server handlers AND from the React admin UI to render the same
 * legal-transition graph.
 */

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'meet_greet_scheduled'
  | 'meet_greet_completed'
  | 'payment_pending'
  | 'confirmed'
  | 'in_progress'
  | 'provider_marked_complete'
  | 'completed'
  | 'reviewed'
  | 'cancelled'
  | 'disputed';

export const ALL_BOOKING_STATUSES: ReadonlyArray<BookingStatus> = [
  'pending',
  'accepted',
  'declined',
  'meet_greet_scheduled',
  'meet_greet_completed',
  'payment_pending',
  'confirmed',
  'in_progress',
  'provider_marked_complete',
  'completed',
  'reviewed',
  'cancelled',
  'disputed',
];

/**
 * Statuses from which a booking can no longer transition.
 * Anything in here should be treated as the end of the line.
 */
export const TERMINAL_STATUSES: ReadonlyArray<BookingStatus> = [
  'declined',
  'cancelled',
  'reviewed',
];

export type BookingActor = 'owner' | 'provider' | 'system' | 'admin';

/**
 * Allowed forward transitions, keyed by source status.
 * `cancelled` is intentionally reachable from many states — see CANCEL_FROM.
 */
const ALLOWED: Readonly<Record<BookingStatus, ReadonlyArray<BookingStatus>>> = {
  pending: ['accepted', 'declined', 'meet_greet_scheduled', 'cancelled'],
  accepted: ['payment_pending', 'confirmed', 'in_progress', 'cancelled', 'meet_greet_scheduled'],
  declined: [], // terminal
  meet_greet_scheduled: ['meet_greet_completed', 'cancelled', 'declined'],
  meet_greet_completed: ['payment_pending', 'confirmed', 'cancelled'],
  payment_pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['provider_marked_complete', 'completed', 'cancelled', 'disputed'],
  provider_marked_complete: ['completed', 'disputed', 'cancelled'],
  completed: ['reviewed', 'disputed'],
  reviewed: [], // terminal
  cancelled: [], // terminal
  disputed: ['completed', 'cancelled', 'reviewed'],
};

/**
 * Which actor roles may trigger a given (from → to) transition.
 * If a (from, to) pair is missing here we fall back to the conservative
 * default in `actorAllowed` below.
 */
const ROLE_RULES: Readonly<Record<string, ReadonlyArray<BookingActor>>> = {
  // pending → ?
  'pending->accepted':              ['provider', 'admin'],
  'pending->declined':              ['provider', 'admin', 'system'],
  'pending->meet_greet_scheduled':  ['provider', 'admin'],
  'pending->cancelled':             ['owner', 'provider', 'admin', 'system'],

  // accepted → ?
  'accepted->payment_pending':      ['system', 'owner', 'admin'],
  'accepted->confirmed':            ['system', 'admin'],
  'accepted->in_progress':          ['provider', 'admin'],
  'accepted->cancelled':            ['owner', 'provider', 'admin', 'system'],
  'accepted->meet_greet_scheduled': ['provider', 'owner', 'admin'],

  // meet_greet_scheduled → ?
  'meet_greet_scheduled->meet_greet_completed': ['provider', 'owner', 'admin'],
  'meet_greet_scheduled->cancelled':            ['owner', 'provider', 'admin', 'system'],
  'meet_greet_scheduled->declined':             ['provider', 'admin'],

  // meet_greet_completed → ?
  'meet_greet_completed->payment_pending': ['system', 'owner', 'admin'],
  'meet_greet_completed->confirmed':       ['system', 'admin'],
  'meet_greet_completed->cancelled':       ['owner', 'provider', 'admin', 'system'],

  // payment_pending → ?
  'payment_pending->confirmed': ['system', 'admin'],
  'payment_pending->cancelled': ['owner', 'admin', 'system'],

  // confirmed → ?
  'confirmed->in_progress': ['provider', 'admin'],
  'confirmed->cancelled':   ['owner', 'provider', 'admin', 'system'],

  // in_progress → ?
  'in_progress->provider_marked_complete': ['provider', 'admin'],
  'in_progress->completed':                ['provider', 'admin', 'system'],
  'in_progress->cancelled':                ['provider', 'admin', 'system'],
  'in_progress->disputed':                 ['owner', 'admin'],

  // provider_marked_complete → ?
  'provider_marked_complete->completed':  ['owner', 'admin', 'system'],
  'provider_marked_complete->disputed':   ['owner', 'admin'],
  'provider_marked_complete->cancelled':  ['admin', 'system'],

  // completed → ?
  'completed->reviewed': ['owner', 'admin'],
  'completed->disputed': ['owner', 'admin'],

  // disputed → ?
  'disputed->completed': ['admin'],
  'disputed->cancelled': ['admin'],
  'disputed->reviewed':  ['admin'],
};

export interface TransitionOk {
  ok: true;
}

export interface TransitionError {
  ok: false;
  /** Machine-readable error code for clients to switch on. */
  code:
    | 'TERMINAL_STATE'
    | 'INVALID_TRANSITION'
    | 'FORBIDDEN_ACTOR'
    | 'UNKNOWN_STATUS';
  /** HTTP status code that callers should return. */
  statusCode: 400 | 403 | 409;
  /** Human-readable English message (also safe to log). */
  error: string;
}

export type TransitionResult = TransitionOk | TransitionError;

/**
 * Returns `{ ok: true }` if the (from → to) transition is legal for the
 * given actor. Otherwise returns a structured error with an HTTP code
 * the route handler can reuse verbatim.
 *
 * Rules in order:
 *   1. `to` must be a known BookingStatus.
 *   2. If `from` is in TERMINAL_STATUSES → 409 TERMINAL_STATE.
 *   3. `to` must be in ALLOWED[from] → 409 INVALID_TRANSITION.
 *   4. The actor must be in the role list for that pair → 403 FORBIDDEN_ACTOR.
 */
export function canTransition(args: {
  from: BookingStatus | string;
  to: BookingStatus;
  actor: BookingActor;
}): TransitionResult {
  const { from, to, actor } = args;

  if (!ALL_BOOKING_STATUSES.includes(to)) {
    return {
      ok: false,
      code: 'UNKNOWN_STATUS',
      statusCode: 400,
      error: `Unknown target status: ${String(to)}`,
    };
  }
  if (!ALL_BOOKING_STATUSES.includes(from as BookingStatus)) {
    return {
      ok: false,
      code: 'UNKNOWN_STATUS',
      statusCode: 400,
      error: `Unknown source status: ${String(from)}`,
    };
  }

  const fromTyped = from as BookingStatus;
  if (TERMINAL_STATUSES.includes(fromTyped)) {
    return {
      ok: false,
      code: 'TERMINAL_STATE',
      statusCode: 409,
      error: `Cannot transition: booking is already in terminal state '${fromTyped}'.`,
    };
  }

  const allowed = ALLOWED[fromTyped] || [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      statusCode: 409,
      error: `Invalid transition '${fromTyped}' → '${to}'.`,
    };
  }

  const roleKey = `${fromTyped}->${to}`;
  const allowedActors = ROLE_RULES[roleKey];
  if (!allowedActors) {
    // Conservative default: only system / admin if no rule is defined.
    if (actor === 'system' || actor === 'admin') return { ok: true };
    return {
      ok: false,
      code: 'FORBIDDEN_ACTOR',
      statusCode: 403,
      error: `Actor '${actor}' is not permitted to transition '${fromTyped}' → '${to}'.`,
    };
  }
  if (!allowedActors.includes(actor)) {
    return {
      ok: false,
      code: 'FORBIDDEN_ACTOR',
      statusCode: 403,
      error: `Actor '${actor}' is not permitted to transition '${fromTyped}' → '${to}'.`,
    };
  }

  return { ok: true };
}

/**
 * Returns the schema column that should be stamped with NOW() when the
 * booking enters this status. Used by handlers and the audit job to
 * keep status-specific timestamps in sync without one if/else per call.
 *
 * Returns null when no per-status column exists (the row's general
 * `updatedAt` field should be used instead).
 */
export function timestampFieldFor(status: BookingStatus): string | null {
  switch (status) {
    case 'accepted':                 return 'acceptedAt';
    case 'declined':                 return 'declinedAt';
    case 'meet_greet_scheduled':     return 'meetGreetDate';
    case 'meet_greet_completed':     return 'meetGreetCompletedAt';
    case 'payment_pending':          return 'paymentHeldAt';
    case 'confirmed':                return 'confirmedAt';
    case 'in_progress':              return 'serviceStartedAt';
    case 'provider_marked_complete': return 'serviceCompletedAt';
    case 'completed':                return 'ownerConfirmedAt';
    case 'reviewed':                 return null; // tracked on review row
    case 'cancelled':                return 'cancelledAt';
    case 'disputed':                 return 'disputeOpenedAt';
    default:                         return null;
  }
}

/**
 * Build an audit entry suitable for appending to the booking's
 * `statusHistory` jsonb column.
 */
export function buildHistoryEntry(args: {
  status: BookingStatus;
  actor: BookingActor;
  actorId?: string | null;
  note?: string | null;
}): {
  status: BookingStatus;
  actor: BookingActor;
  actorId: string | null;
  note: string | null;
  timestamp: string;
} {
  return {
    status: args.status,
    actor: args.actor,
    actorId: args.actorId ?? null,
    note: args.note ?? null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Convenience: combine canTransition + audit-entry building. Intended
 * to be the one call a handler makes before doing the DB update.
 */
export function applyTransition(args: {
  from: BookingStatus | string;
  to: BookingStatus;
  actor: BookingActor;
  actorId?: string | null;
  note?: string | null;
}): {
  result: TransitionResult;
  historyEntry?: ReturnType<typeof buildHistoryEntry>;
  timestampField?: string | null;
} {
  const result = canTransition(args);
  if (!result.ok) return { result };
  return {
    result,
    historyEntry: buildHistoryEntry({
      status: args.to,
      actor: args.actor,
      actorId: args.actorId,
      note: args.note,
    }),
    timestampField: timestampFieldFor(args.to),
  };
}
