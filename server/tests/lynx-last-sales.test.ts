/**
 * Lynx get-last-sales (bay-transaction reconciliation feed) — regression pin (2026-07-10).
 *
 * Verified against the Nayax Developer Portal (via MCP): Nayax Lynx is PULL, not
 * push — bay transactions are retrieved with
 *   GET /operational/v1/machines/{MachineID}/lastSales   (Bearer User Token)
 * This adds getLastSales to the existing money-safe LynxClient and exposes it as a
 * super-admin Tower Control feed. READ-ONLY; dark until LYNX_ENABLED + LYNX_USER_TOKEN.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CLIENT = fs.readFileSync(path.resolve(__dirname, '..', 'services', 'LynxClient.ts'), 'utf8');
const ADMIN = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'admin-lynx.ts'), 'utf8');

describe('Lynx last-sales pull (2026-07-10)', () => {
  it('LynxClient.getLastSales hits the real documented endpoint', () => {
    expect(CLIENT).toMatch(/export function getLastSales\(machineId: string\)/);
    expect(CLIENT).toMatch(/\/operational\/v1\/machines\/\$\{encodeURIComponent\(machineId\)\}\/lastSales/);
    expect(CLIENT).toMatch(/getLastSales,/); // exported on the LynxClient object
  });

  it('exposed as a super-admin Tower Control feed, audited', () => {
    expect(ADMIN).toMatch(/router\.get\('\/machine\/:machineId\/last-sales', \.\.\.requireSuperAdmin/);
    expect(ADMIN).toMatch(/LynxClient\.getLastSales\(machineId\)/);
    expect(ADMIN).toMatch(/ADMIN_LYNX_LAST_SALES/);
  });
});
