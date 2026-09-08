import { describe, expect, it, beforeAll, vi } from "vitest";

/**
 * 2026-09-08 — an amount with no currency is not an amount.
 *
 * StepUpBinding was (operation, targetId, amountMinor). The amount was in the
 * MAC, so a proof for 42.00 could not authorise 4200.00 — but 5000 ILS and
 * 5000 AUD produced the SAME fingerprint and were interchangeable, and they
 * are not worth the same thing.
 *
 * Closed before the binding model spread past ILS-only payouts. Retrofitting
 * it after money routes depend on it would mean invalidating live proofs on a
 * live money path instead of a dead one.
 */

beforeAll(() => {
  process.env.STEP_UP_HMAC_SECRET = "c".repeat(48);
  process.env.COOKIE_SECRET = "test-cookie-secret-currency-0123456789abcdef";
});

async function load() {
  return await import("../services/StepUpService");
}

const UID = "uid-currency-test";
const MONEY = "payout_action" as const;

describe("step-up money proofs bind the currency", () => {
  it("a proof for 5000 ILS does not authorise 5000 AUD", async () => {
    const { issueStepUpProof, decodeStepUpProof } = await load();
    const issued = issueStepUpProof(UID, MONEY, 300, {
      operation: "payout.execute",
      targetId: "payout-1",
      amountMinor: 5000,
      currency: "ILS",
    });
    expect(issued).not.toBeNull();

    const sameCurrency = decodeStepUpProof(UID, MONEY, issued!.token, {
      operation: "payout.execute", targetId: "payout-1", amountMinor: 5000, currency: "ILS",
    });
    expect(sameCurrency).not.toBeNull();

    const otherCurrency = decodeStepUpProof(UID, MONEY, issued!.token, {
      operation: "payout.execute", targetId: "payout-1", amountMinor: 5000, currency: "AUD",
    });
    expect(otherCurrency).toBeNull();
  });

  it("the amount still cannot be moved", async () => {
    const { issueStepUpProof, decodeStepUpProof } = await load();
    const issued = issueStepUpProof(UID, MONEY, 300, {
      operation: "payout.execute", targetId: "payout-1", amountMinor: 5000, currency: "ILS",
    });
    const bigger = decodeStepUpProof(UID, MONEY, issued!.token, {
      operation: "payout.execute", targetId: "payout-1", amountMinor: 500000, currency: "ILS",
    });
    expect(bigger).toBeNull();
  });

  it("refuses to ISSUE an amount-bound proof with no currency", async () => {
    const { issueStepUpProof } = await load();
    const issued = issueStepUpProof(UID, MONEY, 300, {
      operation: "payout.execute", targetId: "payout-1", amountMinor: 5000,
    });
    expect(issued).toBeNull();
  });

  it("still refuses an UNBOUND money proof (unchanged)", async () => {
    const { issueStepUpProof } = await load();
    expect(issueStepUpProof(UID, MONEY, 300, undefined)).toBeNull();
  });

  it("a binding with no amount needs no currency", async () => {
    const { issueStepUpProof, decodeStepUpProof } = await load();
    // bank_details_change authorises a destination change, not a sum.
    const issued = issueStepUpProof(UID, MONEY, 300, {
      operation: "bank_details.change", targetId: "req-77",
    });
    expect(issued).not.toBeNull();
    expect(decodeStepUpProof(UID, MONEY, issued!.token, {
      operation: "bank_details.change", targetId: "req-77",
    })).not.toBeNull();
  });

  it("currency comparison is case- and space-insensitive, not three bindings", async () => {
    const { issueStepUpProof, decodeStepUpProof } = await load();
    const issued = issueStepUpProof(UID, MONEY, 300, {
      operation: "payout.execute", targetId: "p1", amountMinor: 100, currency: " ils ",
    });
    expect(issued).not.toBeNull();
    expect(decodeStepUpProof(UID, MONEY, issued!.token, {
      operation: "payout.execute", targetId: "p1", amountMinor: 100, currency: "ILS",
    })).not.toBeNull();
  });

  it("authoriseMoneyAction refuses an amount with no currency, before touching Redis", async () => {
    const { issueStepUpProof, authoriseMoneyAction } = await load();
    const issued = issueStepUpProof(UID, MONEY, 300, {
      operation: "payout.execute", targetId: "p9", amountMinor: 100, currency: "ILS",
    });
    const r = await authoriseMoneyAction({
      uid: UID, purpose: MONEY, token: issued!.token,
      operation: "payout.execute", targetId: "p9", amountMinor: 100,
    });
    expect(r.ok).toBe(false);
    expect((r as any).reason).toBe("CURRENCY_REQUIRED");
  });
});
