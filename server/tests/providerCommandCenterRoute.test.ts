import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  createProviderCommandCenterRouter,
  type ProviderCommandCenterActor,
  type ProviderCommandCenterApplication,
} from "../routes/provider-command-center";
import type {
  ProviderApplicationDecisionMutationInput,
  ProviderAuditWriteInput,
} from "../services/providerCommandCenterDecisionService";

function makeApp(options: {
  actor?: ProviderCommandCenterActor | null;
  application?: ProviderCommandCenterApplication | null;
  auditEvents?: ProviderAuditWriteInput[];
  mutations?: ProviderApplicationDecisionMutationInput[];
}) {
  const app = express();
  const auditEvents = options.auditEvents ?? [];
  const mutations = options.mutations ?? [];

  app.use(express.json());
  app.use(
    "/api/provider-command-center",
    createProviderCommandCenterRouter({
      resolveActor: () => options.actor ?? null,
      loadApplication: async () => options.application ?? null,
      auditWriter: async (event) => {
        auditEvents.push(event);
      },
      decisionApplier: async (mutation) => {
        mutations.push(mutation);
        return {
          appliedStage: mutation.newState,
          providerStatus: mutation.action === "REJECT" ? "rejected" : "pending",
        };
      },
    }),
  );

  return app;
}

const managementActor: ProviderCommandCenterActor = {
  uid: "admin_uid",
  email: "nir.h@petwash.co.il",
  actorType: "HUMAN_ADMIN",
};

const approvalApplication: ProviderCommandCenterApplication = {
  applicationId: 42,
  providerId: "provider_123",
  currentState: "HUMAN_APPROVAL_REQUIRED",
};

describe("Provider Command Center route", () => {
  it("preflights a management approval and writes the audit payload", async () => {
    const auditEvents: ProviderAuditWriteInput[] = [];
    const mutations: ProviderApplicationDecisionMutationInput[] = [];
    const app = makeApp({
      actor: managementActor,
      application: approvalApplication,
      auditEvents,
      mutations,
    });

    const response = await request(app)
      .post("/api/provider-command-center/admin/applications/42/decision-preflight")
      .send({
        action: "APPROVE",
        reasonCode: "APPROVED_ALL_CHECKS_PASSED",
        note: "Ready for SUMIT sandbox setup.",
      });

    expect(response.status).toBe(200);
    expect(response.body.decision).toMatchObject({
      ok: true,
      previousState: "HUMAN_APPROVAL_REQUIRED",
      newState: "APPROVED_FOR_SUMIT_SANDBOX",
      decisionRecorded: true,
      providerMutationApplied: false,
      sumitSandboxQueued: false,
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0].payload).toMatchObject({
      providerId: "provider_123",
      source: "COMMAND_CENTER",
      action: "APPROVE",
      note: "Ready for SUMIT sandbox setup.",
    });
    expect(mutations).toHaveLength(0);
  });

  it("applies a management decision through the route without activating providers or queueing SUMIT", async () => {
    const auditEvents: ProviderAuditWriteInput[] = [];
    const mutations: ProviderApplicationDecisionMutationInput[] = [];
    const app = makeApp({
      actor: managementActor,
      application: approvalApplication,
      auditEvents,
      mutations,
    });

    const response = await request(app)
      .post("/api/provider-command-center/admin/applications/42/decision")
      .set("User-Agent", "vitest-command-center")
      .send({
        action: "APPROVE",
        reasonCode: "APPROVED_ALL_CHECKS_PASSED",
        note: "Human management approval.",
      });

    expect(response.status).toBe(200);
    expect(response.body.decision).toMatchObject({
      ok: true,
      previousState: "HUMAN_APPROVAL_REQUIRED",
      newState: "APPROVED_FOR_SUMIT_SANDBOX",
      providerMutationApplied: true,
      providerStatus: "pending",
      sumitSandboxQueued: false,
    });
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({
      action: "APPROVE",
      newState: "APPROVED_FOR_SUMIT_SANDBOX",
      reasonCode: "APPROVED_ALL_CHECKS_PASSED",
      userAgent: "vitest-command-center",
    });
    expect(auditEvents[0]).toMatchObject({ eventType: "HUMAN_APPROVED" });
  });

  it("returns 401 before loading application context when no actor is present", async () => {
    const app = makeApp({
      actor: null,
      application: approvalApplication,
    });

    const response = await request(app)
      .post("/api/provider-command-center/admin/applications/42/decision-preflight")
      .send({
        action: "APPROVE",
        reasonCode: "APPROVED_ALL_CHECKS_PASSED",
      });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: "AUTHENTICATION_REQUIRED" });
  });

  it("rejects support approval while still writing a denied audit event", async () => {
    const auditEvents: ProviderAuditWriteInput[] = [];
    const mutations: ProviderApplicationDecisionMutationInput[] = [];
    const app = makeApp({
      actor: {
        uid: "support_uid",
        email: "support@petwash.co.il",
        actorType: "HUMAN_ADMIN",
      },
      application: approvalApplication,
      auditEvents,
      mutations,
    });

    const response = await request(app)
      .post("/api/provider-command-center/admin/applications/42/decision")
      .send({
        action: "APPROVE",
        reasonCode: "APPROVED_ALL_CHECKS_PASSED",
      });

    expect(response.status).toBe(403);
    expect(response.body.decision).toMatchObject({
      ok: false,
      newState: "HUMAN_APPROVAL_REQUIRED",
      providerMutationApplied: false,
    });
    expect(auditEvents[0]).toMatchObject({
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_PERMISSION",
      actorUserId: "support_uid",
    });
    expect(mutations).toHaveLength(0);
  });

  it("fails closed on mismatched provider/application identifiers", async () => {
    const auditEvents: ProviderAuditWriteInput[] = [];
    const app = makeApp({
      actor: managementActor,
      application: approvalApplication,
      auditEvents,
    });

    const response = await request(app)
      .post("/api/provider-command-center/admin/applications/42/decision-preflight")
      .send({
        providerId: "different_provider",
        action: "APPROVE",
        reasonCode: "APPROVED_ALL_CHECKS_PASSED",
      });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ error: "PROVIDER_APPLICATION_MISMATCH" });
    expect(auditEvents).toHaveLength(0);
  });
});
