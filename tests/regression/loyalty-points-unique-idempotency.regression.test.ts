import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const MIGRATION = readFileSync(join(ROOT, 'migrations', '0117_loyalty_points_idempotency.sql'), 'utf8');
const SCHEMA    = readFileSync(join(ROOT, 'shared', 'schema-loyalty.ts'), 'utf8');

// Regression pin for Item 222 (2026-08-18, MONEY-CODE): partial-unique index
// on points_transactions (user_id, source, source_id) WHERE source_id IS NOT NULL.
// The schema and the migration MUST stay in sync so drizzle-kit push does not
// try to re-create the index.

describe('Item 222 — points_transactions partial-unique idempotency guard', () => {
  it('migration creates the unique partial index with the exact name and columns', () => {
    expect(MIGRATION).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS/);
    expect(MIGRATION).toMatch(/points_transactions_user_source_ref_uniq_idx/);
    expect(MIGRATION).toMatch(/ON points_transactions \(user_id, source, source_id\)/);
    expect(MIGRATION).toMatch(/WHERE source_id IS NOT NULL/);
  });

  it('drizzle schema declares the same partial unique index', () => {
    expect(SCHEMA).toMatch(/uniqueIndex\(['"]points_transactions_user_source_ref_uniq_idx['"]\)/);
    expect(SCHEMA).toMatch(/\.on\(table\.userId,\s*table\.source,\s*table\.sourceId\)/);
    expect(SCHEMA).toMatch(/\.where\(sql`\$\{table\.sourceId\} IS NOT NULL`\)/);
  });

  it('imports uniqueIndex + sql from drizzle-orm', () => {
    expect(SCHEMA).toMatch(/uniqueIndex\s*}\s*from\s*['"]drizzle-orm\/pg-core['"]/);
    expect(SCHEMA).toMatch(/import\s+\{\s*sql\s*\}\s+from\s+['"]drizzle-orm['"]/);
  });
});
