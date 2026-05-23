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

describe('apply-pending-migrations — --lenient mode (M-DEPLOY-1b)', () => {
  // Why lenient mode exists: prod schema drifted from migration files
  // (tables created via out-of-band drizzle-kit push). One orphaned
  // ALTER (e.g. 0015 on station_settlements) blocking every downstream
  // migration is what caused CI run #968. The fix is to log orphans
  // and continue so newer migrations still apply. Strict mode is
  // preserved for local dev to catch real ordering bugs.

  it('declares an UNDEFINED_REFERENCE_CODES set with 42P01 and 42703', () => {
    const codesBlock = RUNNER_SRC.match(
      /UNDEFINED_REFERENCE_CODES\s*=\s*new Set\(\[[\s\S]*?\]\)/,
    )?.[0] ?? '';
    expect(codesBlock).toMatch(/['"]42P01['"]/);
    expect(codesBlock).toMatch(/['"]42703['"]/);
  });

  it('UNDEFINED_REFERENCE_CODES is SEPARATE from ALREADY_EXISTS_CODES', () => {
    // If 42P01 leaks into ALREADY_EXISTS_CODES, the runner would silently
    // bootstrap-record migrations whose target tables are missing —
    // dangerous schema-divergence masking.
    const alreadyExists = RUNNER_SRC.match(
      /ALREADY_EXISTS_CODES\s*=\s*new Set\(\[[\s\S]*?\]\)/,
    )?.[0] ?? '';
    expect(alreadyExists).not.toMatch(/['"]42P01['"]/);
    expect(alreadyExists).not.toMatch(/['"]42703['"]/);
  });

  it('lenient mode is opt-in via --lenient flag OR PETWASH_MIGRATE_LENIENT=1', () => {
    expect(RUNNER_SRC).toMatch(/process\.argv\.includes\(['"]--lenient['"]\)/);
    expect(RUNNER_SRC).toMatch(/PETWASH_MIGRATE_LENIENT === ['"]1['"]/);
  });

  it('default mode is STRICT (no flag → lenient is false)', () => {
    // The lenient guard is a logical OR; nothing flips it on by default.
    const block = RUNNER_SRC.match(
      /const lenient\s*=[\s\S]*?;/,
    )?.[0] ?? '';
    expect(block).toMatch(/process\.argv\.includes\(['"]--lenient['"]\)/);
    expect(block).toMatch(/===\s*['"]1['"]/);
    // Must not have a `|| true` or similar default-on hack.
    expect(block).not.toMatch(/\|\|\s*true/);
  });

  it('UNDEFINED_REFERENCE_CODES path is gated on `lenient` — strict mode still fails closed', () => {
    expect(RUNNER_SRC).toMatch(
      /if \(lenient && code && UNDEFINED_REFERENCE_CODES\.has\(code\)\)/,
    );
  });

  it('orphaned migrations are recorded in orphanedFiles array (NOT in _petwash_migrations)', () => {
    // Important: orphan-skips must NOT write to _petwash_migrations so
    // a future schema-aligned run gets another chance at the migration.
    // The skip-orphan block is between the already-exists block and the
    // fail-closed branch.
    const orphanBlock = RUNNER_SRC.match(
      /if \(lenient && code && UNDEFINED_REFERENCE_CODES\.has\(code\)\)[\s\S]*?continue;/,
    )?.[0] ?? '';
    expect(orphanBlock).toMatch(/orphanedFiles\.push/);
    // Must NOT INSERT into _petwash_migrations from this branch.
    expect(orphanBlock).not.toMatch(/INSERT INTO _petwash_migrations/);
  });

  it('CI workflow invokes the script with --lenient', () => {
    const yaml = fs.readFileSync(
      path.join(REPO_ROOT, '.github', 'workflows', 'petwash-ci.yml'),
      'utf8',
    );
    expect(yaml).toMatch(/apply-pending-migrations\.ts --lenient/);
  });

  it('summary line includes the ORPHANED count + a fix-forward operator message', () => {
    expect(RUNNER_SRC).toMatch(/ORPHANED \(lenient skip\)/);
    expect(RUNNER_SRC).toMatch(/ORPHANED migrations — these reference tables\/columns missing from the prod schema/);
    expect(RUNNER_SRC).toMatch(/Fix-forward options for each ORPHANED entry/);
  });
});

describe('apply-pending-migrations — non-transactional statements (M-DEPLOY-1c)', () => {
  // Postgres returns code 25001 (active_sql_transaction) if any of
  // these run inside BEGIN/COMMIT. CI run #969 failed on 0016 because
  // CREATE INDEX CONCURRENTLY needs autocommit. Runner now detects
  // these statements and skips the transaction wrap for affected
  // files — each statement runs in its own implicit transaction.

  it('declares a NON_TRANSACTIONAL_RE pattern + isNonTransactional helper', () => {
    expect(RUNNER_SRC).toMatch(/const NON_TRANSACTIONAL_RE\s*=/);
    expect(RUNNER_SRC).toMatch(/function isNonTransactional\(sql: string\): boolean/);
  });

  it('NON_TRANSACTIONAL_RE matches CONCURRENTLY, VACUUM, REINDEX, ALTER SYSTEM, CREATE/DROP DATABASE/TABLESPACE', () => {
    const re = RUNNER_SRC.match(/const NON_TRANSACTIONAL_RE\s*=\s*(\/[^;]+\/[gimsuy]*)/)?.[1] ?? '';
    expect(re).toMatch(/CONCURRENTLY/);
    expect(re).toMatch(/VACUUM/);
    expect(re).toMatch(/REINDEX/);
    expect(re).toMatch(/ALTER\\s\+SYSTEM/);
    expect(re).toMatch(/CREATE\\s\+DATABASE/);
    expect(re).toMatch(/DROP\\s\+DATABASE/);
    expect(re).toMatch(/CREATE\\s\+TABLESPACE/);
    expect(re).toMatch(/DROP\\s\+TABLESPACE/);
  });

  it('isNonTransactional strips comments before matching (no false positive on documentation)', () => {
    const block = RUNNER_SRC.match(
      /function isNonTransactional[\s\S]*?\n\}/,
    )?.[0] ?? '';
    // Must strip line comments AND block comments.
    expect(block).toMatch(/replace\(\/--\[\^\\n\]\*\/g/);
    expect(block).toMatch(/replace\(\/\\\/\\\*\[\\s\\S\]\*\?\\\*\\\//);
  });

  it('non-tx path uses isNonTransactional() to decide whether to wrap in BEGIN/COMMIT', () => {
    expect(RUNNER_SRC).toMatch(/const nonTx\s*=\s*isNonTransactional\(sql\)/);
    expect(RUNNER_SRC).toMatch(/if \(nonTx\)/);
  });

  it('non-tx path does NOT emit BEGIN or COMMIT — autocommit per statement', () => {
    // Pull the if(nonTx) block specifically. Use a careful regex bounded
    // on the matching else.
    const block = RUNNER_SRC.match(
      /if \(nonTx\) \{[\s\S]*?\} else \{/,
    )?.[0] ?? '';
    expect(block).not.toMatch(/client\.query\(['"]BEGIN['"]\)/);
    expect(block).not.toMatch(/client\.query\(['"]COMMIT['"]\)/);
    expect(block).toMatch(/await client\.query\(sql\)/);
  });

  it('transactional path (else branch) preserves BEGIN/COMMIT', () => {
    // The else branch must still wrap in a transaction for normal
    // migrations — atomicity is what makes _petwash_migrations and the
    // schema change land together.
    const block = RUNNER_SRC.match(
      /\} else \{[\s\S]*?await client\.query\(['"]COMMIT['"]\);/,
    )?.[0] ?? '';
    expect(block).toMatch(/client\.query\(['"]BEGIN['"]\)/);
    expect(block).toMatch(/client\.query\(['"]COMMIT['"]\)/);
  });
});

describe('CI workflow — apply-migrations no longer blocks deploy (M-DEPLOY-1c)', () => {
  // Migration failures keep finding new edge cases (orphans, CONCURRENTLY,
  // and likely more). Production deployed cleanly for months WITHOUT
  // auto-migrations. The honest call is: keep the step for visibility
  // (operators see what didn't apply in CI logs) but stop letting it
  // gate deploy-backend. `continue-on-error: true` makes the job's
  // failure non-blocking for downstream `needs:` evaluation.

  it('apply-migrations job has continue-on-error: true', () => {
    const yaml = fs.readFileSync(
      path.join(REPO_ROOT, '.github', 'workflows', 'petwash-ci.yml'),
      'utf8',
    );
    // Locate the apply-migrations job and verify the flag is set inside it.
    const job = yaml.match(/apply-migrations:[\s\S]*?(?=\n  [a-z-]+:|\Z)/)?.[0] ?? '';
    expect(job).toMatch(/continue-on-error:\s*true/);
  });

  it('deploy-backend still has apply-migrations in its needs (visibility preserved)', () => {
    const yaml = fs.readFileSync(
      path.join(REPO_ROOT, '.github', 'workflows', 'petwash-ci.yml'),
      'utf8',
    );
    const deployBlock = yaml.match(/deploy-backend:[\s\S]*?needs:\s*\[[^\]]+\]/)?.[0] ?? '';
    expect(deployBlock).toMatch(/apply-migrations/);
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
