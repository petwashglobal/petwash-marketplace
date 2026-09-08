import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * 2026-09-08 — nine admin wallet routes moved value with no approval band and
 * (bar one) no ceiling. POST /admin/wallet/adjust took { userId, amountCents,
 * type } behind a bare customClaims.admin check: one admin, any wallet, any
 * amount, no second approver.
 *
 * The matrix could not simply be mounted: financial_approval_matrix SHIPS
 * EMPTY — no seed migration exists — so checkFinancialAuthority fails closed on
 * every lookup. Mounting it bare would have switched these routes off,
 * including a support agent's ability to refund a customer.
 *
 * Hence: the matrix decides when it has a rule, and a ceiling applies when it
 * does not.
 */

let rule: any = null;
vi.mock("../lib/financial-approvals", () => ({
  getApprovalRule: async () => rule,
  explainFinancialApproval: (r: any, role: string) => ({
    allowed: r.required_role === role,
    requiredRole: r.required_role,
    secondApprovalRequired: !!r.second_approval_role,
    secondApprovalRole: r.second_approval_role ?? null,
    reason: r.required_role === role ? "ok" : `requires ${r.required_role}`,
    matchedRule: r,
  }),
}));
vi.mock("../lib/logger", () => ({ logger: { error: () => {}, warn: () => {}, info: () => {} } }));

const { authoriseWalletMoneyAction, SUPPORT_TIER_CEILING_CENTS } =
  await import("../lib/walletMoneyAuthority");

const base = {
  caseType: "wallet_adjust", actionType: "adjust",
  actingRole: "admin", fallbackCeilingCents: SUPPORT_TIER_CEILING_CENTS,
};

beforeEach(() => { rule = null; });

describe("wallet money authority", () => {
  it("an unbounded mint is refused when no matrix rule exists", async () => {
    const r = await authoriseWalletMoneyAction({ ...base, amountCents: 100_000_000 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("ABOVE_UNAPPROVED_CEILING");
  });

  it("ordinary amounts still work — the fix must not switch the route off", async () => {
    const r = await authoriseWalletMoneyAction({ ...base, amountCents: 1_000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.via).toBe("ceiling");
  });

  it("the ceiling is inclusive at its exact value", async () => {
    const r = await authoriseWalletMoneyAction({ ...base, amountCents: SUPPORT_TIER_CEILING_CENTS });
    expect(r.ok).toBe(true);
  });

  it("one agora over the ceiling is refused", async () => {
    const r = await authoriseWalletMoneyAction({ ...base, amountCents: SUPPORT_TIER_CEILING_CENTS + 1 });
    expect(r.ok).toBe(false);
  });

  it("a matrix rule SUPERSEDES the ceiling, in both directions", async () => {
    // A rule that permits far more than the ceiling.
    rule = { required_role: "admin", second_approval_role: null };
    const big = await authoriseWalletMoneyAction({ ...base, amountCents: 100_000_000 });
    expect(big.ok).toBe(true);
    if (big.ok) expect(big.via).toBe("matrix");

    // A rule that demands a role the actor does not hold.
    rule = { required_role: "executive", second_approval_role: null };
    const denied = await authoriseWalletMoneyAction({ ...base, amountCents: 1_000 });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("INSUFFICIENT_AUTHORITY");
  });

  it("a non-integer, negative or zero amount is refused, never treated as zero", async () => {
    for (const bad of [0, -1, 10.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      const r = await authoriseWalletMoneyAction({ ...base, amountCents: bad });
      expect(r.ok, `amountCents=${bad} should be refused`).toBe(false);
      if (!r.ok) expect(r.code).toBe("AMOUNT_INVALID");
    }
  });

  it("an unsupported currency is refused", async () => {
    const r = await authoriseWalletMoneyAction({ ...base, amountCents: 100, currency: "BANANA" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("CURRENCY_UNSUPPORTED");
  });

  it("a failed rule lookup falls back to the ceiling — it never opens the gate", async () => {
    const mod = await import("../lib/financial-approvals");
    (mod as any).getApprovalRule = async () => { throw new Error("db down"); };
    const over = await authoriseWalletMoneyAction({ ...base, amountCents: 100_000_000 });
    expect(over.ok).toBe(false);
  });
});
