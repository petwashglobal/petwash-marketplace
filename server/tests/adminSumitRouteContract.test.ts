import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('admin SUMIT route contract', () => {
  it('uses the real suppliers.osek_classification column for dry-run readiness', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/routes/admin-sumit.ts'), 'utf8');

    expect(source).toContain('osek_classification');
    expect(source).not.toContain('coalesce(osek_type');
    expect(source).not.toContain('FROM suppliers\n      GROUP BY 1');
  });

  it('surfaces activation readiness on both health and sync dry-run responses', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/routes/admin-sumit.ts'), 'utf8');

    expect(source).toContain('buildSumitActivationReadiness');
    expect(source.match(/readiness,/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
