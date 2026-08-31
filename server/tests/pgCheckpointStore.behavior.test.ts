/**
 * PgCheckpointStore behavior — CEO Journey Brain Phase 2 (task #141).
 *
 * Verifies the Drizzle-backed adapter honours the CheckpointStore
 * interface: put() upserts on (owner_uid, kind), get() returns
 * undefined for missing rows and a well-shaped JourneyCheckpoint
 * for hits, delete() removes only the requested (uid, kind) pair.
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
  lastConflict: null as { target: unknown; set: Record<string, unknown> } | null,
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
    eq: (col: any, val: any) => ({ col: col?.name, val }),
    and: (...preds: any[]) => ({ and: preds }),
  };
});

vi.mock('../db', () => ({
  db: {
    insert: () => ({
      values: (v: any) => ({
        onConflictDoUpdate: (opts: any) => {
          state.lastConflict = { target: opts.target, set: opts.set };
          const existing = state.rows.find((r) => r.ownerUid === v.ownerUid && r.kind === v.kind);
          if (existing) {
            existing.step = opts.set.step ?? existing.step;
            existing.payload = (opts.set.payload ?? existing.payload) as Record<string, unknown>;
            existing.updatedAt = (opts.set.updatedAt ?? new Date()) as Date;
          } else {
            state.rows.push({
              ownerUid: v.ownerUid,
              kind: v.kind,
              step: v.step,
              payload: v.payload ?? {},
              updatedAt: new Date(),
            });
          }
          return Promise.resolve();
        },
      }),
    }),
    select: () => ({
      from: (_t: any) => ({
        where: (predicate: any) => ({
          limit: async (_n: number) => {
            // predicate is { and: [ eq(ownerUid, uid), eq(kind, kind) ] }
            const clauses: Array<{ col: string; val: string }> = predicate?.and ?? [];
            const byCol = Object.fromEntries(clauses.map((c) => [c.col, c.val]));
            const uid = byCol['owner_uid'];
            const kind = byCol['kind'];
            return state.rows.filter((r) => r.ownerUid === uid && r.kind === kind);
          },
        }),
      }),
    }),
    delete: (_t: any) => ({
      where: async (predicate: any) => {
        const clauses: Array<{ col: string; val: string }> = predicate?.and ?? [];
        const byCol = Object.fromEntries(clauses.map((c) => [c.col, c.val]));
        const uid = byCol['owner_uid'];
        const kind = byCol['kind'];
        for (let i = state.rows.length - 1; i >= 0; i--) {
          if (state.rows[i].ownerUid === uid && state.rows[i].kind === kind) {
            state.rows.splice(i, 1);
          }
        }
      },
    }),
  },
}));

const { PgCheckpointStore } = await import('../services/marketplace/PgCheckpointStore');

beforeEach(() => {
  state.rows.length = 0;
  state.lastConflict = null;
});

describe('PgCheckpointStore', () => {
  it('get returns undefined for a missing (uid, kind) pair', async () => {
    const store = new PgCheckpointStore();
    const cp = await store.get('uid-nobody', 'CHECKOUT');
    expect(cp).toBeUndefined();
  });

  it('put inserts a new row (onConflict path armed) and get returns the shaped checkpoint', async () => {
    const store = new PgCheckpointStore();
    await store.put({
      kind: 'CHECKOUT',
      ownerUid: 'uid-sarah',
      step: 'summary',
      payload: { formValues: {}, entityRef: { kind: 'booking', id: 'BK-1' } },
      updatedAt: new Date().toISOString(),
    });
    const cp = await store.get('uid-sarah', 'CHECKOUT');
    expect(cp).toBeDefined();
    if (!cp) throw new Error();
    expect(cp.kind).toBe('CHECKOUT');
    expect(cp.ownerUid).toBe('uid-sarah');
    expect(cp.step).toBe('summary');
    expect(typeof cp.updatedAt).toBe('string');
    expect(state.lastConflict?.target).toBeDefined();
  });

  it('put twice for the same (uid, kind) upserts — second write overwrites step + payload', async () => {
    const store = new PgCheckpointStore();
    await store.put({
      kind: 'BOOKING_REQUEST', ownerUid: 'uid-1', step: 'pet_pick', payload: {},
      updatedAt: new Date().toISOString(),
    });
    await store.put({
      kind: 'BOOKING_REQUEST', ownerUid: 'uid-1', step: 'confirm', payload: { providerId: 'P-1' },
      updatedAt: new Date().toISOString(),
    });
    const cp = await store.get('uid-1', 'BOOKING_REQUEST');
    expect(cp?.step).toBe('confirm');
    expect((cp?.payload as any).providerId).toBe('P-1');
    // Only one row in the mock table — proves the upsert path (not two inserts).
    expect(state.rows.filter((r) => r.ownerUid === 'uid-1' && r.kind === 'BOOKING_REQUEST')).toHaveLength(1);
  });

  it('put for the same uid with a DIFFERENT kind creates a distinct row', async () => {
    const store = new PgCheckpointStore();
    await store.put({ kind: 'CHECKOUT', ownerUid: 'uid-1', step: 's1', payload: {}, updatedAt: new Date().toISOString() });
    await store.put({ kind: 'SHOP_CART', ownerUid: 'uid-1', step: 's2', payload: {}, updatedAt: new Date().toISOString() });
    expect(state.rows.filter((r) => r.ownerUid === 'uid-1')).toHaveLength(2);
  });

  it('get isolates by ownerUid — one user cannot read another user\'s checkpoint of the same kind', async () => {
    const store = new PgCheckpointStore();
    await store.put({ kind: 'CHECKOUT', ownerUid: 'uid-alice', step: 'summary', payload: {}, updatedAt: new Date().toISOString() });
    const cp = await store.get('uid-bob', 'CHECKOUT');
    expect(cp).toBeUndefined();
  });

  it('delete removes only the requested (uid, kind) pair', async () => {
    const store = new PgCheckpointStore();
    await store.put({ kind: 'CHECKOUT', ownerUid: 'uid-1', step: 's', payload: {}, updatedAt: new Date().toISOString() });
    await store.put({ kind: 'SHOP_CART', ownerUid: 'uid-1', step: 's', payload: {}, updatedAt: new Date().toISOString() });
    await store.delete('uid-1', 'CHECKOUT');
    expect(await store.get('uid-1', 'CHECKOUT')).toBeUndefined();
    // The SHOP_CART row stays intact.
    expect(await store.get('uid-1', 'SHOP_CART')).toBeDefined();
  });
});
