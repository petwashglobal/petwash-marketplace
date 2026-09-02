/**
 * Release-blocker A1 + A2 — kill-switch AND idempotency fail CLOSED
 * on any Postgres failure (CEO 2026-09-02 release freeze).
 *
 * Prior behaviour: getKillSwitch() returned `true` (permitted) on any
 * DB error, and checkIdempotency() returned `{hit:false}` (proceed as
 * a new mutation). A single Postgres blip therefore silently re-
 * enabled every dangerous flag AND opened the door to duplicate
 * wallet mutations.
 *
 * Fixed behaviour (this test locks in):
 *
 *   1. getKillSwitchAllowed() throws KillSwitchUnavailableError on ANY
 *      DB failure. Callers translate to a 503 "operation denied",
 *      never a 200 "permitted".
 *
 *   2. A missing row is UNKNOWN — throws the same error. An admin
 *      must explicitly seed the row to permit.
 *
 *   3. checkIdempotency() throws IdempotencyUnavailableError on DB
 *      failure — the caller returns 503, never proceeds as a fresh
 *      mutation.
 *
 *   4. recordIdempotency() throws on DB failure — if we cannot record
 *      the mutation we cannot honour a future retry either.
 *
 *   5. Happy paths still work: a row with enabled=true still returns
 *      permitted; a first idempotency check still returns {hit:false}
 *      and a second returns {hit:true, responseHash}.
 */
import { describe, expect, it, vi } from 'vitest';

// Silence the shared logger — the module logs ERROR on the fail-closed
// paths and that's the intended behaviour, but we don't want noise in
// the test runner output.
vi.mock('../lib/logger', () => ({
  logger: {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
  },
}));

import {
  getKillSwitchAllowed,
  checkIdempotency,
  recordIdempotency,
  KillSwitchUnavailableError,
  IdempotencyUnavailableError,
} from '../lib/killSwitchAndIdempotency';

// Minimal pg-Pool stand-in — one field, driven per-test.
type Q = { rows: any[] };
function makePool(handler: (sql: string, params?: unknown[]) => Promise<Q> | Q): any {
  return {
    query: async (sql: string, params?: unknown[]) => handler(sql, params),
  };
}

describe('A1 · getKillSwitchAllowed fails CLOSED', () => {
  it('DB error → throws KillSwitchUnavailableError', async () => {
    const pool = makePool(() => { throw new Error('connection reset'); });
    await expect(getKillSwitchAllowed(pool, 'payouts_enabled')).rejects.toBeInstanceOf(
      KillSwitchUnavailableError,
    );
  });

  it('row missing → throws KillSwitchUnavailableError (unknown state = deny)', async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(getKillSwitchAllowed(pool, 'remittances_enabled')).rejects.toBeInstanceOf(
      KillSwitchUnavailableError,
    );
  });

  it('row with enabled=true → returns true (happy permit path preserved)', async () => {
    const pool = makePool(() => ({ rows: [{ enabled: true }] }));
    await expect(getKillSwitchAllowed(pool, 'automation_enabled')).resolves.toBe(true);
  });

  it('row with enabled=false → returns false (deliberate deny path)', async () => {
    const pool = makePool(() => ({ rows: [{ enabled: false }] }));
    await expect(getKillSwitchAllowed(pool, 'policy_execution_enabled')).resolves.toBe(false);
  });

  it('row with enabled=<truthy-non-true> → strictly false (no type coercion permits)', async () => {
    const pool = makePool(() => ({ rows: [{ enabled: 'yes' as any }] }));
    await expect(getKillSwitchAllowed(pool, 'assistant_execution_enabled')).resolves.toBe(false);
  });

  it('error class shape is stable — callers depend on .name and .key', () => {
    const err = new KillSwitchUnavailableError('payouts_enabled', new Error('db_down'));
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('KillSwitchUnavailableError');
    expect(err.message).toBe('kill_switch_unavailable:payouts_enabled');
    expect(err.key).toBe('payouts_enabled');
  });
});

describe('A2 · checkIdempotency fails CLOSED', () => {
  it('DB error → throws IdempotencyUnavailableError', async () => {
    const pool = makePool(() => { throw new Error('connection reset'); });
    await expect(checkIdempotency(pool, 'idem-a', '/endpoint')).rejects.toBeInstanceOf(
      IdempotencyUnavailableError,
    );
  });

  it('no row → returns {hit:false} (fresh request path preserved)', async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(checkIdempotency(pool, 'idem-b', '/endpoint')).resolves.toEqual({ hit: false });
  });

  it('row present → returns {hit:true, responseHash}', async () => {
    const pool = makePool(() => ({ rows: [{ response_hash: 'abcd' }] }));
    await expect(checkIdempotency(pool, 'idem-c', '/endpoint')).resolves.toEqual({
      hit: true,
      responseHash: 'abcd',
    });
  });
});

describe('A2 · recordIdempotency fails CLOSED', () => {
  it('DB error → throws IdempotencyUnavailableError (cannot honour future retry)', async () => {
    const pool = makePool(() => { throw new Error('write failed'); });
    await expect(
      recordIdempotency(pool, 'idem-d', '/endpoint', '{"ok":true}'),
    ).rejects.toBeInstanceOf(IdempotencyUnavailableError);
  });

  it('successful write → resolves silently', async () => {
    const pool = makePool(() => ({ rows: [] }));
    await expect(
      recordIdempotency(pool, 'idem-e', '/endpoint', '{"ok":true}'),
    ).resolves.toBeUndefined();
  });

  it('error class shape is stable — callers depend on .name and .endpoint', () => {
    const err = new IdempotencyUnavailableError('/admin/wallet/test-retry-safety', new Error('db_down'));
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('IdempotencyUnavailableError');
    expect(err.message).toBe('idempotency_unavailable:/admin/wallet/test-retry-safety');
    expect(err.endpoint).toBe('/admin/wallet/test-retry-safety');
  });
});

describe('A2 · check-then-record round-trip (real caller shape)', () => {
  it('happy path: miss on first check, insert succeeds, hit on second check', async () => {
    const store = new Map<string, string>();
    const pool = makePool((sql: string, params?: unknown[]) => {
      const p = (params ?? []) as string[];
      if (sql.startsWith('SELECT response_hash')) {
        const key = `${p[0]}::${p[1]}`;
        const v = store.get(key);
        return v ? { rows: [{ response_hash: v }] } : { rows: [] };
      }
      if (sql.startsWith('INSERT INTO idempotency_keys')) {
        store.set(`${p[0]}::${p[1]}`, p[2]);
        return { rows: [] };
      }
      return { rows: [] };
    });

    const first = await checkIdempotency(pool, 'idem-happy', '/endpoint');
    expect(first).toEqual({ hit: false });

    await recordIdempotency(pool, 'idem-happy', '/endpoint', '{"ok":true}');

    const second = await checkIdempotency(pool, 'idem-happy', '/endpoint');
    expect(second.hit).toBe(true);
    expect(typeof second.responseHash).toBe('string');
    expect(second.responseHash!.length).toBeGreaterThan(0);
  });

  it('unhappy path: check succeeds (miss), record throws → caller sees the error, no double-record', async () => {
    let inserts = 0;
    const pool = makePool((sql: string) => {
      if (sql.startsWith('SELECT response_hash')) return { rows: [] };
      if (sql.startsWith('INSERT INTO idempotency_keys')) {
        inserts++;
        throw new Error('constraint conflict fell through');
      }
      return { rows: [] };
    });
    const c = await checkIdempotency(pool, 'idem-half', '/endpoint');
    expect(c).toEqual({ hit: false });
    await expect(
      recordIdempotency(pool, 'idem-half', '/endpoint', '{"ok":true}'),
    ).rejects.toBeInstanceOf(IdempotencyUnavailableError);
    expect(inserts).toBe(1);
  });
});
