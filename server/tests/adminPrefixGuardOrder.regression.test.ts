/**
 * ADMIN-PREFIX-GUARD-ORDER — regression guard.
 *
 * Locks the four prefix-scoped guards that protect the entire
 * `/api/admin/*` surface. Most admin route files (and many
 * `app.post('/api/admin/finance/...')` inline handlers inside
 * `server/routes.ts` itself) rely SOLELY on this prefix stack.
 * If the prefix guards are ever removed, reordered, or scoped
 * away from `/api/admin/`, dozens of admin endpoints would
 * silently open to unauthenticated callers with no per-route
 * fallback to catch it.
 *
 * The four guards below are the security backbone of every
 * admin endpoint that does not repeat the auth wiring inline:
 *
 *   1. adminLimiter          — rate limit  (line-505 territory)
 *   2. verifyAppCheckTokenOptional — App Check monitor mode
 *   3. optionalFirebaseToken — parse Bearer to populate
 *                              `req.firebaseUser` (required so
 *                              the RBAC guard below can see it)
 *   4. requireRole(...ADMIN_ROLES_ARRAY) + requireStaffApproved
 *      + requireMfaEnrolled  — RBAC + staff-active + MFA gate
 *
 * Ordering matters: the RBAC guard MUST come AFTER the Firebase
 * token parser or every Bearer-token admin request 401s
 * (comment at routes.ts line ~513 explains this exact bug
 * pattern for /api/provider-review). And it MUST come AFTER
 * the rate limiter, otherwise unauthenticated attackers can
 * burn CPU on RBAC evaluations at line-rate.
 *
 * Sister suite to:
 *   - server/tests/adminUrlExposure.regression.test.ts
 *   - server/tests/adminOldLayers.regression.test.ts
 *   - server/tests/apiExposureGuards.regression.test.ts
 *
 * Test-only suite. No schema, no UI, no API, no auth, no
 * routing changes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path, { resolve } from "path";

const ROOT = resolve(__dirname, "..", "..");
const ROUTES_PATH = path.join(ROOT, "server/routes.ts");
const ROUTES = readFileSync(ROUTES_PATH, "utf8");

// Match ONLY the exact prefix `/api/admin/` — a stray
// `/api/admin` (no trailing slash) would not attach the
// middleware to the admin router the way express expects.
const AT_ADMIN_PREFIX = (rest: string) =>
  new RegExp(
    String.raw`app\.use\(\s*['"\`]\/api\/admin\/['"\`]\s*,\s*` + rest,
  );

function indexOfOrFail(re: RegExp, label: string): number {
  const m = ROUTES.match(re);
  if (!m || m.index === undefined) {
    throw new Error(
      `ADMIN-PREFIX-GUARD-ORDER: expected \`${label}\` mounted on /api/admin/ prefix in server/routes.ts but did not find it. ` +
        `If you moved this guard, update the regression test AND make sure every admin endpoint still gets the same middleware.`,
    );
  }
  return m.index;
}

describe("ADMIN-PREFIX-GUARD-ORDER — /api/admin/ prefix guards must exist and stay in order", () => {
  it("server/routes.ts exists and is non-empty", () => {
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  it("mounts adminLimiter on the /api/admin/ prefix", () => {
    expect(ROUTES).toMatch(AT_ADMIN_PREFIX(`adminLimiter\\s*\\)`));
  });

  it("mounts verifyAppCheckTokenOptional on the /api/admin/ prefix", () => {
    expect(ROUTES).toMatch(
      AT_ADMIN_PREFIX(`verifyAppCheckTokenOptional\\s*\\)`),
    );
  });

  it("mounts the optional Firebase token parser (optFirebase) on the /api/admin/ prefix", () => {
    // The parser is imported as `optionalFirebaseToken` and
    // aliased to `optFirebase` immediately before it is
    // mounted. Match either form so a future rename that
    // drops the alias still passes.
    expect(ROUTES).toMatch(
      AT_ADMIN_PREFIX(`(optFirebase|optionalFirebaseToken)\\s*\\)`),
    );
  });

  it("mounts requireRole(...ADMIN_ROLES_ARRAY) + requireStaffApproved + requireMfaEnrolled on the /api/admin/ prefix", () => {
    // All three must be on ONE `app.use('/api/admin/', ...)` call
    // so they run as a single guard chain — splitting them across
    // calls is allowed by express but would let a `next('route')`
    // shortcut skip later ones, so we pin the combined form that
    // currently ships.
    expect(ROUTES).toMatch(
      AT_ADMIN_PREFIX(
        `requireRole\\(\\s*\\.\\.\\.ADMIN_ROLES_ARRAY\\s*\\)\\s*,\\s*requireStaffApproved\\s*,\\s*requireMfaEnrolled\\s*\\)`,
      ),
    );
  });

  it("mounts enforceReadOnlyMutations on the /api/admin/ prefix (viewer role guard)", () => {
    // Viewer accounts pass the RBAC guard and can VIEW every
    // admin screen but must be blocked from mutating. If this
    // guard is dropped, viewers silently gain write access.
    expect(ROUTES).toMatch(AT_ADMIN_PREFIX(`enforceReadOnlyMutations\\s*\\)`));
  });

  describe("ordering — the guards must run in the right sequence", () => {
    it("adminLimiter runs BEFORE the RBAC guard (rate limit before RBAC eval)", () => {
      const limiterIdx = indexOfOrFail(
        AT_ADMIN_PREFIX(`adminLimiter\\s*\\)`),
        "app.use('/api/admin/', adminLimiter)",
      );
      const rbacIdx = indexOfOrFail(
        AT_ADMIN_PREFIX(
          `requireRole\\(\\s*\\.\\.\\.ADMIN_ROLES_ARRAY\\s*\\)`,
        ),
        "app.use('/api/admin/', requireRole(...ADMIN_ROLES_ARRAY), ...)",
      );
      expect(limiterIdx).toBeLessThan(rbacIdx);
    });

    it("optFirebase runs BEFORE the RBAC guard (Bearer token must be parsed before RBAC reads it)", () => {
      // This is the exact bug pattern called out at routes.ts
      // ~line 513 for /api/provider-review: if the parser runs
      // AFTER the RBAC guard, every Bearer-token admin request
      // is blocked with 401 because req.firebaseUser is empty.
      const optIdx = indexOfOrFail(
        AT_ADMIN_PREFIX(`(optFirebase|optionalFirebaseToken)\\s*\\)`),
        "app.use('/api/admin/', optFirebase)",
      );
      const rbacIdx = indexOfOrFail(
        AT_ADMIN_PREFIX(
          `requireRole\\(\\s*\\.\\.\\.ADMIN_ROLES_ARRAY\\s*\\)`,
        ),
        "app.use('/api/admin/', requireRole(...ADMIN_ROLES_ARRAY), ...)",
      );
      expect(optIdx).toBeLessThan(rbacIdx);
    });

    it("verifyAppCheckTokenOptional runs BEFORE the RBAC guard", () => {
      const appCheckIdx = indexOfOrFail(
        AT_ADMIN_PREFIX(`verifyAppCheckTokenOptional\\s*\\)`),
        "app.use('/api/admin/', verifyAppCheckTokenOptional)",
      );
      const rbacIdx = indexOfOrFail(
        AT_ADMIN_PREFIX(
          `requireRole\\(\\s*\\.\\.\\.ADMIN_ROLES_ARRAY\\s*\\)`,
        ),
        "app.use('/api/admin/', requireRole(...ADMIN_ROLES_ARRAY), ...)",
      );
      expect(appCheckIdx).toBeLessThan(rbacIdx);
    });

    it("enforceReadOnlyMutations runs AFTER the RBAC guard (only reached by callers who already passed RBAC)", () => {
      const rbacIdx = indexOfOrFail(
        AT_ADMIN_PREFIX(
          `requireRole\\(\\s*\\.\\.\\.ADMIN_ROLES_ARRAY\\s*\\)`,
        ),
        "app.use('/api/admin/', requireRole(...ADMIN_ROLES_ARRAY), ...)",
      );
      const readOnlyIdx = indexOfOrFail(
        AT_ADMIN_PREFIX(`enforceReadOnlyMutations\\s*\\)`),
        "app.use('/api/admin/', enforceReadOnlyMutations)",
      );
      expect(readOnlyIdx).toBeGreaterThan(rbacIdx);
    });
  });

  it("does not scope the RBAC guard away to a narrower admin subpath", () => {
    // Guard against a subtle "fix" where a contributor tries to
    // relax the guard by attaching requireRole to something like
    // '/api/admin/reports/' — that would leave every OTHER admin
    // sub-tree unguarded. If someone genuinely needs a per-subpath
    // exception, they must open a new prefix `app.use` on top of
    // the existing global one, not replace it.
    const globalRbac = ROUTES.match(
      AT_ADMIN_PREFIX(
        `requireRole\\(\\s*\\.\\.\\.ADMIN_ROLES_ARRAY\\s*\\)`,
      ),
    );
    expect(globalRbac).not.toBeNull();
  });
});
