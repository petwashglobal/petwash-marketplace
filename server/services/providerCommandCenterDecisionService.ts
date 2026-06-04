import {
  isManagementIdentity,
  validateHumanDecisionRequest,
  type ProviderCommandActorType,
  type ProviderCommandCenterStatus,
  type ProviderDecisionAction,
  type ProviderDecisionReasonCode,
  type ProviderDecisionRequest,
} from "../../shared/providerCommandCenter";

export interface ProviderAuditWriteInput {
  applicationId: number;
  eventType: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  payload?: Record<string, unknown> | null;
}

export type ProviderAuditWriter = (input: ProviderAuditWriteInput) => Promise<void>;

export interface ProviderApplicationDecisionMutationInput {
  applicationId: number;
  providerId: string;
  previousState: ProviderCommandCenterStatus;
  newState: ProviderCommandCenterStatus;
  action: ProviderDecisionAction;
  reasonCode: ProviderDecisionReasonCode;
  note?: string | null;
  actorUid: string;
  actorEmail: string;
  requestIp?: string | null;
  userAgent?: string | null;
}

export interface ProviderApplicationDecisionMutationResult {
  appliedStage: ProviderCommandCenterStatus;
  providerStatus: "pending" | "rejected";
}

export type ProviderApplicationDecisionApplier = (
  input: ProviderApplicationDecisionMutationInput,
) => Promise<ProviderApplicationDecisionMutationResult>;

export interface ProviderCommandDecisionInput {
  applicationId: number;
  providerId: string;
  currentState: ProviderCommandCenterStatus;
  action: ProviderDecisionAction;
  reasonCode?: ProviderDecisionReasonCode | null;
  note?: string | null;
  actorUid: string;
  actorEmail: string;
  actorType?: ProviderCommandActorType;
  source: "COMMAND_CENTER" | "SLACK";
  auditWriter?: ProviderAuditWriter;
  decisionApplier?: ProviderApplicationDecisionApplier;
  requestIp?: string | null;
  userAgent?: string | null;
}

export interface ProviderCommandDecisionResult {
  ok: boolean;
  statusCode: number;
  decisionRecorded: boolean;
  providerMutationApplied: false;
  previousState: ProviderCommandCenterStatus;
  newState: ProviderCommandCenterStatus;
  reasonCode: ProviderDecisionReasonCode | null;
  eventType: string;
  message: string;
  sumitSandboxQueued: false;
}

export interface ProviderCommandDecisionApplyResult extends ProviderCommandDecisionResult {
  providerMutationApplied: boolean;
  providerStatus?: "pending" | "rejected";
  appliedStage?: ProviderCommandCenterStatus;
}

const APPROVAL_READY_STATE: ProviderCommandCenterStatus = "HUMAN_APPROVAL_REQUIRED";

export async function preflightProviderCommandDecision(
  input: ProviderCommandDecisionInput,
): Promise<ProviderCommandDecisionResult> {
  const auditWriter = input.auditWriter ?? writeProviderAuditDefault;

  const request: ProviderDecisionRequest = {
    providerId: input.providerId,
    action: input.action,
    reasonCode: input.reasonCode,
    note: input.note,
    actorId: input.actorUid,
    source: input.source,
  };

  const validation = validateHumanDecisionRequest(request);
  if (!validation.ok) {
    await auditDecision(auditWriter, input, {
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_VALIDATION",
      newState: input.currentState,
      message: validation.reason,
    });
    return result(input, {
      ok: false,
      statusCode: 400,
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_VALIDATION",
      newState: input.currentState,
      message: validation.reason,
    });
  }

  if (input.source === "SLACK") {
    await auditDecision(auditWriter, input, {
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_SOURCE",
      newState: input.currentState,
      message: "Slack provider decisions are not enabled",
    });
    return result(input, {
      ok: false,
      statusCode: 400,
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_SOURCE",
      newState: input.currentState,
      message: "Slack provider decisions are not enabled",
    });
  }

  if (input.actorType === "AI") {
    await auditDecision(auditWriter, input, {
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_PERMISSION",
      newState: input.currentState,
      message: "AI actors cannot make final provider decisions",
    });
    return result(input, {
      ok: false,
      statusCode: 403,
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_PERMISSION",
      newState: input.currentState,
      message: "AI actors cannot make final provider decisions",
    });
  }

  if (!isManagementIdentity(input.actorEmail)) {
    await auditDecision(auditWriter, input, {
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_PERMISSION",
      newState: input.currentState,
      message: "Management approval is required",
    });
    return result(input, {
      ok: false,
      statusCode: 403,
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_PERMISSION",
      newState: input.currentState,
      message: "Management approval is required",
    });
  }

  if (input.currentState !== APPROVAL_READY_STATE) {
    await auditDecision(auditWriter, input, {
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_STALE_STATE",
      newState: input.currentState,
      message: `Provider is not in ${APPROVAL_READY_STATE}`,
    });
    return result(input, {
      ok: false,
      statusCode: 409,
      eventType: "PROVIDER_COMMAND_DECISION_REJECTED_STALE_STATE",
      newState: input.currentState,
      message: `Provider is not in ${APPROVAL_READY_STATE}`,
    });
  }

  const newState = nextStateForDecision(input.action, input.reasonCode!);
  const eventType = eventTypeForDecision(input.action);

  await auditDecision(auditWriter, input, {
    eventType,
    newState,
    message: "Provider command decision preflight recorded",
  });

  return result(input, {
    ok: true,
    statusCode: 200,
    eventType,
    newState,
    message: "Provider command decision preflight recorded",
  });
}

export async function applyProviderCommandDecision(
  input: ProviderCommandDecisionInput,
): Promise<ProviderCommandDecisionApplyResult> {
  const preflight = await preflightProviderCommandDecision(input);
  if (!preflight.ok) {
    return preflight;
  }

  const decisionApplier = input.decisionApplier ?? applyProviderApplicationDecisionDefault;
  const mutation = await decisionApplier({
    applicationId: input.applicationId,
    providerId: input.providerId,
    previousState: input.currentState,
    newState: preflight.newState,
    action: input.action,
    reasonCode: input.reasonCode!,
    note: input.note,
    actorUid: input.actorUid,
    actorEmail: input.actorEmail,
    requestIp: input.requestIp ?? null,
    userAgent: input.userAgent ?? null,
  });

  return {
    ...preflight,
    message: "Provider command decision applied",
    providerMutationApplied: true,
    providerStatus: mutation.providerStatus,
    appliedStage: mutation.appliedStage,
  };
}

function nextStateForDecision(
  action: ProviderDecisionAction,
  reasonCode: ProviderDecisionReasonCode,
): ProviderCommandCenterStatus {
  if (action === "APPROVE") return "APPROVED_FOR_SUMIT_SANDBOX";
  if (action === "REJECT") return "REJECTED";

  if (
    reasonCode === "TAX_STATUS_UNCLEAR" ||
    reasonCode === "BOOKKEEPING_CERTIFICATE_MISSING" ||
    reasonCode === "WITHHOLDING_CERTIFICATE_MISSING" ||
    reasonCode === "ACCOUNTANT_REVIEW_REQUIRED"
  ) {
    return "ACCOUNTANT_REVIEW_REQUIRED";
  }

  if (
    reasonCode === "MISSING_DOCUMENTS" ||
    reasonCode === "CONTRACT_NOT_SIGNED" ||
    reasonCode === "TRAINING_NOT_COMPLETE"
  ) {
    return "MISSING_DOCUMENTS";
  }

  return "COMPLIANCE_REVIEW_REQUIRED";
}

function eventTypeForDecision(action: ProviderDecisionAction): string {
  if (action === "APPROVE") return "HUMAN_APPROVED";
  if (action === "REJECT") return "HUMAN_REJECTED";
  return "HUMAN_HELD";
}

async function auditDecision(
  auditWriter: ProviderAuditWriter,
  input: ProviderCommandDecisionInput,
  outcome: { eventType: string; newState: ProviderCommandCenterStatus; message: string },
): Promise<void> {
  await auditWriter({
    applicationId: input.applicationId,
    eventType: outcome.eventType,
    actorUserId: input.actorUid,
    actorRole: input.actorType ?? "HUMAN_ADMIN",
    payload: {
      providerId: input.providerId,
      source: input.source,
      action: input.action,
      previousState: input.currentState,
      newState: outcome.newState,
      reasonCode: input.reasonCode ?? null,
      note: input.note ?? null,
      actorEmail: input.actorEmail.toLowerCase(),
      message: outcome.message,
      sumitSandboxQueued: false,
    },
  });
}

async function writeProviderAuditDefault(input: ProviderAuditWriteInput): Promise<void> {
  const { writeProviderAudit } = await import("./providerAudit");
  await writeProviderAudit(input);
}

async function applyProviderApplicationDecisionDefault(
  input: ProviderApplicationDecisionMutationInput,
): Promise<ProviderApplicationDecisionMutationResult> {
  const crypto = await import("crypto");
  const { desc, eq } = await import("drizzle-orm");
  const { db } = await import("../db");
  const { providerApplicants, providerStageTransitions } = await import("@shared/schema-enterprise");

  const now = new Date();
  const providerStatus: "pending" | "rejected" = input.action === "REJECT" ? "rejected" : "pending";
  const safeNote = input.note?.trim() ? input.note.trim() : null;

  const updateValues: Record<string, unknown> = {
    stage: input.newState,
    lastUpdatedAt: now,
    stageChangedAt: now,
    reviewerNotes: safeNote,
  };

  if (input.action === "REJECT") {
    updateValues.status = "rejected";
    updateValues.rejectionReason = safeNote ?? input.reasonCode;
    updateValues.rejectedAt = now;
  }

  await db.update(providerApplicants)
    .set(updateValues)
    .where(eq(providerApplicants.id, input.applicationId));

  const [lastTransition] = await db.select()
    .from(providerStageTransitions)
    .where(eq(providerStageTransitions.applicantId, input.applicationId))
    .orderBy(desc(providerStageTransitions.createdAt))
    .limit(1);

  const previousHash = lastTransition?.transitionHash ?? null;
  const transitionData = JSON.stringify({
    applicantId: input.applicationId,
    fromStage: input.previousState,
    toStage: input.newState,
    actorUid: input.actorUid,
    reasonCode: input.reasonCode,
    timestamp: now.toISOString(),
    previousHash,
  });
  const transitionHash = crypto.createHash("sha256").update(transitionData).digest("hex");

  await db.insert(providerStageTransitions).values({
    applicantId: input.applicationId,
    fromStage: input.previousState,
    toStage: input.newState,
    transitionReason: `Command Center ${input.action}: ${input.reasonCode}`,
    triggeredByUid: input.actorUid,
    triggeredBySystem: false,
    metadata: {
      source: "PROVIDER_COMMAND_CENTER",
      providerId: input.providerId,
      action: input.action,
      reasonCode: input.reasonCode,
      note: safeNote,
      actorEmail: input.actorEmail.toLowerCase(),
      sumitSandboxQueued: false,
      providerStatus,
    },
    ipAddress: input.requestIp ?? null,
    userAgent: input.userAgent ?? null,
    previousHash,
    transitionHash,
  });

  return {
    appliedStage: input.newState,
    providerStatus,
  };
}

function result(
  input: ProviderCommandDecisionInput,
  outcome: {
    ok: boolean;
    statusCode: number;
    eventType: string;
    newState: ProviderCommandCenterStatus;
    message: string;
  },
): ProviderCommandDecisionResult {
  return {
    ok: outcome.ok,
    statusCode: outcome.statusCode,
    decisionRecorded: outcome.ok,
    providerMutationApplied: false,
    previousState: input.currentState,
    newState: outcome.newState,
    reasonCode: input.reasonCode ?? null,
    eventType: outcome.eventType,
    message: outcome.message,
    sumitSandboxQueued: false,
  };
}
