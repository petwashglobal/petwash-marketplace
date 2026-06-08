#!/usr/bin/env node
/**
 * PetWash migration runner — applies pending SQL files in `migrations/`
 * to the Postgres database identified by DATABASE_URL.
 *
 * WHY this exists instead of `drizzle-kit migrate`:
 *   migrations/_journal.json tracks only ~6 of the 28+ SQL files in
 *   migrations/. The rest are hand-written and not registered with
 *   drizzle. `drizzle-kit migrate` would silently skip them. Production
 *   has been getting schema changes applied by some out-of-band process,
 *   which is exactly what caused the slot-lock + Maya migrations to be
 *   missing on prod even after their code shipped.
 *
 * What this script does:
 *   1. Ensure tracking table `_petwash_migrations` exists.
 *   2. Load the manual-migrations allowlist from
 *      `migrations/.manual-migrations.txt` (one filename per line,
 *      comments with #). Listed files target tables managed outside the
 *      canonical Drizzle schema (e.g. deprecated subsystems) and must
 *      not be auto-applied — they are recorded as bootstrapped on
 *      first sight.
 *   3. For each migrations/XXXX_*.sql file in lexicographic order:
 *      a. Skip if filename is already in _petwash_migrations.
 *      b. If filename is in the manual-migrations allowlist, record
 *         as bootstrapped without running, then continue.
 *      c. Otherwise BEGIN, run the file's SQL, INSERT tracking row, COMMIT.
 *      d. If the file fails with "already exists" (PG codes 42P07 /
 *         42710 / 42P06), assume it was applied out-of-band before this
 *         script existed (bootstrap case). Mark as applied (with a
 *         `bootstrapped: true` flag) and continue.
 *      e. If the file fails with "undefined reference" (PG codes
 *         42P01 / 42703) AND --lenient is on, log as ORPHANED and
 *         continue to the next file. WITHOUT --lenient, fail closed.
 *      f. If the file fails with duplicate-data (PG code 23505) AND
 *         --lenient is on, log as DATA_CONFLICT and continue without
 *         recording it as applied. This is for old unique-index
 *         backfills blocked by existing dirty production rows; the
 *         index still needs a data-repair migration later.
 *      g. Any OTHER error → exit non-zero so the deploy blocks.
 *
 * Modes:
 *   STRICT (default, local dev):
 *     Every error except ALREADY_EXISTS_CODES is fatal. Used to catch
 *     real ordering / dependency bugs during development.
 *   LENIENT (CI deploy step, opt-in via --lenient or
 *           PETWASH_MIGRATE_LENIENT=1):
 *     Treats UNDEFINED_REFERENCE_CODES (42P01, 42703) and
 *     DATA_CONFLICT_CODES (23505) as soft skips and continues to the
 *     next file. Required because prod schema drifted from migration
 *     files — some tables (e.g.
 *     station_settlements, super_app_payouts) exist in
 *     shared/schema.ts but were created via out-of-band
 *     `drizzle-kit push` rather than a migration file. Their ALTER
 *     migrations (0015 etc.) cannot run until either the table is
 *     created via a new migration, or the file is moved to the
 *     manual-migrations allowlist.
 *     End-of-run summary lists every ORPHANED and DATA_CONFLICT file
 *     with the PG error code so an operator can resolve via the
 *     fix-forward options printed at the end.
 *
 * Bootstrap semantics:
 *   On the very first run against an existing database, the tracking
 *   table is empty. Each "old" migration (0000-0027) was already
 *   applied by other means, so re-running hits "already exists". The
 *   script records it as applied and moves on. Truly NEW migrations
 *   (whatever isn't yet in the DB) apply cleanly.
 *
 * Idempotency:
 *   Re-running after success is a no-op. Each file is in
 *   _petwash_migrations and gets skipped.
 *
 * Concurrency:
 *   The workflow's `concurrency: production-deploy` serializes runs.
 *
 * Connection:
 *   Uses @neondatabase/serverless Pool (same client as server/db.ts).
 *   Works for both Neon-hosted Postgres (current prod) and standard
 *   Postgres TCP (e.g. local dev with `pg`-compatible URL).
 *
 * Local development:
 *   DATABASE_URL=postgres://... npx tsx scripts/apply-pending-migrations.ts
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');
const MIGRATION_FILE_RE = /^\d{4}_[A-Za-z0-9_-]+\.sql$/;
const MANUAL_MIGRATIONS_LIST = join(MIGRATIONS_DIR, '.manual-migrations.txt');

// PG error codes that indicate "schema object already exists" —
// typical of an out-of-band-applied migration meeting this script for
// the first time. Recorded as bootstrapped without re-running.
const ALREADY_EXISTS_CODES = new Set([
  '42P07', // duplicate_table
  '42710', // duplicate_object (e.g. constraint, type)
  '42P06', // duplicate_schema
  '42P16', // invalid_table_definition (rare; when re-creating with conflicting cols)
]);

// PG error codes that indicate "schema object the migration assumed
// existed does NOT exist." Typically a migration that ALTERs a table
// created out-of-band via `drizzle-kit push` against shared/schema.ts,
// where that push never ran on this deployment. In --lenient mode we
// log + record as ORPHANED and continue so newer migrations downstream
// still get a chance to apply. In strict mode (default) we fail closed.
const UNDEFINED_REFERENCE_CODES = new Set([
  '42P01', // undefined_table
  '42703', // undefined_column
]);

// PG error codes that indicate a migration would be valid after a
// production data repair, but current rows violate the new integrity
// rule. In --lenient mode we log and continue WITHOUT recording the
// migration as applied, because the constraint/index was not created.
const DATA_CONFLICT_CODES = new Set([
  '23505', // unique_violation, e.g. CREATE UNIQUE INDEX found duplicates
]);

// Statements that CANNOT run inside a transaction block. Postgres
// returns code 25001 (active_sql_transaction) if any of these are sent
// after BEGIN. The runner detects them via regex (comments stripped)
// and skips the BEGIN/COMMIT wrap for affected files. Each statement
// runs in its own implicit transaction (autocommit), so if a later
// statement fails the earlier ones stay committed — fine for the
// IF NOT EXISTS idempotent shape these migrations use today.
const NON_TRANSACTIONAL_RE =
  /\bCONCURRENTLY\b|\bVACUUM\b|\bREINDEX\s+(?!OPTIONS)|ALTER\s+SYSTEM\b|CREATE\s+DATABASE\b|DROP\s+DATABASE\b|CREATE\s+TABLESPACE\b|DROP\s+TABLESPACE\b/i;

function isNonTransactional(sql: string): boolean {
  // Strip line + block comments so documentation references to
  // CONCURRENTLY etc. (e.g. the header comment in 0016) don't trigger
  // false positives.
  const stripped = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return NON_TRANSACTIONAL_RE.test(stripped);
}

/**
 * Split a multi-statement SQL string into individual statements.
 *
 * Required for non-transactional migrations because
 * @neondatabase/serverless wraps multi-statement client.query() calls
 * in an implicit transaction at the WebSocket protocol layer — that is
 * what made CI #970 fail with PG 25001 even after we removed our own
 * BEGIN/COMMIT. Each individual single-statement client.query() runs
 * in autocommit on Neon, which is the only shape that lets
 * `CREATE INDEX CONCURRENTLY` execute.
 *
 * Strategy:
 *   1. Strip line comments (`-- ...`) and block comments (slash-star
 *      blocks) so a `;` inside a comment doesn't split a real statement.
 *   2. Split on `;`.
 *   3. Trim, drop empty, drop comment-only fragments.
 *
 * This intentionally does NOT try to parse strings / dollar-quoted
 * bodies — the migrations using this path today (0016) are simple
 * DDL with no embedded `;` in literals. If a future migration needs
 * dollar-quoted functions, switch to a real SQL splitter.
 */
function splitSqlStatements(sql: string): string[] {
  const stripped = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return stripped
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => MIGRATION_FILE_RE.test(f))
    .filter((f) => statSync(join(MIGRATIONS_DIR, f)).isFile())
    .sort();
}

/**
 * Load the manual-migrations allowlist. Each non-empty, non-comment
 * line is a filename the runner must skip (record as bootstrapped
 * without running). Tolerant: missing file → empty set, malformed
 * lines silently dropped.
 *
 * Use this for migrations that target tables managed outside the
 * canonical Drizzle schema — e.g. a deprecated subsystem whose tables
 * were never created in this deployment. Without this allowlist the
 * runner fails with 42P01 (undefined_table) and blocks every deploy.
 */
function loadManualMigrationsList(): Set<string> {
  const skip = new Set<string>();
  try {
    const raw = readFileSync(MANUAL_MIGRATIONS_LIST, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      // Only accept entries that match the migration filename pattern —
      // defensive against accidental paths or globs.
      if (MIGRATION_FILE_RE.test(trimmed)) skip.add(trimmed);
    }
  } catch (err: any) {
    // Missing file is fine (no manual migrations declared).
    if (err?.code !== 'ENOENT') {
      console.warn(
        `[migrate] could not read ${MANUAL_MIGRATIONS_LIST}: ${err?.message ?? err}`,
      );
    }
  }
  return skip;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] DATABASE_URL is not set');
    process.exit(2);
  }

  // --lenient (or PETWASH_MIGRATE_LENIENT=1): on UNDEFINED_REFERENCE_CODES
  // errors (42P01 / 42703), log + continue instead of fail-closed. Used
  // by CI where prod schema diverges from migration files (tables created
  // out-of-band via drizzle-kit push). Local invocations stay STRICT by
  // default so devs catch real ordering bugs.
  const lenient =
    process.argv.includes('--lenient') ||
    process.env.PETWASH_MIGRATE_LENIENT === '1';
  if (lenient) {
    console.log('[migrate] LENIENT mode enabled — orphaned ALTER/INDEX targets will be logged + skipped, not fatal.');
  }

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    // Tracking table. Created on first run, no-op every other time.
    await client.query(`
      CREATE TABLE IF NOT EXISTS _petwash_migrations (
        filename     TEXT PRIMARY KEY,
        checksum     TEXT NOT NULL,
        applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        bootstrapped BOOLEAN NOT NULL DEFAULT false
      )
    `);

    const appliedRows = await client.query<{ filename: string }>(
      'SELECT filename FROM _petwash_migrations',
    );
    const applied = new Set(appliedRows.rows.map((r) => r.filename));

    const files = listMigrationFiles();
    const manualSkip = loadManualMigrationsList();
    console.log(
      `[migrate] found ${files.length} migration files; ${applied.size} already recorded as applied; ${manualSkip.size} declared manual.`,
    );

    let appliedCount = 0;
    let bootstrappedCount = 0;
    let manualSkipCount = 0;
    const orphanedFiles: Array<{ file: string; code: string; message: string }> = [];
    const dataConflictFiles: Array<{ file: string; code: string; message: string }> = [];

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = sha256(sql);

      // Manual-migrations allowlist — record as bootstrapped without
      // running. Used for migrations that target out-of-band-managed
      // tables (e.g. deprecated subsystems). See
      // migrations/.manual-migrations.txt for the list + per-file
      // justification.
      if (manualSkip.has(file)) {
        console.log(
          `[migrate] ⊘  ${file} declared manual — recording as bootstrapped without running.`,
        );
        await client.query(
          `INSERT INTO _petwash_migrations (filename, checksum, bootstrapped)
           VALUES ($1, $2, true)
           ON CONFLICT (filename) DO NOTHING`,
          [file, checksum],
        );
        manualSkipCount += 1;
        continue;
      }

      const nonTx = isNonTransactional(sql);

      try {
        if (nonTx) {
          // CREATE INDEX CONCURRENTLY / VACUUM / REINDEX / etc. cannot
          // run inside BEGIN/COMMIT (PG code 25001). Two important
          // details that CI #970 surfaced:
          //   1. We must skip the explicit BEGIN/COMMIT wrap (done).
          //   2. The @neondatabase/serverless WebSocket driver wraps
          //      MULTI-statement client.query() calls in an implicit
          //      transaction at the protocol layer — so we must also
          //      send statements ONE AT A TIME. A single-statement
          //      client.query() runs in autocommit and is the only
          //      shape that lets CONCURRENTLY execute on Neon.
          //
          // Split on `;` with comments stripped first (so a `;` inside
          // a comment doesn't fool us). Each statement runs in its own
          // autocommit. IF NOT EXISTS guards make partial-failure on
          // retry safe for the migrations we use today.
          console.log(`[migrate] (non-tx) ${file} — running statements individually in autocommit.`);
          const statements = splitSqlStatements(sql);
          for (const stmt of statements) {
            await client.query(stmt);
          }
          await client.query(
            `INSERT INTO _petwash_migrations (filename, checksum, bootstrapped)
             VALUES ($1, $2, false)
             ON CONFLICT (filename) DO NOTHING`,
            [file, checksum],
          );
        } else {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query(
            `INSERT INTO _petwash_migrations (filename, checksum, bootstrapped)
             VALUES ($1, $2, false)
             ON CONFLICT (filename) DO NOTHING`,
            [file, checksum],
          );
          await client.query('COMMIT');
        }
        console.log(`[migrate] ✅ applied: ${file}`);
        appliedCount += 1;
      } catch (err) {
        // Always rollback before deciding next move. ROLLBACK is a
        // no-op when there's no active transaction (non-tx path).
        try { await client.query('ROLLBACK'); } catch { /* already rolled back */ }

        const code = (err as { code?: string }).code;
        const msg = (err as Error).message;

        if (code && ALREADY_EXISTS_CODES.has(code)) {
          // Bootstrap case: schema object already exists from a prior
          // out-of-band apply. Record the file as applied so future
          // runs skip it; the actual schema is whatever was there.
          console.log(
            `[migrate] ⚠️  ${file} hit "already exists" (${code}) — bootstrapping as applied.`,
          );
          await client.query(
            `INSERT INTO _petwash_migrations (filename, checksum, bootstrapped)
             VALUES ($1, $2, true)
             ON CONFLICT (filename) DO NOTHING`,
            [file, checksum],
          );
          bootstrappedCount += 1;
          continue;
        }

        if (lenient && code && UNDEFINED_REFERENCE_CODES.has(code)) {
          // Orphan case: this migration targets a table/column that does
          // not exist on this DB. Usually means the table was supposed to
          // be created by an out-of-band `drizzle-kit push` against
          // shared/schema.ts that never ran here. Log, record nothing in
          // _petwash_migrations (so a future schema-aligned run still
          // tries the migration), and move on to the next file. This is
          // what lets NEW migrations downstream still apply even when an
          // OLD orphan blocks the strict path.
          console.error(
            `[migrate] 🟧 ORPHANED ${file} (code=${code}) — target missing from prod schema. Skipping (lenient). msg: ${msg}`,
          );
          orphanedFiles.push({ file, code, message: msg });
          continue;
        }

        if (lenient && code && DATA_CONFLICT_CODES.has(code)) {
          // Data conflict case: the migration is structurally valid, but
          // existing production rows violate a new constraint/index. Keep
          // moving so newer unrelated migrations can apply, but do NOT
          // mark this migration as applied; the failed integrity backfill
          // must be repaired and retried later.
          console.error(
            `[migrate] 🟨 DATA_CONFLICT ${file} (code=${code}) — existing prod data violates this migration. Skipping (lenient, not recorded). msg: ${msg}`,
          );
          dataConflictFiles.push({ file, code, message: msg });
          continue;
        }

        // Real error (or strict mode) — fail closed so deploy blocks.
        console.error(
          `[migrate] ❌ ${file} failed (code=${code ?? 'none'}): ${msg}`,
        );
        process.exit(1);
      }
    }

    console.log(
      `[migrate] summary: ${appliedCount} newly applied, ${bootstrappedCount} bootstrapped as already-existing, ${manualSkipCount} skipped via manual allowlist, ${orphanedFiles.length} ORPHANED (lenient skip), ${dataConflictFiles.length} DATA_CONFLICT (lenient skip).`,
    );

    if (orphanedFiles.length > 0) {
      console.error('[migrate] ORPHANED migrations — these reference tables/columns missing from the prod schema:');
      for (const o of orphanedFiles) {
        console.error(`  • ${o.file}  [${o.code}]  ${o.message.split('\n')[0]}`);
      }
      console.error(
        '[migrate] Fix-forward options for each ORPHANED entry:\n' +
        '  (a) Create the missing table via shared/schema.ts + a new CREATE TABLE migration, OR\n' +
        '  (b) Confirm the table is genuinely out-of-band-managed and add the file to migrations/.manual-migrations.txt, OR\n' +
        '  (c) Delete the migration file if it is dead code from a removed feature.\n' +
        '[migrate] These DID NOT block this deploy (lenient mode) but will keep firing on every run until resolved.',
      );
    }

    if (dataConflictFiles.length > 0) {
      console.error('[migrate] DATA_CONFLICT migrations — these need production data repair before their constraints can apply:');
      for (const d of dataConflictFiles) {
        console.error(`  • ${d.file}  [${d.code}]  ${d.message.split('\n')[0]}`);
      }
      console.error(
        '[migrate] Fix-forward options for each DATA_CONFLICT entry:\n' +
        '  (a) Add a targeted cleanup/dedupe migration before retrying the constraint, OR\n' +
        '  (b) Update the constraint to match the intended business key, then rerun migrations.\n' +
        '[migrate] These DID NOT block this deploy (lenient mode) but are NOT marked applied.',
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[migrate] fatal:', err);
  process.exit(1);
});
