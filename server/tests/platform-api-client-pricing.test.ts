/**
 * Platform API booking: non-admins may not supply their own item prices.
 *
 * EnhancedBookingService prices POST /api/platform/bookings as
 * Σ(item.quantity × item.unitPrice) directly from the request body — unitPrice
 * is the only price source. Any authenticated customer could POST items with
 * unitPrice:0 (free) or any number. This raw engine has no server-side rate card.
 *
 * Fix: block client-supplied priced items for non-admin callers (admins/trusted
 * platform integrations only). Source-introspection guard.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'platform-api.ts'),
  'utf8',
);

describe('platform-api POST /bookings — no client pricing for non-admins', () => {
  it('rejects items from a non-admin caller', () => {
    expect(src).toMatch(/parsed\.data\.items\?\.length && !isAdmin\(req\)/);
    expect(src).toMatch(/CLIENT_PRICING_FORBIDDEN/);
  });

  it('the guard runs before the booking is created', () => {
    const guard = src.indexOf('CLIENT_PRICING_FORBIDDEN');
    const create = src.indexOf('enhancedBookingService.createBooking');
    expect(guard).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(create);
  });
});
