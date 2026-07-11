/**
 * Nayax→SUMIT fiscal automation cron — regression pin (2026-07-11).
 * Verifies the hands-off scheduled rail: same x-cron-secret auth as the other crons,
 * covers the two Kfar Saba bays by default, is dark-safe, and is actually mounted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const CRON = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'cron-nayax-sumit.ts'), 'utf8');
const ROUTES = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');

describe('cron-nayax-sumit (2026-07-11)', () => {
  it('exposes POST /nayax-sumit-reconcile with cron-secret OR super-admin auth', () => {
    expect(CRON).toMatch(/router\.post\('\/nayax-sumit-reconcile'/);
    expect(CRON).toMatch(/x-cron-secret/);
    expect(CRON).toMatch(/timingSafeEqual/);
    expect(CRON).toMatch(/isSuperAdmin\(email\)/);
  });

  it('defaults to the two confirmed Kfar Saba bays, overridable by env', () => {
    expect(CRON).toMatch(/const DEFAULT_MACHINE_IDS = '182443,182462'/);
    expect(CRON).toMatch(/process\.env\.NAYAX_BRIDGE_MACHINE_IDS/);
  });

  it('drives the triple-dark, idempotent bridge (no bespoke issuance logic)', () => {
    expect(CRON).toMatch(/reconcileMachineToSumit\(machineId, \{ dryRun/);
    expect(CRON).toMatch(/bridgeWired\(\)/);
  });

  it('is registered under /api/cron', () => {
    expect(ROUTES).toMatch(/import cronNayaxSumitRoutes from ".\/routes\/cron-nayax-sumit"/);
    expect(ROUTES).toMatch(/app\.use\('\/api\/cron', cronNayaxSumitRoutes\)/);
  });
});
