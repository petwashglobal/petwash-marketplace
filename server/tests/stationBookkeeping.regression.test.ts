/**
 * Station bookkeeping (CEO 2026-07-24: "K9000 dual bay info for bookkeeping,
 * maps, station id, shop, HR staff"). Per-bay financials from the live Nayax
 * ledger + canonical registry; honest HR flag (not faked).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const reg = R('server/lib/stationRegistry.ts');
const api = R('server/routes/admin-bookkeeping.ts');
const routes = R('server/routes.ts');
const page = R('client/src/pages/AdminBookkeeping.tsx');
const app = R('client/src/App.tsx');

describe('canonical station registry', () => {
  it('has both real Kfar Saba stations with dual-bay machine ids for Wald', () => {
    expect(reg).toContain("code: 'PWS-IL-KFS-001'");
    expect(reg).toContain("machineId: '182443'");
    expect(reg).toContain("machineId: '182462'");
    expect(reg).toContain("code: 'PWS-IL-KFS-002'"); // Green KS, bays fill in later
    expect(reg).toMatch(/buildMachineIndex/);
    expect(reg).toMatch(/waze\.com\/ul/);
  });
});

describe('bookkeeping endpoint', () => {
  it('is super-admin gated, mounted, and reads the real bay ledger with VAT split', () => {
    expect(api).toMatch(/requireSuperAdmin/);
    expect(api).toContain('FROM nayax_transaction_events');
    expect(api).toMatch(/vatCents: Math\.max\(0, grossCents - netCents\)/);
    expect(routes).toMatch(/adminBookkeepingRoutes/);
  });

  it('surfaces machines that reported but are not yet in the registry', () => {
    expect(api).toMatch(/orphanMachines/);
  });

  it('points at the real HR module (built 2026-07-24) — never a fake roster', () => {
    expect(api).toMatch(/staff: \{ built: true/);
    expect(api).toMatch(/href: '\/admin\/staff'/);
  });
});

describe('bookkeeping page', () => {
  it('routed behind the admin guard and reachable from the tower', () => {
    expect(app).toMatch(/path="\/admin\/bookkeeping"/);
    expect(R('client/src/pages/AdminOctopus.tsx')).toContain("to: '/admin/bookkeeping'");
  });

  it('renders per-bay gross/vat/net + map + waze links', () => {
    expect(page).toContain('bk-station-');
    expect(page).toMatch(/מע״מ/);
    expect(page).toMatch(/maps\.waze/);
  });
});
