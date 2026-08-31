/**
 * Regression pin — CEO P0-CEP §16/§17.
 *
 * `shared/marketplace/eventEnvelope.ts` inlines composeIdempotencyKey
 * to avoid a shared→server import. That inlined copy MUST produce
 * exactly the same string as `server/services/marketplace/
 * IdempotencyKeyComposer.ts` for every plausible input, forever.
 * A cross-system correlation guarantee lives inside this equality.
 *
 * The pin runs the server-side composer AND the shared envelope
 * builder against a fixed input matrix and compares the derived keys.
 * If either implementation ever drifts, this test trips.
 */
import { describe, it, expect } from 'vitest';
import { composeIdempotencyKey } from '../services/marketplace/IdempotencyKeyComposer';
import { composeEventEnvelope } from '@shared/marketplace/eventEnvelope';

describe('EventEnvelope ↔ IdempotencyKeyComposer parity', () => {
  it('produces byte-identical idempotencyKey for every input in the matrix', () => {
    const now = new Date('2026-08-31T12:00:00Z');
    const cases: Array<{
      actionType: string;
      actorUid: string;
      entityRef: { kind: string; id: string };
      attemptSalt?: string;
    }> = [
      { actionType: 'booking.confirmed', actorUid: 'uid-42', entityRef: { kind: 'booking', id: 'BK-9' } },
      { actionType: 'payment.captured', actorUid: 'uid-1', entityRef: { kind: 'payment', id: 'P-1' } },
      { actionType: 'wallet.topped_up', actorUid: 'uid-77', entityRef: { kind: 'wallet', id: 'W' }, attemptSalt: 'reconcile-2' },
      { actionType: '  booking.cancelled  ', actorUid: ' uid ', entityRef: { kind: ' booking ', id: ' BK ' } }, // trim
      { actionType: 'egift.redeemed', actorUid: 'uid-9', entityRef: { kind: 'egift', id: 'GC-1' }, attemptSalt: '   ' /* blank salt ignored */ },
    ];
    for (const c of cases) {
      const expected = composeIdempotencyKey(c);
      const envelope = composeEventEnvelope({
        eventId: 'e',
        // Cast: composer's actionType is any string; envelope's is the closed EventType union.
        // For parity purposes we only care about the derived key equality.
        eventType: c.actionType as never,
        schemaVersion: 1,
        occurredAt: new Date('2026-08-31T12:00:00Z'),
        actorUid: c.actorUid,
        entity: c.entityRef,
        attemptSalt: c.attemptSalt,
        payload: {},
      });
      expect(envelope.idempotencyKey, `parity break for ${JSON.stringify(c)}`).toBe(expected);
    }
    // Silence the unused-variable warning on `now` in case a
    // future case wants it.
    void now;
  });
});
