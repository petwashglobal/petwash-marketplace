/**
 * Supplier-invoice screening — pure, framework-free decision logic.
 *
 * Given the deterministic facts about an inbound supplier invoice (file-hash
 * duplicate? invoice-number duplicate per supplier? business-number match?
 * bank visible/match? VAT math? amount over threshold? OCR / fraud-engine
 * available?) plus the fraud-engine's own score, produce:
 *
 *   - the list of invoice_checks rows to persist,
 *   - a final risk score (0..100),
 *   - a risk level (green | yellow | red),
 *   - the invoice status to set,
 *   - and a four-eyes / role-based approval gate.
 *
 * No DB calls. No external services. Tests exercise this without a database.
 *
 * Failure-handling rule (acceptance criteria): if OCR or the fraud engine is
 * unavailable, that is a VISIBLE warning check that contributes to risk —
 * never a silent pass.
 */

export type CheckResultSeverity = 'pass' | 'warning' | 'fail';

export type CheckType =
  | 'exact_duplicate_file'
  | 'duplicate_invoice_number'
  | 'business_number_mismatch'
  | 'supplier_name_mismatch'
  | 'bank_mismatch'
  | 'bank_missing_from_invoice'
  | 'vat_math_mismatch'
  | 'high_amount'
  | 'ocr_unavailable'
  | 'fraud_engine_unavailable'
  | 'fraud_engine_score';

export interface CheckResult {
  type: CheckType;
  result: CheckResultSeverity;
  scoreImpact: number;
  details?: Record<string, unknown>;
}

export type RiskLevel = 'green' | 'yellow' | 'red';

export type InvoiceStatusFromScreening = 'ready_for_approval' | 'needs_review' | 'blocked';

export interface ScreeningInput {
  /** True when an invoice with this exact file_hash already exists in the table. */
  fileHashDuplicate: boolean;
  /** True when (supplier_id, ocr_invoice_number) already exists on a non-rejected row. */
  invoiceNumberDuplicate: boolean;
  /** Business number text extracted from the invoice ('' / null if not visible). */
  businessNumberOnInvoice?: string | null;
  /** true = matches supplier profile, false = mismatch, null = unknown (no supplier profile data). */
  businessNumberMatchesSupplier?: boolean | null;
  /** true = matches, false = mismatch, null = unknown / not extracted. */
  supplierNameMatchesSupplier?: boolean | null;
  /** Whether a bank account is printed on the invoice. */
  bankAccountVisibleOnInvoice?: boolean;
  /** true = matches a verified supplier bank account, false = mismatch, null = unknown. */
  bankAccountMatchesVerified?: boolean | null;
  amountBeforeVat?: number | null;
  vatAmount?: number | null;
  totalAmount?: number | null;
  /** Default ₪2,000 — invoices above this need finance-manager attention. */
  highAmountThresholdCents?: number;
  /** Whether the OCR step succeeded (false → visible warning, not a silent pass). */
  ocrAvailable: boolean;
  /** Whether the AI fraud engine produced a result (false → visible warning). */
  fraudEngineAvailable: boolean;
  /** 0..100 from receiptFraudDetection.analyzeReceipt when available. */
  fraudEngineScore?: number | null;
}

const DEFAULT_HIGH_AMOUNT_THRESHOLD_CENTS = 200_000; // ₪2,000

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build the list of check rows for an invoice. Pure: maps facts → check rows.
 * Scoring follows the SDD scoring table.
 */
export function buildChecks(input: ScreeningInput): CheckResult[] {
  const checks: CheckResult[] = [];

  if (input.fileHashDuplicate) {
    checks.push({ type: 'exact_duplicate_file', result: 'fail', scoreImpact: 100 });
  }
  if (input.invoiceNumberDuplicate) {
    checks.push({ type: 'duplicate_invoice_number', result: 'fail', scoreImpact: 100 });
  }

  if (input.businessNumberMatchesSupplier === false) {
    checks.push({
      type: 'business_number_mismatch', result: 'fail', scoreImpact: 80,
      details: { onInvoice: input.businessNumberOnInvoice ?? null, reason: 'mismatch' },
    });
  } else if (!input.businessNumberOnInvoice) {
    // Missing from invoice (not a mismatch) — warning, not fail.
    checks.push({
      type: 'business_number_mismatch', result: 'warning', scoreImpact: 30,
      details: { reason: 'not_visible' },
    });
  }

  if (input.supplierNameMatchesSupplier === false) {
    checks.push({ type: 'supplier_name_mismatch', result: 'warning', scoreImpact: 40 });
  }

  if (input.bankAccountVisibleOnInvoice && input.bankAccountMatchesVerified === false) {
    checks.push({ type: 'bank_mismatch', result: 'fail', scoreImpact: 80 });
  } else if (!input.bankAccountVisibleOnInvoice) {
    checks.push({ type: 'bank_missing_from_invoice', result: 'warning', scoreImpact: 25 });
  }

  if (
    typeof input.amountBeforeVat === 'number' &&
    typeof input.vatAmount === 'number' &&
    typeof input.totalAmount === 'number'
  ) {
    const sum = round2(input.amountBeforeVat + input.vatAmount);
    const total = round2(input.totalAmount);
    if (Math.abs(sum - total) > 0.05) {
      checks.push({
        type: 'vat_math_mismatch', result: 'warning', scoreImpact: 20,
        details: { sumOfParts: sum, total },
      });
    }
  }

  const threshold = input.highAmountThresholdCents ?? DEFAULT_HIGH_AMOUNT_THRESHOLD_CENTS;
  if (typeof input.totalAmount === 'number' && input.totalAmount * 100 > threshold) {
    checks.push({
      type: 'high_amount', result: 'warning', scoreImpact: 15,
      details: { totalAmount: input.totalAmount, thresholdCents: threshold },
    });
  }

  if (!input.ocrAvailable) {
    checks.push({ type: 'ocr_unavailable', result: 'warning', scoreImpact: 10 });
  }

  if (!input.fraudEngineAvailable) {
    checks.push({ type: 'fraud_engine_unavailable', result: 'warning', scoreImpact: 10 });
  } else if (typeof input.fraudEngineScore === 'number') {
    if (input.fraudEngineScore >= 70) {
      checks.push({
        type: 'fraud_engine_score', result: 'fail', scoreImpact: 60,
        details: { score: input.fraudEngineScore },
      });
    } else if (input.fraudEngineScore >= 30) {
      checks.push({
        type: 'fraud_engine_score', result: 'warning', scoreImpact: 30,
        details: { score: input.fraudEngineScore },
      });
    }
  }

  return checks;
}

export function computeRiskScore(checks: ReadonlyArray<CheckResult>): number {
  const total = checks.reduce((sum, c) => sum + (c.scoreImpact || 0), 0);
  return Math.max(0, Math.min(100, total));
}

export function riskLevel(score: number): RiskLevel {
  if (score >= 70) return 'red';
  if (score >= 25) return 'yellow';
  return 'green';
}

export function mapToInvoiceStatus(level: RiskLevel): InvoiceStatusFromScreening {
  if (level === 'red') return 'blocked';
  if (level === 'yellow') return 'needs_review';
  return 'ready_for_approval';
}

// ── Four-eyes / role-based approval gate ──────────────────────────────────

export interface ApprovalInvoice {
  uploadedBy: string;
  riskLevel: RiskLevel;
  status: string;
}

export interface ApprovalActor {
  userId: string;
  /** Role string from RBAC (finance_manager, super_admin, admin, etc.). */
  role: string;
}

export interface ApprovalDecisionInput {
  invoice: ApprovalInvoice;
  actor: ApprovalActor;
  action: 'approve' | 'reject';
  /** Required for YELLOW approvals. */
  note?: string;
}

export interface ApprovalDecision {
  ok: boolean;
  reason?: string;
}

const ELEVATED_ROLES = new Set(['finance_manager', 'super_admin']);

/**
 * Four-eyes + risk-tier gate. The route still enforces RBAC for who may CALL
 * approve/reject; this function adds the per-invoice safeguards:
 *  - the approver cannot be the uploader (four-eyes),
 *  - RED requires a finance manager or super admin override,
 *  - YELLOW requires a non-empty note.
 *  - GREEN passes (route role check still applies).
 */
export function evaluateApproval(input: ApprovalDecisionInput): ApprovalDecision {
  const { invoice, actor, action, note } = input;

  if (actor.userId === invoice.uploadedBy) {
    return { ok: false, reason: 'four_eyes: approver cannot be the uploader' };
  }

  if (action === 'reject') {
    return { ok: true };
  }

  // action === 'approve'
  if (invoice.riskLevel === 'red' && !ELEVATED_ROLES.has(actor.role)) {
    return {
      ok: false,
      reason: 'RED invoices require a finance_manager or super_admin override',
    };
  }
  if (invoice.riskLevel === 'yellow' && (!note || !note.trim())) {
    return { ok: false, reason: 'YELLOW invoices require an approval note' };
  }
  return { ok: true };
}

/**
 * Convenience: full screening decision from facts to (checks, score, level,
 * status). The caller persists the rows; this function never touches the DB.
 */
export function screenInvoice(input: ScreeningInput) {
  const checks = buildChecks(input);
  const score = computeRiskScore(checks);
  const level = riskLevel(score);
  const status = mapToInvoiceStatus(level);
  return { checks, riskScore: score, riskLevel: level, status };
}
