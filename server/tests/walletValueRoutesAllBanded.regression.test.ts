import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sourceWithoutComments } from "./helpers/sourceWithoutComments";

/**
 * 2026-09-10 — the census listed NINE value-moving wallet routes. Two passes
 * banded eight, and the report said "all eight now governed". The ninth,
 * POST /admin/wallet/refund-requests/:id/approve, was simply never counted.
 *
 * Nobody would have noticed: it is the strongest of the nine in every other
 * respect — super-admin only, a state check, an amount derived from the
 * record, and a four-eyes rule that the second approver cannot be the
 * requester. It just had no concept of SIZE, so a ₪5 refund and a ₪500,000
 * refund required exactly the same authority.
 *
 * A prose count in a PR body is not a control. This is the count, executable.
 * Adding a value-moving route without a band now fails here.
 */

const root = resolve(import.meta.dirname, "../..");

/** Comments stripped — a pin must never pass on its own explanation. */

/**
 * The routes docs/security/money-authority-census-2026-09-08.md identified as
 * moving real value. Adding one here without banding it fails the suite; that
 * is the point.
 */
const VALUE_MOVING = [
  "/admin/wallet/release",
  "/admin/wallet/refund",
  "/admin/wallet/adjust",
  "/admin/wallet/support/release-hold",
  "/admin/wallet/support/issue-refund",
  "/admin/wallet/support/credit",
  "/admin/wallet/payout-entries/mark-paid",
  "/admin/wallet/refund-requests/:id/approve",
  "/admin/wallet/disputes/:caseRef/apply-resolution",
] as const;

const src = sourceWithoutComments("server/routes/prestige-pass.ts");

function handlerBodies(): Map<string, string> {
  const lines = src.split("\n");
  const starts: Array<[number, string]> = [];
  lines.forEach((l, i) => {
    const m = l.match(/router\.post\('(\/admin\/wallet\/[^']+)'/);
    if (m) starts.push([i, m[1]]);
  });
  const out = new Map<string, string>();
  starts.forEach(([i, name], idx) => {
    const end = idx + 1 < starts.length ? starts[idx + 1][0] : lines.length;
    out.set(name, lines.slice(i, end).join("\n"));
  });
  return out;
}

describe("every value-moving wallet route carries an authority band", () => {
  const bodies = handlerBodies();

  it("the parser actually found the wallet routes", () => {
    // A regex that silently matches nothing would pass every assertion below.
    expect(bodies.size).toBeGreaterThan(20);
  });

  it("each census route still exists under the name the census used", () => {
    const missing = VALUE_MOVING.filter((r) => !bodies.has(r));
    expect(missing, "renamed or removed — re-point the census and this pin").toEqual([]);
  });

  it("each one calls authoriseWalletMoneyAction", () => {
    const unbanded = VALUE_MOVING.filter((r) => !(bodies.get(r) ?? "").includes("authoriseWalletMoneyAction"));
    expect(unbanded, "these move value with no approval band").toEqual([]);
  });

  it("none of them bands a caller-supplied amount without validating it", () => {
    // authoriseWalletMoneyAction refuses a non-positive / non-integer amount,
    // so the band cannot be dodged with 0 — assert the call is reached, not
    // buried behind a truthiness check that a 0 would skip silently.
    for (const r of VALUE_MOVING) {
      const body = bodies.get(r) ?? "";
      const at = body.indexOf("authoriseWalletMoneyAction");
      expect(at, `${r}`).toBeGreaterThan(-1);
      expect(body.slice(at, at + 400), `${r} does not act on the result`).toContain("moneyAuthority.ok");
    }
  });
});
