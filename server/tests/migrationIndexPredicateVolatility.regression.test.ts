/**
 * Migration guard · reject volatile/stable time functions inside
 * PostgreSQL partial-index predicates.
 *
 * Root cause pin for the 2026-09-03 production-deploy blocker:
 * migration 0144 shipped this index —
 *
 *   CREATE INDEX ... ON journey_checkpoints (...)
 *     WHERE expires_at > now();
 *
 * — which PostgreSQL refuses with:
 *
 *   ERROR: functions in index predicate must be marked IMMUTABLE
 *
 * `now()`, `current_timestamp`, `current_date`, `current_time`,
 * `statement_timestamp()`, `transaction_timestamp()`, `clock_timestamp()`
 * and `localtimestamp` / `localtime` are STABLE or VOLATILE — their
 * value changes with time — so PostgreSQL correctly rejects them in
 * a predicate that would then change meaning as the clock moves.
 *
 * These functions are FINE in application queries (they evaluate
 * once per query, not once per row of a stored predicate) — so the
 * fix is to move the time comparison from the index predicate into
 * the query, backed by a composite index on the same columns.
 *
 * This test scans EVERY migration in migrations/*.sql and fails if
 * ANY CREATE INDEX ... WHERE clause mentions one of these functions.
 * Catches the same class of bug before it reaches main / production.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'migrations');

const FORBIDDEN_IN_INDEX_PREDICATE = [
  'now\\s*\\(\\s*\\)',
  'current_timestamp\\b',
  'current_date\\b',
  'current_time\\b',
  'statement_timestamp\\s*\\(\\s*\\)',
  'transaction_timestamp\\s*\\(\\s*\\)',
  'clock_timestamp\\s*\\(\\s*\\)',
  'localtimestamp\\b',
  'localtime\\b',
];

/**
 * Strip -- line comments and /* block comments *\/ so a code sample
 * or explanatory comment inside a migration file cannot false-flag.
 */
function stripComments(sql: string): string {
  return sql
    // Block comments (non-greedy).
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // -- line comments through end of line.
    .replace(/--[^\n]*/g, '');
}

/**
 * Extract every `CREATE [UNIQUE] INDEX ... WHERE <predicate>` from
 * a SQL string. Returns the WHERE predicate text of each, one entry
 * per matching statement. Uses a semicolon as the statement
 * terminator, which is the SQL convention every file in this repo
 * follows.
 */
function extractIndexWherePredicates(sql: string): string[] {
  const out: string[] = [];
  // Match a CREATE [UNIQUE] INDEX ... statement up to its terminator.
  const stmtRx = /CREATE\s+(?:UNIQUE\s+)?INDEX[\s\S]*?;/gi;
  const wherRx = /\bWHERE\b([\s\S]*?);/i;
  let m: RegExpExecArray | null;
  while ((m = stmtRx.exec(sql)) !== null) {
    const stmt = m[0];
    const w = wherRx.exec(stmt);
    if (w) out.push(w[1]);
  }
  return out;
}

function listMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => path.join(MIGRATIONS_DIR, e.name))
    .sort();
}

describe('migration guard · index predicates must be IMMUTABLE (Postgres)', () => {
  const files = listMigrationFiles();

  it('at least one migration file exists (sanity)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [path.basename(f), f]))(
    '%s has no volatile time function inside any CREATE INDEX WHERE predicate',
    (_name, absPath) => {
      const raw = fs.readFileSync(absPath, 'utf8');
      const sql = stripComments(raw);
      const predicates = extractIndexWherePredicates(sql);
      for (const pred of predicates) {
        for (const forbidden of FORBIDDEN_IN_INDEX_PREDICATE) {
          const rx = new RegExp(forbidden, 'i');
          if (rx.test(pred)) {
            throw new Error(
              `${path.basename(absPath)}: CREATE INDEX ... WHERE predicate references \`${forbidden.replace(/\\\\|\\s\*|\\b|\(|\)/g, '')}\` — ` +
                `PostgreSQL rejects volatile/stable time functions in index predicates ` +
                `("functions in index predicate must be marked IMMUTABLE"). ` +
                `Move the time comparison into the QUERY (where now() is legal) and back ` +
                `it with a composite index on the same columns.\n` +
                `Offending predicate: ${pred.trim().slice(0, 200)}`,
            );
          }
        }
      }
    },
  );

  it('the specific 0144 hotfix preserves the pruner (expires_at) index AND uses a composite active index', () => {
    // A more targeted pin so a well-meaning refactor that removes
    // either index also trips a red flag.
    const p = files.find((f) => f.endsWith('0144_journey_checkpoints_2026_09_03.sql'));
    expect(p).toBeDefined();
    const raw = fs.readFileSync(p!, 'utf8');
    const sql = stripComments(raw);
    // Composite active index — user_uid FIRST + expires_at second so
    // the (user_uid = $1 AND expires_at > now()) query at read time
    // is index-satisfiable.
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+idx_journey_checkpoints_active[\s\S]*?ON journey_checkpoints\s*\(\s*user_uid\s*,\s*expires_at[\s\S]*?\);/,
    );
    // Pruner index — expires_at alone.
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS\s+idx_journey_checkpoints_expiry[\s\S]*?ON journey_checkpoints\s*\(\s*expires_at\s*\);/,
    );
    // NO partial index predicate anywhere on this migration.
    const preds = extractIndexWherePredicates(sql);
    expect(preds).toEqual([]);
  });
});

describe('self-check · the guard rejects the exact bad SQL that failed prod', () => {
  it('detects `WHERE expires_at > now()` on a CREATE INDEX in a synthetic SQL string', () => {
    const bad = `
      CREATE TABLE demo(id UUID, expires_at TIMESTAMPTZ);
      CREATE INDEX idx_demo_active
        ON demo (id)
        WHERE expires_at > now();
    `;
    const preds = extractIndexWherePredicates(stripComments(bad));
    expect(preds.length).toBe(1);
    expect(preds[0]).toMatch(/now\s*\(\s*\)/i);
  });

  it('does NOT false-flag `now()` used INSIDE a comment or inside a table DEFAULT', () => {
    const ok = `
      -- Table has a created_at default of now() which is fine.
      CREATE TABLE demo(
        id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      /* index predicate below is time-free — good */
      CREATE INDEX idx_demo_all ON demo (id, created_at);
    `;
    // Comments stripped, no CREATE INDEX WHERE clause at all — so
    // the guard returns an empty predicate list.
    const preds = extractIndexWherePredicates(stripComments(ok));
    expect(preds).toEqual([]);
  });

  it('allows a partial-index WHERE clause that only uses IMMUTABLE column comparisons', () => {
    const ok = `
      CREATE INDEX idx_x ON tbl (a) WHERE status = 'active';
    `;
    const preds = extractIndexWherePredicates(stripComments(ok));
    expect(preds.length).toBe(1);
    for (const forbidden of FORBIDDEN_IN_INDEX_PREDICATE) {
      expect(new RegExp(forbidden, 'i').test(preds[0])).toBe(false);
    }
  });
});
