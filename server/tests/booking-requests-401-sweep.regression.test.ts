/**
 * PR-BOOKING-REQUESTS-401-SWEEP — regression pin for the explicit-401 hardening
 * across booking-requests state-changing routes.
 *
 * The /api/booking-requests router is mounted with optionalFirebaseToken
 * (server/routes.ts:12724), so unauthenticated callers can reach these
 * handlers. Before this sweep, an unauth caller for any of the listed
 * routes fell through to a misleading 403 ("Only owner/provider can X")
 * AFTER a wasted bookingRequests SELECT. This is the same shape PR-1904
 * fixed on handleConfirmCompletion; here we sweep the remaining state-
 * changing sibling routes with the same fix.
 *
 * Each pin anchors on the route's docblock and asserts the 401 guard
 * exists immediately after the userId read.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../routes/booking-requests.ts'),
  'utf8',
);

const HANDLERS: Array<{ label: string; anchor: RegExp; guard: RegExp }> = [
  {
    label: '/:requestId/respond',
    anchor: /router\.post\(\s*['"]\/:requestId\/respond['"]/,
    guard: /if\s*\(\s*!userId\s*\)\s*return\s+res\.status\(401\)/,
  },
  {
    label: '/:requestId/meet-greet',
    anchor: /router\.post\(\s*['"]\/:requestId\/meet-greet['"]/,
    guard: /if\s*\(\s*!userId\s*\)\s*return\s+res\.status\(401\)/,
  },
  {
    label: '/:requestId/pay',
    anchor: /router\.post\(\s*['"]\/:requestId\/pay['"]/,
    guard: /if\s*\(\s*!userId\s*\)\s*return\s+res\.status\(401\)/,
  },
  {
    label: '/:requestId/start',
    anchor: /router\.post\(\s*['"]\/:requestId\/start['"]/,
    guard: /if\s*\(\s*!userId\s*\)\s*return\s+res\.status\(401\)/,
  },
  {
    label: '/:requestId/complete',
    anchor: /router\.post\(\s*['"]\/:requestId\/complete['"]/,
    guard: /if\s*\(\s*!userId\s*\)\s*return\s+res\.status\(401\)/,
  },
  {
    label: '/:requestId/cancel',
    anchor: /router\.post\(\s*['"]\/:requestId\/cancel['"]/,
    guard: /if\s*\(\s*!userId\s*\)\s*return\s+res\.status\(401\)/,
  },
  {
    label: '/:requestId/photo-update',
    anchor: /router\.post\(\s*['"]\/:requestId\/photo-update['"]/,
    guard: /if\s*\(\s*!userId\s*\)\s*return\s+res\.status\(401\)/,
  },
];

describe('booking-requests router — explicit 401 sweep', () => {
  for (const h of HANDLERS) {
    it(`${h.label} — 401 guard present at handler entry`, () => {
      const start = SRC.search(h.anchor);
      expect(start).toBeGreaterThan(-1);
      // Look at the next ~400 chars for the guard.
      const window = SRC.slice(start, start + 400);
      expect(window).toMatch(h.guard);
      // Sanity: guard MUST come before the first db.select(), otherwise the
      // unauth caller still eats a DB round-trip.
      const guardIdx = window.search(h.guard);
      const dbIdx = window.search(/db\.select\(/);
      if (dbIdx !== -1) {
        expect(guardIdx).toBeGreaterThan(-1);
        expect(guardIdx).toBeLessThan(dbIdx);
      }
    });
  }

  it('all guards use the same honest error message ("Authentication required")', () => {
    for (const h of HANDLERS) {
      const start = SRC.search(h.anchor);
      const window = SRC.slice(start, start + 400);
      expect(window).toMatch(/error:\s*['"]Authentication required['"]/);
    }
  });
});
