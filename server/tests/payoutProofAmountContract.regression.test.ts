import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 2026-09-08 — the payout proof builder never saw the amount.
 *
 * server/lib/unifiedPayoutVerification.ts wrote the challenge payload as
 *
 *     { action, operation, targetId, amountCents }
 *
 * while StepUpService's stepUpProofForChallenge() reads
 *
 *     payload.amountMinor
 *
 * Two vocabularies for the same field, meeting at an AUTHORIZATION boundary.
 * The read simply found `undefined`, so every payout proof minted through that
 * helper was amount-UNBOUND: a proof authorising ₪1 authorised ₪1,000,000 to
 * the same target, for its whole TTL. Nothing failed loudly — a name mismatch
 * on an optional field just quietly produces a broader proof.
 *
 * These pins keep one vocabulary on that boundary.
 */

const root = resolve(import.meta.dirname, "../..");

/** Comments stripped — a pin must never pass on its own explanation. */
function code(path: string): string {
  return readFileSync(resolve(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("payout proof: one amount vocabulary on the authorization boundary", () => {
  const helper = code("server/lib/unifiedPayoutVerification.ts");
  const service = code("server/services/UnifiedVerificationService.ts");

  it("the helper writes the field name the proof builder reads", () => {
    expect(helper).toContain("amountMinor");
    expect(service).toContain("payload.amountMinor");
  });

  it("`amountCents` is gone from the payout verification boundary", () => {
    expect(helper).not.toContain("amountCents");
  });

  it("the helper also carries the currency the binding now requires", () => {
    expect(helper).toContain("currency");
    expect(service).toContain("payload.currency");
  });

  it("every caller passes amountMinor + currency together, never cents", () => {
    for (const path of ["server/routes/prestige-pass.ts", "server/routes/finance/settlements.ts"]) {
      const src = code(path);
      const calls = src.split("requireUnifiedPayoutVerification(").slice(1);
      expect(calls.length, `${path} has no payout-verification call sites`).toBeGreaterThan(0);
      for (const call of calls) {
        const args = call.slice(0, 600);
        expect(args, `${path}: a caller still passes amountCents`).not.toContain("amountCents:");
        // A caller that binds an amount must state its currency in the same breath.
        if (args.includes("amountMinor:")) {
          expect(args, `${path}: amountMinor passed without a currency`).toContain("currency:");
        }
      }
    }
  });
});
