/**
 * WashPackages empty-state guard — regression pin (2026-07-09).
 *
 * Root-caused LIVE: prod GET /api/packages returns [] (wash_packages table
 * empty/inactive), so the homepage packages section rendered a header with ZERO
 * cards — the "regular wash packages missing" report. It was a DATA problem, not
 * responsive/device.
 *
 * Fix pins: (1) an empty (non-error) list renders NOTHING (no broken ghost
 * section), and (2) we must NOT substitute FALLBACK_PACKAGES for an empty list —
 * the fallback prices (₪55 single) don't match the live Kfar Saba price and the
 * cards are purchasable, so showing them would mis-price a real sale. Fallback
 * stays for hard ERROR only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'WashPackages.tsx'),
  'utf8',
);

describe('WashPackages hides cleanly on an empty API (2026-07-09)', () => {
  it('returns null when there are no packages to sell', () => {
    expect(SRC).toMatch(/if \(displayPackages\.length === 0\)\s*\{\s*return null/);
  });

  it('still uses FALLBACK_PACKAGES ONLY on a hard error, not on empty', () => {
    // the fallback is gated on isError, never substituted for an empty [] result
    expect(SRC).toMatch(/packages \|\| \(isError \? FALLBACK_PACKAGES : \[\]\)/);
  });
});
