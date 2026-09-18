/**
 * migrations/ must be able to rebuild the database — regression pin (2026-09-18).
 *
 * WHY THIS EXISTS
 * ---------------
 * Production was largely built by out-of-band `drizzle-kit push` against
 * shared/schema*.ts, not by applying migrations/. The migration history quietly
 * stopped being a description of the database. Replaying every file in
 * migrations/ into an empty Postgres produced 318 of the 712 tables that
 * shared/schema*.ts declares, and 148 statements failed along the way — 137 of
 * them ALTER/CREATE INDEX statements whose target table had never been created
 * by any migration at all. `booking_requests`, the table behind every
 * marketplace booking, had no CREATE TABLE anywhere in the series.
 *
 * Nothing noticed, because nothing ever rebuilt from migrations. The deploy
 * runner's own summary line ("N bootstrapped as already-existing") is what a
 * healthy run looks like when the files are wrong and the database is right.
 *
 * This test rebuilds from migrations/ alone, in an in-process Postgres, and
 * fails if either half of that contract breaks:
 *   1. every statement in every migration file applies without error;
 *   2. every table and column in shared/schema*.ts exists afterwards.
 *
 * It runs on every PR that touches migrations/ or shared/schema*.ts. If you add
 * a table to shared/schema*.ts without a migration that creates it, this fails.
 *
 * TWO ENVIRONMENT SHIMS, BOTH DELIBERATE AND NARROW
 * -------------------------------------------------
 *   • btree_gist is loaded from PGlite's bundled contrib set. Neon prod has the
 *     extension; PGlite only has it if you pass it in. Two migrations (0005,
 *     0028_marketplace_booking_slot_locks) need it for their EXCLUDE
 *     constraints.
 *   • CREATE INDEX CONCURRENTLY is rewritten to CREATE INDEX. PGlite is a
 *     single-connection engine and answers CONCURRENTLY with XX000 "tuple
 *     concurrently updated". The resulting index is identical; only the locking
 *     behaviour during creation differs, which is not what this test is about.
 *
 * Anything else that fails, fails the test. No error-code tolerance list — that
 * is exactly the habit that let the migration series rot for a year.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'migrations');
const SHARED_DIR = path.join(REPO_ROOT, 'shared');
const MIGRATION_FILE_RE = /^\d{4}_[A-Za-z0-9_-]+\.sql$/;

/**
 * Split SQL into statements on top-level semicolons.
 *
 * Aware of line comments, block comments, single-quoted strings, quoted
 * identifiers and dollar-quoted bodies — so a `;` inside a DO $$ ... $$ block
 * or inside a string does not split a statement in half. (The deploy runner's
 * own splitter is NOT dollar-quote aware, which is why every migration in this
 * series stays on its transactional path, where the whole file is sent as one
 * query and the splitter is never used.)
 */
export function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];

    if (c === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      const end = nl === -1 ? sql.length : nl;
      buf += sql.slice(i, end);
      i = end;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      let depth = 1;
      let j = i + 2;
      while (j < sql.length && depth > 0) {
        if (sql[j] === '/' && sql[j + 1] === '*') { depth++; j += 2; }
        else if (sql[j] === '*' && sql[j + 1] === '/') { depth--; j += 2; }
        else j++;
      }
      buf += sql.slice(i, j);
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === c && sql[j + 1] === c) { j += 2; continue; }
        if (sql[j] === c) { j++; break; }
        j++;
      }
      buf += sql.slice(i, j);
      i = j;
      continue;
    }
    if (c === '$') {
      const tag = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i))?.[0];
      if (tag) {
        const close = sql.indexOf(tag, i + tag.length);
        const end = close === -1 ? sql.length : close + tag.length;
        buf += sql.slice(i, end);
        i = end;
        continue;
      }
    }
    if (c === ';') { out.push(buf); buf = ''; i++; continue; }
    buf += c;
    i++;
  }
  out.push(buf);

  return out
    .map((s) => s.trim())
    .filter((s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim().length > 0);
}

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => MIGRATION_FILE_RE.test(f)).sort();
}

interface Failure { file: string; code: string; message: string; statement: string }

async function rebuildFromMigrations() {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec('CREATE EXTENSION IF NOT EXISTS btree_gist;');

  const failures: Failure[] = [];
  let applied = 0;

  for (const file of listMigrationFiles()) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      .replace(/-->\s*statement-breakpoint/g, ';')
      .replace(/\bCREATE\s+(UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/gi, (_m, u) => `CREATE ${u ?? ''}INDEX`);

    for (const statement of splitSqlStatements(sql)) {
      try {
        await db.exec(statement);
        applied++;
      } catch (err: any) {
        failures.push({
          file,
          code: err?.code ?? 'unknown',
          message: String(err?.message ?? err).split('\n')[0],
          statement: statement.replace(/\s+/g, ' ').slice(0, 200),
        });
      }
    }
  }
  return { db, failures, applied };
}

/** Every table shared/schema*.ts declares, as { table -> column names }. */
async function declaredSchema(): Promise<Map<string, Set<string>>> {
  const files = readdirSync(SHARED_DIR).filter((f) => /^schema.*\.ts$/.test(f)).sort();
  const out = new Map<string, Set<string>>();
  for (const f of files) {
    const mod: Record<string, unknown> = await import(/* @vite-ignore */ path.join(SHARED_DIR, f));
    for (const value of Object.values(mod)) {
      if (!is(value, PgTable)) continue;
      const cfg = getTableConfig(value as PgTable);
      out.set(cfg.name, new Set(cfg.columns.map((c) => c.name)));
    }
  }
  return out;
}

describe('migrations/ can rebuild the database on its own', () => {
  it('applies every statement in every migration file without a single error', async () => {
    const { failures, applied } = await rebuildFromMigrations();

    if (failures.length > 0) {
      const byFile = new Map<string, Failure[]>();
      for (const f of failures) {
        if (!byFile.has(f.file)) byFile.set(f.file, []);
        byFile.get(f.file)!.push(f);
      }
      const report = [...byFile.entries()]
        .map(([file, list]) =>
          `\n  ${file}  (${list.length} failed)\n` +
          list.map((f) => `    [${f.code}] ${f.message}\n           ${f.statement}`).join('\n'))
        .join('\n');
      throw new Error(
        `${failures.length} migration statement(s) failed while rebuilding from migrations/ alone.\n` +
        `A migration that cannot run against a database built by the migrations before it is a\n` +
        `migration that only works because production already has what it assumes.\n${report}\n`,
      );
    }
    expect(applied).toBeGreaterThan(3000);
  }, 180_000);

  it('produces every table and column that shared/schema*.ts declares', async () => {
    const { db } = await rebuildFromMigrations();
    const declared = await declaredSchema();
    expect(declared.size).toBeGreaterThan(700);

    const rows = (await db.query<{ tbl: string; col: string }>(`
      SELECT c.relname AS tbl, a.attname AS col
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      WHERE c.relkind = 'r'
    `)).rows;
    const built = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!built.has(r.tbl)) built.set(r.tbl, new Set());
      built.get(r.tbl)!.add(r.col);
    }

    const missingTables: string[] = [];
    const missingColumns: string[] = [];
    for (const [table, columns] of declared) {
      const actual = built.get(table);
      if (!actual) { missingTables.push(table); continue; }
      for (const col of columns) if (!actual.has(col)) missingColumns.push(`${table}.${col}`);
    }

    expect(
      missingTables,
      `${missingTables.length} table(s) declared in shared/schema*.ts are never created by migrations/. ` +
      `Add a migration that creates them (CREATE TABLE IF NOT EXISTS, so it stays a no-op on production).`,
    ).toEqual([]);
    expect(
      missingColumns,
      `${missingColumns.length} column(s) declared in shared/schema*.ts are never added by migrations/. ` +
      `Add a migration with ALTER TABLE ... ADD COLUMN IF NOT EXISTS.`,
    ).toEqual([]);
  }, 180_000);
});
