/**
 * JourneyCheckpointService — Program 32.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryCheckpointStore,
  evaluateResume,
} from '../services/marketplace/JourneyCheckpointService';

const store = new InMemoryCheckpointStore();

beforeEach(() => store.clear());

const HOUR = 60 * 60 * 1000;

describe('JourneyCheckpointService', () => {
  it('no checkpoint → NO_CHECKPOINT', async () => {
    const out = await evaluateResume({ ownerUid: 'sarah', kind: 'BOOKING_REQUEST', store, ttlMs: 24 * HOUR });
    expect(out.code).toBe('NO_CHECKPOINT');
  });

  it('fresh checkpoint → RESUME', async () => {
    const cp = { kind: 'BOOKING_REQUEST' as const, ownerUid: 'sarah', step: 'PICK_TIME', payload: { providerId: 'maya' }, updatedAt: new Date('2026-08-30T09:00:00Z').toISOString() };
    store.put(cp);
    const out = await evaluateResume({ ownerUid: 'sarah', kind: 'BOOKING_REQUEST', store, ttlMs: 24 * HOUR, now: new Date('2026-08-30T10:00:00Z') });
    expect(out.code).toBe('RESUME');
    if (out.code !== 'RESUME') throw new Error();
    expect(out.checkpoint.step).toBe('PICK_TIME');
  });

  it('stale checkpoint → EXPIRED + auto-deleted', async () => {
    const cp = { kind: 'CHECKOUT' as const, ownerUid: 'sarah', step: 'CARD_DETAILS', payload: {}, updatedAt: new Date('2026-08-25T09:00:00Z').toISOString() };
    store.put(cp);
    const out = await evaluateResume({ ownerUid: 'sarah', kind: 'CHECKOUT', store, ttlMs: 24 * HOUR, now: new Date('2026-08-30T10:00:00Z') });
    expect(out.code).toBe('EXPIRED');
    // Store no longer holds it.
    expect(store.get('sarah', 'CHECKOUT')).toBeUndefined();
  });

  it('unparsable updatedAt → EXPIRED (never resume garbage state)', async () => {
    const cp = { kind: 'SHOP_CART' as const, ownerUid: 'sarah', step: 'REVIEW', payload: {}, updatedAt: 'not-a-date' };
    store.put(cp);
    const out = await evaluateResume({ ownerUid: 'sarah', kind: 'SHOP_CART', store, ttlMs: HOUR });
    expect(out.code).toBe('EXPIRED');
  });

  it('checkpoints are scoped by (ownerUid, kind) — no cross-user leak', async () => {
    store.put({ kind: 'CHECKOUT', ownerUid: 'sarah', step: 'CARD_DETAILS', payload: {}, updatedAt: new Date().toISOString() });
    const out = await evaluateResume({ ownerUid: 'nir', kind: 'CHECKOUT', store, ttlMs: HOUR });
    expect(out.code).toBe('NO_CHECKPOINT');
  });

  it('two kinds under the same uid are independent', async () => {
    const now = new Date();
    store.put({ kind: 'PROVIDER_APPLICATION', ownerUid: 'sarah', step: 'UPLOAD_ID', payload: {}, updatedAt: now.toISOString() });
    const cart = await evaluateResume({ ownerUid: 'sarah', kind: 'SHOP_CART', store, ttlMs: HOUR });
    const app = await evaluateResume({ ownerUid: 'sarah', kind: 'PROVIDER_APPLICATION', store, ttlMs: HOUR });
    expect(cart.code).toBe('NO_CHECKPOINT');
    expect(app.code).toBe('RESUME');
  });
});
