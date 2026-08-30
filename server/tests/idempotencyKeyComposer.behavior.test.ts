/**
 * IdempotencyKeyComposer — canonical key derivation.
 */
import { describe, it, expect } from 'vitest';
import {
  composeIdempotencyKey,
  isSameIdempotencyKey,
} from '../services/marketplace/IdempotencyKeyComposer';

describe('IdempotencyKeyComposer', () => {
  it('same inputs → same key (deterministic)', () => {
    const k1 = composeIdempotencyKey({
      actionType: 'BOOKING_ACCEPT',
      actorUid: 'maya',
      entityRef: { kind: 'booking', id: 'B-1' },
    });
    const k2 = composeIdempotencyKey({
      actionType: 'BOOKING_ACCEPT',
      actorUid: 'maya',
      entityRef: { kind: 'booking', id: 'B-1' },
    });
    expect(k1).toBe(k2);
  });

  it('different actor → different key', () => {
    expect(composeIdempotencyKey({ actionType: 'A', actorUid: 'x', entityRef: { kind: 'k', id: '1' } }))
      .not.toBe(composeIdempotencyKey({ actionType: 'A', actorUid: 'y', entityRef: { kind: 'k', id: '1' } }));
  });

  it('different entity id → different key', () => {
    expect(composeIdempotencyKey({ actionType: 'A', actorUid: 'x', entityRef: { kind: 'k', id: '1' } }))
      .not.toBe(composeIdempotencyKey({ actionType: 'A', actorUid: 'x', entityRef: { kind: 'k', id: '2' } }));
  });

  it('different entity kind → different key (same id)', () => {
    expect(composeIdempotencyKey({ actionType: 'A', actorUid: 'x', entityRef: { kind: 'booking', id: '1' } }))
      .not.toBe(composeIdempotencyKey({ actionType: 'A', actorUid: 'x', entityRef: { kind: 'shop_order', id: '1' } }));
  });

  it('different attemptSalt → different key (retry after reconcile is a distinct attempt)', () => {
    const base = { actionType: 'PAYMENT_INITIATE', actorUid: 'sarah', entityRef: { kind: 'booking', id: 'B-1' } };
    expect(composeIdempotencyKey(base))
      .not.toBe(composeIdempotencyKey({ ...base, attemptSalt: 'retry-1' }));
    expect(composeIdempotencyKey({ ...base, attemptSalt: 'retry-1' }))
      .not.toBe(composeIdempotencyKey({ ...base, attemptSalt: 'retry-2' }));
  });

  it('whitespace-only attemptSalt is ignored (matches no-salt key)', () => {
    const base = { actionType: 'A', actorUid: 'x', entityRef: { kind: 'k', id: '1' } };
    expect(composeIdempotencyKey({ ...base, attemptSalt: '   ' }))
      .toBe(composeIdempotencyKey(base));
  });

  it('isSameIdempotencyKey wraps the equality check', () => {
    const a = { actionType: 'A', actorUid: 'x', entityRef: { kind: 'k', id: '1' } };
    const b = { actionType: 'A', actorUid: 'x', entityRef: { kind: 'k', id: '2' } };
    expect(isSameIdempotencyKey(a, a)).toBe(true);
    expect(isSameIdempotencyKey(a, b)).toBe(false);
  });
});
