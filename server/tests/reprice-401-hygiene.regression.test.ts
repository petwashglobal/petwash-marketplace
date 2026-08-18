/**
 * PR-REPRICE-401-HYGIENE — regression pin for the split of `!userId`
 * (auth) from the ownership check on POST /:requestId/reprice.
 *
 * Before: `if (!userId || (br.ownerId !== userId && !isSuperAdminVerified(...)))`
 * folded the missing-auth case into the 403 "Not authorized" branch AFTER a
 * DB fetch. Unauth callers ate a wasted SELECT + got a misleading 403.
 *
 * After: an honest 401 at the door + the ownership check runs cleanly with a
 * known userId.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../routes/booking-requests.ts'),
  'utf8',
);

describe('POST /:requestId/reprice — 401 hygiene split', () => {
  it('returns 401 explicitly when there is no userId', () => {
    const start = SRC.search(/router\.post\(\s*['"]\/:requestId\/reprice['"]/);
    expect(start).toBeGreaterThan(-1);
    const window = SRC.slice(start, start + 1000);
    expect(window).toMatch(
      /if\s*\(\s*!userId\s*\)\s*\{\s*return\s+res\.status\(401\)\.json\(\{\s*error:\s*['"]Authentication required['"]/,
    );
  });

  it('401 guard sits BEFORE the first db.select() (no wasted round-trip)', () => {
    const start = SRC.search(/router\.post\(\s*['"]\/:requestId\/reprice['"]/);
    const window = SRC.slice(start, start + 2000);
    const guardIdx = window.search(/if\s*\(\s*!userId\s*\)\s*\{\s*return\s+res\.status\(401\)/);
    const dbIdx = window.search(/db\s*\.\s*select\(/);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(dbIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(dbIdx);
  });

  it('ownership check no longer folds !userId into the 403 branch', () => {
    const start = SRC.search(/router\.post\(\s*['"]\/:requestId\/reprice['"]/);
    const window = SRC.slice(start, start + 2500);
    // The 403 branch must NOT contain !userId anymore
    expect(window).not.toMatch(
      /if\s*\(\s*!userId\s*\|\|\s*\(br\.ownerId\s*!==\s*userId/,
    );
    // But the pure ownership check must still exist
    expect(window).toMatch(
      /if\s*\(\s*br\.ownerId\s*!==\s*userId\s*&&\s*!isSuperAdminVerified\(req\s+as\s+any\)\s*\)/,
    );
  });
});
