/**
 * EventEnvelope + EventOutboxSpec — CEO P0-CEP task #175 (Batch §16/§17).
 *
 * Doctrine:
 *   §16 outbox pattern: mutation and its emitted event are atomic
 *   in the same transaction; a worker drains the outbox with
 *   at-least-once delivery semantics.
 *   §17 idempotency: consumers dedupe on eventId — same envelope
 *   may arrive twice.
 */
import { describe, it, expect } from 'vitest';
import {
  EVENT_TYPES,
  isEventType,
  composeEventEnvelope,
  transitionOutboxRow,
  type EventType,
  type OutboxRowSnapshot,
} from '@shared/marketplace/eventEnvelope';

const NOW = new Date('2026-08-31T12:00:00Z');

describe('EventEnvelope', () => {
  describe('EVENT_TYPES enumeration', () => {
    it('is non-empty and each entry is unique DOMAIN.past_tense', () => {
      expect(EVENT_TYPES.length).toBeGreaterThan(0);
      const seen = new Set<string>();
      for (const t of EVENT_TYPES) {
        expect(seen.has(t)).toBe(false);
        seen.add(t);
        expect(/^[a-z_]+\.[a-z_]+$/.test(t)).toBe(true);
      }
    });
    it('contains the CEO Batch §16-cited domains verbatim', () => {
      for (const req of [
        'booking.confirmed',
        'payment.captured',
        'wallet.topped_up',
        'egift.redeemed',
        'profile.updated',
        'saved_search.created',
      ]) {
        expect((EVENT_TYPES as readonly string[]).includes(req)).toBe(true);
      }
    });
  });

  describe('isEventType', () => {
    it('accepts registered types', () => {
      expect(isEventType('booking.confirmed')).toBe(true);
    });
    it('rejects freeform strings', () => {
      expect(isEventType('booking_confirmed')).toBe(false);
      expect(isEventType('Booking.Confirmed')).toBe(false);
      expect(isEventType('')).toBe(false);
      expect(isEventType(undefined)).toBe(false);
    });
  });

  describe('composeEventEnvelope', () => {
    it('deterministically derives idempotencyKey from actor + entity + eventType', () => {
      const a = composeEventEnvelope({
        eventId: 'evt-1',
        eventType: 'booking.confirmed' satisfies EventType,
        schemaVersion: 1,
        occurredAt: NOW,
        actorUid: 'uid-42',
        entity: { kind: 'booking', id: 'BK-9' },
        payload: { amount: 100 },
      });
      const b = composeEventEnvelope({
        eventId: 'evt-2',   // different envelope id
        eventType: 'booking.confirmed',
        schemaVersion: 1,
        occurredAt: NOW,
        actorUid: 'uid-42',
        entity: { kind: 'booking', id: 'BK-9' },
        payload: { amount: 100 },
      });
      // Different envelope IDs — but SAME logical action, so the
      // idempotency key matches. That is the guarantee consumers
      // rely on for cross-system correlation.
      expect(a.idempotencyKey).toBe(b.idempotencyKey);
      expect(a.eventId).not.toBe(b.eventId);
    });

    it('produces a distinct key when actor or entity differ', () => {
      const a = composeEventEnvelope({
        eventId: 'e', eventType: 'booking.confirmed', schemaVersion: 1,
        occurredAt: NOW, actorUid: 'uid-1', entity: { kind: 'booking', id: 'X' }, payload: {},
      });
      const b = composeEventEnvelope({
        eventId: 'e', eventType: 'booking.confirmed', schemaVersion: 1,
        occurredAt: NOW, actorUid: 'uid-2', entity: { kind: 'booking', id: 'X' }, payload: {},
      });
      expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
    });

    it('honours attemptSalt so a deliberate retry keys differently', () => {
      const a = composeEventEnvelope({
        eventId: 'e', eventType: 'payment.captured', schemaVersion: 1,
        occurredAt: NOW, actorUid: 'u', entity: { kind: 'p', id: '1' }, payload: {},
      });
      const b = composeEventEnvelope({
        eventId: 'e', eventType: 'payment.captured', schemaVersion: 1,
        occurredAt: NOW, actorUid: 'u', entity: { kind: 'p', id: '1' }, payload: {},
        attemptSalt: 'reconcile-2',
      });
      expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
    });

    it('empty traceId defaults to "" (never undefined) — telemetry contract', () => {
      const env = composeEventEnvelope({
        eventId: 'e', eventType: 'booking.confirmed', schemaVersion: 1,
        occurredAt: NOW, actorUid: 'u', entity: { kind: 'b', id: '1' }, payload: {},
      });
      expect(env.traceId).toBe('');
    });
  });
});

describe('EventOutbox transitions', () => {
  function makeRow(over: Partial<OutboxRowSnapshot> = {}): OutboxRowSnapshot {
    return {
      state: 'PENDING',
      attempts: 0,
      maxAttempts: 5,
      nextAttemptAt: NOW,
      ...over,
    };
  }

  it('PENDING → IN_FLIGHT on PICK_UP', () => {
    const v = transitionOutboxRow({ row: makeRow(), transition: 'PICK_UP', now: NOW });
    expect(v.code).toBe('OK');
    if (v.code !== 'OK') throw new Error();
    expect(v.next.state).toBe('IN_FLIGHT');
  });

  it('PICK_UP refuses on any non-PENDING state', () => {
    for (const state of ['IN_FLIGHT', 'DELIVERED', 'FAILED', 'DEAD'] as const) {
      const v = transitionOutboxRow({ row: makeRow({ state }), transition: 'PICK_UP', now: NOW });
      expect(v.code).toBe('REFUSE');
      if (v.code !== 'REFUSE') throw new Error();
      expect(v.reasonCode).toBe('ILLEGAL_STATE_FOR_TRANSITION');
    }
  });

  it('IN_FLIGHT → DELIVERED with deliveredAt=now on DELIVER_OK', () => {
    const v = transitionOutboxRow({
      row: makeRow({ state: 'IN_FLIGHT' }),
      transition: 'DELIVER_OK',
      now: NOW,
    });
    expect(v.code).toBe('OK');
    if (v.code !== 'OK') throw new Error();
    expect(v.next.state).toBe('DELIVERED');
    expect(v.next.deliveredAt).toEqual(NOW);
  });

  it('IN_FLIGHT → FAILED with back-off when attempts remain', () => {
    const v = transitionOutboxRow({
      row: makeRow({ state: 'IN_FLIGHT', attempts: 1, maxAttempts: 5 }),
      transition: 'DELIVER_FAIL',
      now: NOW,
      backoffMs: 60_000,
      errorCode: 'CONSUMER_5XX',
    });
    expect(v.code).toBe('OK');
    if (v.code !== 'OK') throw new Error();
    expect(v.next.state).toBe('FAILED');
    expect(v.next.attempts).toBe(2);
    expect(v.next.nextAttemptAt.getTime()).toBe(NOW.getTime() + 60_000);
    expect(v.next.lastErrorCode).toBe('CONSUMER_5XX');
  });

  it('IN_FLIGHT → DEAD when attempts+1 hits maxAttempts', () => {
    const v = transitionOutboxRow({
      row: makeRow({ state: 'IN_FLIGHT', attempts: 4, maxAttempts: 5 }),
      transition: 'DELIVER_FAIL',
      now: NOW,
      errorCode: 'CONSUMER_5XX',
    });
    expect(v.code).toBe('OK');
    if (v.code !== 'OK') throw new Error();
    expect(v.next.state).toBe('DEAD');
    expect(v.next.attempts).toBe(5);
  });

  it('FAILED → PENDING on RESCHEDULE while attempts remain', () => {
    const v = transitionOutboxRow({
      row: makeRow({ state: 'FAILED', attempts: 2 }),
      transition: 'RESCHEDULE',
      now: NOW,
    });
    expect(v.code).toBe('OK');
    if (v.code !== 'OK') throw new Error();
    expect(v.next.state).toBe('PENDING');
  });

  it('RESCHEDULE refuses when attempts already exhausted', () => {
    const v = transitionOutboxRow({
      row: makeRow({ state: 'FAILED', attempts: 5, maxAttempts: 5 }),
      transition: 'RESCHEDULE',
      now: NOW,
    });
    expect(v.code).toBe('REFUSE');
    if (v.code !== 'REFUSE') throw new Error();
    expect(v.reasonCode).toBe('ATTEMPTS_ALREADY_EXHAUSTED');
  });

  it('FAILED → DEAD on GIVE_UP (operator ack)', () => {
    const v = transitionOutboxRow({
      row: makeRow({ state: 'FAILED', attempts: 3 }),
      transition: 'GIVE_UP',
      now: NOW,
      errorCode: 'OPERATOR_ACK',
    });
    expect(v.code).toBe('OK');
    if (v.code !== 'OK') throw new Error();
    expect(v.next.state).toBe('DEAD');
    expect(v.next.lastErrorCode).toBe('OPERATOR_ACK');
  });
});
