/**
 * Gap 1 — DataRetentionService must read the retention_policies TABLE (it was
 * dead: the service used hardcoded constants and never consulted the DB).
 *
 * SAFETY: the fix must not make the destructive purge more aggressive. It reads
 * + reports the table and previews enforcement as a DRY-RUN; it must not auto-
 * delete on unreviewed table values.
 *
 * Source-introspection (the methods are DB-bound).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'DataRetentionService.ts'),
  'utf8',
);

describe('Gap 1 — retention_policies table is wired', () => {
  it('imports + reads the retentionPolicies table', () => {
    expect(src).toMatch(/retentionPolicies/);
    expect(src).toMatch(/db\.select\(\)\.from\(retentionPolicies\)/);
  });

  it('getRetentionPolicies prefers DB and falls back to hardcoded', () => {
    expect(src).toMatch(/async getRetentionPolicies\(\)/);
    expect(src).toMatch(/source: 'database'/);
    expect(src).toMatch(/source: 'hardcoded'/);
  });

  it('adds a DRY-RUN preview that deletes nothing and flags review', () => {
    expect(src).toMatch(/previewRetentionEnforcement/);
    expect(src).toMatch(/DRY-RUN/);
    expect(src).toMatch(/reviewRequired: true/);
    expect(src).toMatch(/purgeTargetWired: false/);
  });

  it('does NOT add new destructive deletes to the preview path', () => {
    // the preview block must not call db.delete
    const previewStart = src.indexOf('previewRetentionEnforcement');
    const previewSection = src.slice(previewStart);
    expect(previewSection).not.toMatch(/db\.delete\(/);
  });
});
