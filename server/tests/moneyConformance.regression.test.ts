/**
 * THE GATE (money domain) — the Referee runs in CI. If the live money pipeline
 * drifts from THE MONEY RULEBOOK, the build fails and prints the exact rule that
 * broke. Highest-stakes domain → highest-value gate.
 */
import { describe, it, expect } from 'vitest';
import { runMoneyConformance } from '../lib/moneyConformance';
import { formatConformanceReport } from '../lib/authConformance';

describe('MONEY RULEBOOK conformance (the Referee)', () => {
  it('the live money pipeline matches the declared truth — zero drift', () => {
    const report = runMoneyConformance();
    if (!report.ok) {
      // eslint-disable-next-line no-console
      console.error('\n' + formatConformanceReport(report) + '\n');
    }
    const failing = report.findings.filter((f) => f.status === 'fail');
    expect(failing, failing.map((f) => `${f.id}: ${f.problems.join('; ')}`).join(' | ')).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('the money Referee genuinely DETECTS drift (not a rubber-stamp)', () => {
    const report = runMoneyConformance('/nonexistent-root-for-drift-proof');
    expect(report.ok).toBe(false);
    expect(report.failed).toBe(report.total);
  });
});
