/**
 * Regression pin — /api/prestige-pass/admin/wallet/refund used a
 * Date.now()-based idempotency key so an admin could issue multiple
 * partial refunds. Two concurrent admin clicks minted two distinct
 * keys and each executed a full refund → customer wallet double-
 * credited. Lane B (2026-08-17) wraps the handler in
 * withBookingMutationLock('admin-wallet-refund', bookingId).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes', 'prestige-pass.ts'),
  'utf8',
);

describe('admin/wallet/refund race guard', () => {
  it('imports the booking mutation lock helper', () => {
    expect(src).toMatch(/import\s*\{[^}]*withBookingMutationLock[^}]*\}\s*from\s*['"][^'"]*bookingMutationLock['"]/);
  });

  it("wraps the admin/wallet/refund handler in withBookingMutationLock('admin-wallet-refund')", () => {
    expect(src).toMatch(/withBookingMutationLock\(\s*['"]admin-wallet-refund['"],\s*bookingId/);
  });

  it('the finance_state read happens INSIDE the lock (not before)', () => {
    const routeStart = src.indexOf("router.post('/admin/wallet/refund'");
    expect(routeStart).toBeGreaterThan(-1);
    const body = src.slice(routeStart, routeStart + 8000);

    const lockAt = body.indexOf("withBookingMutationLock('admin-wallet-refund'");
    const readAt = body.indexOf('FROM booking_requests WHERE request_id');
    expect(lockAt).toBeGreaterThan(-1);
    expect(readAt).toBeGreaterThan(-1);
    // Read must be inside the lock to see the up-to-date finance_state.
    expect(lockAt).toBeLessThan(readAt);
  });

  it('the WalletLedger call happens INSIDE the lock', () => {
    const routeStart = src.indexOf("router.post('/admin/wallet/refund'");
    const body = src.slice(routeStart, routeStart + 8000);

    const lockAt = body.indexOf("withBookingMutationLock('admin-wallet-refund'");
    const refundAt = body.indexOf('refundToWallet');
    expect(lockAt).toBeGreaterThan(-1);
    expect(refundAt).toBeGreaterThan(-1);
    expect(lockAt).toBeLessThan(refundAt);
  });

  it('maps a lock timeout to 503 (retryable) rather than 500', () => {
    expect(src).toMatch(/BookingMutationLockTimeoutError[\s\S]{0,400}?res\.status\(503\)/);
  });
});
