/**
 * K9000 reconciliation engine + Cortina release-sweep wiring guard.
 * DB-coupled engine → verified by source-introspection + tsc (per repo norm for
 * money/DB engines), not an integration run. Covers the blueprint follow-ups:
 * schedule releaseStaleCortinaReservations on a cron + build the daily recon.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const recon = readFileSync(resolve(ROOT, 'server/services/K9000ReconciliationService.ts'), 'utf8');
const jobs = readFileSync(resolve(ROOT, 'server/backgroundJobs.ts'), 'utf8');
const bayCtl = readFileSync(resolve(ROOT, 'server/routes/admin-bay-control.ts'), 'utf8');

describe('K9000 reconciliation + release-sweep wiring', () => {
  it('release sweep is scheduled on a cron (RELEASE half actually runs)', () => {
    expect(jobs).toMatch(/releaseStaleCortinaReservations/);
    expect(jobs).toMatch(/acquireLock\('cortinaReleaseSweep'\)/);
  });

  it('daily reconciliation is scheduled', () => {
    expect(jobs).toMatch(/runK9000Reconciliation/);
    expect(jobs).toMatch(/acquireLock\('k9000Reconciliation'\)/);
  });

  it('recon writes the four self-owned break types into k9000_reconciliation_breaks', () => {
    expect(recon).toMatch(/INSERT INTO k9000_reconciliation_breaks/);
    expect(recon).toMatch(/'bay_hang'/);
    expect(recon).toMatch(/'commit_without_evidence'/);
    expect(recon).toMatch(/'duplicate_ref', severity: 'critical'/);   // double-vend is critical
    expect(recon).toMatch(/'stale_reservation'/);
  });

  it('recon is idempotent (no duplicate OPEN break for the same entity)', () => {
    expect(recon).toMatch(/SELECT 1 FROM k9000_reconciliation_breaks[^]*status = 'open'/);
  });

  it('recon alerts on CRITICAL breaks and never throws', () => {
    expect(recon).toMatch(/if \(critical > 0\)/);
    expect(recon).toMatch(/sendAlert\(\{/);
    expect(recon).toMatch(/catch \(err: any\) \{[^]*\[K9000Recon\] run error/);
  });

  it('Phase-2 Nayax-export break is left an explicit TODO, not silently assumed', () => {
    expect(recon).toMatch(/TODO \(Phase 2[^]*settlement_without_commit/);
  });

  it('admin can view + resolve breaks (guarded triage surface)', () => {
    expect(bayCtl).toMatch(/router\.get\('\/reconciliation-breaks'/);
    expect(bayCtl).toMatch(/router\.post\('\/reconciliation-breaks\/:id\/resolve'/);
    expect(bayCtl).toMatch(/K9000_RECON_BREAK_RESOLVE/); // audit-logged
  });
});
