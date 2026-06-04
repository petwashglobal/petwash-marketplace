import { describe, expect, it } from "vitest";
import {
  aiMayApproveProvider,
  buildSumitProviderCreateIdempotencyKey,
  canQueueSumitSandboxCreate,
  enqueueSumitSandboxCreate,
  evaluateProviderCommandCenterState,
  isManagementIdentity,
  type AIReviewSummary,
  type ProviderRuleFacts,
} from "../../shared/providerCommandCenter";

function cleanAiReview(overrides: Partial<AIReviewSummary> = {}): AIReviewSummary {
  return {
    providerId: "provider_123",
    extractedFields: {},
    documentsDetected: ["identity", "bookkeeping", "insurance"],
    requiredDocumentsPresent: true,
    missingDocuments: [],
    expiryDates: {},
    taxStatusExtracted: "osek_murshe",
    bookkeepingCertificateDetected: true,
    withholdingTaxCertificateDetected: true,
    businessIdDetected: true,
    identityDocumentDetected: true,
    livenessStatus: "passed",
    biometricMatchStatus: "passed",
    ocrConfidence: 94,
    riskLevel: "LOW",
    riskWarnings: [],
    suggestedRoute: "HUMAN_APPROVAL_REQUIRED",
    humanReadableSummary: "All checks look ready for human review.",
    ...overrides,
  };
}

function cleanFacts(overrides: Partial<ProviderRuleFacts> = {}): ProviderRuleFacts {
  return {
    identityVerified: true,
    livenessPassed: true,
    biometricMatchPassed: true,
    requiredDocumentsValid: true,
    taxStatusAcceptable: true,
    accountantReviewPassed: false,
    insuranceValid: true,
    licenceValid: true,
    contractSigned: true,
    trainingComplete: true,
    privacyConsentCaptured: true,
    declarationsComplete: true,
    adminApprovalGranted: false,
    noActiveWatchdogHold: true,
    ...overrides,
  };
}

describe("Provider Command Center foundation", () => {
  it("AI can never approve a provider", () => {
    expect(aiMayApproveProvider()).toBe(false);
  });

  it("routes a clean AI review to human approval, not final approval", () => {
    const result = evaluateProviderCommandCenterState(cleanAiReview(), cleanFacts());

    expect(result.status).toBe("HUMAN_APPROVAL_REQUIRED");
    expect(result.reasonCode).toBe("APPROVED_ALL_CHECKS_PASSED");
    expect(result.alertChannels).toEqual(["#provider-approvals"]);
    expect(result.requiresHumanDecision).toBe(true);
  });

  it("deterministic rules override an unsafe AI human-approval suggestion when documents are missing", () => {
    const result = evaluateProviderCommandCenterState(
      cleanAiReview({
        requiredDocumentsPresent: false,
        missingDocuments: ["insurance"],
        suggestedRoute: "HUMAN_APPROVAL_REQUIRED",
      }),
      cleanFacts({ requiredDocumentsValid: false }),
    );

    expect(result.status).toBe("MISSING_DOCUMENTS");
    expect(result.reasonCode).toBe("MISSING_DOCUMENTS");
  });

  it("routes liveness or identity failure to compliance and security/privacy", () => {
    const result = evaluateProviderCommandCenterState(
      cleanAiReview({ livenessStatus: "failed" }),
      cleanFacts({ identityVerified: false, livenessPassed: false }),
    );

    expect(result.status).toBe("COMPLIANCE_REVIEW_REQUIRED");
    expect(result.reasonCode).toBe("ID_LIVENESS_FAILED");
    expect(result.alertChannels).toEqual(["#compliance-review", "#security-privacy"]);
  });

  it("routes unclear tax status to legal/accounting unless accountant review passed", () => {
    const result = evaluateProviderCommandCenterState(
      cleanAiReview({ taxStatusExtracted: "unknown" }),
      cleanFacts({ taxStatusAcceptable: false, accountantReviewPassed: false }),
    );

    expect(result.status).toBe("ACCOUNTANT_REVIEW_REQUIRED");
    expect(result.reasonCode).toBe("TAX_STATUS_UNCLEAR");
    expect(result.alertChannels).toEqual(["#legal-accounting"]);
  });

  it("builds approval-version scoped SUMIT sandbox idempotency keys", () => {
    expect(buildSumitProviderCreateIdempotencyKey("provider_123", 2)).toBe(
      "sumit_provider_create:provider_provider_123:approval_2",
    );
  });

  it("queues SUMIT sandbox creation only after human approval gates pass", () => {
    expect(
      canQueueSumitSandboxCreate({
        providerId: "provider_123",
        status: "HUMAN_APPROVAL_REQUIRED",
        approvalVersion: 1,
        identityVerified: true,
        livenessPassed: true,
        requiredDocumentsValid: true,
        contractSigned: true,
        adminApprovalGranted: true,
        noActiveWatchdogHold: true,
      }),
    ).toBe(false);

    expect(
      canQueueSumitSandboxCreate({
        providerId: "provider_123",
        status: "APPROVED_FOR_SUMIT_SANDBOX",
        approvalVersion: 1,
        identityVerified: true,
        livenessPassed: true,
        requiredDocumentsValid: true,
        contractSigned: true,
        adminApprovalGranted: true,
        noActiveWatchdogHold: true,
      }),
    ).toBe(true);
  });

  it("does not duplicate SUMIT sandbox queue records on double-click", () => {
    const approvedProvider = {
      providerId: "provider_123",
      status: "APPROVED_FOR_SUMIT_SANDBOX" as const,
      approvalVersion: 1,
      identityVerified: true,
      livenessPassed: true,
      requiredDocumentsValid: true,
      contractSigned: true,
      adminApprovalGranted: true,
      noActiveWatchdogHold: true,
    };

    const first = enqueueSumitSandboxCreate([], approvedProvider, "2026-06-05T00:00:00.000Z");
    const second = enqueueSumitSandboxCreate(first.records, approvedProvider, "2026-06-05T00:00:01.000Z");

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.records).toHaveLength(1);
    expect(second.record?.idempotencyKey).toBe(first.record?.idempotencyKey);
  });

  it("keeps support identity out of management while allowing Nir and Ido", () => {
    expect(isManagementIdentity("support@petwash.co.il")).toBe(false);
    expect(isManagementIdentity("nir.h@petwash.co.il")).toBe(true);
    expect(isManagementIdentity("ido.s@petwash.co.il")).toBe(true);
  });
});
