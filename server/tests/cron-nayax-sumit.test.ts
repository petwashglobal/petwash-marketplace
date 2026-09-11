/**
 * Nayax→SUMIT fiscal automation cron — regression pin (2026-07-11).
 * Verifies the hands-off scheduled rail: same x-cron-secret auth as the other crons,
 * covers the WHOLE live bay fleet by default, is dark-safe, and is actually mounted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { NAYAX_TERMINALS } from '../services/nayaxTerminals';

/** Every bay that takes money today. Named, so dropping one from the registry
 *  fails here instead of silently shrinking the fleet the rail documents. */
const LIVE_BAYS = ['182374', '182403', '182443', '182462'];

const CRON = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'cron-nayax-sumit.ts'), 'utf8');
const ROUTES = fs.readFileSync(path.resolve(__dirname, '..', 'routes.ts'), 'utf8');

describe('cron-nayax-sumit (2026-07-11)', () => {
  it('exposes POST /nayax-sumit-reconcile with cron-secret OR super-admin auth', () => {
    expect(CRON).toMatch(/router\.post\('\/nayax-sumit-reconcile'/);
    expect(CRON).toMatch(/x-cron-secret/);
    expect(CRON).toMatch(/timingSafeEqual/);
    // #240 migration: re-pointed from the bare `isSuperAdmin(email)` shape.
    // That shape is the audit-199 DEFECT (allowlist match on the email
    // STRING alone); the route was correctly migrated to
    // isSuperAdminVerified(req) — allowlist AND email_verified === true —
    // so this pin had begun failing against the FIXED code and was telling
    // the next agent to restore the vulnerability. Guarantee unchanged.
    expect(CRON).toMatch(/isSuperAdminVerified\(req as any\)/);
  });

  /**
   * ROTTED, AND IT ASSERTED THE BUG (found 2026-09-12, never once run in CI).
   *
   * This read `DEFAULT_MACHINE_IDS = '182443,182462'` — the Wald-only hardcode
   * that was replaced on 2026-09-06 precisely because the Green Park 80 bays
   * 182374/182403 had been taking money since July with nothing documenting them.
   * So the pin failed against the fix and would have gone GREEN against a revert
   * to the two-bay list: a guard that rewards losing half the fleet's tax
   * documents. It survived because no CI job has ever run this file.
   *
   * Pinned to the INVARIANT now — the fleet comes from the terminal registry, so
   * every bay that can take money is a bay the rail documents — plus every live
   * machine id by name, so adding a bay to the registry and forgetting the cron
   * cannot pass. A literal default list is what rotted; it is not restored.
   */
  it('documents the WHOLE fleet — derived from the terminal registry, env-overridable', () => {
    expect(CRON).toMatch(/const DEFAULT_MACHINE_IDS = Object\.keys\(NAYAX_TERMINALS\)\.join\(','\)/);
    expect(CRON).not.toMatch(/const DEFAULT_MACHINE_IDS = '[\d,]+'/);
    expect(CRON).toMatch(/process\.env\.NAYAX_BRIDGE_MACHINE_IDS/);
    for (const id of LIVE_BAYS) {
      expect(Object.keys(NAYAX_TERMINALS), `bay ${id} must be in the fleet`).toContain(id);
    }
  });

  it('drives the triple-dark, idempotent bridge (no bespoke issuance logic)', () => {
    // Tolerant of formatting: this previously required `{ dryRun` on the same
    // line and broke the moment the call was wrapped. A pin that fails on a
    // line break teaches people to delete pins.
    expect(CRON).toMatch(/reconcileMachineToSumit\(machineId,\s*\{[\s\S]{0,200}?dryRun/);
    expect(CRON).toMatch(/bridgeWired\(\)/);
  });

  it('is registered under /api/cron', () => {
    expect(ROUTES).toMatch(/import cronNayaxSumitRoutes from ".\/routes\/cron-nayax-sumit"/);
    expect(ROUTES).toMatch(/app\.use\('\/api\/cron', cronNayaxSumitRoutes\)/);
  });
});
