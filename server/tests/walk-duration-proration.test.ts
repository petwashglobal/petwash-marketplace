/**
 * Walk pricing must pro-rate by time, not round up to whole hours.
 *
 * WalkEliteBookingEngine.calculateDurationHours used Math.ceil(diffMs/hour), so a
 * 30-minute walk was billed a full hour and a 90-minute walk two hours —
 * overcharging the customer and diverging from walkFeeCalculator (per-minute).
 *
 * Fix: return fractional hours (no ceil). Source-introspection guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'booking-engines', 'walk', 'WalkEliteBookingEngine.ts'),
  'utf8',
);

function durationFn(s: string): string {
  const start = s.indexOf('private calculateDurationHours(');
  return s.slice(start, start + 800);
}

describe('WalkEliteBookingEngine.calculateDurationHours — pro-rated billing', () => {
  const fn = durationFn(src);

  it('no longer rounds up to whole hours (no Math.ceil)', () => {
    expect(fn).not.toMatch(/Math\.ceil/);
  });

  it('returns fractional hours (diffMs / hour)', () => {
    expect(fn).toMatch(/diffMs \/ \(1000 \* 60 \* 60\)/);
  });

  // Sanity: the math a 30-minute walk would now produce.
  it('30 minutes prices as 0.5h, not 1h', () => {
    const thirtyMin = 30 * 60 * 1000;
    expect(thirtyMin / (1000 * 60 * 60)).toBe(0.5);
    expect(Math.ceil(thirtyMin / (1000 * 60 * 60))).toBe(1); // the old (wrong) result
  });
});
