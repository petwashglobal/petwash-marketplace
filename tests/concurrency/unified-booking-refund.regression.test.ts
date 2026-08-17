/**
 * Regression pin — unified-booking /:bookingId/refund had no
 * idempotency key and no status gate. Router is DARK by default
 * (UNIFIED_BOOKING_ENABLED gate) so the fix is preventative: two
 * concurrent admin refunds would each create a stampRefund row and
 * refund the customer twice once the flag flips.
 * Lane B (2026-08-17) wraps in withBookingMutationLock and returns 409
 * on the losing request.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes', 'unified-booking.ts'),
  'utf8',
);

describe('unified-booking /:bookingId/refund race guard', () => {
  it('imports withBookingMutationLock', () => {
    expect(src).toMatch(/import\s*\{[^}]*withBookingMutationLock[^}]*\}\s*from\s*['"][^'"]*bookingMutationLock['"]/);
  });

  it("wraps the refund handler in withBookingMutationLock('unified-booking-refund')", () => {
    expect(src).toMatch(/withBookingMutationLock\(\s*['"]unified-booking-refund['"],\s*bookingId/);
  });

  it("re-reads status INSIDE the lock and returns 409 when already 'REFUNDED'", () => {
    const routeStart = src.indexOf("router.post('/:bookingId/refund'");
    expect(routeStart).toBeGreaterThan(-1);
    const body = src.slice(routeStart, routeStart + 4000);
    // The lock-scoped load must precede the status short-circuit.
    const lockAt = body.indexOf("withBookingMutationLock('unified-booking-refund'");
    const loadAt = body.indexOf('loadBookingFromDB(bookingId)');
    expect(lockAt).toBeLessThan(loadAt);
    expect(body).toMatch(/status[^,]*['"]REFUNDED['"]/);
    expect(body).toMatch(/__http\s*=\s*409/);
  });

  it('maps a lock timeout to 503 (retryable)', () => {
    expect(src).toMatch(/BookingMutationLockTimeoutError[\s\S]{0,400}?res\.status\(503\)/);
  });
});
