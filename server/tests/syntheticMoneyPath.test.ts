import { describe, it, expect } from 'vitest';
import { runDeterministicMoneyChecks, SyntheticMoneyPathMonitor } from '../services/SyntheticMoneyPathMonitor';

/**
 * The synthetic money-path monitor (CTO P0-7) must PASS against the current correct
 * money code — if it ever goes red, either prod math regressed OR the monitor's
 * expected values drifted from the code. Either way it's a real signal. This test
 * keeps the monitor calibrated to the shipped calculators.
 */
describe('SyntheticMoneyPathMonitor — invariants match the live money code', () => {
  it('all deterministic money checks pass on the current code', () => {
    const checks = runDeterministicMoneyChecks();
    const failed = checks.filter((c) => !c.ok);
    expect(failed, `failing: ${failed.map((c) => `${c.name} (${c.detail})`).join('; ')}`).toEqual([]);
    expect(checks.length).toBeGreaterThanOrEqual(5);
  });

  it('covers walk 15%, sitter single-15%, no-double-charge, and VAT-18%', () => {
    const names = runDeterministicMoneyChecks().map((c) => c.name);
    expect(names).toContain('walk_fee_single_15pct');
    expect(names).toContain('walk_vat_extracted_not_added');
    expect(names).toContain('sitter_fee_single_15pct');
    expect(names).toContain('sitter_no_double_charge');
    expect(names).toContain('vat_rate_is_18pct');
  });

  it('runChecks() reports ok on healthy code', async () => {
    const report = await SyntheticMoneyPathMonitor.runChecks();
    expect(report.ok).toBe(true);
    expect(report.checkedAt).toBeTruthy();
  });
});
