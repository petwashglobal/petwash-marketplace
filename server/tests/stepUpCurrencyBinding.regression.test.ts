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

  /**
   * CORRECTED 2026-09-08. This originally minted a bank_details.change binding
   * under `payout_action` and asserted "an amountless money proof is fine".
   * That was conceptually wrong twice over: it used an operation string to
   * smuggle a destination change through the EXECUTION purpose, and in doing
   * so it pinned the exact hole — an amountless payout_action — as correct
   * behaviour. Destination changes are change_payout. The purpose decides the
   * rule; a free-text operation never does.
   */
  it("change_payout binds an exact destination and needs no amount", async () => {
    const { issueStepUpProof, decodeStepUpProof } = await load();
    const issued = issueStepUpProof(UID, "change_payout", 300, {
      operation: "bank_details.change", targetId: "req-77",
    });
    expect(issued).not.toBeNull();
    expect(decodeStepUpProof(UID, "change_payout", issued!.token, {
      operation: "bank_details.change", targetId: "req-77",
    })).not.toBeNull();
    // ...and it still binds the exact target.
    expect(decodeStepUpProof(UID, "change_payout", issued!.token, {
      operation: "bank_details.change", targetId: "req-78",
    })).toBeNull();
  });

  it("an AMOUNTLESS payout_action cannot be minted", async () => {
    const { issueStepUpProof } = await load();
    expect(issueStepUpProof(UID, MONEY, 300, {
      operation: "payout.execute", targetId: "payout-1", currency: "ILS",
    })).toBeNull();
  });

  it("an amountless payout_action cannot be AUTHORISED either", async () => {
    const { issueStepUpProof, authoriseMoneyAction } = await load();
    // Mint a legitimate bound proof, then try to spend it without an amount.
    const issued = issueStepUpProof(UID, MONEY, 300, {
      operation: "payout.execute", targetId: "p-1", amountMinor: 5000, currency: "ILS",
    })!;
    const r = await authoriseMoneyAction({
      uid: UID, purpose: MONEY, token: issued.token,
      operation: "payout.execute", targetId: "p-1",
    });
    expect(r.ok).toBe(false);
    expect((r as any).reason).toBe("BINDING_REQUIREMENT_NOT_MET");
  });

  it("an invalid currency cannot be minted — 'BANANA' is not ISO-4217", async () => {
    const { issueStepUpProof } = await load();
    expect(issueStepUpProof(UID, MONEY, 300, {
      operation: "payout.execute", targetId: "p-1", amountMinor: 5000, currency: "BANANA",
    })).toBeNull();
  });

  it("a fractional or non-positive amount cannot be minted", async () => {
    const { issueStepUpProof } = await load();
    for (const bad of [0, -100, 10.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      expect(issueStepUpProof(UID, MONEY, 300, {
        operation: "payout.execute", targetId: "p-1", amountMinor: bad, currency: "ILS",
      }), `amountMinor=${bad} should be refused`).toBeNull();
    }
  });

  it("a changed target and a changed operation are both rejected", async () => {
    const { issueStepUpProof, decodeStepUpProof } = await load();
    const issued = issueStepUpProof(UID, MONEY, 300, {
      operation: "payout.execute", targetId: "p-1", amountMinor: 5000, currency: "ILS",
    })!;
    expect(decodeStepUpProof(UID, MONEY, issued.token, {
      operation: "payout.execute", targetId: "p-2", amountMinor: 5000, currency: "ILS",
    })).toBeNull();
    expect(decodeStepUpProof(UID, MONEY, issued.token, {
      operation: "payout.refund", targetId: "p-1", amountMinor: 5000, currency: "ILS",
    })).toBeNull();
  });

  it("v1 and v2 proofs can never satisfy a v3 money authorization", async () => {
    const { issueStepUpProof, decodeStepUpProof } = await load();
    const crypto = await import("node:crypto");
    const secret = process.env.STEP_UP_HMAC_SECRET!;
    const b64url = (b: Buffer) => b.toString("base64url");

    // A v3 proof is what a money purpose accepts.
    const v3 = issueStepUpProof(UID, MONEY, 300, {
      operation: "payout.execute", targetId: "p-1", amountMinor: 5000, currency: "ILS",
    })!;
    const decodedV3 = decodeStepUpProof(UID, MONEY, v3.token, {
      operation: "payout.execute", targetId: "p-1", amountMinor: 5000, currency: "ILS",
    });
    expect(decodedV3?.version).toBe("v3");

    // Hand-mint correctly-signed v1 and v2 tokens for the same money purpose.
    const now = Math.floor(Date.now() / 1000);
    const mint = (fields: string[]) => {
      const payload = fields.join(".");
      const mac = b64url(crypto.createHmac("sha256", secret).update(payload, "utf8").digest());
      return `${b64url(Buffer.from(payload, "utf8"))}.${mac}`;
    };
    const v2Fp = b64url(
      crypto.createHmac("sha256", secret)
        .update(["payout.execute", "p-1", "5000"].join("\u0000"), "utf8").digest(),
    ).slice(0, 22);

    const v1Token = mint(["v1", UID, MONEY, String(now), String(now + 300), "nonce1"]);
    const v2Token = mint(["v2", UID, MONEY, String(now), String(now + 300), "nonce2", v2Fp]);

    for (const t of [v1Token, v2Token]) {
      expect(decodeStepUpProof(UID, MONEY, t, {
        operation: "payout.execute", targetId: "p-1", amountMinor: 5000, currency: "ILS",
      })).toBeNull();
    }
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
    expect((r as any).reason).toBe("BINDING_REQUIREMENT_NOT_MET");
  });
});
