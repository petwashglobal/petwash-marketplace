import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sourceWithoutComments } from "./helpers/sourceWithoutComments";

/**
 * 2026-09-08 — five routes in this router had no per-route guard.
 *
 * The mount is `app.use('/api/financial-approvals', validateFirebaseToken, …)`,
 * and validateFirebaseToken is AUTHENTICATION, not authorization: it 401s
 * without a token and then calls next(). It never looks at a role. So every
 * signed-in CUSTOMER could read:
 *
 *   GET  /matrix           every threshold, required role and second approver
 *   GET  /queue            pending refunds and payout batches — amounts,
 *                          requester UIDs, booking ids
 *   GET  /reserve-summary  money held, blocked and released
 *   GET  /log              the approval audit trail
 *   POST /check            an oracle: any amount, any CLAIMED role -> verdict
 *
 * The same class as #2268 (~45 prestige-pass /admin routes reachable
 * unauthenticated) and the optionalFirebaseToken sweep: an auth-only mount
 * means every handler must establish authority for itself.
 *
 * This pins the whole router rather than the five, so a route ADDED later
 * without a guard fails here instead of shipping open.
 */

const root = resolve(import.meta.dirname, "../..");

/** Comments stripped — a pin must never pass on its own explanation. */

const src = sourceWithoutComments("server/routes/financial-approvals.ts");
const AUTHZ = new Set(["requireFinancialAdmin", "requirePolicyAdmin"]);

type Route = { verb: string; path: string; guard: string };

function routes(): Route[] {
  const out: Route[] = [];
  for (const m of src.matchAll(/router\.(get|post|patch|delete)\('([^']+)',\s*([A-Za-z_$][\w$]*)?/g)) {
    out.push({ verb: m[1].toUpperCase(), path: m[2], guard: m[3] ?? "" });
  }
  return out;
}

describe("every financial-approvals route establishes its own authority", () => {
  const all = routes();

  it("the router actually has routes — a silent zero would pass everything else", () => {
    expect(all.length).toBeGreaterThanOrEqual(10);
  });

  it("no route relies on the mount's authentication alone", () => {
    const open = all.filter((r) => !AUTHZ.has(r.guard));
    expect(
      open.map((r) => `${r.verb} ${r.path}`),
      "these reach any signed-in user, including a customer",
    ).toEqual([]);
  });

  it("matrix MUTATION is narrower than matrix use", () => {
    for (const r of all.filter((r) => r.path.startsWith("/matrix") && r.verb !== "GET")) {
      expect(r.guard, `${r.verb} ${r.path}`).toBe("requirePolicyAdmin");
    }
  });

  it("/check evaluates the CALLER's role, never one supplied in the body", () => {
    const at = src.indexOf("router.post('/check'");
    const body = src.slice(at, at + 1200);
    expect(body).toContain("getActingRole(req)");
    // the body field is gone entirely, not merely ignored
    expect(body).not.toContain("user_role");
  });
});
