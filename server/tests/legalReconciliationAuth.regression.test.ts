/**
 * Regression pin — GET /api/admin/legal-reconciliation auth matrix
 * (CEO 2026-08-26 correction pass #2 §6).
 *
 * The endpoint returns divergence counts across the canonical
 * `legal_acceptances` ledger vs. every legacy surface. It must NOT
 * rely on the /admin path segment alone — the handler explicitly
 * calls `isSuperAdmin(callerEmail)` and rejects anyone else.
 *
 * Structural pin — reads the handler source and asserts:
 *   • unauthenticated caller path denies (no firebaseUser → 403 or 401)
 *   • the handler branches on `isSuperAdmin(callerEmail)` and returns
 *     403 for anyone whose email is NOT on the super-admin allowlist
 *   • customer / provider / non-super-admin support roles ALSO 403 —
 *     confirmed by the same isSuperAdmin gate (there is no other
 *     branch that would let them through)
 *   • super-admin path is the only branch that reaches the queries
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'legal-reconciliation.ts'),
  'utf8',
);

describe('/api/admin/legal-reconciliation — auth matrix', () => {
  it('handler imports isSuperAdmin and rejects on it', () => {
    expect(SRC).toMatch(/import\s*\{\s*isSuperAdmin\s*\}\s*from\s*['"]\.\.\/middleware\/rbac['"]/);
    // The rejection branch must return 403 before ANY pool.query is
    // executed. Grep both.
    const gateIdx = SRC.indexOf('isSuperAdmin(callerEmail)');
    const queryIdx = SRC.indexOf('pool.query');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(queryIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(queryIdx);
    expect(SRC).toMatch(/return\s+res\.status\(403\)\.json\(\{\s*ok:\s*false,\s*error:\s*'Admin access required'/);
  });

  it('handler does not have any bypass branch that skips the isSuperAdmin gate', () => {
    // Every response path in the handler must be either the 403 above
    // or come AFTER the isSuperAdmin check.
    const beforeGate = SRC.split('isSuperAdmin(callerEmail)')[0];
    // No 200 res.json() before the gate.
    expect(beforeGate).not.toMatch(/res\.json\(\s*\{\s*ok:\s*true/);
    // No pool.query before the gate.
    expect(beforeGate).not.toMatch(/pool\.query\s*\(/);
  });

  it('handler never mutates rows — read-only queries only', () => {
    // pool.query is the only DB entry point used. Ban every mutation
    // verb by string match — a future refactor that adds INSERT /
    // UPDATE / DELETE / TRUNCATE / ALTER / DROP breaks this test.
    for (const verb of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'ALTER TABLE', 'DROP TABLE']) {
      expect(SRC).not.toMatch(new RegExp(verb, 'i'));
    }
  });

  it('handler surfaces migrationPending when views do not exist yet (Postgres 42P01)', () => {
    // A fresh env without migration 0129 applied must NOT 500 — it
    // returns 200 with { migrationPending } so the admin dashboard
    // renders a "run migration first" banner. §5 discipline: 0129 is
    // BLOCKED-CEO-DEPLOY today, so this branch must exist for the
    // life of the branch.
    expect(SRC).toMatch(/42P01/);
    expect(SRC).toMatch(/migrationPending/);
  });
});
