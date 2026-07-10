/**
 * Wash-packages section visibility — regression pin (2026-07-10).
 *
 * CEO reported on iPhone: eGifts show but the regular wash packages section is GONE.
 * Root cause: prod GET /api/packages returns [] (never seeded), and a prior empty-
 * guard (#1346) rendered the whole section as null on an empty list. Since the single
 * price is ₪55 (CEO-CONFIRMED), the fallback is correctly priced — so an empty/errored
 * API must FALL BACK to FALLBACK_PACKAGES, never vanish. Admin-seeded packages
 * (/admin/wash-packages, #1350) override the fallback.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'WashPackages.tsx'),
  'utf8',
);

describe('WashPackages visibility (2026-07-10)', () => {
  it('falls back to FALLBACK_PACKAGES when the API is empty OR errors (never null)', () => {
    // DB packages win when present; otherwise fallback — the OLD `(isError ? … : [])`
    // (which left an empty list on a 200 []) must be gone.
    expect(SRC).toMatch(
      /const displayPackages = \(packages && packages\.length > 0\) \? packages : FALLBACK_PACKAGES;/,
    );
    expect(SRC).not.toMatch(/const displayPackages = packages \|\| \(isError \? FALLBACK_PACKAGES : \[\]\);/);
  });

  it('single wash fallback is the CEO-confirmed ₪55', () => {
    expect(SRC).toMatch(/name: 'Single Wash',[\s\S]*?price: '55',/);
  });
});
