/**
 * Cancellation-fee tier: explicit 0% must stay 0%, not silently become 100%.
 *
 * BookingPolicyEngine.calculateCancellation used logical-OR defaults:
 *   refundPercent = rules["24_hours_before"].refund_percent || 100
 * so a provider/policy that configures a "0% refund" tier had it coerced to a
 * FULL 100% refund (`0 || 100 === 100`) — a cancellation-fee bypass / money loss.
 * Same for an explicit fee of 0.
 *
 * Fix: nullish-coalescing (??) so an explicitly configured 0 is preserved.
 * Source-introspection so a regression back to || fails CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'services', 'BookingPolicyEngine.ts'),
  'utf8',
);

// Isolate the tier-assignment block so we don't accidentally match unrelated ||.
const start = src.indexOf('Apply rules based on time until booking');
const block = src.slice(start, start + 1100);

describe('BookingPolicyEngine cancellation tiers — nullish defaults', () => {
  it('uses ?? (not ||) for every refund_percent default', () => {
    expect(block).toMatch(/refund_percent \?\? 100/);
    expect(block).toMatch(/refund_percent \?\? 50/);
    expect(block).toMatch(/refund_percent \?\? 0/);
  });

  it('uses ?? (not ||) for every fee default', () => {
    expect(block).toMatch(/\.fee \?\? 0/);
    expect(block).toMatch(/\.fee \?\? 10/);
    expect(block).toMatch(/\.fee \?\? 20/);
  });

  it('no logical-OR defaults remain in the tier block (the bug)', () => {
    expect(block).not.toMatch(/refund_percent \|\|/);
    expect(block).not.toMatch(/\.fee \|\|/);
  });
});
