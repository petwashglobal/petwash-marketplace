import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import {
  preflightProviderCommandDecision,
} from "../services/providerCommandCenterDecisionService";

function auditSpy() {
  return vi.fn(async () => undefined);
}

const baseInput = {
  applicationId: 42,
  providerId: "provider_42",
  currentState: "HUMAN_APPROVAL_REQUIRED" as const,
  action: "APPROVE" as const,
  reasonCode: "APPROVED_ALL_CHECKS_PASSED" as const,
  note: "All checks passed.",
  actorUid: "admin_uid",
  actorEmail: "nir.h@petwash.co.il",
  actorType: "HUMAN_ADMIN" as const,
  source: "COMMAND_CENTER" as const,
};

describe("Provider Command Center decision preflight", () => {
  it("requires a reason code for every human decision", async () => {
    const writer = auditSpy();
    const result = await preflightProviderCommandDecision({
      ...baseInput,
      reasonCode: undefined,
      auditWriter: writer,
    });

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.eventType).toBe("PROVIDER_COMMAND_DECISION_REJECTED_VALIDATION");
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_VALIDATION",
      applicationId: 42,
    }));
  });

  it("rejects AI actors even when they submit an approval-shaped request", async () => {
    const writer = auditSpy();
    const result = await preflightProviderCommandDecision({
      ...baseInput,
      actorType: "AI",
      actorEmail: "nir.h@petwash.co.il",
      auditWriter: writer,
    });

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.message).toMatch(/AI actors cannot/);
    expect(result.newState).toBe("HUMAN_APPROVAL_REQUIRED");
    expect(result.sumitSandboxQueued).toBe(false);
  });

  it("rejects support@petwash.co.il from acting as management", async () => {
    const writer = auditSpy();
    const result = await preflightProviderCommandDecision({
      ...baseInput,
      actorUid: "support_uid",
      actorEmail: "support@petwash.co.il",
      auditWriter: writer,
    });

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.message).toBe("Management approval is required");
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_PERMISSION",
      actorUserId: "support_uid",
      payload: expect.objectContaining({
        actorEmail: "support@petwash.co.il",
        sumitSandboxQueued: false,
      }),
    }));
  });

  it("approves only as a recorded preflight and does not queue SUMIT", async () => {
    const writer = auditSpy();
    const result = await preflightProviderCommandDecision({
      ...baseInput,
      auditWriter: writer,
    });

    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.previousState).toBe("HUMAN_APPROVAL_REQUIRED");
    expect(result.newState).toBe("APPROVED_FOR_SUMIT_SANDBOX");
    expect(result.sumitSandboxQueued).toBe(false);
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "HUMAN_APPROVED",
      applicationId: 42,
      payload: expect.objectContaining({
        previousState: "HUMAN_APPROVAL_REQUIRED",
        newState: "APPROVED_FOR_SUMIT_SANDBOX",
        reasonCode: "APPROVED_ALL_CHECKS_PASSED",
        sumitSandboxQueued: false,
      }),
    }));
  });

  it("rejects stale/current-state mismatch before applying a decision", async () => {
    const writer = auditSpy();
    const result = await preflightProviderCommandDecision({
      ...baseInput,
      currentState: "MISSING_DOCUMENTS",
      auditWriter: writer,
    });

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(409);
    expect(result.eventType).toBe("PROVIDER_COMMAND_DECISION_REJECTED_STALE_STATE");
    expect(result.newState).toBe("MISSING_DOCUMENTS");
  });

  it("maps hold reason codes to the correct review state", async () => {
    const writer = auditSpy();
    const result = await preflightProviderCommandDecision({
      ...baseInput,
      action: "HOLD",
      reasonCode: "TAX_STATUS_UNCLEAR",
      note: "Accountant must confirm tax status.",
      auditWriter: writer,
    });

    expect(result.ok).toBe(true);
    expect(result.eventType).toBe("HUMAN_HELD");
    expect(result.newState).toBe("ACCOUNTANT_REVIEW_REQUIRED");
  });
});

describe("Provider Command Center route source guards", () => {
  const routeSource = fs.readFileSync(
    path.resolve(process.cwd(), "server/routes/provider-command-center.ts"),
    "utf8",
  );
  const routesSource = fs.readFileSync(path.resolve(process.cwd(), "server/routes.ts"), "utf8");
  const serviceSource = fs.readFileSync(
    path.resolve(process.cwd(), "server/services/providerCommandCenterDecisionService.ts"),
    "utf8",
  );

  it("mounts the preflight route behind Firebase and admin controls", () => {
    expect(routesSource).toContain("app.use('/api/provider-command-center', validateFirebaseToken");
    expect(routesSource).toContain("requireAdminMfa");
    expect(routesSource).toContain("requireRole('admin', 'management')");
  });

  it("does not import live Slack, SUMIT, wallet, Nayax, or K9000 integrations", () => {
    const combined = `${routeSource}\n${serviceSource}`;
    expect(combined).not.toMatch(/from\s+["'][^"']*(SumitClient|slack|wallet|nayax|k9000)[^"']*["']/i);
    expect(combined).not.toMatch(/\b(sumitClient|createSubBusiness|postMessage|chat\.postMessage|WalletService|generateSignedRedeemToken)\b/);
  });

  it("uses the existing provider review audit pattern", () => {
    expect(serviceSource).toContain('await import("./providerAudit")');
    expect(serviceSource).toContain("writeProviderAudit(input)");
    expect(serviceSource).not.toContain("INSERT INTO provider_review_audit");
  });
});
