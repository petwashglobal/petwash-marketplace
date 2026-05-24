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
    // M-DEPLOY-2 updated: the non-tx path now loops over splitSqlStatements
    // and runs each statement individually (Neon WebSocket wraps multi-
    // statement client.query() in implicit tx, see split-statement tests
    // below). At least one client.query(stmt) call is present.
    expect(block).toMatch(/await client\.query\(stmt\)/);
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

describe('CI workflow — apply-migrations is opt-in only (M-DEPLOY-2)', () => {
  // M-DEPLOY-2: removed apply-migrations from the auto-push path.
  // The job ONLY runs when an operator manually triggers the workflow
  // with the `run_migrations` checkbox enabled. Push-to-main runs the
  // gates + deploy-backend + deploy-frontend, never the migrations.
  // History: PR #395 shipped this as a deploy gate; #402/#403/#404
  // progressively defanged it; CI #970 still failed because Neon
  // wraps multi-statement client.query() in an implicit transaction —
  // the catch-up is endless. Auto-migrations were a wrong call.

  const yaml = fs.readFileSync(
    path.join(REPO_ROOT, '.github', 'workflows', 'petwash-ci.yml'),
    'utf8',
  );

  it('workflow_dispatch declares a run_migrations boolean input (default false)', () => {
    expect(yaml).toMatch(/workflow_dispatch:[\s\S]*?inputs:[\s\S]*?run_migrations:/);
    expect(yaml).toMatch(/run_migrations:[\s\S]*?type:\s*boolean/);
    expect(yaml).toMatch(/run_migrations:[\s\S]*?default:\s*false/);
  });

  it('apply-migrations job has an `if:` gating on workflow_dispatch + run_migrations==true', () => {
    const job = yaml.match(/apply-migrations:[\s\S]*?(?=\n  [a-z-]+:|\Z)/)?.[0] ?? '';
    expect(job).toMatch(/if:\s*\$\{\{\s*github\.event_name\s*===?\s*['"]workflow_dispatch['"]/);
    expect(job).toMatch(/inputs\.run_migrations\s*===?\s*true/);
  });

  it('deploy-backend does NOT list apply-migrations in needs (would skip deploy forever)', () => {
    // Extract JUST the needs array (not the surrounding comment block,
    // which legitimately mentions "apply-migrations" in its explanation).
    const needsArray =
      yaml.match(/deploy-backend:[\s\S]*?\n    needs:\s*(\[[^\]]+\])/)?.[1] ?? '';
    expect(needsArray).not.toMatch(/apply-migrations/);
    // Sanity: the two pre-deploy gates are still required.
    expect(needsArray).toMatch(/gate-smoke-test-startup/);
    expect(needsArray).toMatch(/gate-audit-env-vars/);
  });
});

describe('apply-pending-migrations — split-statement non-tx execution (M-DEPLOY-2)', () => {
  // CI #970 surfaced that even after our code skipped BEGIN/COMMIT,
  // the @neondatabase/serverless WebSocket driver still wrapped the
  // multi-statement client.query() in an implicit transaction at the
  // protocol layer — PG returned 25001. The fix is to send statements
  // ONE AT A TIME so each runs in autocommit. A single-statement
  // client.query() on Neon is the only shape that lets CONCURRENTLY
  // execute.

  it('declares a splitSqlStatements helper', () => {
    expect(RUNNER_SRC).toMatch(/function splitSqlStatements\(sql: string\): string\[\]/);
  });

  it('splitSqlStatements strips comments before splitting on `;`', () => {
    const block = RUNNER_SRC.match(
      /function splitSqlStatements[\s\S]*?\n\}/,
    )?.[0] ?? '';
    // Must strip line + block comments first so a `;` inside a comment
    // doesn't break a real statement in two.
    expect(block).toMatch(/replace\(\/--\[\^\\n\]\*\/g/);
    expect(block).toMatch(/replace\(\/\\\/\\\*\[\\s\\S\]\*\?\\\*\\\//);
    expect(block).toMatch(/\.split\(';'\)/);
    expect(block).toMatch(/\.filter\(/);
  });

  it('non-tx path loops over splitSqlStatements (one-at-a-time, not one client.query for the whole file)', () => {
    const block = RUNNER_SRC.match(
      /if \(nonTx\) \{[\s\S]*?\} else \{/,
    )?.[0] ?? '';
    expect(block).toMatch(/const statements\s*=\s*splitSqlStatements\(sql\)/);
    expect(block).toMatch(/for \(const stmt of statements\)/);
    expect(block).toMatch(/await client\.query\(stmt\)/);
    // Must NOT pass the whole multi-statement SQL in one call — that's
    // what caused #970 to fail with 25001.
    expect(block).not.toMatch(/await client\.query\(sql\);[\s\S]*?await client\.query\(\s*`INSERT INTO _petwash_migrations[\s\S]*?bootstrapped\)\s*\n\s*VALUES \(\$1, \$2, false\)/);
  });
});

describe('apply-pending-migrations — allowlist content', () => {
  // The Tranzila migration is the original landmine that motivated this
  // feature. If the table ever gets created in prod (Tranzila resurrected),
  // remove the line; until then it must stay.
  it('migrations/.manual-migrations.txt exists', () => {
    expect(fs.existsSync(ALLOWLIST_PATH)).toBe(true);
  });

  // 0009_tranzila_processor_auth_number.sql was DELETED 2026-05-24 as
  // part of the Tranzila Option A kill. The runner no longer needs to
  // skip it because the file itself is gone. The allowlist remains in
  // place for future manual migrations.
  it('does not require 0009 entry — the file was deleted with Tranzila kill', () => {
    const lines = fs
      .readFileSync(ALLOWLIST_PATH, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    // No entry needed because the migration file is gone.
    expect(lines).not.toContain('0009_tranzila_processor_auth_number.sql');
    // Sanity: confirm the underlying file is actually gone.
    const migrationFile = path.join(REPO_ROOT, 'migrations', '0009_tranzila_processor_auth_number.sql');
    expect(fs.existsSync(migrationFile)).toBe(false);
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
