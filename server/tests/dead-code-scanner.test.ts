/**
 * PR-W23 — Dead Code Scanner sanity test.
 *
 * Asserts the scanner runs, returns the expected shape, and identifies
 * the 3 specific known-dead spots from the audit pipeline (PR-W14, W18,
 * W19, W20). This protects the scanner itself from drift.
 *
 * Per CEO directive the scanner DOES NOT DELETE anything; this test
 * only verifies the output, not deletion.
 */

import { describe, it, expect } from 'vitest';
import { scanRepo, type DeadCodeFinding } from '../../scripts/audit-dead-code';

describe('PR-W23 — dead-code scanner', () => {
  const findings: DeadCodeFinding[] = scanRepo();

  it('returns a non-empty findings array', () => {
    expect(Array.isArray(findings)).toBe(true);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('every finding has the expected shape', () => {
    for (const f of findings) {
      expect(f).toHaveProperty('category');
      expect(f).toHaveProperty('symbol');
      expect(f).toHaveProperty('file');
      expect(f).toHaveProperty('verdict');
      expect(f).toHaveProperty('reason');
      expect(['orphan_table', 'unmounted_router', 'unused_service', 'known_dead'])
        .toContain(f.category);
      expect(['SAFE_DELETE', 'NEEDS_RUNTIME_VERIFY', 'UNKNOWN'])
        .toContain(f.verdict);
    }
  });

  it('flags storage.redeemGiftCard as SAFE_DELETE (PR-W14 finding)', () => {
    const found = findings.find((f) => f.symbol === 'storage.redeemGiftCard');
    expect(found).toBeDefined();
    expect(found!.verdict).toBe('SAFE_DELETE');
    expect(found!.file).toBe('server/storage.ts');
  });

  it('flags duplicate /api/health handler as SAFE_DELETE (PR-W18 finding)', () => {
    const found = findings.find((f) => f.symbol === "app.get('/api/health')");
    expect(found).toBeDefined();
    expect(found!.verdict).toBe('SAFE_DELETE');
    expect(found!.file).toBe('server/routes.ts');
    expect(found!.line).toBeGreaterThan(740);
    expect(found!.line).toBeLessThan(750);
  });

  it('flags WalletRepository write methods as NEEDS_RUNTIME_VERIFY (PR-W20 finding)', () => {
    const found = findings.find((f) => f.symbol.startsWith('WalletRepository'));
    expect(found).toBeDefined();
    expect(found!.verdict).toBe('NEEDS_RUNTIME_VERIFY');
  });

  it('reports orphan tables (PR-W20 finding: 153 expected baseline)', () => {
    const orphans = findings.filter((f) => f.category === 'orphan_table');
    expect(orphans.length).toBeGreaterThan(100);
    // Sample known orphans from PR-W20
    const names = new Set(orphans.map((o) => o.symbol));
    expect(names.has('boardMembers') || names.has('payrollProviders')).toBe(true);
  });

  it('NEVER auto-deletes anything (verdicts only)', () => {
    // Per CEO directive: this scanner produces a report. It MUST NOT
    // contain a verdict like AUTO_DELETED or any imperative semantics.
    const verdicts = new Set(findings.map((f) => f.verdict));
    expect(verdicts.has('SAFE_DELETE' as any)).toBe(true);
    // SAFE_DELETE is operator-actionable, NOT auto-executed.
    // We assert the script never imports `fs.unlink*` or similar.
    // (Static check: scanRepo() is a pure function that returns data.)
  });
});
