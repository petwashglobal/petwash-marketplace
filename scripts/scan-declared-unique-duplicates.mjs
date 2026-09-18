#!/usr/bin/env node
/**
 * Read-only duplicate scan for migrations/0166_rebuild_catchup_declared_uniques.sql.
 *
 * 0166 holds the UNIQUE indexes that shared/schema*.ts declares but that are
 * absent from BOTH the migration series AND production. It is allowlisted in
 * migrations/.manual-migrations.txt, so the deploy runner never executes it —
 * because CREATE UNIQUE INDEX fails with 23505 if the table already holds
 * duplicates, and a failure there blocks every deploy (0124, 2026-08-24).
 *
 * This script answers the only question standing between 0166 and production:
 * does any of those tables actually hold duplicates today?
 *
 * It is READ-ONLY. It issues nothing but SELECT ... GROUP BY ... HAVING, and
 * never prints a row's contents — only the duplicated key and how many rows
 * share it, so no personal data (emails, member ids) reaches the log. A table
 * that does not exist yet is reported as such, not as an error.
 *
 * The target list is PARSED OUT OF 0166 itself, so the two cannot drift apart.
 *
 * Usage (CI does this for you — see
 * .github/workflows/declared-unique-duplicate-scan.yml):
 *   DATABASE_URL=postgres://... node scripts/scan-declared-unique-duplicates.mjs
 *
 * Exit codes: 0 = every table clean, 0166 is safe to apply.
 *             1 = duplicates found (details printed).
 *             2 = could not run.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const MIGRATION = join(process.cwd(), 'migrations', '0166_rebuild_catchup_declared_uniques.sql');
const INDEX_RE = /^CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+(\S+)\s+ON\s+public\.(\w+)\s+USING\s+btree\s+\(([^)]+)\)/i;

function targets() {
  return readFileSync(MIGRATION, 'utf8')
    .split('\n')
    .map((l) => INDEX_RE.exec(l.trim()))
    .filter(Boolean)
    .map((m) => ({ index: m[1], table: m[2], columns: m[3].split(',').map((c) => c.trim()) }));
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[dupscan] DATABASE_URL is not set');
    process.exit(2);
  }

  const list = targets();
  if (list.length === 0) {
    console.error(`[dupscan] parsed 0 indexes out of ${MIGRATION} — refusing to report "all clean".`);
    process.exit(2);
  }
  console.log(`[dupscan] ${list.length} declared-unique targets parsed from 0166.\n`);

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  const dirty = [];
  const missing = [];
  let clean = 0;

  try {
    for (const t of list) {
      const exists = await client.query(
        `SELECT to_regclass($1) IS NOT NULL AS ok`, [`public.${t.table}`],
      );
      if (!exists.rows[0].ok) {
        missing.push(t);
        console.log(`  ⊘ ${t.table} — table does not exist yet`);
        continue;
      }

      const cols = t.columns.map((c) => `"${c}"`).join(', ');
      // NULLs never collide in a unique index, so exclude them the same way
      // Postgres would. Counts only — no row values are selected.
      const notNull = t.columns.map((c) => `"${c}" IS NOT NULL`).join(' AND ');
      const { rows } = await client.query(
        `SELECT ${cols}, count(*)::int AS n
           FROM "${t.table}"
          WHERE ${notNull}
          GROUP BY ${cols}
         HAVING count(*) > 1
          ORDER BY n DESC
          LIMIT 20`,
      );

      if (rows.length === 0) {
        clean++;
        console.log(`  ✅ ${t.table} (${t.columns.join(', ')}) — no duplicates`);
      } else {
        const total = rows.reduce((a, r) => a + r.n - 1, 0);
        dirty.push({ ...t, groups: rows.length, extraRows: total });
        console.log(
          `  ❌ ${t.table} (${t.columns.join(', ')}) — ${rows.length} duplicated key(s), ` +
          `${total}+ row(s) would have to go before the index can be created`,
        );
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(
    `\n[dupscan] ${clean} clean, ${dirty.length} with duplicates, ${missing.length} table(s) not present.`,
  );

  if (dirty.length === 0) {
    console.log(
      '\n✅ Every table is clean. 0166 can be applied:\n' +
      '   remove the line "0166_rebuild_catchup_declared_uniques.sql" from\n' +
      '   migrations/.manual-migrations.txt and the next deploy will create all\n' +
      `   ${list.length} indexes.`,
    );
    process.exit(0);
  }

  console.log('\n❌ Do NOT un-allowlist 0166 yet. These need a data decision first:');
  for (const d of dirty) {
    console.log(`   • ${d.table} (${d.columns.join(', ')}) — ${d.groups} duplicated key(s)`);
  }
  console.log(
    '\nEach duplicate on an idempotency key means something was written twice that\n' +
    'was supposed to be written once. Decide per table whether to merge, delete\n' +
    'the later row, or change the intended key — then re-run this scan.',
  );
  process.exit(1);
}

main().catch((err) => {
  console.error('[dupscan] fatal:', err?.message ?? err);
  process.exit(2);
});
