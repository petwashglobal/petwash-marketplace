/**
 * PR-W22 — CI guard for the duplicate-constants invariant.
 *
 * Wraps scripts/audit-duplicate-constants.ts and asserts the count of
 * findings does NOT GROW above a frozen baseline. Existing drift is
 * tracked but the test passes; any NEW duplicate added in a future PR
 * fails CI loudly.
 *
 * The baseline is intentionally above zero because PR-W22 only ADDS
 * the detector — it does not fix the drift. Subsequent cleanup PRs
 * (PR-W37 VAT/Compliance Map → impl PRs) will lower the baseline.
 *
 * To deliberately lower the baseline (i.e., when you've fixed some):
 *   1. Run `npx tsx scripts/audit-duplicate-constants.ts` to see the new count.
 *   2. Lower BASELINE below.
 *   3. Commit with the cleanup PR.
 *
 * To raise the baseline:
 *   You may not. Add the import / constant fix in the same PR as the
 *   addition. The whole point of this guard is to prevent quiet drift.
 */

import { describe, it, expect } from 'vitest';
import { scanRepo } from '../../scripts/audit-duplicate-constants';

// Frozen baseline as of PR-W22 (2026-05-05). Lower this when fixing,
// never raise it.
const BASELINE_FINDINGS = 19;

describe('PR-W22 — duplicate-constants guard', () => {
  const findings = scanRepo();

  it('count does not exceed the frozen baseline', () => {
    if (findings.length > BASELINE_FINDINGS) {
      const grouped: Record<string, number> = {};
      for (const f of findings) grouped[f.category] = (grouped[f.category] || 0) + 1;
      const summary = Object.entries(grouped)
        .map(([cat, n]) => `${cat}=${n}`)
        .join(', ');
      const sample = findings
        .slice(0, 5)
        .map((f) => `  ${f.file}:${f.line}  ${f.snippet}`)
        .join('\n');
      const msg =
        `Duplicate-constants count grew above the baseline.\n` +
        `Baseline: ${BASELINE_FINDINGS}, current: ${findings.length} (${summary})\n` +
        `Sample of offenders:\n${sample}\n\n` +
        `Either fix the duplicate in the same PR, or import from the canonical:\n` +
        `  - VAT rate:        shared/israel-compliance-config.ts (ISRAEL_VAT_RATE)\n` +
        `  - K9000 wash price: server/services/K9000RedemptionService.ts (WASH_PRICE_ILS_CENTS)\n` +
        `  - wash-pack prices: server/utils.ts (createWashPackageData)\n`;
      throw new Error(msg);
    }
    expect(findings.length).toBeLessThanOrEqual(BASELINE_FINDINGS);
  });

  it('detector returns a stable shape', () => {
    expect(Array.isArray(findings)).toBe(true);
    if (findings.length > 0) {
      const f = findings[0];
      expect(f).toHaveProperty('category');
      expect(f).toHaveProperty('file');
      expect(f).toHaveProperty('line');
      expect(f).toHaveProperty('snippet');
      expect(f).toHaveProperty('message');
      expect(['vat_rate', 'wash_price_cents', 'wash_package_price', 'env_fallback'])
        .toContain(f.category);
    }
  });

  it('canonical sources are excluded from findings', () => {
    // The canonical files should NEVER be flagged by the detector even
    // though they contain the literal definitions.
    expect(
      findings.some((f) => f.file === 'shared/israel-compliance-config.ts'),
    ).toBe(false);
  });
});
