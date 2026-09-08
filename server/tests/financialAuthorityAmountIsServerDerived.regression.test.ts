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

  /**
   * CORRECTED. The first version of this pin asserted that /approve should
   * derive its amount from the pending financial_approval_log row. That was
   * wrong twice: the log is EVIDENCE OF A DECISION, not a money source (and
   * before this fix the server wrote caller-supplied amounts into it), and
   * /queue LEFT JOINs it — it is legitimately absent for a first approval, so
   * requiring one would have broken the normal flow.
   */
  it("approve resolves every authority fact from the business object", () => {
    expect(approve).toContain("resolveCanonicalFinancialAction");
    expect(approve).not.toContain("canonicalPendingApprovalAmountCents");
  });

  it("the approval log is never read as an authority input", () => {
    const resolver = src.slice(
      src.indexOf("export async function resolveCanonicalFinancialAction"),
      src.indexOf("function assertClientAmountMatches"),
    );
    expect(resolver).not.toContain("financial_approval_log");
  });

  it("owner scope and id are derived, not destructured from the body", () => {
    expect(approve).toContain("canonicalAction.ownerScope");
    expect(approve).toContain("canonicalAction.ownerId");
    const gateOwner = gate.slice(0, gate.indexOf("checkFinancialAuthority"));
    expect(gateOwner).not.toMatch(/owner_scope\s*=\s*'global'\s*,\s*owner_id\s*=\s*null\s*\}\s*=\s*req\.body/);
  });

  it("a payout batch is never reinterpreted as a station settlement id", () => {
    const exec = src.slice(src.indexOf("async function executeFinancialAction"));
    expect(exec).not.toContain("parseInt(caseRefId");
    expect(exec).toContain("sourceTable !== 'station_settlements'");
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

  it("an unresolvable case/action pair is refused rather than evaluated", () => {
    expect(src).toContain("UNSUPPORTED_FINANCIAL_ACTION");
  });

  it("the authority call receives the derived value in both handlers", () => {
    for (const [name, h] of [["gate", gate], ["approve", approve]] as const) {
      const call = h.slice(h.indexOf("checkFinancialAuthority("));
      expect(call.slice(0, 200), `${name} passes something other than the derived amount`)
        .toContain("amount_cents");
      // and the derived constant is what that identifier now holds
      expect(h).toMatch(/const amount_cents = canonical(Action)?\.amountCents/);
    }
  });
});
