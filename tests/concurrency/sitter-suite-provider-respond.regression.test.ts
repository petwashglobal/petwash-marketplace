/**
 * Regression pin — sitter-suite /provider-respond concurrent Accept
 * previously double-charged the customer via Nayax (SELECT-then-Nayax-
 * then-UPDATE with no lock). Lane B (2026-08-17) wraps the accept branch
 * in withBookingMutationLock('sitter-provider-respond', bookingId).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes', 'sitter-suite.ts'),
  'utf8',
);

describe('sitter-suite provider-respond race guard', () => {
  it('imports the booking mutation lock helper', () => {
    expect(src).toMatch(/import\s*\{\s*[^}]*withBookingMutationLock[^}]*\}\s*from\s*['"][^'"]*bookingMutationLock['"]/);
  });

  it('wraps the provider-respond handler in withBookingMutationLock', () => {
    // The lock namespace and key shape MUST be exactly this — an audit
    // may search on it to prove the money-race was closed.
    expect(src).toMatch(/withBookingMutationLock\(\s*['"]sitter-provider-respond['"],\s*bookingId/);
  });

  it('the lock wrap sits BEFORE the Nayax payment capture', () => {
    const lockAt = src.indexOf("withBookingMutationLock('sitter-provider-respond'");
    const nayaxAt = src.indexOf('nayaxSitterMarketplace.processBookingPayment');
    expect(lockAt).toBeGreaterThan(-1);
    expect(nayaxAt).toBeGreaterThan(-1);
    expect(lockAt).toBeLessThan(nayaxAt);
  });

  it('surfaces a lock timeout as 503 (retryable) rather than 500', () => {
    // The 503 mapping matches the caller-facing contract documented in
    // bookingMutationLock.ts — client should retry.
    expect(src).toMatch(/BookingMutationLockTimeoutError[\s\S]{0,400}?res\.status\(503\)/);
  });
});
