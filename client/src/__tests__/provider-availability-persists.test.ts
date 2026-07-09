/**
 * Provider Available/Offline header toggle persists — regression pin (2026-07-09).
 *
 * The header toggle in the provider-os shell only flipped local useState and never
 * saved. A provider who tapped "Offline" was still shown AVAILABLE to customers
 * (and it reverted on refresh) — a real marketplace bug: offline providers could
 * still be booked. The dashboard's own toggle persisted; the always-visible header
 * one didn't.
 *
 * Fix: the shell now reads the real availability + providerId from the stats
 * payload, initialises the toggle from the server, and persists every toggle to
 * POST /api/provider-dashboard/availability (optimistic, reverts on failure).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'pages', 'provider-os', 'ProviderOS.tsx'),
  'utf8',
);

describe('ProviderOS header availability toggle persists (2026-07-09)', () => {
  it('reads providerId + real availability from stats', () => {
    expect(SRC).toMatch(/provStats\?\.platforms\?\.\[0\]\?\.id/);
    expect(SRC).toMatch(/provStats\?\.platforms\?\.\[0\]\?\.isAvailable/);
  });

  it('persists the toggle to the availability endpoint', () => {
    expect(SRC).toMatch(/persistAvailability/);
    expect(SRC).toMatch(/'\/api\/provider-dashboard\/availability'/);
    expect(SRC).toMatch(/setIsAvailable\(!next\)/); // reverts on failure
  });

  it('the header toggle no longer just flips local state', () => {
    expect(SRC).toMatch(/onClick=\{\(\) => persistAvailability\(!isAvailable\)\}/);
    expect(SRC).not.toMatch(/onClick=\{\(\) => setIsAvailable\(!isAvailable\)\}/);
  });
});
