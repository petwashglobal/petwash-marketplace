import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * 2026-09-08 — the caller chose the facts used to decide its own authority.
 *
 * getApprovalRule() picks a rule by (case_type, action_type, owner_scope,
 * owner_id, amount) and prefers an owner-specific rule over a global one. All
 * five arrived from the request body, so an authorised-but-lower-authority
 * operator could understate the amount, or claim a different ownership context
 * or action, and land on a laxer band than their action deserved.
 *
 * NOTE ON SEVERITY: these routes already require admin / executive /
 * franchise_owner. This is not an unauthenticated exploit. It is a lower-
 * authority authorised operator lying about the facts that decide whether they
 * need a higher band or a second approver.
 *
 * These are BEHAVIOURAL: they drive the real resolver against a mocked
 * database, rather than asserting on source text.
 */

const rows: Record<string, any[]> = {};
const executed: string[] = [];

vi.mock("../db", () => ({
  db: {
    async execute(q: any) {
      // drizzle's sql`` builds a SQL object of queryChunks, not a plain
      // template array — walk it for the literal text.
      const collect = (n: any, out: string[] = [], d = 0): string[] => {
        if (!n || d > 6) return out;
        if (typeof n === "string") { out.push(n); return out; }
        if (Array.isArray(n)) { n.forEach((x) => collect(x, out, d + 1)); return out; }
        if (typeof n === "object") {
          if (typeof n.value === "string") out.push(n.value);
          if (Array.isArray(n.value)) n.value.forEach((x: any) => collect(x, out, d + 1));
          for (const k of ["queryChunks", "chunks", "strings"]) {
            if (n[k]) collect(n[k], out, d + 1);
          }
        }
        return out;
      };
      const text: string = collect(q).join(" ");
      executed.push(text.replace(/\s+/g, " ").trim());
      if (/FROM refund_approvals/i.test(text)) return { rows: rows.refund ?? [] };
      if (/FROM payout_batches/i.test(text)) return { rows: rows.batch ?? [] };
      if (/FROM booking_disputes/i.test(text)) return { rows: rows.dispute ?? [] };
      if (/FROM station_settlements/i.test(text)) return { rows: rows.settlement ?? [] };
      return { rows: [] };
    },
  },
}));
vi.mock("../lib/logger", () => ({ logger: { error: () => {}, warn: () => {}, info: () => {} } }));

const { resolveCanonicalFinancialAction } = await import("../routes/financial-approvals");

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  executed.length = 0;
});

describe("authority facts are resolved from the business object", () => {
  it("a ₪500,000 refund resolves at ₪500,000 whatever the caller says", async () => {
    rows.refund = [{ refund_request_id: "rr-1", amount_cents: 50_000_000, status: "pending" }];
    const r = await resolveCanonicalFinancialAction("refund", "rr-1", "approve");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.action.amountCents).toBe(50_000_000);
  });

  it("the ownership context is derived, never taken from the caller", async () => {
    rows.refund = [{ refund_request_id: "rr-1", amount_cents: 100, status: "pending" }];
    const r = await resolveCanonicalFinancialAction("refund", "rr-1", "approve");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The resolver's own value — the request body cannot contribute one.
    expect(r.action.ownerScope).toBe("global");
    expect(r.action.ownerId).toBeNull();
  });

  it("a FIRST approval works with no approval-log row in existence", async () => {
    // The queue LEFT JOINs financial_approval_log; it is legitimately absent.
    rows.refund = [{ refund_request_id: "rr-1", amount_cents: 4200, status: "pending" }];
    const r = await resolveCanonicalFinancialAction("refund", "rr-1", "approve");
    expect(r.ok).toBe(true);
    // and the resolver never consults the log at all
    expect(executed.some((q) => /financial_approval_log/i.test(q))).toBe(false);
  });

  it("a refund that is not pending is refused", async () => {
    rows.refund = [{ refund_request_id: "rr-1", amount_cents: 4200, status: "approved" }];
    const r = await resolveCanonicalFinancialAction("refund", "rr-1", "approve");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("REFUND_NOT_PENDING");
  });

  it("a textual payout batch id resolves as a BATCH, never as a settlement", async () => {
    rows.batch = [{ batch_id: "SCHED-123-abc", total_net_cents: 777_00, status: "pending" }];
    const r = await resolveCanonicalFinancialAction("payout_release", "SCHED-123-abc", "release");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.action.sourceTable).toBe("payout_batches");
    expect(r.action.amountCents).toBe(77_700);
    // and nothing went looking in station_settlements for it
    expect(executed.some((q) => /station_settlements/i.test(q))).toBe(false);
  });

  it("relabelling an action to reach an easier rule does not resolve", async () => {
    rows.batch = [{ batch_id: "b-1", total_net_cents: 999_00, status: "pending" }];
    const r = await resolveCanonicalFinancialAction("dispute_close", "b-1", "release");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("UNSUPPORTED_FINANCIAL_ACTION");
  });

  it("an unknown case/action pair is refused rather than evaluated", async () => {
    const r = await resolveCanonicalFinancialAction("something_new", "x", "approve");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(400);
  });

  it("a missing object is refused, not defaulted to zero", async () => {
    const r = await resolveCanonicalFinancialAction("refund", "does-not-exist", "approve");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("REFUND_NOT_FOUND");
  });
});
