export const PROVIDER_COMMAND_CENTER_VERSION = "provider-command-center-v1";

export type ProviderCommandCenterStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "AI_REVIEW_IN_PROGRESS"
  | "AI_REVIEWED"
  | "MISSING_DOCUMENTS"
  | "ACCOUNTANT_REVIEW_REQUIRED"
  | "COMPLIANCE_REVIEW_REQUIRED"
  | "HUMAN_APPROVAL_REQUIRED"
  | "APPROVED_FOR_SUMIT_SANDBOX"
  | "SUMIT_SANDBOX_CREATE_QUEUED"
  | "SUMIT_SANDBOX_CREATED"
  | "SUMIT_SANDBOX_CREATE_FAILED"
  | "REJECTED"
  | "BLOCKED"
  | "ACTIVATION_READY";

export type ProviderDecisionAction = "APPROVE" | "HOLD" | "REJECT";

export type ProviderDecisionReasonCode =
  | "APPROVED_ALL_CHECKS_PASSED"
  | "APPROVED_MINOR_NON_BLOCKING_NOTE"
  | "APPROVED_ACCOUNTANT_CONFIRMED"
  | "APPROVED_COMPLIANCE_CONFIRMED"
  | "MISSING_DOCUMENTS"
  | "TAX_STATUS_UNCLEAR"
  | "BOOKKEEPING_CERTIFICATE_MISSING"
  | "WITHHOLDING_CERTIFICATE_MISSING"
  | "BUSINESS_ID_MISSING"
  | "BUSINESS_ID_MISMATCH"
  | "INSURANCE_MISSING"
  | "INSURANCE_EXPIRED"
  | "LICENCE_MISSING"
  | "LICENCE_EXPIRED"
  | "CONTRACT_NOT_SIGNED"
  | "TRAINING_NOT_COMPLETE"
  | "ACCOUNTANT_REVIEW_REQUIRED"
  | "COMPLIANCE_REVIEW_REQUIRED"
  | "MANUAL_REVIEW_REQUIRED"
  | "ID_LIVENESS_FAILED"
  | "ID_DOCUMENT_FAILED"
  | "BIOMETRIC_MISMATCH"
  | "DUPLICATE_PROVIDER_RISK"
  | "DOCUMENT_TAMPERING_RISK"
  | "FRAUD_RISK_TOO_HIGH"
  | "PROVIDER_NOT_ELIGIBLE"
  | "REJECTED_RISK_TOO_HIGH"
  | "LEGAL_BLOCK"
  | "PRIVACY_RISK"
  | "SECURITY_RISK";

export type ProviderRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";

export type ProviderSuggestedRoute =
  | "MISSING_DOCUMENTS"
  | "ACCOUNTANT_REVIEW_REQUIRED"
  | "COMPLIANCE_REVIEW_REQUIRED"
  | "HUMAN_APPROVAL_REQUIRED"
  | "BLOCKED";

export type ProviderCommandActorType =
  | "SYSTEM"
  | "AI"
  | "HUMAN_ADMIN"
  | "ACCOUNTANT"
  | "COMPLIANCE"
  | "SLACK_USER"
  | "SUMIT_ADAPTER";

export interface AIReviewSummary {
  providerId: string;
  extractedFields: Record<string, unknown>;
  documentsDetected: string[];
  requiredDocumentsPresent: boolean;
  missingDocuments: string[];
  expiryDates: Record<string, string | null>;
  taxStatusExtracted: string | null;
  bookkeepingCertificateDetected: boolean;
  withholdingTaxCertificateDetected: boolean;
  businessIdDetected: boolean;
  identityDocumentDetected: boolean;
  livenessStatus: "not_run" | "passed" | "failed" | "needs_review";
  biometricMatchStatus: "not_run" | "passed" | "failed" | "needs_review";
  ocrConfidence: number;
  riskLevel: ProviderRiskLevel;
  riskWarnings: string[];
  suggestedRoute: ProviderSuggestedRoute;
  humanReadableSummary: string;
}

export interface ProviderRuleFacts {
  identityVerified: boolean;
  livenessPassed: boolean;
  biometricMatchPassed: boolean;
  requiredDocumentsValid: boolean;
  taxStatusAcceptable: boolean;
  accountantReviewPassed: boolean;
  insuranceValid: boolean;
  licenceValid: boolean;
  contractSigned: boolean;
  trainingComplete: boolean;
  privacyConsentCaptured: boolean;
  declarationsComplete: boolean;
  adminApprovalGranted: boolean;
  noActiveWatchdogHold: boolean;
  duplicateIdentityRisk?: boolean;
  documentTamperingRisk?: boolean;
}

export interface ProviderRuleDecision {
  status: ProviderCommandCenterStatus;
  reasonCode: ProviderDecisionReasonCode;
  alertChannels: SlackAlertChannel[];
  requiresHumanDecision: boolean;
}

export type SlackAlertChannel =
  | "#customer-alerts"
  | "#provider-alerts"
  | "#system-alerts"
  | "#urgent-live-issues"
  | "#support-inbox"
  | "#management"
  | "#board"
  | "#supplier-invoices"
  | "#payments-approvals"
  | "#security-privacy"
  | "#compliance-review"
  | "#provider-approvals"
  | "#legal-accounting";

export interface ProviderAuditEvent {
  id: string;
  providerId: string;
  eventType: string;
  actorType: ProviderCommandActorType;
  actorId: string;
  previousState: ProviderCommandCenterStatus | null;
  newState: ProviderCommandCenterStatus;
  reasonCode: ProviderDecisionReasonCode | null;
  note: string | null;
  metadata: Record<string, unknown>;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface ProviderDecisionRequest {
  providerId: string;
  action: ProviderDecisionAction;
  reasonCode?: ProviderDecisionReasonCode | null;
  note?: string | null;
  actorId: string;
  source: "COMMAND_CENTER" | "SLACK";
}

export interface ProviderApprovalSnapshot {
  providerId: string;
  status: ProviderCommandCenterStatus;
  approvalVersion: number;
  identityVerified: boolean;
  livenessPassed: boolean;
  requiredDocumentsValid: boolean;
  contractSigned: boolean;
  adminApprovalGranted: boolean;
  noActiveWatchdogHold: boolean;
  externalSumitProviderId?: string | null;
}

export interface SumitSandboxQueueRecord {
  idempotencyKey: string;
  providerId: string;
  approvalVersion: number;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
}

export function aiMayApproveProvider(): false {
  return false;
}

export function buildSumitProviderCreateIdempotencyKey(providerId: string, approvalVersion: number): string {
  return `sumit_provider_create:provider_${providerId}:approval_${approvalVersion}`;
}

export function canQueueSumitSandboxCreate(provider: ProviderApprovalSnapshot): boolean {
  return (
    provider.status === "APPROVED_FOR_SUMIT_SANDBOX" &&
    provider.identityVerified === true &&
    provider.livenessPassed === true &&
    provider.requiredDocumentsValid === true &&
    provider.contractSigned === true &&
    provider.adminApprovalGranted === true &&
    provider.noActiveWatchdogHold === true
  );
}

export function evaluateProviderCommandCenterState(
  aiReview: AIReviewSummary,
  facts: ProviderRuleFacts,
): ProviderRuleDecision {
  if (facts.duplicateIdentityRisk) {
    return decision("COMPLIANCE_REVIEW_REQUIRED", "DUPLICATE_PROVIDER_RISK", [
      "#compliance-review",
      "#security-privacy",
    ]);
  }

  if (facts.documentTamperingRisk) {
    return decision("COMPLIANCE_REVIEW_REQUIRED", "DOCUMENT_TAMPERING_RISK", [
      "#compliance-review",
      "#security-privacy",
    ]);
  }

  if (aiReview.riskLevel === "BLOCKED" || aiReview.riskLevel === "HIGH") {
    return decision("COMPLIANCE_REVIEW_REQUIRED", "MANUAL_REVIEW_REQUIRED", [
      "#compliance-review",
    ]);
  }

  if (!aiReview.requiredDocumentsPresent || aiReview.missingDocuments.length > 0) {
    return decision("MISSING_DOCUMENTS", "MISSING_DOCUMENTS", ["#provider-approvals"]);
  }

  if (!facts.identityVerified || aiReview.livenessStatus === "failed" || aiReview.biometricMatchStatus === "failed") {
    return decision("COMPLIANCE_REVIEW_REQUIRED", "ID_LIVENESS_FAILED", [
      "#compliance-review",
      "#security-privacy",
    ]);
  }

  if (!facts.taxStatusAcceptable && !facts.accountantReviewPassed) {
    return decision("ACCOUNTANT_REVIEW_REQUIRED", "TAX_STATUS_UNCLEAR", ["#legal-accounting"]);
  }

  if (!facts.insuranceValid) {
    return decision("COMPLIANCE_REVIEW_REQUIRED", "INSURANCE_MISSING", ["#compliance-review"]);
  }

  if (!facts.licenceValid) {
    return decision("COMPLIANCE_REVIEW_REQUIRED", "LICENCE_MISSING", ["#compliance-review"]);
  }

  if (!facts.contractSigned) {
    return decision("MISSING_DOCUMENTS", "CONTRACT_NOT_SIGNED", ["#provider-approvals"]);
  }

  if (!facts.trainingComplete) {
    return decision("MISSING_DOCUMENTS", "TRAINING_NOT_COMPLETE", ["#provider-approvals"]);
  }

  if (!facts.privacyConsentCaptured || !facts.declarationsComplete) {
    return decision("COMPLIANCE_REVIEW_REQUIRED", "COMPLIANCE_REVIEW_REQUIRED", ["#compliance-review"]);
  }

  return decision("HUMAN_APPROVAL_REQUIRED", "APPROVED_ALL_CHECKS_PASSED", ["#provider-approvals"]);
}

export function validateHumanDecisionRequest(request: ProviderDecisionRequest): { ok: true } | { ok: false; reason: string } {
  if (!request.reasonCode) {
    return { ok: false, reason: "reason code is required" };
  }

  if (request.action === "REJECT" && !request.note?.trim()) {
    return { ok: false, reason: "reject requires a note" };
  }

  return { ok: true };
}

export function enqueueSumitSandboxCreate(
  existing: readonly SumitSandboxQueueRecord[],
  provider: ProviderApprovalSnapshot,
  nowIso: string,
): { records: SumitSandboxQueueRecord[]; record: SumitSandboxQueueRecord | null; created: boolean; reason?: string } {
  if (!canQueueSumitSandboxCreate(provider)) {
    return {
      records: [...existing],
      record: null,
      created: false,
      reason: "provider is not eligible for SUMIT sandbox queue",
    };
  }

  const idempotencyKey = buildSumitProviderCreateIdempotencyKey(provider.providerId, provider.approvalVersion);
  const found = existing.find((row) => row.idempotencyKey === idempotencyKey);
  if (found) {
    return { records: [...existing], record: found, created: false };
  }

  const record: SumitSandboxQueueRecord = {
    idempotencyKey,
    providerId: provider.providerId,
    approvalVersion: provider.approvalVersion,
    status: "queued",
    createdAt: nowIso,
  };

  return { records: [...existing, record], record, created: true };
}

export function routeProviderAlert(decisionResult: ProviderRuleDecision): SlackAlertChannel[] {
  return decisionResult.alertChannels;
}

export function isManagementIdentity(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return normalized === "nir.h@petwash.co.il" || normalized === "ido.s@petwash.co.il";
}

function decision(
  status: ProviderCommandCenterStatus,
  reasonCode: ProviderDecisionReasonCode,
  alertChannels: SlackAlertChannel[],
): ProviderRuleDecision {
  return {
    status,
    reasonCode,
    alertChannels,
    requiresHumanDecision: true,
  };
}
