/**
 * Write-readiness probe — regression pin (2026-09-07).
 *
 * INCIDENT: on 2026-09-06, 12:09–12:14 UTC, the production database accepted
 * reads and refused every write. `/api/health` ran `SELECT 1`, which a
 * read-only database passes, so database health reported green for the whole
 * window while the FiscalOutboxDrainer, AsyncJobWorker, JobDispatch poller and
 * Cortina release sweep were all failing with "cannot execute UPDATE in a
 * read-only transaction". The 5xx alert fired correctly — alerting was never
 * the defect. The defect was that nothing separated "database unreachable"
 * from "database reachable but not writable".
 *
 * These tests pin the properties that make that state impossible to miss again.
 * classifyWriteError is pure, so the classification rules are tested for real
 * rather than by reading source; the wiring is pinned at source level because
 * no database is available in CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { classifyWriteError, SQLSTATE_READ_ONLY_TRANSACTION } from '../lib/dbWriteReadiness';

const repo = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(repo, p), 'utf8');

describe('classifyWriteError — the 2026-09-06 error shapes', () => {
  it('maps SQLSTATE 25006 to READ_ONLY, the code behind the outage', () => {
    expect(SQLSTATE_READ_ONLY_TRANSACTION).toBe('25006');
    const c = classifyWriteError({
      code: '25006',
      message: 'cannot execute UPDATE in a read-only transaction',
    });
    expect(c.kind).toBe('READ_ONLY');
    expect(c.code).toBe('25006');
  });

  it('still detects read-only when the driver swallowed the SQLSTATE', () => {
    // The Neon serverless driver can wrap an error and lose `code`. A read-only
    // database misreported as UNKNOWN is exactly the failure this module ends,
    // so the message fallback is load-bearing, not decoration.
    const c = classifyWriteError(new Error('cannot execute UPDATE in a read-only transaction'));
    expect(c.kind).toBe('READ_ONLY');
  });

  it('does not confuse an unreachable database with a read-only one', () => {
    expect(classifyWriteError({ code: '08006', message: 'connection failure' }).kind)
      .toBe('CONNECTION');
    expect(classifyWriteError({ code: '53300', message: 'too many connections' }).kind)
      .toBe('CONNECTION');
    // These must NOT be READ_ONLY — they need a different operator response.
    expect(classifyWriteError({ code: '08006', message: 'connection failure' }).kind)
      .not.toBe('READ_ONLY');
  });

  it('flags a missing probe table distinctly from a refused write', () => {
    const c = classifyWriteError({
      code: '42P01',
      message: 'relation "ops_db_write_probe" does not exist',
    });
    expect(c.kind).toBe('MISSING_PROBE_TABLE');
    expect(c.kind).not.toBe('READ_ONLY');
  });

  it('never throws on malformed input', () => {
    for (const bad of [null, undefined, 'a string', 42, {}]) {
      expect(() => classifyWriteError(bad)).not.toThrow();
      expect(classifyWriteError(bad).kind).toBeTruthy();
    }
  });
});

describe('the probe writes ONLY to the ops table, never to business data', () => {
  const SRC = read('lib/dbWriteReadiness.ts');

  it('targets ops_db_write_probe and nothing else', () => {
    expect(SRC).toMatch(/UPDATE ops_db_write_probe/);
    // Any write naming a money/customer/fiscal table is a hard failure: a health
    // probe must never be able to touch business rows.
    expect(SRC).not.toMatch(/UPDATE\s+(users|bookings|payments|digital_receipts|sitter_bookings|wallet)/i);
    expect(SRC).not.toMatch(/INSERT INTO\s+(users|bookings|payments|digital_receipts)/i);
  });

  it('reports reachable, readable and writable as separate facts', () => {
    for (const field of ['dbReachable', 'dbReadable', 'dbWritable', 'dbWriteErrorCode', 'dbWriteLatencyMs']) {
      expect(SRC).toMatch(new RegExp(`${field}\\b`));
    }
  });
});

describe('liveness must not depend on the write probe (no restart storm)', () => {
  const IDX = read('index.ts');

  it('/api/health status stays driven by the READ check', () => {
    // If `status` keyed off writability, Cloud Run would restart every container
    // during a read-only event — a restart storm on top of an outage.
    expect(IDX).toMatch(/const status = db\.ok \? 'OK' : 'DEGRADED'/);
  });

  it('/api/health still reports write state alongside it', () => {
    expect(IDX).toMatch(/dbWrite:\s*\{/);
    expect(IDX).toMatch(/dbWritable: write\.dbWritable/);
  });

  it('a separate readiness endpoint 503s when the database cannot take a write', () => {
    expect(IDX).toMatch(/'\/api\/health\/readiness'/);
    expect(IDX).toMatch(/res\.status\(w\.dbWritable \? 200 : 503\)/);
    // force:true — a cached "writable" must never promote a broken revision.
    expect(IDX).toMatch(/getDbWriteReadiness\(\{ force: true \}\)/);
  });

  it('never leaks the driver error message over HTTP', () => {
    // SQLSTATE and the classified kind are safe; the raw message can carry
    // connection details.
    expect(IDX).not.toMatch(/dbWriteErrorMessage/);
  });
});

describe('the incident is alertable, and the 5xx alert explains itself', () => {
  const AL = read('lib/alerts.ts');

  it('has a dedicated db_write_unavailable alert', () => {
    expect(AL).toMatch(/name: 'db_write_unavailable'/);
    // Fires only on readable-but-not-writable — the state that hides.
    expect(AL).toMatch(/if \(!w\.dbReadable \|\| w\.dbWritable\) return;/);
  });

  it('the existing 5xx alert now carries the write-probe state', () => {
    expect(AL).toMatch(/name: 'server_error_rate_high'/);
    expect(AL).toMatch(/db_writable: w\.dbWritable/);
    expect(AL).toMatch(/DATABASE IS NOT WRITABLE/);
  });

  it('alert enrichment can never suppress the alert itself', () => {
    expect(AL).toMatch(/catch \{ \/\* enrichment must never suppress the alert \*\/ \}/);
  });
});
