/**
 * PR-FRONTEND-BOOKING-AUTHORITY-A.
 *
 * The marketplace service may read legacy booking cache/query endpoints while
 * old dashboards are still being mapped, but it must not create or cancel via
 * `/api/bookings`. Those write paths bypass the newer booking-request and
 * marketplace checkout flows that own money/state/calendar safety.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = fs.readFileSync(path.resolve(__dirname, 'marketplace.ts'), 'utf8');

describe('marketplace frontend booking authority guard', () => {
  it('does not create bookings through the legacy /api/bookings write endpoint', () => {
    expect(SRC).not.toMatch(/apiRequest\(\s*['"`]POST['"`]\s*,\s*['"`]\/api\/bookings['"`]/);
  });

  it('does not cancel bookings through the legacy /api/bookings write endpoint', () => {
    expect(SRC).not.toMatch(/apiRequest\(\s*['"`]POST['"`]\s*,\s*`\/api\/bookings\/\$\{bookingId\}\/cancel`/);
    expect(SRC).not.toMatch(/\/api\/bookings\/\$\{bookingId\}\/cancel/);
  });

  it('fails closed with migration guidance if a stale caller invokes old booking hooks', () => {
    expect(SRC).toContain('Legacy /api/bookings creation is disabled');
    expect(SRC).toContain('Legacy /api/bookings cancellation is disabled');
    expect(SRC).toContain('canonical booking-request');
  });
});
