import { describe, expect, it } from "vitest";
import {
  applyProviderCommandDecision,
  preflightProviderCommandDecision,
  type ProviderApplicationDecisionMutationInput,
  type ProviderAuditWriteInput,
  type ProviderCommandDecisionInput,
} from "../services/providerCommandCenterDecisionService";

function decisionInput(
  auditEvents: ProviderAuditWriteInput[],
  overrides: Partial<ProviderCommandDecisionInput> = {},
): ProviderCommandDecisionInput {
  return {
    applicationId: 42,
    providerId: "provider_123",
    currentState: "HUMAN_APPROVAL_REQUIRED",
    action: "APPROVE",
    reasonCode: "APPROVED_ALL_CHECKS_PASSED",
    note: "All checks passed.",
    actorUid: "admin_uid",
    actorEmail: "nir.h@petwash.co.il",
    actorType: "HUMAN_ADMIN",
    source: "COMMAND_CENTER",
    auditWriter: async (event) => {
      auditEvents.push(event);
    },
    ...overrides,
  };
}

describe("Provider Command Center decision service", () => {
  it("records management approval preflight without provider mutation or SUMIT queueing", async () => {
    const auditEvents: ProviderAuditWriteInput[] = [];

    const result = await preflightProviderCommandDecision(decisionInput(auditEvents));

    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.newState).toBe("APPROVED_FOR_SUMIT_SANDBOX");
    expect(result.decisionRecorded).toBe(true);
    expect(result.providerMutationApplied).toBe(false);
    expect(result.sumitSandboxQueued).toBe(false);
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      applicationId: 42,
      eventType: "HUMAN_APPROVED",
      actorUserId: "admin_uid",
      actorRole: "HUMAN_ADMIN",
    });
    expect(auditEvents[0].payload).toMatchObject({
      providerId: "provider_123",
      previousState: "HUMAN_APPROVAL_REQUIRED",
      newState: "APPROVED_FOR_SUMIT_SANDBOX",
      reasonCode: "APPROVED_ALL_CHECKS_PASSED",
      sumitSandboxQueued: false,
    });
  });

  it("rejects AI actors even when the requested action is otherwise approvable", async () => {
    const auditEvents: ProviderAuditWriteInput[] = [];

    const result = await preflightProviderCommandDecision(
      decisionInput(auditEvents, {
        actorUid: "ai_agent",
        actorEmail: "maya@petwash.co.il",
        actorType: "AI",
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.newState).toBe("HUMAN_APPROVAL_REQUIRED");
    expect(auditEvents[0]).toMatchObject({
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_PERMISSION",
      actorRole: "AI",
    });
    expect(auditEvents[0].payload).toMatchObject({
      message: "AI actors cannot make final provider decisions",
      sumitSandboxQueued: false,
    });
  });

  it("keeps support identities out of management approval", async () => {
    const auditEvents: ProviderAuditWriteInput[] = [];

    const result = await preflightProviderCommandDecision(
      decisionInput(auditEvents, {
        actorUid: "support_uid",
        actorEmail: "support@petwash.co.il",
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(auditEvents[0].payload).toMatchObject({
      actorEmail: "support@petwash.co.il",
      message: "Management approval is required",
    });
  });

  it("requires human reason codes and audits validation rejections", async () => {
    const auditEvents: ProviderAuditWriteInput[] = [];

    const result = await preflightProviderCommandDecision(
      decisionInput(auditEvents, {
        reasonCode: null,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(auditEvents[0]).toMatchObject({
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_VALIDATION",
    });
  });

  it("fails Slack decisions closed until live Slack approval is explicitly built", async () => {
    const auditEvents: ProviderAuditWriteInput[] = [];

    const result = await preflightProviderCommandDecision(
      decisionInput(auditEvents, {
        source: "SLACK",
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(auditEvents[0]).toMatchObject({
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_SOURCE",
    });
    expect(auditEvents[0].payload).toMatchObject({
      source: "SLACK",
      message: "Slack provider decisions are not enabled",
    });
  });

  it("applies a management approval as a command-center stage only, without activating provider or queueing SUMIT", async () => {
    const auditEvents: ProviderAuditWriteInput[] = [];
    const mutations: ProviderApplicationDecisionMutationInput[] = [];

    const result = await applyProviderCommandDecision(
      decisionInput(auditEvents, {
        decisionApplier: async (mutation) => {
          mutations.push(mutation);
          return {
            appliedStage: mutation.newState,
            providerStatus: "pending",
          };
        },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.providerMutationApplied).toBe(true);
    expect(result.appliedStage).toBe("APPROVED_FOR_SUMIT_SANDBOX");
    expect(result.providerStatus).toBe("pending");
    expect(result.sumitSandboxQueued).toBe(false);
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({
      applicationId: 42,
      providerId: "provider_123",
      previousState: "HUMAN_APPROVAL_REQUIRED",
      newState: "APPROVED_FOR_SUMIT_SANDBOX",
      action: "APPROVE",
      reasonCode: "APPROVED_ALL_CHECKS_PASSED",
    });
    expect(auditEvents[0]).toMatchObject({ eventType: "HUMAN_APPROVED" });
  });

  it("does not mutate when support attempts to apply a provider decision", async () => {
    const auditEvents: ProviderAuditWriteInput[] = [];
    const mutations: ProviderApplicationDecisionMutationInput[] = [];

    const result = await applyProviderCommandDecision(
      decisionInput(auditEvents, {
        actorUid: "support_uid",
        actorEmail: "support@petwash.co.il",
        decisionApplier: async (mutation) => {
          mutations.push(mutation);
          return {
            appliedStage: mutation.newState,
            providerStatus: "pending",
          };
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.providerMutationApplied).toBe(false);
    expect(mutations).toHaveLength(0);
    expect(auditEvents[0]).toMatchObject({
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_PERMISSION",
    });
  });

  it("does not mutate stale provider command-center states", async () => {
    const auditEvents: ProviderAuditWriteInput[] = [];
    const mutations: ProviderApplicationDecisionMutationInput[] = [];

    const result = await applyProviderCommandDecision(
      decisionInput(auditEvents, {
        currentState: "MISSING_DOCUMENTS",
        decisionApplier: async (mutation) => {
          mutations.push(mutation);
          return {
            appliedStage: mutation.newState,
            providerStatus: "pending",
          };
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(409);
    expect(result.providerMutationApplied).toBe(false);
    expect(mutations).toHaveLength(0);
  });
});
