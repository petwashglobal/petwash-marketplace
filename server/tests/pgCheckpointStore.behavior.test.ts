/**
 * PgCheckpointStore behavior — CEO Journey Brain Phase 2 (task #141).
 *
 * Verifies the Drizzle-backed CheckpointStore satisfies the same
 * contract as InMemoryCheckpointStore: put + get round-trip, get on
 * a missing (uid, kind) returns undefined, delete removes the row.
 * The DB layer is stubbed — this pin catches contract drift, not DB
 * connectivity.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  rows: [] as Array<{
    ownerUid: string;
    kind: string;
    step: string;
    payload: Record<string, unknown>;
    updatedAt: Date;
  }>,
  captured: {
    lastUpsertConflictTarget: null as unknown,
    lastDelete: null as { uid: string; kind: string } | null,
  },
}));

vi.mock('@shared/schema', () => ({
  journeyCheckpoints: {
    ownerUid: { name: 'owner_uid' },
    kind: { name: 'kind' },
    step: { name: 'step' },
    payload: { name: 'payload' },
    updatedAt: { name: 'updated_at' },
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: (...preds: any[]) => ({ __and: preds }),
    eq: (col: any, val: any) => ({ __eq: [col?.name, val] }),
    sql: (strings: TemplateStringsArray) => ({ __sql: strings.join('') }),
  };
});

vi.mock('../db', () => ({
  db: {
    insert: (_t: any) => ({
      values: (v: any) => ({
        onConflictDoUpdate: async (opts: any) => {
          state.captured.lastUpsertConflictTarget = opts.target;
          // Simulate upsert: if a row with (ownerUid, kind) exists,
          // update; otherwise insert.
          const idx = state.rows.findIndex(
            (r) => r.ownerUid === v.ownerUid && r.kind === v.kind,
          );
          if (idx >= 0) {
            state.rows[idx] = {
              ...state.rows[idx],
              step: v.step,
              payload: v.payload,
              updatedAt: new Date(),
            };
          } else {
            state.rows.push({
              ownerUid: v.ownerUid,
              kind: v.kind,
              step: v.step,
              payload: v.payload,
              updatedAt: v.updatedAt,
            });
          }
          void opts.set; // capture-side effect only
        },
      }),
    }),
    select: (_cols: any) => ({
      from: (_t: any) => ({
        where: (predicate: any) => ({
          limit: async (_n: number) => {
            // Walk the mock predicate to pull the (ownerUid, kind) pair.
            const preds: any[] = predicate?.__and ?? [predicate];
            const parts: Record<string, string> = {};
            for (const p of preds) {
              if (p?.__eq) parts[p.__eq[0] as string] = p.__eq[1] as string;
            }
            return state.rows.filter(
              (r) => r.ownerUid === parts['owner_uid'] && r.kind === parts['kind'],
            );
          },
        }),
      }),
    }),
    delete: (_t: any) => ({
      where: async (predicate: any) => {
        const preds: any[] = predicate?.__and ?? [predicate];
        const parts: Record<string, string> = {};
        for (const p of preds) {
          if (p?.__eq) parts[p.__eq[0] as string] = p.__eq[1] as string;
        }
        state.captured.lastDelete = { uid: parts['owner_uid'], kind: parts['kind'] };
        state.rows = state.rows.filter(
          (r) => !(r.ownerUid === parts['owner_uid'] && r.kind === parts['kind']),
        );
      },
    }),
  },
}));

const { PgCheckpointStore } = await import('../services/marketplace/PgCheckpointStore');
import type { JourneyCheckpoint } from '../services/marketplace/JourneyCheckpointService';

beforeEach(() => {
  state.rows.length = 0;
  state.captured.lastUpsertConflictTarget = null;
  state.captured.lastDelete = null;
});

const cp = (overrides: Partial<JourneyCheckpoint> = {}): JourneyCheckpoint => ({
  ownerUid: 'sarah',
  kind: 'CHECKOUT',
  step: 'summary',
  payload: { entityRef: { kind: 'booking', id: 'BK-1' } },
  updatedAt: new Date('2026-08-31T12:00:00Z').toISOString(),
  ...overrides,
});

describe('PgCheckpointStore', () => {
  it('put + get round-trips the payload for the same (uid, kind)', async () => {
    const store = new PgCheckpointStore();
    await store.put(cp());
    const out = await store.get('sarah', 'CHECKOUT');
    expect(out).toBeDefined();
    expect(out?.ownerUid).toBe('sarah');
    expect(out?.kind).toBe('CHECKOUT');
    expect(out?.step).toBe('summary');
    expect(out?.payload).toEqual({ entityRef: { kind: 'booking', id: 'BK-1' } });
  });

  it('get on a missing (uid, kind) returns undefined', async () => {
    const store = new PgCheckpointStore();
    const out = await store.get('sarah', 'CHECKOUT');
    expect(out).toBeUndefined();
  });

  it('put upserts on conflict — same (uid, kind) never accumulates rows', async () => {
    const store = new PgCheckpointStore();
    await store.put(cp({ step: 'step-1' }));
    await store.put(cp({ step: 'step-2' }));
    await store.put(cp({ step: 'step-3' }));
    expect(state.rows.length).toBe(1);
    const out = await store.get('sarah', 'CHECKOUT');
    expect(out?.step).toBe('step-3');
  });

  it('put uses the ownerUid + kind conflict target', async () => {
    const store = new PgCheckpointStore();
    await store.put(cp());
    // The target array is drizzle-shape — we capture it verbatim to
    // pin the intent (the DB upsert plan MUST key on the composite
    // unique index; a rewrite that dropped either column would silently
    // introduce duplicate-per-user resume prompts).
    expect(state.captured.lastUpsertConflictTarget).toEqual([
      { name: 'owner_uid' },
      { name: 'kind' },
    ]);
  });

  it('delete removes the row for (uid, kind); subsequent get returns undefined', async () => {
    const store = new PgCheckpointStore();
    await store.put(cp());
    expect((await store.get('sarah', 'CHECKOUT'))).toBeDefined();
    await store.delete('sarah', 'CHECKOUT');
    expect(state.captured.lastDelete).toEqual({ uid: 'sarah', kind: 'CHECKOUT' });
    expect((await store.get('sarah', 'CHECKOUT'))).toBeUndefined();
  });

  it('two users are isolated — putting sarah:CHECKOUT does not surface for maya:CHECKOUT', async () => {
    const store = new PgCheckpointStore();
    await store.put(cp({ ownerUid: 'sarah' }));
    expect((await store.get('maya', 'CHECKOUT'))).toBeUndefined();
    expect((await store.get('sarah', 'CHECKOUT'))?.ownerUid).toBe('sarah');
  });

  it('two kinds for the same user are isolated (SHOP_CART vs CHECKOUT)', async () => {
    const store = new PgCheckpointStore();
    await store.put(cp({ kind: 'CHECKOUT', step: 'summary' }));
    await store.put(cp({ kind: 'SHOP_CART', step: 'cart' }));
    expect((await store.get('sarah', 'CHECKOUT'))?.step).toBe('summary');
    expect((await store.get('sarah', 'SHOP_CART'))?.step).toBe('cart');
    expect(state.rows.length).toBe(2);
  });

  it('null payload from the DB is projected as {} (never crashes)', async () => {
    // Simulate a legacy row with NULL payload.
    state.rows.push({
      ownerUid: 'sarah', kind: 'CHECKOUT', step: 'summary',
      payload: null as unknown as Record<string, unknown>,
      updatedAt: new Date('2026-08-31T12:00:00Z'),
    });
    const store = new PgCheckpointStore();
    const out = await store.get('sarah', 'CHECKOUT');
    expect(out?.payload).toEqual({});
  });
});
