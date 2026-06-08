#!/usr/bin/env tsx
/**
 * Replaces retired PetWash public email references in stored data.
 *
 * Default mode is dry-run. Use --apply only with a fresh backup/export.
 * Covers PostgreSQL textual/json columns and selected Firestore collections.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import admin, { db as firestoreDb } from '../../server/lib/firebase-admin';

neonConfig.webSocketConstructor = ws;

const OLD_EMAIL = `${'hello'}@${'petwash.co.il'}`;
const NEW_EMAIL = 'support@petwash.co.il';
const APPLY = process.argv.includes('--apply');
const INCLUDE_FIRESTORE = !process.argv.includes('--sql-only');
const INCLUDE_SQL = !process.argv.includes('--firestore-only');

type SqlTarget = {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
};

type Summary = {
  sqlColumnsScanned: number;
  sqlCellsMatched: number;
  sqlCellsUpdated: number;
  firestoreDocsScanned: number;
  firestoreDocsMatched: number;
  firestoreDocsUpdated: number;
};

const summary: Summary = {
  sqlColumnsScanned: 0,
  sqlCellsMatched: 0,
  sqlCellsUpdated: 0,
  firestoreDocsScanned: 0,
  firestoreDocsMatched: 0,
  firestoreDocsUpdated: 0,
};

function replaceDeep(value: unknown): { value: unknown; changed: boolean } {
  if (typeof value === 'string') {
    const next = value.split(OLD_EMAIL).join(NEW_EMAIL);
    return { value: next, changed: next !== value };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const replaced = replaceDeep(item);
      changed ||= replaced.changed;
      return replaced.value;
    });
    return { value: next, changed };
  }

  if (value && typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      return { value, changed: false };
    }

    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const replaced = replaceDeep(item);
      changed ||= replaced.changed;
      next[key] = replaced.value;
    }
    return { value: next, changed };
  }

  return { value, changed: false };
}

async function sanitizeSql() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set; skipping PostgreSQL scan.');
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const targetResult = await pool.query<SqlTarget>(`
      SELECT table_schema, table_name, column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND is_generated = 'NEVER'
        AND is_updatable = 'YES'
        AND (
          data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
          OR udt_name IN ('text', 'varchar', 'bpchar', 'json', 'jsonb')
        )
      ORDER BY table_schema, table_name, ordinal_position
    `);

    for (const target of targetResult.rows) {
      summary.sqlColumnsScanned += 1;

      const tableIdent = `"${target.table_schema.replace(/"/g, '""')}"."${target.table_name.replace(/"/g, '""')}"`;
      const columnIdent = `"${target.column_name.replace(/"/g, '""')}"`;
      const isJson = target.udt_name === 'json' || target.udt_name === 'jsonb';
      const matchSql = `
        SELECT count(*)::int AS count
        FROM ${tableIdent}
        WHERE ${columnIdent}::text LIKE $1
      `;
      const matchResult = await pool.query<{ count: number }>(matchSql, [`%${OLD_EMAIL}%`]);
      const matches = Number(matchResult.rows[0]?.count ?? 0);

      if (!matches) {
        continue;
      }

      summary.sqlCellsMatched += matches;
      console.log(`[sql] ${target.table_name}.${target.column_name}: ${matches} row(s) contain retired address`);

      if (!APPLY) {
        continue;
      }

      const replacementExpr = isJson
        ? `replace(${columnIdent}::text, $1, $2)::${target.udt_name}`
        : `replace(${columnIdent}::text, $1, $2)`;
      const updateSql = `
        UPDATE ${tableIdent}
        SET ${columnIdent} = ${replacementExpr}
        WHERE ${columnIdent}::text LIKE $3
      `;
      const updateResult = await pool.query(updateSql, [OLD_EMAIL, NEW_EMAIL, `%${OLD_EMAIL}%`]);
      summary.sqlCellsUpdated += updateResult.rowCount ?? 0;
    }
  } finally {
    await pool.end();
  }
}

async function sanitizeFirestoreCollection(collectionPath: string) {
  const snapshot = await firestoreDb.collection(collectionPath).get();
  let batch = firestoreDb.batch();
  let pending = 0;

  for (const doc of snapshot.docs) {
    summary.firestoreDocsScanned += 1;
    const replaced = replaceDeep(doc.data());

    if (!replaced.changed) {
      continue;
    }

    summary.firestoreDocsMatched += 1;
    console.log(`[firestore] ${collectionPath}/${doc.id} contains retired address`);

    if (!APPLY) {
      continue;
    }

    batch.set(doc.ref, {
      ...(replaced.value as Record<string, unknown>),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      retiredEmailSanitizedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    pending += 1;

    if (pending === 400) {
      await batch.commit();
      summary.firestoreDocsUpdated += pending;
      batch = firestoreDb.batch();
      pending = 0;
    }
  }

  if (APPLY && pending > 0) {
    await batch.commit();
    summary.firestoreDocsUpdated += pending;
  }
}

async function sanitizeFirestore() {
  const configuredCollections = (process.env.RETIRED_EMAIL_FIRESTORE_COLLECTIONS ?? [
    'users',
    'employees',
    'providers',
    'settings',
    'email_templates',
    'backup_logs',
    'compliance_events',
    'prestige_passes',
  ].join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  for (const collectionPath of configuredCollections) {
    await sanitizeFirestoreCollection(collectionPath);
  }
}

console.log(`Retired email sanitizer started in ${APPLY ? 'APPLY' : 'DRY-RUN'} mode.`);

if (INCLUDE_SQL) {
  await sanitizeSql();
}

if (INCLUDE_FIRESTORE) {
  await sanitizeFirestore();
}

console.log(JSON.stringify(summary, null, 2));

if (!APPLY) {
  console.log('Dry-run only. Re-run with --apply after backup/export to update matching values.');
}
