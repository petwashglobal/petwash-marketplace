/**
 * Issue #153 PR-WALK-1 — Walk-My-Pet owner walks endpoint security bridge.
 *
 * BEFORE this fix:
 *   server/routes/walk-my-pet.ts:1535 mounted GET /users/:userId/walks
 *   with NO middleware. The handler trusted req.params.userId as the
 *   source of truth and ran a WHERE walkBookings.ownerId = <userId>
 *   against any value the caller sent. Anyone on the internet who
 *   could guess a Firebase UID could pull that user's walk-booking
 *   history (when they walked, with whom, where). The legitimate
 *   caller (client/src/pages/walk-my-pet/OwnerDashboard.tsx:53,55)
 *   amplified the leak by putting the uid in the URL — which then
 *   appeared in referrer headers, browser history, and access logs.
 *
 *   Mirror anti-pattern: PR #173 closed the same shape on the pet
 *   ICS endpoint.
 *
 * AFTER this fix:
 *   1. NEW canonical route GET /api/walk-my-pet/walks/mine carries
 *      `requireAuth` and reads userId from req.user.uid (verified
 *      Firebase session), never from the URL.
 *   2. LEGACY route /users/:userId/walks now ALSO carries `requireAuth`
 *      AND rejects with 403 when req.user.uid !== req.params.userId
 *      (admin roles still bypass for support tooling). Backwards
 *      compatible for any caller already authenticating with the
 *      correct uid; abusive callers blocked.
 *   3. OwnerDashboard.tsx switched from the legacy URL to the canonical
 *      /walks/mine alias so the uid no longer appears in any client
 *      URL.
 *
 * This source-pin test fails if any of the eight guarantees regress.
 *
 * Out of scope (explicitly NOT changed):
 *   - Schema migrations
 *   - Walker (provider) endpoints — separate file scope
 *   - Booking writes / state machines
 *   - Payment / wallet / escrow
 *   - K9000 / Nayax / Tranzila
 *   - Other walk-my-pet routes (search, register, GPS, complete, etc.)
 *   - Other clients of the walk-my-pet API
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'walk-my-pet.ts'),
  'utf8',
);
const DASHBOARD_SRC = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'walk-my-pet', 'OwnerDashboard.tsx'),
  'utf8',
);

describe('Issue #153 PR-WALK-1 — server endpoint hardening', () => {
  it('mounts new canonical route GET /walks/mine with requireAuth', () => {
    expect(SRC).toMatch(
      /router\.get\(\s*['"]\/walks\/mine['"]\s*,\s*requireAuth\s*,/,
    );
  });

  // Helper: extract a route handler block from the source. We walk forward
  // from the route start to the NEXT router.<verb>( call (or end of file)
  // because handler bodies contain inner `})` closures (.where().orderBy()
  // chains, async-function wrappers) that defeat a naive "find the next
  // });" approach.
  function routeBlock(needle: string): string {
    const start = SRC.indexOf(needle);
    if (start < 0) return '';
    const after = SRC.slice(start + needle.length);
    const nextRouter = after.search(/\nrouter\.(get|post|put|patch|delete)\(/);
    return nextRouter > 0
      ? SRC.slice(start, start + needle.length + nextRouter)
      : SRC.slice(start);
  }

  it('canonical /walks/mine reads uid from req.user.uid (never the URL)', () => {
    const block = routeBlock("router.get('/walks/mine'");
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(
      /const\s+userId\s*:\s*string\s*=\s*req\.user\?\.uid\s*\|\|\s*req\.firebaseUser\?\.uid/,
    );
    // Must NOT pull userId from req.params anywhere in the canonical handler.
    expect(block).not.toMatch(/req\.params\.userId/);
  });

  it('canonical /walks/mine filters walks by walkBookings.ownerId = userId from token', () => {
    const block = routeBlock("router.get('/walks/mine'");
    expect(block).toMatch(
      /\.where\(\s*eq\(\s*walkBookings\.ownerId,\s*userId\s*\)\s*\)/,
    );
    // Same response shape as the legacy route (clients depend on it).
    expect(block).toMatch(/res\.json\(\s*\{\s*success:\s*true,\s*bookings\s*\}\s*\)/);
  });

  it('legacy /users/:userId/walks route now carries requireAuth', () => {
    expect(SRC).toMatch(
      /router\.get\(\s*['"]\/users\/:userId\/walks['"]\s*,\s*requireAuth\s*,/,
    );
    // The pre-fix shape (no middleware) must NOT remain in the file.
    expect(SRC).not.toMatch(
      /router\.get\(\s*['"]\/users\/:userId\/walks['"]\s*,\s*async\s*\(req,\s*res\)/,
    );
  });

  it('legacy /users/:userId/walks rejects path-uid mismatch with 403 (BOLA guard)', () => {
    const block = routeBlock("router.get('/users/:userId/walks'");
    expect(block.length).toBeGreaterThan(0);
    // Path-uid vs token-uid mismatch check, with admin bypass.
    expect(block).toMatch(/callerUid\s*!==\s*userId\s*&&\s*!isAdmin/);
    expect(block).toMatch(/res\.status\(403\)/);
    // BOLA log entry — observability into abuse attempts.
    expect(block).toMatch(/BOLA blocked/);
  });

  it('legacy /users/:userId/walks admin bypass uses the canonical role list', () => {
    const block = routeBlock("router.get('/users/:userId/walks'");
    // Admin bypass roles must include super_admin / management / staff /
    // admin. Anchor the array literal so a future PR cannot silently
    // expand it (e.g. add 'customer') and re-open the leak.
    expect(block).toMatch(
      /\[\s*['"]super_admin['"],\s*['"]management['"],\s*['"]staff['"],\s*['"]admin['"]\s*\]/,
    );
  });
});

describe('Issue #153 PR-WALK-1 — client owner-dashboard caller', () => {
  it('OwnerDashboard.tsx fetches the canonical /walks/mine, not the legacy /users/${uid}/walks', () => {
    // The new query key + URL shape must be present.
    expect(DASHBOARD_SRC).toMatch(
      /queryKey:\s*\[\s*['"]\/api\/walk-my-pet\/walks\/mine['"]\s*\]/,
    );
    expect(DASHBOARD_SRC).toMatch(
      /fetch\(\s*['"]\/api\/walk-my-pet\/walks\/mine['"]/,
    );
    // The pre-fix anti-pattern (uid in the URL) must not remain.
    expect(DASHBOARD_SRC).not.toMatch(/\/api\/walk-my-pet\/users\/\$\{user\?\.id\}\/walks/);
    expect(DASHBOARD_SRC).not.toMatch(/'\/api\/walk-my-pet\/users',\s*user\?\.id,\s*'walks'/);
  });

  it('OwnerDashboard.tsx still gates the query on a logged-in user (no anon fetch)', () => {
    expect(DASHBOARD_SRC).toMatch(/enabled:\s*!!user\?\.id/);
  });
});
