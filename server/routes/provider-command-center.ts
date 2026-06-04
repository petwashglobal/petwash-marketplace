import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  type ProviderCommandActorType,
  type ProviderCommandCenterStatus,
} from "../../shared/providerCommandCenter";
import {
  applyProviderCommandDecision,
  preflightProviderCommandDecision,
  type ProviderApplicationDecisionApplier,
  type ProviderAuditWriter,
} from "../services/providerCommandCenterDecisionService";

const providerCommandCenterStatuses = [
  "DRAFT",
  "SUBMITTED",
  "AI_REVIEW_IN_PROGRESS",
  "AI_REVIEWED",
  "MISSING_DOCUMENTS",
  "ACCOUNTANT_REVIEW_REQUIRED",
  "COMPLIANCE_REVIEW_REQUIRED",
  "HUMAN_APPROVAL_REQUIRED",
  "APPROVED_FOR_SUMIT_SANDBOX",
  "SUMIT_SANDBOX_CREATE_QUEUED",
  "SUMIT_SANDBOX_CREATED",
  "SUMIT_SANDBOX_CREATE_FAILED",
  "REJECTED",
  "BLOCKED",
  "ACTIVATION_READY",
] as const;

const providerDecisionReasonCodes = [
  "APPROVED_ALL_CHECKS_PASSED",
  "APPROVED_MINOR_NON_BLOCKING_NOTE",
  "APPROVED_ACCOUNTANT_CONFIRMED",
  "APPROVED_COMPLIANCE_CONFIRMED",
  "MISSING_DOCUMENTS",
  "TAX_STATUS_UNCLEAR",
  "BOOKKEEPING_CERTIFICATE_MISSING",
  "WITHHOLDING_CERTIFICATE_MISSING",
  "BUSINESS_ID_MISSING",
  "BUSINESS_ID_MISMATCH",
  "INSURANCE_MISSING",
  "INSURANCE_EXPIRED",
  "LICENCE_MISSING",
  "LICENCE_EXPIRED",
  "CONTRACT_NOT_SIGNED",
  "TRAINING_NOT_COMPLETE",
  "ACCOUNTANT_REVIEW_REQUIRED",
  "COMPLIANCE_REVIEW_REQUIRED",
  "MANUAL_REVIEW_REQUIRED",
  "ID_LIVENESS_FAILED",
  "ID_DOCUMENT_FAILED",
  "BIOMETRIC_MISMATCH",
  "DUPLICATE_PROVIDER_RISK",
  "DOCUMENT_TAMPERING_RISK",
  "FRAUD_RISK_TOO_HIGH",
  "PROVIDER_NOT_ELIGIBLE",
  "REJECTED_RISK_TOO_HIGH",
  "LEGAL_BLOCK",
  "PRIVACY_RISK",
  "SECURITY_RISK",
] as const;

const actorTypes = [
  "SYSTEM",
  "AI",
  "HUMAN_ADMIN",
  "ACCOUNTANT",
  "COMPLIANCE",
  "SLACK_USER",
  "SUMIT_ADAPTER",
] as const;

const decisionSchema = z.object({
  providerId: z.string().min(1).optional(),
  currentState: z.enum(providerCommandCenterStatuses).optional(),
  action: z.enum(["APPROVE", "HOLD", "REJECT"]),
  reasonCode: z.enum(providerDecisionReasonCodes).nullable().optional(),
  note: z.string().max(2_000).nullable().optional(),
  source: z.enum(["COMMAND_CENTER", "SLACK"]).default("COMMAND_CENTER"),
});

export interface ProviderCommandCenterActor {
  uid: string;
  email: string;
  actorType?: ProviderCommandActorType;
}

export interface ProviderCommandCenterApplication {
  applicationId: number;
  providerId: string;
  currentState: ProviderCommandCenterStatus;
}

export interface ProviderCommandCenterRouterDeps {
  loadApplication?: (applicationId: number) => Promise<ProviderCommandCenterApplication | null>;
  resolveActor?: (req: Request) => ProviderCommandCenterActor | null;
  auditWriter?: ProviderAuditWriter;
  decisionApplier?: ProviderApplicationDecisionApplier;
}

export function createProviderCommandCenterRouter(deps: ProviderCommandCenterRouterDeps = {}) {
  const router = Router();
  const loadApplication = deps.loadApplication ?? loadProviderApplicationForDecision;
  const resolveActor = deps.resolveActor ?? resolveFirebaseActor;

  router.post("/admin/applications/:applicationId/decision-preflight", async (req, res) => {
    return handleProviderDecision(req, res, { apply: false });
  });

  router.post("/admin/applications/:applicationId/decision", async (req, res) => {
    return handleProviderDecision(req, res, { apply: true });
  });

  async function handleProviderDecision(req: Request, res: Response, options: { apply: boolean }) {
    const applicationId = Number.parseInt(req.params.applicationId, 10);
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return res.status(400).json({ error: "INVALID_APPLICATION_ID" });
    }

    const parsed = decisionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "INVALID_PROVIDER_DECISION",
        details: parsed.error.flatten(),
      });
    }

    const actor = resolveActor(req);
    if (!actor?.uid || !actor.email) {
      return res.status(401).json({ error: "AUTHENTICATION_REQUIRED" });
    }

    const application = await loadApplication(applicationId);
    if (!application) {
      return res.status(404).json({ error: "PROVIDER_APPLICATION_NOT_FOUND" });
    }

    const body = parsed.data;
    if (body.providerId && body.providerId !== application.providerId) {
      return res.status(409).json({ error: "PROVIDER_APPLICATION_MISMATCH" });
    }

    const decisionInput = {
      applicationId,
      providerId: application.providerId,
      currentState: body.currentState ?? application.currentState,
      action: body.action,
      reasonCode: body.reasonCode,
      note: body.note,
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorType: actor.actorType ?? "HUMAN_ADMIN",
      source: body.source,
      auditWriter: deps.auditWriter,
      decisionApplier: deps.decisionApplier,
      requestIp: req.ip ?? req.headers["x-forwarded-for"]?.toString() ?? null,
      userAgent: req.headers["user-agent"]?.toString() ?? null,
    };

    const result = options.apply
      ? await applyProviderCommandDecision(decisionInput)
      : await preflightProviderCommandDecision(decisionInput);

    return res.status(result.statusCode).json({
      ok: result.ok,
      decision: result,
    });
  }

  return router;
}

function resolveFirebaseActor(req: Request): ProviderCommandCenterActor | null {
  const firebaseUser = (req as any).firebaseUser ?? {};
  const uid = firebaseUser.uid ?? (req as any).userId ?? (req as any).user?.uid;
  const email = firebaseUser.email ?? (req as any).userEmail ?? (req as any).user?.email;

  if (!uid || !email) {
    return null;
  }

  return {
    uid: String(uid),
    email: String(email),
    actorType: actorTypes.includes((firebaseUser.actorType ?? "") as any)
      ? firebaseUser.actorType
      : "HUMAN_ADMIN",
  };
}

async function loadProviderApplicationForDecision(applicationId: number): Promise<ProviderCommandCenterApplication | null> {
  const { db } = await import("../db");
  const { providerApplicants } = await import("@shared/schema-enterprise");

  const [application] = await db
    .select({
      id: providerApplicants.id,
      userId: providerApplicants.userId,
      status: providerApplicants.status,
      stage: providerApplicants.stage,
    })
    .from(providerApplicants)
    .where(eq(providerApplicants.id, applicationId))
    .limit(1);

  if (!application) {
    return null;
  }

  return {
    applicationId: application.id,
    providerId: application.userId,
    currentState: mapProviderApplicationState(application.status, application.stage),
  };
}

function mapProviderApplicationState(status: string | null, stage: string | null): ProviderCommandCenterStatus {
  if (status === "approved") return "APPROVED_FOR_SUMIT_SANDBOX";
  if (status === "rejected") return "REJECTED";

  const normalizedStage = (stage ?? "").toUpperCase();
  if ((providerCommandCenterStatuses as readonly string[]).includes(normalizedStage)) {
    return normalizedStage as ProviderCommandCenterStatus;
  }

  return "HUMAN_APPROVAL_REQUIRED";
}

export default createProviderCommandCenterRouter();
