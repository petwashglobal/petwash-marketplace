/**
 * Source-pin regression test for the manual-migrations allowlist in
 * scripts/apply-pending-migrations.ts.
 *
 * BEFORE this fix (CI run #967):
 *   The auto-migration step failed on `0009_tranzila_processor_auth_number.sql`
 *   with PG code 42P01 (undefined_table) — the tranzila_transactions
 *   table is managed outside the canonical Drizzle schema and does not
 *   exist in this deployment. The runner had no concept of "manual"
 *   migrations and fell through to the fail-closed branch, blocking
 *   every production deploy until a hot-fix landed.
 *
 * AFTER this fix:
 *   `migrations/.manual-migrations.txt` declares filenames that the
 *   runner must skip. Each listed file is inserted into
 *   _petwash_migrations as `bootstrapped: true` without ever being
 *   executed against the DB. 42P01 / 42703 remain fail-closed for
 *   non-allowlisted files (real ordering bugs).
 *
 * This source-pin test fails if:
 *   1. The allowlist file is removed.
 *   2. The runner stops reading the allowlist.
 *   3. The runner stops short-circuiting allowlisted files.
 *   4. 42P01 gets silently added to ALREADY_EXISTS_CODES (which would
 *      mask real schema-ordering bugs).
 *   5. 0009 is removed from the allowlist without the underlying
 *      tranzila_transactions table being created.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RUNNER_PATH = path.join(REPO_ROOT, 'scripts', 'apply-pending-migrations.ts');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'migrations', '.manual-migrations.txt');

const RUNNER_SRC = fs.readFileSync(RUNNER_PATH, 'utf8');

describe('apply-pending-migrations — manual-migrations allowlist', () => {
  it('loads the allowlist from migrations/.manual-migrations.txt', () => {
    expect(RUNNER_SRC).toMatch(/MANUAL_MIGRATIONS_LIST\s*=\s*join\(MIGRATIONS_DIR,\s*['"]\.manual-migrations\.txt['"]\)/);
    expect(RUNNER_SRC).toMatch(/function loadManualMigrationsList\(\)/);
  });

  it('skips comment lines (#) and blank lines when parsing the allowlist', () => {
    const block = RUNNER_SRC.match(
      /function loadManualMigrationsList[\s\S]*?\n\}/,
    )?.[0] ?? '';
    expect(block).toMatch(/startsWith\(['"]#['"]\)/);
    expect(block).toMatch(/if \(!trimmed/);
  });

  it('only accepts entries matching the migration filename pattern (defensive)', () => {
    const block = RUNNER_SRC.match(
      /function loadManualMigrationsList[\s\S]*?\n\}/,
    )?.[0] ?? '';
    expect(block).toMatch(/MIGRATION_FILE_RE\.test\(trimmed\)/);
  });

  it('records allowlisted files as bootstrapped without executing them', () => {
    // The skip block must run BEFORE the try { client.query(sql) } block
    // so an orphaned ALTER never reaches Postgres.
    const skipIdx = RUNNER_SRC.indexOf('manualSkip.has(file)');
    const queryIdx = RUNNER_SRC.indexOf('await client.query(sql)');
    expect(skipIdx).toBeGreaterThan(0);
    expect(queryIdx).toBeGreaterThan(0);
    expect(skipIdx).toBeLessThan(queryIdx);

    // The skip path must insert with bootstrapped=true.
    const block = RUNNER_SRC.match(
      /if \(manualSkip\.has\(file\)\)[\s\S]*?continue;/,
    )?.[0] ?? '';
    expect(block).toMatch(/bootstrapped\)\s*\n\s*VALUES \(\$1, \$2, true\)/);
    expect(block).toMatch(/ON CONFLICT \(filename\) DO NOTHING/);
  });

  it('does NOT add 42P01 (undefined_table) to ALREADY_EXISTS_CODES (would mask ordering bugs)', () => {
    const codesBlock = RUNNER_SRC.match(
      /ALREADY_EXISTS_CODES\s*=\s*new Set\(\[[\s\S]*?\]\)/,
    )?.[0] ?? '';
    expect(codesBlock).not.toMatch(/['"]42P01['"]/);
    expect(codesBlock).not.toMatch(/['"]42703['"]/);
    // Sanity: original four "object already exists" codes preserved.
    expect(codesBlock).toMatch(/['"]42P07['"]/);
    expect(codesBlock).toMatch(/['"]42710['"]/);
    expect(codesBlock).toMatch(/['"]42P06['"]/);
    expect(codesBlock).toMatch(/['"]42P16['"]/);
  });
});

describe('apply-pending-migrations — allowlist content', () => {
  // The Tranzila migration is the original landmine that motivated this
  // feature. If the table ever gets created in prod (Tranzila resurrected),
  // remove the line; until then it must stay.
  it('migrations/.manual-migrations.txt exists', () => {
    expect(fs.existsSync(ALLOWLIST_PATH)).toBe(true);
  });

  it('declares 0009_tranzila_processor_auth_number.sql as manual', () => {
    const lines = fs
      .readFileSync(ALLOWLIST_PATH, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    expect(lines).toContain('0009_tranzila_processor_auth_number.sql');
  });

  it('every non-comment line matches the migration filename pattern', () => {
    const lines = fs
      .readFileSync(ALLOWLIST_PATH, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    for (const line of lines) {
      expect(line).toMatch(/^\d{4}_[A-Za-z0-9_-]+\.sql$/);
    }
  });
});
