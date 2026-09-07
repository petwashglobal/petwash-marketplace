import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 2026-09-08 — an EMAIL one-time code left no legal record at all.
 *
 * Both audit writers opened with the same guard:
 *
 *   if (challenge.channel !== "sms" && challenge.channel !== "whatsapp") return;
 *   if (!challenge.destination.startsWith("+")) return;
 *
 * so for every email verification — sent, resent, verified, failed, expired —
 * zero rows were written. The only trace was the verification_challenges row,
 * and that row is UPDATED IN PLACE (pending -> verified -> consumed). It is
 * current state, not history: it cannot show when the code was issued versus
 * when it was entered, how many attempts preceded the match, or that an
 * earlier code for the same address was superseded.
 *
 * For a one-time code the record IS the product. "This destination confirmed
 * THIS purpose at THIS moment, from this IP and device" is the entire reason
 * the code exists, and for email we were keeping none of it.
 *
 * auth_events is append-only, already deployed and channel-agnostic, so the
 * fix needed no migration.
 */

const root = resolve(import.meta.dirname, "../..");

/** Comments stripped — a pin must never pass on its own explanation. */
function code(path: string): string {
  return readFileSync(resolve(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const src = code("server/services/UnifiedVerificationService.ts");

function fnBody(name: string): string {
  const start = src.indexOf(`async function ${name}(`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const rest = src.slice(start + 10);
  const next = rest.search(/\nasync function \w+\(/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe("every channel and purpose leaves an audit trail", () => {
  it("a channel-agnostic audit writer exists and targets auth_events", () => {
    const body = fnBody("recordVerificationAudit");
    expect(body).toContain("db.insert(authEvents)");
    // No channel gate — that is the whole point.
    expect(body).not.toContain('channel !== "sms"');
  });

  it("it records the purpose, so the row says WHAT was confirmed", () => {
    expect(fnBody("recordVerificationAudit")).toContain("purpose=");
  });

  it("it is called BEFORE the SMS-only tables filter themselves out", () => {
    const body = fnBody("recordOtpEvent");
    const auditAt = body.indexOf("recordVerificationAudit(");
    const smsGateAt = body.indexOf('channel !== "sms"');
    expect(auditAt).toBeGreaterThan(-1);
    expect(smsGateAt).toBeGreaterThan(-1);
    expect(auditAt).toBeLessThan(smsGateAt);
  });

  it("never stores the code or the destination in the audit row", () => {
    const body = fnBody("recordVerificationAudit");
    expect(body).not.toContain("codeHash");
    expect(body).not.toContain("destination");
  });

  it("an audit failure is logged at ERROR, never swallowed", () => {
    const body = fnBody("recordVerificationAudit");
    expect(body).toContain("logger.error");
  });

  it("every OTP lifecycle event still funnels through recordOtpEvent", () => {
    for (const evt of ["OTP_SENT", "OTP_RESENT", "OTP_VERIFIED", "OTP_FAILED", "OTP_EXPIRED"]) {
      expect(src, `${evt} is not recorded`).toContain(evt);
    }
    // If a future change records an event by calling the SMS-shaped writer
    // directly, this catches it: authEvents must be reachable from one place.
    const inserts = src.match(/db\.insert\(authEvents\)/g) ?? [];
    expect(inserts.length).toBe(1);
  });
});
