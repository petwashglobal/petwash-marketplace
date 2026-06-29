/**
 * super-app-bookings cancel/complete: ONE cancel route (the refund-capable one),
 * and provider auth resolves the numeric providers.id to the caller's UID via the
 * providers table — never the old `providerId.toString() === userId` (always false,
 * which both blocked real providers AND let the no-refund handler shadow the refund one).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const SRC = readFileSync(resolve(__dirname, '..', 'routes', 'super-app-bookings.ts'), 'utf8');

describe('super-app cancel/complete consolidation + auth', () => {
  it('exactly one cancel route, and it triggers the escrow refund', () => {
    const cancelRoutes = (SRC.match(/'\/:platformId\/bookings\/:bookingId\/cancel'/g) || []).length;
    expect(cancelRoutes).toBe(1);
    expect(SRC).toMatch(/cancelEscrowAndRefund\(payout\.id, reason\)/);
    expect(SRC).toMatch(/paymentStatus: refundPending \? 'refund_pending' : 'cancelled'/);
  });
  it('no live code compares providerId.toString() to a UID (only in comments)', () => {
    const codeHits = SRC.split('\n').filter(l => /providerId\.toString\(\) === userId/.test(l) && !l.trim().startsWith('//'));
    expect(codeHits.length).toBe(0);
  });
  it('both cancel and complete resolve the provider via the providers join', () => {
    const joins = (SRC.match(/eq\(providers\.id, existingBooking\.providerId\),\s*\n\s*eq\(providers\.userId, userId\)/g) || []).length;
    expect(joins).toBeGreaterThanOrEqual(2);
  });
});
