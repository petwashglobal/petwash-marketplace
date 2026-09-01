/**
 * AdminRouteGuard server-authority regression pin (Phase 8.c, CEO D2).
 *
 * The audit found `AdminRouteGuard.tsx` granted admin access if ANY of
 * three sources said admin: server whoami, useAdminAuth server hook,
 * OR Firebase custom claims (client-side cache). Per CEO D2 the
 * Firebase-claims path is a stale-positive vector — the cached ID
 * token may still carry an admin role after the server revokes it.
 *
 * This pin enforces:
 *   1. AdminRouteGuard NEVER reads `claims` from useFirebaseAuth or
 *      any Firebase-claim source when computing admin access.
 *   2. Both remaining sources (useWhoami + useAdminAuth) are server-
 *      backed hooks — no local-cache authority path.
 *   3. isSuperAdmin still comes from useWhoami (server-authoritative).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '..', '..', 'client', 'src', 'components', 'AdminRouteGuard.tsx'),
  'utf8',
);

describe('AdminRouteGuard · server-authority regression pin', () => {
  it('does NOT destructure `claims` from useFirebaseAuth', () => {
    // The refactored guard imports useFirebaseAuth for user/loading only.
    // Any regression that reintroduces claims destructuring signals the
    // client-cache authority path is back.
    expect(SRC).not.toMatch(/const\s+\{[^}]*\bclaims\b[^}]*\}\s*=\s*useFirebaseAuth\(/);
  });

  it('does NOT reference `claimsHasAccess` or `claims.role`', () => {
    // Post-refactor identifiers. Regression would restore either.
    const stripped = SRC.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/\bclaimsHasAccess\b/);
    expect(stripped).not.toMatch(/\bclaims\.role\b/);
  });

  it('grants access only via server-authoritative sources', () => {
    // The `(whoamiHasAccess || adminHasAccess)` computation must remain
    // exactly two-term. A third `||` in that expression is either a new
    // client-cache fallback (defect) or an intentional new source we
    // should discuss — either way, this pin flags it.
    const accessComputations = SRC.match(
      /if\s*\(\s*whoamiHasAccess\s*\|\|\s*adminHasAccess[\s|]*\)/g,
    );
    expect(accessComputations).not.toBeNull();
    expect(accessComputations!.length).toBeGreaterThanOrEqual(1);
    for (const expr of accessComputations!) {
      // Reject a trailing `|| xxxHasAccess` (a third source).
      expect(expr).not.toMatch(/\|\|\s*\w+HasAccess\s*\|\|/);
    }
  });

  it('isSuperAdmin still sourced from useWhoami', () => {
    // Match either a bare `isSuperAdmin,` inside the whoami destructure
    // or `isSuperAdmin }` at the end of it. Regression: sourcing
    // isSuperAdmin from useFirebaseAuth (Firebase claims) would fail.
    const whoamiDestructure = SRC.match(
      /const\s*\{[^}]*\bisSuperAdmin\b[^}]*\}\s*=\s*useWhoami\(/,
    );
    expect(whoamiDestructure, 'isSuperAdmin must be destructured from useWhoami()').not.toBeNull();
  });

  it('regression: NEVER imports isAdminRole from a client-only cache', () => {
    // isAdminRole comes from @shared/adminRoles — a pure enum-style
    // helper. Any import of a client-cached role source (Firebase claims,
    // localStorage, etc.) here is a defect.
    expect(SRC).toMatch(/from\s*['"]@shared\/adminRoles['"]/);
    expect(SRC).not.toMatch(/localStorage\.getItem\(.*[Rr]ole/);
  });
});
