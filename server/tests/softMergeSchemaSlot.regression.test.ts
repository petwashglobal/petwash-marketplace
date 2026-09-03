/**
 * Regression pin — the users.merged_into_uid soft-merge schema slot
 * must exist and stay tied to the CEO D6 non-destructive contract.
 *
 * Auth-rebuild Phase 6 ships the column (migration 0138) so the
 * super-admin soft-merge tool (server/routes/admin-identity-soft-
 * merge.ts) has a place to write. Phase 6.b lands the actual write
 * flow — this pin prevents the slot from being silently dropped or
 * downgraded before that arrives, AND locks in the invariants that
 * make soft-merge safe.
 *
 * INVARIANTS:
 *   1. users.merged_into_uid MUST be nullable (never NOT NULL) — the
 *      normal case is a non-merged user and defaulting to any value
 *      would flip that around.
 *   2. NO foreign-key constraint on the SQL column — Firebase UIDs
 *      are external identity strings and hard FK enforcement is
 *      unsafe. Application-layer validation is enough.
 *   3. Drizzle schema declares the column so type-safe writes exist.
 *   4. The soft-merge admin router keeps its 501 stubs (the write
 *      landing depends on Phase 6.b) and stays gated by super-admin
 *      + step-up.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

describe('auth-rebuild Phase 6 · users.merged_into_uid schema slot', () => {
  it('migration 0138 exists and adds merged_into_uid as nullable varchar', () => {
    const path = join(ROOT, 'migrations/0138_users_merged_into_uid_2026_09_01.sql');
    expect(existsSync(path)).toBe(true);
    const raw = readFileSync(path, 'utf8');
    // Strip SQL line-comments (-- ...) before regex-asserting on the
    // effective SQL — the file's docstring intentionally names the
    // patterns we DON'T want (NOT NULL, FOREIGN KEY, REFERENCES), so
    // matching against the raw text would false-positive.
    const sql = raw
      .split('\n')
      .filter((l) => !/^\s*--/.test(l))
      .join('\n');
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS merged_into_uid\s+varchar\(\d+\)/i);
    // Must NOT be NOT NULL — that would break every existing row.
    expect(
      /ADD COLUMN IF NOT EXISTS merged_into_uid\s+varchar\([^)]+\)\s+NOT\s+NULL/i.test(sql),
    ).toBe(false);
    // Must NOT declare a FOREIGN KEY on this column — hard FK on a
    // Firebase UID is unsafe (external identity, re-issuable outside
    // our DB).
    expect(/FOREIGN\s+KEY[^;]*merged_into_uid/i.test(sql)).toBe(false);
    expect(/merged_into_uid[^;]*REFERENCES\s+users/i.test(sql)).toBe(false);
    // Partial index only on non-NULL rows keeps it cheap at scale.
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_users_merged_into_uid/i);
    expect(sql).toMatch(/WHERE merged_into_uid IS NOT NULL/i);
  });

  it('shared/schema.ts declares users.mergedIntoUid alongside lastActiveRole', () => {
    const schema = readFileSync(join(ROOT, 'shared/schema.ts'), 'utf8');
    // The Drizzle column must be present and named correctly.
    expect(schema).toMatch(/mergedIntoUid:\s*varchar\(\s*["']merged_into_uid["']/);
    // It must be optional (no .notNull()).
    const line = schema
      .split('\n')
      .find((l) => l.includes('mergedIntoUid:'));
    expect(line, 'mergedIntoUid line must exist').toBeTruthy();
    expect(line!.includes('.notNull()')).toBe(false);
  });

  it('admin soft-merge router keeps super-admin + step-up gates on every endpoint', () => {
    const path = join(ROOT, 'server/routes/admin-identity-soft-merge.ts');
    expect(existsSync(path)).toBe(true);
    const src = readFileSync(path, 'utf8');
    // Super-admin gate must remain in place.
    expect(src).toMatch(/isSuperAdminVerified/);
    // Step-up proof for admin_dangerous_action must remain in place.
    expect(src).toMatch(/requireStepUp\(\s*['"]admin_dangerous_action['"]\s*\)/);
    // The three endpoints exist.
    expect(src).toMatch(/\/soft-merge\/preview/);
    expect(src).toMatch(/\/soft-merge\/unmerge/);
    expect(src).toMatch(/router\.post\(\s*['"]\/soft-merge['"]/);
    // Write path enforces preview freshness AND recommendation.
    expect(src).toMatch(/PREVIEW_MAX_AGE_MS/);
    expect(src).toMatch(/MERGE_REJECTED_BY_PREVIEW/);
    // Write path never re-parents money — the UPDATE only touches
    // merged_into_uid, never other columns.
    const setBlock = src.match(/\.set\(\{[\s\S]*?mergedIntoUid:[\s\S]*?\}\)/g) || [];
    for (const block of setBlock) {
      // Only merged_into_uid may appear inside the SET on this router.
      // Any other column name (email, phone, role, balance, etc.) is a
      // soft-merge contract violation.
      const dangerous = /(email|phone|role|balance|payout|passkey|wallet|loyalty|password|idNumber)/i;
      expect(dangerous.test(block), `SET clause must not touch identity/money fields: ${block}`).toBe(
        false,
      );
    }
  });
});
