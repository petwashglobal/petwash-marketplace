/**
 * PR-NAV-ROUTES-A — booking confirmation navigation regression pin.
 *
 * BookingConfirmation.tsx previously navigated to `/my-bookings`, which is NOT
 * a registered route in client/src/App.tsx (only `/bookings` exists). The two
 * buttons ("Back" and "View all bookings") therefore landed on a 404.
 *
 * This pin enforces that the page navigates to the real `/bookings` route and
 * never reintroduces the dead `/my-bookings` client route.
 *
 * Out of scope (NOT exercised, NOT in this PR):
 *   - the `/api/bookings/my-bookings` API query key (a backend endpoint, valid)
 *
 * Provider-detail message buttons are pinned separately in
 * PlatformNavigation.nav.regression.test.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, 'BookingConfirmation.tsx'),
  'utf8',
);

describe('BookingConfirmation — PR-NAV-ROUTES-A navigation pin', () => {
  it('never navigates to the dead /my-bookings client route', () => {
    expect(SRC).not.toMatch(/navigate\(\s*['"`]\/my-bookings['"`]\s*\)/);
  });

  it('navigates to the real /bookings route', () => {
    expect(SRC).toMatch(/navigate\(\s*['"`]\/bookings['"`]\s*\)/);
  });
});
