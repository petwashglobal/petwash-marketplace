/**
 * THE GATE — the Referee runs in CI. If the live code drifts from THE AUTH
 * RULEBOOK (shared/auth/authRulebook.ts), this test fails the build and prints
 * exactly which rule broke. This is what makes "is auth right?" answerable.
 */
import { describe, it, expect } from 'vitest';
import { runAuthConformance, formatConformanceReport } from '../lib/authConformance';

describe('AUTH RULEBOOK conformance (the Referee)', () => {
  it('the live system matches the declared auth truth — zero drift', () => {
    const report = runAuthConformance();
    if (!report.ok) {
      // Print the full human report so CI shows precisely what drifted.
      // eslint-disable-next-line no-console
      console.error('\n' + formatConformanceReport(report) + '\n');
    }
    const failing = report.findings.filter((f) => f.status === 'fail');
    expect(failing, failing.map((f) => `${f.id}: ${f.problems.join('; ')}`).join(' | ')).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('the Rulebook actually has checks (it is not empty)', () => {
    const report = runAuthConformance();
    expect(report.total).toBeGreaterThanOrEqual(10);
  });

  it('the Referee genuinely DETECTS drift (not a rubber-stamp)', () => {
    // Point it at a root with none of the source files → every check must fail.
    // Proves a green run above is a real signal, not a no-op.
    const report = runAuthConformance('/nonexistent-root-for-drift-proof');
    expect(report.ok).toBe(false);
    expect(report.failed).toBe(report.total);
  });
});
