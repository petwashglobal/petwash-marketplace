import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Regression pin for CEO 2026-08-19 SUMIT Phase 2 Item 11 — the daily
// reconciler cron + admin report endpoint. Locks in:
//   (a) SumitReconciliationService exposes runDailyReconcile() and
//       startSumitReconciliationJob() with the documented shapes, feature
//       flag SUMIT_DAILY_RECONCILE_ENABLED, and fail-quiet contract.
//   (b) The cron is registered in server/routes.ts alongside the other
//       daily reconcilers.
//   (c) GET /api/admin/sumit/reconcile-report is mounted, super-admin-gated,
//       and never accepts a userId from client input.
//   (d) Migration 0118 creates the sumit_reconcile_runs table + index; the
//       drizzle schema declares the matching pgTable.

const ROOT = join(__dirname, '..', '..');

const SERVICE_SRC = readFileSync(
  join(ROOT, 'server', 'services', 'SumitReconciliationService.ts'),
  'utf8',
);
const ADMIN_SUMIT_SRC = readFileSync(
  join(ROOT, 'server', 'routes', 'admin-sumit.ts'),
  'utf8',
);
const ROUTES_SRC = readFileSync(
  join(ROOT, 'server', 'routes.ts'),
  'utf8',
);
const MIGRATION_SRC = readFileSync(
  join(ROOT, 'migrations', '0118_sumit_reconcile_runs.sql'),
  'utf8',
);
const SCHEMA_SRC = readFileSync(
  join(ROOT, 'shared', 'schema.ts'),
  'utf8',
);

describe('SUMIT Phase 2 Item 11 — daily reconciler cron + admin report', () => {
  it('SumitReconciliationService exports runDailyReconcile with the documented shape', () => {
    expect(SERVICE_SRC).toMatch(
      /export\s+async\s+function\s+runDailyReconcile\s*\(\s*opts\?\s*:\s*\{[\s\S]*?sampleSize\?\s*:\s*number/,
    );
    // Return shape: { status, checkedUsers, mismatches, skipped, sampleSize, report }
    expect(SERVICE_SRC).toMatch(/interface\s+ReconcileResult/);
    expect(SERVICE_SRC).toMatch(/checkedUsers:\s*number/);
    expect(SERVICE_SRC).toMatch(/mismatches:\s*number/);
    expect(SERVICE_SRC).toMatch(/report:\s*MismatchRow\[\]/);
  });

  it('MismatchRow captures the two directions of drift', () => {
    expect(SERVICE_SRC).toMatch(/'sumit_has_local_missing'/);
    expect(SERVICE_SRC).toMatch(/'local_has_sumit_missing'/);
  });

  it('feature flag is SUMIT_DAILY_RECONCILE_ENABLED, defaulting OFF', () => {
    expect(SERVICE_SRC).toMatch(/isSumitDailyReconcileEnabled\s*\(\s*\)/);
    expect(SERVICE_SRC).toMatch(
      /process\.env\.SUMIT_DAILY_RECONCILE_ENABLED\s*===\s*'true'/,
    );
    // Explicit flag-off short-circuit branch.
    expect(SERVICE_SRC).toMatch(/status:\s*'flag_off'/);
  });

  it('is fail-quiet on SUMIT dormant AND on per-row SUMIT errors', () => {
    // Dormant branch skips per-row calls entirely.
    expect(SERVICE_SRC).toMatch(/status:\s*'dormant'/);
    expect(SERVICE_SRC).toMatch(/!client\.isWired\(\)/);
    // Per-row failure just skips the row — the whole reconcile keeps going.
    expect(SERVICE_SRC).toMatch(/skipped\+\+;\s*continue/);
  });

  it('never accepts a userId from client input — walks sumit_customers server-side', () => {
    // Service must not derive uid from any browser-shaped source.
    expect(SERVICE_SRC).not.toMatch(/req\.body\.userId|req\.query\.userId|req\.params\.userId/);
    // Walks the mapping table itself.
    expect(SERVICE_SRC).toMatch(/\.from\(sumitCustomers\)/);
  });

  it('is READ-ONLY on both SUMIT and local sides (no insert/update/delete beyond the run log)', () => {
    // Only allowed write: inserting into sumit_reconcile_runs.
    const inserts = SERVICE_SRC.match(/db\.insert\([^)]+\)/g) ?? [];
    for (const stmt of inserts) {
      expect(stmt).toMatch(/db\.insert\(sumitReconcileRuns\)/);
    }
    // No update / delete of any money-side or SUMIT-side table.
    expect(SERVICE_SRC).not.toMatch(/db\.update\(/);
    expect(SERVICE_SRC).not.toMatch(/db\.delete\(/);
  });

  it('startSumitReconciliationJob runs at 03:00 Asia/Jerusalem, every 24h', () => {
    expect(SERVICE_SRC).toMatch(/export\s+function\s+startSumitReconciliationJob/);
    expect(SERVICE_SRC).toMatch(/'Asia\/Jerusalem'/);
    // 03:00 is the documented run hour.
    expect(SERVICE_SRC).toMatch(/getMsUntilNextRunJerusalem\(\s*3\s*,\s*0\s*\)/);
    // Daily interval.
    expect(SERVICE_SRC).toMatch(/24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  });

  it('cron is registered in server/routes.ts alongside the other reconcilers', () => {
    expect(ROUTES_SRC).toMatch(/startSumitReconciliationJob\s*\(\s*\)/);
    // Registered inside the same startup block as the other daily jobs — pin
    // the neighbourhood so a reshuffle doesn't silently orphan it.
    const idx = ROUTES_SRC.indexOf('startSumitReconciliationJob');
    expect(idx).toBeGreaterThan(0);
    const window = ROUTES_SRC.slice(Math.max(0, idx - 3000), idx);
    expect(window).toMatch(/startDailyReconciliationJob\(\)/);
  });

  it('GET /api/admin/sumit/reconcile-report is mounted and super-admin-gated', () => {
    expect(ADMIN_SUMIT_SRC).toMatch(/router\.get\(\s*['"]\/reconcile-report['"]/);
    // Same gate chain as the /customer-sync diagnostics route.
    const routeStart = ADMIN_SUMIT_SRC.indexOf("router.get(\n  '/reconcile-report'");
    const nextExport = ADMIN_SUMIT_SRC.indexOf('export default router');
    const block = ADMIN_SUMIT_SRC.slice(routeStart, nextExport);
    expect(block).toMatch(/validateFirebaseToken/);
    expect(block).toMatch(/requireSuperAdminGate/);
    expect(block).toMatch(/checkAccessLevel\(8\)/);
    // Never derives uid from the request — reconciler is server-driven.
    expect(block).not.toMatch(/req\.body\.userId|req\.query\.userId|req\.params\.userId/);
  });

  it('admin route surfaces the feature-flag state without leaking the env value', () => {
    expect(ADMIN_SUMIT_SRC).toMatch(/isSumitDailyReconcileEnabled\s*\(\s*\)/);
    // Envelope shape: { flag: {enabled, envName}, runs: [...] } — no secret values.
    expect(ADMIN_SUMIT_SRC).toMatch(/envName:\s*['"]SUMIT_DAILY_RECONCILE_ENABLED['"]/);
  });

  it('migration 0118 creates sumit_reconcile_runs table + run_at index', () => {
    expect(MIGRATION_SRC).toMatch(/CREATE TABLE IF NOT EXISTS sumit_reconcile_runs/);
    expect(MIGRATION_SRC).toMatch(/id\s+SERIAL\s+PRIMARY KEY/i);
    expect(MIGRATION_SRC).toMatch(/checked_users\s+INTEGER/i);
    expect(MIGRATION_SRC).toMatch(/mismatches\s+INTEGER/i);
    expect(MIGRATION_SRC).toMatch(/skipped\s+INTEGER/i);
    expect(MIGRATION_SRC).toMatch(/status\s+VARCHAR\(32\)/i);
    expect(MIGRATION_SRC).toMatch(/report\s+JSONB/i);
    expect(MIGRATION_SRC).toMatch(/CREATE INDEX IF NOT EXISTS idx_sumit_reconcile_runs_run_at/);
    // Never touches money-side tables — additive-only new table.
    expect(MIGRATION_SRC).not.toMatch(/ALTER TABLE|DROP TABLE|UPDATE |DELETE FROM/i);
  });

  it('drizzle schema declares sumitReconcileRuns matching the migration', () => {
    expect(SCHEMA_SRC).toMatch(/export\s+const\s+sumitReconcileRuns\s*=\s*pgTable\(\s*['"]sumit_reconcile_runs['"]/);
    expect(SCHEMA_SRC).toMatch(/status:\s*varchar\(['"]status['"],\s*\{\s*length:\s*32\s*\}\)\.notNull\(\)/);
    expect(SCHEMA_SRC).toMatch(/report:\s*jsonb\(['"]report['"]\)/);
    expect(SCHEMA_SRC).toMatch(/index\(['"]idx_sumit_reconcile_runs_run_at['"]\)/);
  });
});
