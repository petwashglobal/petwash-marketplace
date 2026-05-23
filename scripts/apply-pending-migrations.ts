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
 *   2. For each migrations/XXXX_*.sql file in lexicographic order:
 *      a. Skip if filename is already in _petwash_migrations.
 *      b. Otherwise BEGIN, run the file's SQL, INSERT tracking row, COMMIT.
 *      c. If the file fails with "already exists" (PG codes 42P07 /
 *         42710 / 42P06), assume it was applied out-of-band before this
 *         script existed (bootstrap case). Mark as applied (with a
 *         `bootstrapped: true` flag) and continue.
 *      d. Any OTHER error → exit non-zero so the deploy blocks.
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

// PG error codes that indicate "schema object already exists" —
// typical of an out-of-band-applied migration meeting this script for
// the first time. Recorded as bootstrapped without re-running.
const ALREADY_EXISTS_CODES = new Set([
  '42P07', // duplicate_table
  '42710', // duplicate_object (e.g. constraint, type)
  '42P06', // duplicate_schema
  '42P16', // invalid_table_definition (rare; when re-creating with conflicting cols)
]);

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => MIGRATION_FILE_RE.test(f))
    .filter((f) => statSync(join(MIGRATIONS_DIR, f)).isFile())
    .sort();
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] DATABASE_URL is not set');
    process.exit(2);
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
    console.log(
      `[migrate] found ${files.length} migration files; ${applied.size} already recorded as applied.`,
    );

    let appliedCount = 0;
    let bootstrappedCount = 0;

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = sha256(sql);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO _petwash_migrations (filename, checksum, bootstrapped)
           VALUES ($1, $2, false)
           ON CONFLICT (filename) DO NOTHING`,
          [file, checksum],
        );
        await client.query('COMMIT');
        console.log(`[migrate] ✅ applied: ${file}`);
        appliedCount += 1;
      } catch (err) {
        // Always rollback before deciding next move.
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

        // Real error — fail closed so deploy blocks.
        console.error(
          `[migrate] ❌ ${file} failed (code=${code ?? 'none'}): ${msg}`,
        );
        process.exit(1);
      }
    }

    console.log(
      `[migrate] summary: ${appliedCount} newly applied, ${bootstrappedCount} bootstrapped as already-existing.`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[migrate] fatal:', err);
  process.exit(1);
});
