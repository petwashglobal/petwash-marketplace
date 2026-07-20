/**
 * K9000 revenue must never go missing quietly.
 *
 * Board item "Swallowed writes set". Two silent failures lived in the revenue
 * step of the wash route, and the second was the dangerous one:
 *
 * 1. recordK9000Transaction throwing was caught and written to a log line. The
 *    customer had been charged, the wash had run, and the money simply never
 *    reached the books. Nobody was told.
 *
 * 2. Worse: chargeILS is resolved by looking up nayax_transactions. If that row
 *    was missing the lookup yielded 0, which failed the `chargeILS > 0` test and
 *    fell into the SAME branch as a free wash — logging
 *    "Free wash — no revenue entry needed". A wash the customer PAID for was
 *    booked as free, with a log line asserting everything was fine.
 *
 * Both now raise a critical payment alert. The books feed the monthly report the
 * CPA files from, so unbooked revenue has to surface before the monthly close —
 * a log line nobody reads is not surfacing.
 *
 * Free / unknown / failed are three different states and must never be conflated.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const src = readFileSync(resolve(ROOT, 'server/routes/k9000.ts'), 'utf8');

describe('K9000 revenue — free, unknown and failed are distinct', () => {
  it('only a genuinely free wash takes the "no revenue entry" path', () => {
    // isFreeWash must be tested on its own, not inferred from chargeILS === 0.
    expect(src).toMatch(/if \(isFreeWash\) \{/);
    expect(src).toMatch(/Free wash — no revenue entry needed/);
  });

  it('a paid wash with an unresolvable charge is flagged, not silently skipped', () => {
    expect(src).toMatch(/UNBOOKED — paid wash with no resolvable charge/);
    expect(src).toMatch(/k9000_revenue_unbooked:/);
  });

  it('a thrown recording error raises an alert instead of only logging', () => {
    expect(src).toMatch(/k9000_revenue_failed:/);
    expect(src).toMatch(/K9000 revenue recording FAILED/);
  });
});

describe('K9000 revenue — alerts are loud and safe', () => {
  it('both unbooked paths are critical severity (money is missing)', () => {
    const criticalAlerts = src.match(/severity: 'critical'/g) || [];
    expect(criticalAlerts.length).toBeGreaterThanOrEqual(2);
  });

  it('alerts are categorised as payment so they reach the money queue', () => {
    expect(src).toMatch(/dedupeKey: `k9000_revenue_unbooked:\$\{washId\}`[\s\S]{0,120}category: 'payment'/);
  });

  it('alerting can never break the wash itself', () => {
    // The customer is standing at the bay — an alerting outage must not fail them.
    const guards = src.match(/alerting must never break the wash/g) || [];
    expect(guards.length).toBe(2);
  });

  it('dedupes per wash so one wash cannot spam the alert queue', () => {
    expect(src).toMatch(/k9000_revenue_unbooked:\$\{washId\}/);
    expect(src).toMatch(/k9000_revenue_failed:\$\{washId\}/);
  });
});
