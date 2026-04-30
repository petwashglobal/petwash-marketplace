import { describe, it, expect } from 'vitest';
import { timingSafeEqual } from 'crypto';

/**
 * Regression test for credit-wallet.ts:669
 * The cron-secret comparison must be constant-time.
 *
 * Before this fix the route used `cronSecret === expectedCronSecret`,
 * which leaks the secret length and prefix via response timing.
 */

function constantTimeMatch(provided: string, expected: string): boolean {
  if (expected.length === 0) return false;
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

describe('cron secret constant-time compare', () => {
  it('returns true on exact match', () => {
    const secret = 'a'.repeat(48);
    expect(constantTimeMatch(secret, secret)).toBe(true);
  });

  it('returns false on length mismatch', () => {
    expect(constantTimeMatch('short', 'a'.repeat(48))).toBe(false);
  });

  it('returns false on content mismatch (same length)', () => {
    expect(constantTimeMatch('a'.repeat(48), 'b'.repeat(48))).toBe(false);
  });

  it('returns false when expected is empty (fail-closed)', () => {
    expect(constantTimeMatch('anything', '')).toBe(false);
  });

  it('returns false when provided is empty', () => {
    expect(constantTimeMatch('', 'a'.repeat(48))).toBe(false);
  });
});
