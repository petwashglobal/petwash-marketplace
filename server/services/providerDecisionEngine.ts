export type ProviderApplicationStatus =
  | "submitted"
  | "processing"
  | "pending_review"
  | "pending_resubmission"
  | "approved"
  | "rejected"
  | "expired"
  | "withdrawn";

export type QueuePriority = "low" | "normal" | "high" | "urgent";

export interface KycDecisionResult {
  status: "approved" | "pending_review" | "pending_resubmission" | "rejected";
  reason: string;
  faceScore: number;
  livenessScore: number;
  ocrConfidence: number;
  documentType: string | null;
  idLastFour: string | null;
  flags: string[];
  fraudFlags: string[];
  fraudRiskLevel: "low" | "medium" | "high";
  backgroundCheckNotes: Record<string, unknown>;
}

function normalizeDocumentType(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (v.includes("passport")) return "passport";
  if (v.includes("national") || (v.includes("id") && !v.includes("driver"))) return "national_id";
  if (v.includes("license") || v.includes("licence") || v.includes("driver")) return "drivers_license";
  if (v.includes("disability")) return "disability_certificate";
  if (v.includes("retirement")) return "retirement_certificate";
  return null;
}

function isHighRiskFraud(fraudFlags: string[]): boolean {
  return fraudFlags.some((f) =>
    [
      "duplicate_document_number",
      "reused_selfie_hash",
      "multi_ip_velocity_high",
      "device_fingerprint_cluster",
    ].includes(f)
  );
}

export function decideProviderKyc(input: {
  faceMatchScore: number;
  livenessPass: boolean;
  livenessScore: number;
  ocrConfidence: number;
  documentType?: string | null;
  extractedName?: string | null;
  extractedDob?: string | null;
  extractedExpiry?: string | null;
  extractedDocumentNumber?: string | null;
  selfieQuality?: string | null;
  idQuality?: string | null;
  submittedName?: string | null;
  submittedDob?: string | null;
  fraudFlags?: string[];
  rawBackground?: Record<string, unknown>;
}): KycDecisionResult {
  const flags: string[] = [];
  const fraudFlags = input.fraudFlags || [];
  const documentType = normalizeDocumentType(input.documentType);

  if (!input.extractedName?.trim()) flags.push("ocr_name_missing");
  if (!input.extractedDob?.trim()) flags.push("ocr_dob_missing");
  if (!input.extractedExpiry?.trim()) flags.push("ocr_expiry_missing");
  if (!input.extractedDocumentNumber?.trim()) flags.push("ocr_document_number_missing");
  if (!documentType) flags.push("document_type_unknown");
  if ((input.ocrConfidence ?? 0) < 50) flags.push("ocr_confidence_low");
  if (input.idQuality && input.idQuality !== "good") flags.push("id_document_poor_quality");
  if (input.selfieQuality && input.selfieQuality !== "good") flags.push("selfie_poor_quality");

  if (
    input.submittedName?.trim() &&
    input.extractedName?.trim() &&
    input.submittedName.trim().toLowerCase() !== input.extractedName.trim().toLowerCase()
  ) {
    flags.push("name_mismatch");
  }

  if (
    input.submittedDob?.trim() &&
    input.extractedDob?.trim() &&
    input.submittedDob.trim() !== input.extractedDob.trim()
  ) {
    flags.push("dob_mismatch");
  }

  let fraudRiskLevel: "low" | "medium" | "high" = "low";
  if (isHighRiskFraud(fraudFlags)) fraudRiskLevel = "high";
  else if (fraudFlags.length > 0) fraudRiskLevel = "medium";

  let status: KycDecisionResult["status"] = "pending_review";
  let reason = "KYC review required";

  // Hard reject: face score too low or liveness failed
  if (input.faceMatchScore < 55 || !input.livenessPass) {
    status = "rejected";
    reason = `Face score ${input.faceMatchScore.toFixed(1)} or liveness check failed`;
  }
  // High fraud risk = instant reject
  else if (fraudRiskLevel === "high") {
    status = "rejected";
    reason = `High fraud risk detected: ${fraudFlags.join(", ")}`;
  }
  // Poor quality docs = ask for resubmission
  else if (
    flags.includes("id_document_poor_quality") ||
    flags.includes("selfie_poor_quality") ||
    flags.includes("ocr_expiry_missing") ||
    flags.includes("ocr_document_number_missing")
  ) {
    status = "pending_resubmission";
    reason = `Better files required: ${flags.join(", ")}`;
  }
  // Medium fraud = manual review
  else if (fraudRiskLevel === "medium") {
    status = "pending_review";
    reason = `Medium fraud risk: ${fraudFlags.join(", ")}`;
  }
  // Strong pass — all clear
  else if (input.faceMatchScore >= 85 && input.livenessPass && flags.length === 0) {
    status = "approved";
    reason = `Strong pass: face ${input.faceMatchScore.toFixed(1)}, liveness OK, OCR complete`;
  }
  // Borderline — human review
  else if (input.faceMatchScore >= 65) {
    status = "pending_review";
    reason = flags.length
      ? `Borderline or flagged: ${flags.join(", ")}`
      : `Borderline face score: ${input.faceMatchScore.toFixed(1)}`;
  }
  // Insufficient — reject
  else {
    status = "rejected";
    reason = "Insufficient confidence — score below threshold";
  }

  return {
    status,
    reason,
    faceScore: input.faceMatchScore,
    livenessScore: input.livenessScore,
    ocrConfidence: input.ocrConfidence,
    documentType,
    idLastFour: input.extractedDocumentNumber
      ? input.extractedDocumentNumber.replace(/\D/g, "").slice(-4) || null
      : null,
    flags,
    fraudFlags,
    fraudRiskLevel,
    backgroundCheckNotes: {
      ...(input.rawBackground || {}),
      decision: { status, reason, fraudRiskLevel, flags },
    },
  };
}

export function queuePriorityFromDecision(result: KycDecisionResult): QueuePriority {
  if (result.fraudRiskLevel === "high") return "urgent";
  if (result.fraudRiskLevel === "medium") return "high";
  if (result.flags.includes("name_mismatch") || result.flags.includes("dob_mismatch")) return "high";
  if (result.faceScore >= 75) return "normal";
  return "normal";
}
