/**
 * GET /api/admin/approved-provider-recon — auth + READ-ONLY discipline pin (CEO §21).
 *
 * Structural pin — reads the handler source and asserts:
 *   • isSuperAdmin gate fires BEFORE any pool.query.
 *   • Every DB call in the handler is read-only (no INSERT/UPDATE/
 *     DELETE/TRUNCATE/ALTER/DROP).
 *   • repairPlan is 'PENDING-CEO' — the endpoint never triggers a fix.
 *   • trainer + station_operator surfaces mark notApplicable so ops
 *     doesn't chase false positives against tables that don't exist.
 *   • Missing tables (Postgres 42P01) return migrationPending rather
 *     than 500, matching the legal-reconciliation endpoint's pattern.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'admin-provider-recon.ts'),
  'utf8',
);

describe('/api/admin/approved-provider-recon — auth + read-only', () => {
  it('handler imports isSuperAdmin and rejects before any query', () => {
    expect(SRC).toMatch(/import\s*\{\s*isSuperAdmin\s*\}\s*from\s*['"]\.\.\/middleware\/rbac['"]/);
    const gateIdx = SRC.indexOf('isSuperAdmin(callerEmail)');
    const queryIdx = SRC.indexOf('pool.query');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(queryIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(queryIdx);
    expect(SRC).toMatch(/return\s+res\.status\(403\)\.json\(\{\s*ok:\s*false,\s*error:\s*'Admin access required'/);
  });

  it('handler is READ-ONLY — never mutates any row', () => {
    // The endpoint may reference INSERT/UPDATE/DELETE inside a JSON
    // response note ("Repair is a separate INSERT command…"), so ban
    // only the CODE forms: pool.query(...INSERT... etc.) by looking
    // inside the pool.query template blocks.
    const queryBlocks = SRC.match(/pool\.query\(`[\s\S]*?`\)/g) ?? [];
    expect(queryBlocks.length).toBeGreaterThan(0);
    for (const block of queryBlocks) {
      for (const verb of ['INSERT', 'UPDATE ', 'DELETE ', 'TRUNCATE', 'ALTER TABLE', 'DROP TABLE']) {
        expect(block, `Mutation verb '${verb}' found in pool.query block:\n${block}`)
          .not.toMatch(new RegExp(verb, 'i'));
      }
    }
  });

  it('repairPlan is a stable PENDING-CEO pointer (no auto-fix)', () => {
    expect(SRC).toMatch(/repairPlan:\s*['"]PENDING-CEO['"]/);
    // The note explaining why must remain — a PR that removes the
    // "READ-ONLY diagnostic" language is silently expanding scope.
    expect(SRC).toMatch(/READ-ONLY diagnostic\./);
  });

  it('trainer and station_operator verticals mark notApplicable (no false positives)', () => {
    // These verticals lack a queryable profile mirror today. If the
    // response silently included their approved count under
    // orphanCount, ops would chase phantom rows.
    expect(SRC).toMatch(/trainer:\s*\{[\s\S]*?notApplicable:\s*true/);
    expect(SRC).toMatch(/station_operator:\s*\{[\s\S]*?notApplicable:\s*true/);
  });

  it('missing tables (42P01) return migrationPending — never 500', () => {
    // Matches the legal-reconciliation endpoint's discipline. A fresh
    // env without provider_applications / sitter_profiles / walker_profiles
    // must render as a "run migrations first" banner, not a server error.
    expect(SRC).toMatch(/42P01/);
    expect(SRC).toMatch(/migrationPending/);
  });

  it('userId is truncated to last 6 chars in responses (PII discipline)', () => {
    // Full uids are available via admin customer-detail endpoint; the
    // recon response only carries a tail so a log search / screenshot
    // doesn't leak the full uid.
    expect(SRC).toMatch(/userIdTail:\s*truncateUid\(r\.user_id\)/);
    expect(SRC).toMatch(/raw\.slice\(-6\)/);
  });
});
