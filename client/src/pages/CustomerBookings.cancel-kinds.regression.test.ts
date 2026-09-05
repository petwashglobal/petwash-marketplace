/**
 * REGRESSION PIN — Cancel must be offered for the bridged verticals.
 *
 * On 2026-07-31 `cancelMutation` was rewritten to route each booking kind to
 * its OWNING service (sitter-suite / walk-my-pet / academy) and to invalidate
 * all five list caches. The `canCancel` guard was never updated: it still
 * excluded 'sitter', 'walker' and 'academy', so the whole kind-routing branch
 * was dead code and a customer could NEVER cancel a sitter, walk or academy
 * booking from My Bookings.
 *
 * 'marketplace' stays excluded on purpose — its cancel route resolves the id
 * against `bookings.id` while this page holds `bookingNumber || id`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, 'CustomerBookings.tsx'), 'utf8');

describe('CustomerBookings — cancellable kinds', () => {
  it('offers Cancel for legacy requests and the three bridged verticals', () => {
    expect(src).toMatch(
      /const CANCELLABLE_KINDS = new Set\(\['request', 'sitter', 'walker', 'academy'\]\)/,
    );
    expect(src).toMatch(/CANCELLABLE_KINDS\.has\(booking\.kind \?\? 'request'\)/);
  });

  it('no longer hides Cancel behind per-kind !== checks', () => {
    expect(src).not.toMatch(/booking\.kind !== 'sitter'/);
    expect(src).not.toMatch(/booking\.kind !== 'walker'/);
    expect(src).not.toMatch(/booking\.kind !== 'academy'/);
  });

  it('still routes each kind to its owning service, and marketplace stays out', () => {
    expect(src).toMatch(/\/api\/sitter-suite\/bookings\/\$\{requestId\}\/cancel/);
    expect(src).toMatch(/\/api\/walk-my-pet\/bookings\/\$\{requestId\}\/cancel/);
    expect(src).toMatch(/\/api\/academy\/bookings\/\$\{requestId\}\/cancel/);
    expect(src).not.toMatch(/CANCELLABLE_KINDS = new Set\(\[[^\]]*'marketplace'/);
  });
});
