/**
 * PR-CUSTOMER-BOOKINGS-TAB-MAP — regression pin for STATUS_TO_TAB coverage.
 *
 * Before: `meet_greet_requested` was missing from STATUS_TO_TAB. Bookings
 * in that state matched no tab and were INVISIBLE in the customer's My
 * Bookings list. Sibling of the 2026-07-31 fix that added `pending_provider`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'CustomerBookings.tsx'),
  'utf8',
);

describe('CustomerBookings — STATUS_TO_TAB coverage pin', () => {
  it('meet_greet_requested is mapped to a tab (was invisible before)', () => {
    expect(SRC).toMatch(/meet_greet_requested:\s*['"]upcoming['"]/);
  });

  it('every server-known active status is mapped (no invisibility)', () => {
    const ACTIVE = [
      'pending', 'pending_provider', 'accepted', 'confirmed',
      'in_progress', 'meet_greet_requested', 'meet_greet_scheduled',
      'meet_greet_completed', 'payment_pending', 'provider_marked_complete',
    ];
    for (const s of ACTIVE) {
      expect(SRC).toMatch(new RegExp(`\\b${s}:\\s*['"](?:pending|upcoming)['"]`));
    }
  });

  it('past + archived statuses remain mapped', () => {
    expect(SRC).toMatch(/completed:\s*['"]past['"]/);
    expect(SRC).toMatch(/reviewed:\s*['"]past['"]/);
    expect(SRC).toMatch(/declined:\s*['"]archived['"]/);
    expect(SRC).toMatch(/cancelled:\s*['"]archived['"]/);
    expect(SRC).toMatch(/disputed:\s*['"]archived['"]/);
  });
});
