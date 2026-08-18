/**
 * PR-BOOKING-DETAIL-AUTH-GATE — regression pin for the GET /:requestId
 * explicit-401 hardening.
 *
 * Before: an unauthenticated caller for GET /api/booking-requests/:requestId
 * slipped past the initial SELECT + the legacy-id fallback SELECT + a
 * provider-name lookup, only to hit a misleading 403 at the ownership
 * check. Fail-closed at the door instead — no anon read of any
 * booking-request row (some fields, e.g. quote_breakdown, are
 * business-sensitive even for parties not on the booking).
 *
 * Companion of PR-1911 (POST-side 401 sweep).
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../routes/booking-requests.ts'),
  'utf8',
);

describe('GET /api/booking-requests/:requestId — explicit 401 gate', () => {
  it('has the 401 guard immediately after userId is read', () => {
    // Anchor on the GET handler declaration.
    const start = SRC.search(/router\.get\(\s*['"]\/:requestId['"]/);
    expect(start).toBeGreaterThan(-1);
    // Look at the next ~500 chars for the guard.
    const window = SRC.slice(start, start + 900);
    expect(window).toMatch(/if\s*\(\s*!userId\s*\)\s*return\s+res\.status\(401\)\.json\(\{\s*error:\s*['"]Authentication required['"]/);
  });

  it('guard runs BEFORE the first db.select() to avoid a wasted DB round-trip', () => {
    const start = SRC.search(/router\.get\(\s*['"]\/:requestId['"]/);
    const window = SRC.slice(start, start + 800);
    const guardIdx = window.search(/if\s*\(\s*!userId\s*\)\s*return\s+res\.status\(401\)/);
    const dbIdx = window.search(/db\.select\(/);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(dbIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(dbIdx);
  });

  it('still enforces owner-or-provider ownership as the second-line check', () => {
    const start = SRC.search(/router\.get\(\s*['"]\/:requestId['"]/);
    const window = SRC.slice(start, start + 2500);
    expect(window).toMatch(
      /booking\.ownerId\s*!==\s*userId\s*&&\s*booking\.providerId\s*!==\s*userId/,
    );
    expect(window).toMatch(/return\s+res\.status\(403\)/);
  });
});
