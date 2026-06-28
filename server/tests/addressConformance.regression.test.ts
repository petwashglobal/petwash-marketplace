/**
 * THE GATE (address domain) — the Referee runs in CI. If address capture drifts
 * from THE ADDRESS RULEBOOK (e.g. paid Google Places is wired back into the
 * shared autocomplete, or saved-address reuse is removed), the build fails.
 */
import { describe, it, expect } from 'vitest';
import { runAddressConformance } from '../lib/addressConformance';
import { formatConformanceReport } from '../lib/authConformance';

describe('ADDRESS RULEBOOK conformance (the Referee)', () => {
  it('address capture matches the declared truth — free OSM, saved per user, no paid Google', () => {
    const report = runAddressConformance();
    if (!report.ok) {
      // eslint-disable-next-line no-console
      console.error('\n' + formatConformanceReport(report) + '\n');
    }
    const failing = report.findings.filter((f) => f.status === 'fail');
    expect(failing, failing.map((f) => `${f.id}: ${f.problems.join('; ')}`).join(' | ')).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('the address Referee genuinely DETECTS drift (not a rubber-stamp)', () => {
    const report = runAddressConformance('/nonexistent-root-for-drift-proof');
    expect(report.ok).toBe(false);
    expect(report.failed).toBe(report.total);
  });
});
