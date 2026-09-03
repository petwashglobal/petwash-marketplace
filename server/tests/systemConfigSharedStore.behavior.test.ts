/**
 * Release-blocker B1 — SystemConfig shared store
 * (CEO 2026-09-02 release freeze).
 *
 * Prior behaviour: every runtime flag lived in a per-instance in-memory
 * Map. Multi-pod Cloud Run: an admin flip was invisible to other pods
 * and vanished on redeploy.
 *
 * Fixed behaviour (this test locks in):
 *
 *   1. Sync `get()` still works — returns from the local cache. Hot
 *      paths pay no DB cost.
 *
 *   2. On boot the service HYDRATES from the shared Postgres table
 *      (system_config). Pod 2 seeing a row Pod 1 wrote picks it up.
 *
 *   3. Every `set()` writes THROUGH to Postgres before updating the
 *      local cache. If the DB write throws, cache stays untouched and
 *      the caller sees the failure (so admins know their flip didn't
 *      take).
 *
 *   4. `reset()` and `patch()` are async and DB-backed too.
 *
 *   5. Hydrate is fail-safe: DB error leaves the cache as it was
 *      (defaults on cold boot, last-good-hydrate afterwards). Boot
 *      NEVER blocks on the DB.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/logger', () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

// In-memory Postgres stand-in.
type Row = { key: string; value_json: unknown; updated_by: string };
let dbRows: Row[] = [];
let hydrateThrows = false;
let writeThrows = false;

vi.mock('../db', () => ({
  pool: {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT key, value_json FROM system_config')) {
        if (hydrateThrows) throw new Error('hydrate failed');
        return { rows: dbRows.map((r) => ({ key: r.key, value_json: r.value_json })) };
      }
      if (sql.includes('INSERT INTO system_config')) {
        if (writeThrows) throw new Error('write failed');
        const p = (params ?? []) as any[];
        const key = p[0];
        const raw = p[1];
        const by = p[2];
        // The SQL passes the already-stringified JSON as text.
        let value: unknown;
        try { value = JSON.parse(raw); } catch { value = raw; }
        const idx = dbRows.findIndex((r) => r.key === key);
        if (idx >= 0) dbRows[idx] = { key, value_json: value, updated_by: by };
        else dbRows.push({ key, value_json: value, updated_by: by });
        return { rows: [] };
      }
      return { rows: [] };
    },
  },
  db: {},
}));

// Import AFTER mocks are in place.
const { systemConfig } = await import('../services/SystemConfig');

beforeEach(async () => {
  dbRows = [];
  hydrateThrows = false;
  writeThrows = false;
  // Fresh state — hydrate resets to defaults when the table is empty.
  await systemConfig.hydrate();
});

describe('B1 · SystemConfig shared store', () => {
  it('defaults are readable on cold boot with empty DB', async () => {
    await systemConfig.hydrate();
    // `sumit.mode` default per current spec is 'off' — assert something
    // observable.
    expect(systemConfig.get('sumit.mode' as any)).toBeDefined();
    expect(systemConfig.get('ff.returning_user.new_door.enabled' as any)).toBe(false);
  });

  it('set() writes through to DB THEN updates cache', async () => {
    await systemConfig.set(
      'ff.returning_user.new_door.enabled' as any,
      true as any,
      'admin@petwash.co.il',
    );
    expect(systemConfig.get('ff.returning_user.new_door.enabled' as any)).toBe(true);
    // The DB row must exist too — Pod 2 will hydrate this.
    const row = dbRows.find((r) => r.key === 'ff.returning_user.new_door.enabled');
    expect(row).toBeDefined();
    expect(row?.value_json).toBe(true);
    expect(row?.updated_by).toBe('admin@petwash.co.il');
  });

  it('set() DB failure throws and does NOT update the cache', async () => {
    // Baseline
    const before = systemConfig.get('ff.returning_user.new_door.enabled' as any);
    writeThrows = true;
    await expect(
      systemConfig.set('ff.returning_user.new_door.enabled' as any, true as any, 'admin'),
    ).rejects.toBeInstanceOf(Error);
    expect(systemConfig.get('ff.returning_user.new_door.enabled' as any)).toBe(before);
  });

  it('hydrate() picks up a row that another pod wrote', async () => {
    // Simulate Pod 1 writing.
    dbRows.push({
      key: 'ff.returning_user.new_door.enabled',
      value_json: true,
      updated_by: 'pod-1-admin',
    });
    // Pod 2 hydrates.
    await systemConfig.hydrate();
    expect(systemConfig.get('ff.returning_user.new_door.enabled' as any)).toBe(true);
  });

  it('hydrate() DB error keeps cache as-is (fail-safe)', async () => {
    // Prime the cache with a real value first.
    await systemConfig.set(
      'ff.returning_user.new_door.enabled' as any,
      true as any,
      'admin',
    );
    expect(systemConfig.get('ff.returning_user.new_door.enabled' as any)).toBe(true);
    // Now simulate a DB outage on refresh.
    hydrateThrows = true;
    await systemConfig.hydrate();
    // Cache still has the previous value — no revert to default.
    expect(systemConfig.get('ff.returning_user.new_door.enabled' as any)).toBe(true);
  });

  it('unknown key in DB is ignored on hydrate (no cache pollution)', async () => {
    dbRows.push({ key: 'ff.definitely.not.a.real.key', value_json: 'x', updated_by: 'x' });
    await systemConfig.hydrate();
    expect((systemConfig.all() as any)['ff.definitely.not.a.real.key']).toBeUndefined();
  });

  it('patch() writes each key through to DB', async () => {
    await systemConfig.patch(
      {
        'ff.returning_user.new_door.enabled': true,
        'ff.returning_user.new_door.percent': 25,
      } as any,
      'admin',
    );
    expect(systemConfig.get('ff.returning_user.new_door.enabled' as any)).toBe(true);
    expect(systemConfig.get('ff.returning_user.new_door.percent' as any)).toBe(25);
    expect(dbRows.some((r) => r.key === 'ff.returning_user.new_door.enabled')).toBe(true);
    expect(dbRows.some((r) => r.key === 'ff.returning_user.new_door.percent')).toBe(true);
  });
});
