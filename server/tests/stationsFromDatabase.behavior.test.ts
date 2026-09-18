/**
 * A station is a DATABASE ROW, not a code change (2026-09-18).
 *
 * server/lib/stationRegistry.ts was a literal two-row array (both Kfar Saba),
 * and it is what admin bookkeeping, maps and wallet passes read — so opening a
 * bay in any other city needed an engineer and a deploy. loadStations() now
 * reads station_registry (migration 0163 creates + seeds it) and falls back to
 * the built-in list only when the table is missing or empty, so a query blip
 * can never blank the map.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const h = vi.hoisted(() => ({ rows: [] as any[], fail: false, calls: 0 }));
vi.mock('../db', () => ({
  db: {
    execute: async () => {
      h.calls += 1;
      if (h.fail) throw new Error('relation "station_registry" does not exist');
      return { rows: h.rows };
    },
  },
}));

import { loadStations, rowToStation, buildMachineIndex, invalidateStationCache, STATION_REGISTRY } from '../lib/stationRegistry';

const row = (over: Record<string, unknown> = {}) => ({
  station_id: 'PWS-IL-TLV-001', station_name: 'Tel Aviv Port', station_name_he: 'נמל תל אביב',
  address: 'הנגר 1, תל אביב', city: 'תל אביב', coordinates: { lat: 32.0975, lng: 34.7745 },
  operating_status: 'active', is_active: true,
  bays: [{ machineId: '900111', terminalId: 'T-1', label: 'תא ימין' }],
  hours_he: '24/7', access_he: 'ליד החניון', access_en: 'Next to the car park', ...over,
});

describe('stations come from the database', () => {
  beforeEach(() => { h.rows = []; h.fail = false; h.calls = 0; invalidateStationCache(); });

  it('a new city needs only a row — no code change', async () => {
    h.rows = [row()];
    const stations = await loadStations({ force: true });
    expect(stations.map((s) => s.code)).toEqual(['PWS-IL-TLV-001']);
    expect(stations[0]).toMatchObject({ city: 'תל אביב', nameHe: 'נמל תל אביב', lat: 32.0975, open: true });
    expect(buildMachineIndex(stations).get('900111')?.station.code).toBe('PWS-IL-TLV-001');
  });

  it('an empty table falls back to the built-in stations (never an empty map)', async () => {
    h.rows = [];
    await expect(loadStations({ force: true })).resolves.toEqual(STATION_REGISTRY);
  });

  it('a DB error falls back too', async () => {
    h.fail = true;
    await expect(loadStations({ force: true })).resolves.toEqual(STATION_REGISTRY);
  });

  it('caches, and the cache can be dropped after an admin edit', async () => {
    h.rows = [row()];
    await loadStations({ force: true });
    await loadStations();
    expect(h.calls).toBe(1);
    invalidateStationCache();
    await loadStations();
    expect(h.calls).toBe(2);
  });

  it('a row without usable coordinates is dropped, not shown at 0,0', () => {
    expect(rowToStation(row({ coordinates: null }) as any)).toBeNull();
    expect(rowToStation(row({ coordinates: { lat: 'x', lng: 1 } }) as any)).toBeNull();
  });

  it('closed / inactive stations are marked closed', () => {
    expect(rowToStation(row({ operating_status: 'maintenance' }) as any)?.open).toBe(false);
    expect(rowToStation(row({ is_active: false }) as any)?.open).toBe(false);
  });

  it('bays without a machine id are ignored (bay income joins on it)', () => {
    const s = rowToStation(row({ bays: [{ label: 'תא' }, { machineId: '1', label: 'ok' }] }) as any);
    expect(s?.bays.map((b) => b.machineId)).toEqual(['1']);
  });
});

describe('admin station door', () => {
  const src = readFileSync(resolve(__dirname, '..', 'routes', 'admin-bookkeeping.ts'), 'utf8');
  const mig = readFileSync(resolve(__dirname, '..', '..', 'migrations', '0163_station_registry_seed.sql'), 'utf8');

  it('add/edit is super-admin only and validated', () => {
    expect(src).toMatch(/router\.post\('\/stations', requireSuperAdmin,/);
    expect(src).toMatch(/router\.get\('\/stations', requireSuperAdmin,/);
    expect(src).toMatch(/lat: z\.number\(\)\.gte\(-90\)\.lte\(90\)/);
  });

  it('one machine id cannot belong to two stations (bay income would split)', () => {
    expect(src).toMatch(/jsonb_array_elements\(COALESCE\(bays, '\[\]'::jsonb\)\)/);
    expect(src).toMatch(/MACHINE_ID_TAKEN/);
  });

  it('saving drops the cache so the change shows at once', () => {
    expect(src.indexOf('invalidateStationCache()')).toBeGreaterThan(src.indexOf("router.post('/stations'"));
  });

  it('the migration creates the table if missing and seeds the two real stations', () => {
    expect(mig).toMatch(/CREATE TABLE IF NOT EXISTS station_registry/);
    expect(mig).toMatch(/ADD COLUMN IF NOT EXISTS bays\s+jsonb/);
    expect(mig).toContain('PWS-IL-KFS-001');
    expect(mig).toContain('PWS-IL-KFS-002');
    expect(mig).toContain('182443');
    expect(mig).toMatch(/ON CONFLICT \(station_id\) DO NOTHING/);
  });
});
