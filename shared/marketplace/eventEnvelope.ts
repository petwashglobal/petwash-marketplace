/**
 * EventEnvelope + EventOutboxSpec — CEO P0-CEP Batch §16 & §17.
 *
 * Doctrine:
 *   §16 (outbox pattern): every side-effecting event you produce is
 *   written INSIDE the same DB transaction that produced it, into
 *   an outbox. A separate worker reads the outbox and dispatches.
 *   The write-and-emit is atomic; the dispatch is at-least-once.
 *
 *   §17 (idempotency): consumers must dedupe on eventId, not on
 *   payload equality — the same event may be delivered twice.
 *
 * This file DECLARES the envelope shape every producer speaks and
 * every outbox row wraps, plus a pure state-transition evaluator
 * for the outbox row lifecycle. Zero DB, zero I/O — the runtime
 * outbox table + worker will consume this spec.
 *
 * Placed in shared/ so the client-side event producers (analytics,
 * saved-search created, favourite saved) speak the same envelope.
 */

/**
 * Idempotency-key composition is inlined here (identical to the
 * server-side IdempotencyKeyComposer) so `shared/` stays free of
 * imports into `server/`. Both files MUST stay in lock-step; a
 * regression pin (eventEnvelopeIdempotencyParity) walks both.
 */
interface KeyComposeInput {
  actionType: string;
  actorUid: string;
  entityRef: { kind: string; id: string };
  attemptSalt?: string;
}
function composeIdempotencyKey(input: KeyComposeInput): string {
  const parts = [
    input.actionType.trim(),
    input.actorUid.trim(),
    `${input.entityRef.kind.trim()}:${input.entityRef.id.trim()}`,
  ];
  if (input.attemptSalt && input.attemptSalt.trim()) {
    parts.push(`salt=${input.attemptSalt.trim()}`);
  }
  return parts.join('|');
}

/**
 * The full set of event types the outbox may transport. Closed
 * union — a well-meaning engineer cannot invent a new event type
 * without landing it here and (usually) also in a consumer.
 *
 * Naming: DOMAIN.PAST_TENSE (booking.confirmed, egift.redeemed).
 */
export const EVENT_TYPES = [
  // Booking lifecycle
  'booking.requested',
  'booking.accepted',
  'booking.confirmed',
  'booking.cancelled',
  'booking.completed',
  // Payments / wallet
  'payment.authorised',
  'payment.captured',
  'payment.refunded',
  'wallet.topped_up',
  'wallet.burned',
  // Shop / eGift
  'shop.order_placed',
  'egift.purchased',
  'egift.redeemed',
  // Prestige / provider
  'prestige.joined',
  'provider.application_submitted',
  'provider.approved',
  // Identity / profile
  'profile.updated',
  'contact.change_committed',
  // Journey / attention
  'saved_search.created',
  'favourite.saved',
  // Communications (consumer side, not the DELIVERY side)
  'notification.enqueued',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && (EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * The envelope every produced event wears. Consumers dedupe on
 * `eventId` — never on payload equality — because the outbox worker
 * is at-least-once and the same envelope may arrive twice.
 */
export interface EventEnvelope<TPayload = unknown> {
  /** Stable per-event identifier. Producer chooses; must be unique. */
  eventId: string;
  eventType: EventType;
  /** Envelope schema version so the same eventType may evolve safely. */
  schemaVersion: number;
  /** Wall-clock at which the event was PRODUCED (not delivered). */
  occurredAt: Date;
  /** Firebase UID of the actor whose action produced the event, or 'system'. */
  actorUid: string;
  /** Anchor entity so consumers can route without parsing payload. */
  entity: { kind: string; id: string };
  /**
   * Canonical idempotency key — the same value the write side used
   * to gate the mutation. Consumers use this AS WELL AS eventId for
   * cross-system correlation (e.g. the payment webhook can match a
   * booking.confirmed envelope by its idempotency key).
   */
  idempotencyKey: string;
  /** Distributed-trace correlation identifier. Empty string = untraced. */
  traceId: string;
  payload: TPayload;
}

/**
 * Compose an envelope from a producer's inputs. This does NOT
 * generate eventId (that's the producer's job — usually a uuid) so
 * that a producer retrying inside the same transaction can pass the
 * same eventId and stay idempotent.
 */
export interface EnvelopeComposeInput<TPayload = unknown> {
  eventId: string;
  eventType: EventType;
  schemaVersion: number;
  occurredAt: Date;
  actorUid: string;
  entity: { kind: string; id: string };
  traceId?: string;
  payload: TPayload;
  /** Optional attempt salt forwarded to IdempotencyKeyComposer. */
  attemptSalt?: string;
}

export function composeEventEnvelope<TPayload>(input: EnvelopeComposeInput<TPayload>): EventEnvelope<TPayload> {
  const keyInput: KeyComposeInput = {
    actionType: input.eventType,
    actorUid: input.actorUid,
    entityRef: input.entity,
    attemptSalt: input.attemptSalt,
  };
  return {
    eventId: input.eventId,
    eventType: input.eventType,
    schemaVersion: input.schemaVersion,
    occurredAt: input.occurredAt,
    actorUid: input.actorUid,
    entity: input.entity,
    idempotencyKey: composeIdempotencyKey(keyInput),
    traceId: input.traceId ?? '',
    payload: input.payload,
  };
}

/* ------------------------------------------------------------------
 * Outbox row lifecycle
 * ------------------------------------------------------------------ */

export type OutboxState = 'PENDING' | 'IN_FLIGHT' | 'DELIVERED' | 'FAILED' | 'DEAD';

export interface OutboxRowSnapshot {
  state: OutboxState;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  /** Populated iff DELIVERED. */
  deliveredAt?: Date;
  /** Populated iff FAILED / DEAD. */
  lastErrorCode?: string;
}

export type OutboxTransition =
  | 'PICK_UP'         // PENDING → IN_FLIGHT (worker claims for dispatch)
  | 'DELIVER_OK'      // IN_FLIGHT → DELIVERED
  | 'DELIVER_FAIL'    // IN_FLIGHT → FAILED (retryable) or DEAD (exhausted)
  | 'RESCHEDULE'      // FAILED → PENDING (next attempt due)
  | 'GIVE_UP';        // FAILED → DEAD (operator ack; no retry)

export interface TransitionInput {
  row: OutboxRowSnapshot;
  transition: OutboxTransition;
  now: Date;
  /** For DELIVER_FAIL/RESCHEDULE: back-off interval to apply. */
  backoffMs?: number;
  /** For DELIVER_FAIL/GIVE_UP: reason code to persist. */
  errorCode?: string;
}

export type TransitionVerdict =
  | { code: 'OK'; next: OutboxRowSnapshot }
  | { code: 'REFUSE'; reasonCode:
      | 'ILLEGAL_STATE_FOR_TRANSITION'
      | 'ATTEMPTS_ALREADY_EXHAUSTED'
    };

/**
 * Pure state-transition evaluator. The runtime worker calls this on
 * a snapshot loaded from the outbox row, applies the returned next
 * snapshot in the same transaction, and repeats. All invalid moves
 * are refused with a typed reason — the worker never guesses.
 */
export function transitionOutboxRow(input: TransitionInput): TransitionVerdict {
  const { row, transition, now } = input;
  switch (transition) {
    case 'PICK_UP': {
      if (row.state !== 'PENDING') {
        return { code: 'REFUSE', reasonCode: 'ILLEGAL_STATE_FOR_TRANSITION' };
      }
      return { code: 'OK', next: { ...row, state: 'IN_FLIGHT' } };
    }
    case 'DELIVER_OK': {
      if (row.state !== 'IN_FLIGHT') {
        return { code: 'REFUSE', reasonCode: 'ILLEGAL_STATE_FOR_TRANSITION' };
      }
      return { code: 'OK', next: { ...row, state: 'DELIVERED', deliveredAt: now } };
    }
    case 'DELIVER_FAIL': {
      if (row.state !== 'IN_FLIGHT') {
        return { code: 'REFUSE', reasonCode: 'ILLEGAL_STATE_FOR_TRANSITION' };
      }
      const nextAttempts = row.attempts + 1;
      // Exhausted OR was already at cap.
      if (nextAttempts >= row.maxAttempts) {
        return { code: 'OK', next: {
          ...row,
          state: 'DEAD',
          attempts: nextAttempts,
          lastErrorCode: input.errorCode,
        } };
      }
      const backoff = input.backoffMs ?? 60_000;
      return { code: 'OK', next: {
        ...row,
        state: 'FAILED',
        attempts: nextAttempts,
        nextAttemptAt: new Date(now.getTime() + backoff),
        lastErrorCode: input.errorCode,
      } };
    }
    case 'RESCHEDULE': {
      if (row.state !== 'FAILED') {
        return { code: 'REFUSE', reasonCode: 'ILLEGAL_STATE_FOR_TRANSITION' };
      }
      if (row.attempts >= row.maxAttempts) {
        return { code: 'REFUSE', reasonCode: 'ATTEMPTS_ALREADY_EXHAUSTED' };
      }
      return { code: 'OK', next: { ...row, state: 'PENDING' } };
    }
    case 'GIVE_UP': {
      if (row.state !== 'FAILED') {
        return { code: 'REFUSE', reasonCode: 'ILLEGAL_STATE_FOR_TRANSITION' };
      }
      return { code: 'OK', next: { ...row, state: 'DEAD', lastErrorCode: input.errorCode } };
    }
  }
}
