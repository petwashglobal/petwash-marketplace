import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 2026-09-08 — the client chose which authority rule applied to it.
 *
 * getApprovalRule() selects the approval band with
 *
 *   min_amount_cents <= :amount AND (max_amount_cents IS NULL OR max_amount_cents >= :amount)
 *
 * so the amount is not merely recorded — it SELECTS THE RULE that decides
 * whether the acting role has authority and whether a second approver is
 * required.
 *
 * POST /api/financial-approvals/payout-release-gate and POST
 * /api/financial-approvals/approve both took `amount_cents` from the REQUEST
 * BODY and passed it straight into checkFinancialAuthority(). Declaring
 * `amount_cents: 1` on a ₪500,000 settlement picked the lowest band and could
 * clear a release that should have required a second approver.
 *
 * Both now derive the figure from the server's own record — the settlement
 * row, and the pending approval row respectively — and refuse the request when
 * a supplied amount disagrees, rather than silently correcting it.
 */

const root = resolve(import.meta.dirname, "../..");

/** Comments stripped — a pin must never pass on its own explanation. */
function code(path: string): string {
  return readFileSync(resolve(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const src = code("server/routes/financial-approvals.ts");

function handler(marker: string): string {
  const at = src.indexOf(marker);
  expect(at, `${marker} not found`).toBeGreaterThan(-1);
  const rest = src.slice(at);
  const next = rest.slice(1).search(/\nrouter\.(post|get|patch|put)\(/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

describe("a financial authority decision never uses a client-supplied amount", () => {
  const gate = handler("router.post('/payout-release-gate'");
  const approve = handler("router.post('/approve'");

  it("payout-release-gate derives the amount from the settlement", () => {
    expect(gate).toContain("canonicalSettlementAmountCents");
  });

  it("approve derives the amount from the pending approval record", () => {
    expect(approve).toContain("canonicalPendingApprovalAmountCents");
  });

  it("neither destructures a trusted `amount_cents` straight out of the body", () => {
    for (const [name, h] of [["gate", gate], ["approve", approve]] as const) {
      // The body value may only arrive renamed as an assertion to be checked.
      expect(h, `${name} still trusts req.body.amount_cents`)
        .toContain("amount_cents: assertedAmountCents");
    }
  });

  it("a supplied amount that disagrees is REFUSED, not silently corrected", () => {
    for (const [name, h] of [["gate", gate], ["approve", approve]] as const) {
      expect(h, `${name} does not check the asserted amount`).toContain("assertClientAmountMatches");
    }
    expect(src).toContain("AMOUNT_MISMATCH");
    // 409, not a quiet overwrite — an operator has to see a stale screen.
    expect(src).toContain("res.status(409)");
  });

  it("approving with no pending request is refused outright", () => {
    expect(src).toContain("NO_PENDING_APPROVAL");
  });

  it("the authority call receives the derived value in both handlers", () => {
    for (const [name, h] of [["gate", gate], ["approve", approve]] as const) {
      const call = h.slice(h.indexOf("checkFinancialAuthority("));
      expect(call.slice(0, 200), `${name} passes something other than the derived amount`)
        .toContain("amount_cents");
      // and the derived constant is what that identifier now holds
      expect(h).toContain("const amount_cents = canonical.amountCents");
    }
  });
});
