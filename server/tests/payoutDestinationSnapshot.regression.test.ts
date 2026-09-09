import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 2026-09-08 — the payout executor read a destination that did not exist, and
 * would have read a MUTABLE one if anybody "fixed" it the obvious way.
 *
 * processIsraeliBankTransfer() read
 *
 *   provider.bankAccountNumber  provider.bankName  provider.bankCode
 *   provider.bankBranchCode     provider.legalName
 *
 * None are columns on `providers` — that table has only a `bank_account`
 * jsonb. So `if (!provider.bankAccountNumber || !provider.bankName)` was
 * ALWAYS true: every payout died there with "bank details not configured",
 * before reaching the BANK_PAYOUT_LIVE gate. The path was dead, and the cause
 * was five phantom field reads rather than any missing configuration.
 *
 * The obvious repair — add those columns to `providers` — is wrong twice. It
 * makes a FOURTH home for bank data (contractor_bank_details is canonical),
 * and it makes the destination mutable at transfer time: edit the profile
 * after a payout is authorised and the money follows the edit.
 *
 * The rule these pin: A PAYOUT AUTHORISED FOR DESTINATION A CAN NEVER BE
 * REDIRECTED TO DESTINATION B BY A LATER PROFILE CHANGE.
 */

const root = resolve(import.meta.dirname, "../..");

/** Comments stripped — a pin must never pass on its own explanation. */
function code(path: string): string {
  return readFileSync(resolve(root, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const svc = code("server/services/ProviderPayoutService.ts");

function transferBody(): string {
  // Anchor on the DEFINITION, not the first occurrence — indexOf finds the
  // call site at the top of the file, and asserting against that would have
  // silently graded the wrong text.
  const at = svc.indexOf("private static async processIsraeliBankTransfer(");
  expect(at, "processIsraeliBankTransfer definition not found — renamed?").toBeGreaterThan(-1);
  const rest = svc.slice(at + 10);
  const next = rest.search(/\n  (private |public |protected )?static /);
  const body = next === -1 ? rest : rest.slice(0, next);
  expect(body.length, "sliced an implausibly short body").toBeGreaterThan(400);
  return body;
}

describe("the payout destination is snapshotted, never looked up live", () => {
  const body = transferBody();

  it("the executor reads NO bank field off the live provider row", () => {
    for (const phantom of [
      "provider.bankAccountNumber", "provider.bankName", "provider.bankCode",
      "provider.bankBranchCode", "provider.legalName",
    ]) {
      expect(body, `still reads ${phantom}`).not.toContain(phantom);
    }
  });

  it("it reads the destination off the payout", () => {
    expect(body).toContain("payout.providerBankAccountNumber");
    expect(body).toContain("payout.providerBankName");
  });

  it("no snapshot means REFUSE — not 'transfer to wherever the profile points'", () => {
    expect(body).toContain("destinationSnapshotAt");
    const at = body.indexOf("destinationSnapshotAt");
    // the refusal comes before any transfer work
    expect(body.slice(at, at + 500)).toContain("success: false");
  });

  it("an incomplete snapshot is refused too", () => {
    expect(body).toContain("snapshot is incomplete");
  });

  it("the snapshot columns exist in the schema and the migration", () => {
    const schema = code("shared/schema.ts");
    const mig = readFileSync(resolve(root, "migrations/0152_payout_destination_snapshot.sql"), "utf8");
    for (const col of [
      "provider_bank_code", "provider_bank_branch_code",
      "provider_bank_account_number", "provider_bank_account_holder",
      "destination_snapshot_at",
    ]) {
      expect(schema, `schema is missing ${col}`).toContain(col);
      expect(mig, `migration is missing ${col}`).toContain(col);
    }
  });

  it("nobody re-introduces the live read in the commented production block", () => {
    /**
     * The real-bank call is where the next person will start, and it lives
     * inside a block comment — so this reads the RAW file. The first version
     * of this test used the comment-stripped source: indexOf returned -1,
     * slice(-1) yielded one character, and the assertion passed VACUOUSLY
     * while the block still said provider.bankAccountNumber. Caught by
     * mutating it and watching nothing fail.
     */
    const raw = readFileSync(resolve(root, "server/services/ProviderPayoutService.ts"), "utf8");
    const at = raw.indexOf("IsraeliBankAPI.initiateTransfer");
    expect(at, "the production block is gone — re-point this pin").toBeGreaterThan(-1);
    const block = raw.slice(at, at + 500);
    expect(block, "the block still reads the live provider profile").not.toMatch(/provider\.bank|provider\.legalName/);
    expect(block).toContain("payout.providerBankAccountNumber");
  });
});
