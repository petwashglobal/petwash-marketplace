import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 2026-09-08 — email verify could NEVER succeed.
 *
 * Driving the real production signup with a correct, freshly-resent code:
 *
 *   POST /api/auth/email/verify -> 404  "Verification challenge not found."
 *
 * verifyLatestChallengeForDestination was written for SMS login (#634) and
 * hardcoded the channel:
 *
 *   normalizeDestination("sms", input.destination)
 *
 * For a phone that is right. For an email the phone branch strips every
 * non-digit and prepends "+", so the lookup key for ANY address is literally
 * "+". startChallenge stores the destination normalized with the REAL channel
 * ("email" -> the address, untouched), so the two keys could never agree.
 * Every email verify without an explicit challengeId 404'd on a correct code.
 *
 * These pins capture the WHERE key the service actually builds, so a future
 * caller cannot silently reintroduce an SMS assumption.
 */

const captured: { destination?: string } = {};

vi.mock("../../server/db", () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: (clause: any) => {
      // drizzle's eq() keeps the bound value on the comparison node; walk the
      // AND tree and keep every string literal we are matching on.
      const found: string[] = [];
      const walk = (node: any, depth = 0) => {
        if (!node || depth > 8) return;
        if (typeof node === "string") { found.push(node); return; }
        if (Array.isArray(node)) { node.forEach((n) => walk(n, depth + 1)); return; }
        if (typeof node === "object") {
          for (const v of Object.values(node)) walk(v, depth + 1);
        }
      };
      walk(clause);
      // The destination is the only bound value carrying an "@" or a leading "+".
      captured.destination = found.find((f) => f.includes("@") || /^\+/.test(f));
      return chain;
    },
    orderBy: () => chain,
    limit: async () => [],
    update: () => chain,
    set: () => chain,
    insert: () => chain,
    values: async () => [],
  };
  return { db: chain };
});

const root = resolve(import.meta.dirname, "../..");
const source = (p: string) => readFileSync(resolve(root, p), "utf8");

/** Source with comments removed — a pin must never pass on its own explanation. */
function code(path: string): string {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("email verify builds an EMAIL lookup key, not a phone one", () => {
  beforeEach(() => {
    captured.destination = undefined;
  });

  it("looks the challenge up by the address itself", async () => {
    const { unifiedVerificationService } = await import(
      "../../server/services/UnifiedVerificationService"
    );

    await unifiedVerificationService
      .verifyLatestChallengeForDestination({
        purpose: "signup" as any,
        channel: "email" as any,
        destination: "support@petwash.co.il",
        code: "123456",
        actor: { kind: "anonymous" } as any,
      })
      .catch(() => { /* no rows -> CHALLENGE_NOT_FOUND; we only want the key */ });

    expect(captured.destination).toBe("support@petwash.co.il");
  });

  it("a phone destination still normalises to E.164", async () => {
    const { unifiedVerificationService } = await import(
      "../../server/services/UnifiedVerificationService"
    );

    await unifiedVerificationService
      .verifyLatestChallengeForDestination({
        purpose: "login" as any,
        channel: "sms" as any,
        destination: "0501234567",
        code: "123456",
        actor: { kind: "anonymous" } as any,
      })
      .catch(() => { /* as above */ });

    expect(captured.destination).toBe("+0501234567");
  });

  it("refuses a channel/destination mismatch instead of 404ing the customer", async () => {
    const { unifiedVerificationService } = await import(
      "../../server/services/UnifiedVerificationService"
    );

    // The exact broken combination: an address normalised by the phone rule.
    await expect(
      unifiedVerificationService.verifyLatestChallengeForDestination({
        purpose: "signup" as any,
        channel: "sms" as any,
        destination: "support@petwash.co.il",
        code: "123456",
        actor: { kind: "anonymous" } as any,
      }),
    ).rejects.toMatchObject({ reasonCode: "DESTINATION_NORMALIZATION_FAILED" });
  });

  it("the service no longer hardcodes a channel in the lookup", () => {
    const src = code("server/services/UnifiedVerificationService.ts");
    const method = src.slice(src.indexOf("async verifyLatestChallengeForDestination"));
    const body = method.slice(0, method.indexOf("async resendChallenge"));
    expect(body).not.toContain('normalizeDestination("sms"');
    expect(body).toContain("normalizeDestination(input.channel");
  });

  it("both callers pass the channel they started the challenge on", () => {
    const email = code("server/routes/auth-email.ts");
    const emailCall = email.slice(email.indexOf("verifyLatestChallengeForDestination"));
    expect(emailCall.slice(0, 300)).toContain("channel: 'email'");

    const sms = code("server/routes/auth-sms.ts");
    const smsCall = sms.slice(sms.indexOf("verifyLatestChallengeForDestination"));
    expect(smsCall.slice(0, 300)).toContain("channel: 'sms'");
  });
});
