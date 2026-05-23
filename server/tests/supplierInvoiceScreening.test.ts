import { describe, it, expect } from 'vitest';
import {
  buildChecks,
  computeRiskScore,
  riskLevel,
  mapToInvoiceStatus,
  screenInvoice,
  evaluateApproval,
  type ScreeningInput,
} from '../lib/supplierInvoiceScreening';

const okFacts: ScreeningInput = {
  fileHashDuplicate: false,
  invoiceNumberDuplicate: false,
  businessNumberOnInvoice: '517145033',
  businessNumberMatchesSupplier: true,
  supplierNameMatchesSupplier: true,
  bankAccountVisibleOnInvoice: true,
  bankAccountMatchesVerified: true,
  amountBeforeVat: 100,
  vatAmount: 18,
  totalAmount: 118,
  ocrAvailable: true,
  fraudEngineAvailable: true,
  fraudEngineScore: 5,
};

describe('supplier-invoice screening — rule scoring', () => {
  it('clean invoice produces zero checks, score 0, ready_for_approval', () => {
    const out = screenInvoice(okFacts);
    expect(out.checks).toEqual([]);
    expect(out.riskScore).toBe(0);
    expect(out.riskLevel).toBe('green');
    expect(out.status).toBe('ready_for_approval');
  });

  it('exact_duplicate_file is a RED fail at +100', () => {
    const out = screenInvoice({ ...okFacts, fileHashDuplicate: true });
    expect(out.checks.some((c) => c.type === 'exact_duplicate_file' && c.result === 'fail')).toBe(true);
    expect(out.riskScore).toBe(100);
    expect(out.riskLevel).toBe('red');
    expect(out.status).toBe('blocked');
  });

  it('duplicate_invoice_number is a RED fail at +100', () => {
    const out = screenInvoice({ ...okFacts, invoiceNumberDuplicate: true });
    expect(out.checks.some((c) => c.type === 'duplicate_invoice_number' && c.result === 'fail')).toBe(true);
    expect(out.riskLevel).toBe('red');
  });

  it('business_number mismatch is fail +80 (not visible is only warning +30)', () => {
    const mismatch = buildChecks({ ...okFacts, businessNumberMatchesSupplier: false });
    expect(mismatch.find((c) => c.type === 'business_number_mismatch')).toMatchObject({ result: 'fail', scoreImpact: 80 });

    const notVisible = buildChecks({
      ...okFacts,
      businessNumberOnInvoice: null,
      businessNumberMatchesSupplier: null,
    });
    expect(notVisible.find((c) => c.type === 'business_number_mismatch')).toMatchObject({ result: 'warning', scoreImpact: 30 });
  });

  it('bank_mismatch when visible+mismatch is fail +80; missing from invoice is warning +25', () => {
    const mismatch = buildChecks({
      ...okFacts,
      bankAccountVisibleOnInvoice: true,
      bankAccountMatchesVerified: false,
    });
    expect(mismatch.find((c) => c.type === 'bank_mismatch')).toMatchObject({ result: 'fail', scoreImpact: 80 });

    const missing = buildChecks({
      ...okFacts,
      bankAccountVisibleOnInvoice: false,
      bankAccountMatchesVerified: null,
    });
    expect(missing.find((c) => c.type === 'bank_missing_from_invoice')).toMatchObject({ result: 'warning', scoreImpact: 25 });
  });

  it('supplier_name_mismatch is warning +40', () => {
    const out = buildChecks({ ...okFacts, supplierNameMatchesSupplier: false });
    expect(out.find((c) => c.type === 'supplier_name_mismatch')).toMatchObject({ result: 'warning', scoreImpact: 40 });
  });

  it('vat_math_mismatch fires when before+vat != total beyond tolerance', () => {
    const out = buildChecks({ ...okFacts, totalAmount: 120 }); // 100 + 18 = 118 ≠ 120
    expect(out.find((c) => c.type === 'vat_math_mismatch')).toMatchObject({ result: 'warning', scoreImpact: 20 });
    // rounding tolerance: 0.05 should NOT fire (within tolerance)
    const tolerance = buildChecks({ ...okFacts, totalAmount: 118.04 });
    expect(tolerance.find((c) => c.type === 'vat_math_mismatch')).toBeUndefined();
  });

  it('high_amount fires above threshold (default ₪2,000)', () => {
    const out = buildChecks({ ...okFacts, totalAmount: 2500 });
    expect(out.find((c) => c.type === 'high_amount')).toMatchObject({ result: 'warning', scoreImpact: 15 });

    const custom = buildChecks({ ...okFacts, totalAmount: 600, highAmountThresholdCents: 50_000 });
    expect(custom.find((c) => c.type === 'high_amount')).toMatchObject({ result: 'warning', scoreImpact: 15 });
  });

  it('failure of OCR or fraud-engine is a VISIBLE warning, never silent (acceptance criteria)', () => {
    const noOcr = buildChecks({ ...okFacts, ocrAvailable: false });
    expect(noOcr.find((c) => c.type === 'ocr_unavailable')).toMatchObject({ result: 'warning', scoreImpact: 10 });

    const noFraud = buildChecks({ ...okFacts, fraudEngineAvailable: false });
    expect(noFraud.find((c) => c.type === 'fraud_engine_unavailable')).toMatchObject({ result: 'warning', scoreImpact: 10 });
  });

  it('fraud_engine_score: >=70 fail +60, 30..69 warning +30, <30 no row', () => {
    expect(buildChecks({ ...okFacts, fraudEngineScore: 80 }).find((c) => c.type === 'fraud_engine_score'))
      .toMatchObject({ result: 'fail', scoreImpact: 60 });
    expect(buildChecks({ ...okFacts, fraudEngineScore: 50 }).find((c) => c.type === 'fraud_engine_score'))
      .toMatchObject({ result: 'warning', scoreImpact: 30 });
    expect(buildChecks({ ...okFacts, fraudEngineScore: 10 }).find((c) => c.type === 'fraud_engine_score'))
      .toBeUndefined();
  });
});

describe('risk-level boundaries and capping', () => {
  it('score 0..24 = green, 25..69 = yellow, 70..100 = red', () => {
    expect(riskLevel(0)).toBe('green');
    expect(riskLevel(24)).toBe('green');
    expect(riskLevel(25)).toBe('yellow');
    expect(riskLevel(69)).toBe('yellow');
    expect(riskLevel(70)).toBe('red');
    expect(riskLevel(100)).toBe('red');
  });

  it('computeRiskScore sums score impacts and caps at 100', () => {
    expect(computeRiskScore([
      { type: 'exact_duplicate_file', result: 'fail', scoreImpact: 100 },
      { type: 'bank_mismatch', result: 'fail', scoreImpact: 80 },
    ])).toBe(100);
    expect(computeRiskScore([
      { type: 'vat_math_mismatch', result: 'warning', scoreImpact: 20 },
      { type: 'high_amount', result: 'warning', scoreImpact: 15 },
    ])).toBe(35);
  });

  it('mapToInvoiceStatus mirrors the risk tier', () => {
    expect(mapToInvoiceStatus('green')).toBe('ready_for_approval');
    expect(mapToInvoiceStatus('yellow')).toBe('needs_review');
    expect(mapToInvoiceStatus('red')).toBe('blocked');
  });
});

describe('four-eyes + risk-tier approval gate', () => {
  const baseInvoice = { uploadedBy: 'uploader-1', riskLevel: 'green' as const, status: 'ready_for_approval' };
  const otherApprover = { userId: 'approver-2', role: 'admin' };

  it('approver cannot be the uploader (four-eyes)', () => {
    const decision = evaluateApproval({
      invoice: baseInvoice,
      actor: { userId: 'uploader-1', role: 'finance_manager' },
      action: 'approve',
    });
    expect(decision.ok).toBe(false);
    expect(decision.reason).toMatch(/four_eyes/);
  });

  it('GREEN is approvable by any approver (route enforces RBAC); reject is similarly four-eyes-only', () => {
    expect(evaluateApproval({ invoice: baseInvoice, actor: otherApprover, action: 'approve' }))
      .toEqual({ ok: true });
    expect(evaluateApproval({ invoice: baseInvoice, actor: otherApprover, action: 'reject' }))
      .toEqual({ ok: true });
  });

  it('YELLOW approval requires a non-empty note', () => {
    const inv = { ...baseInvoice, riskLevel: 'yellow' as const, status: 'needs_review' };
    expect(evaluateApproval({ invoice: inv, actor: otherApprover, action: 'approve' }).ok).toBe(false);
    expect(evaluateApproval({ invoice: inv, actor: otherApprover, action: 'approve', note: '   ' }).ok).toBe(false);
    expect(evaluateApproval({ invoice: inv, actor: otherApprover, action: 'approve', note: 'verified with supplier' }).ok)
      .toBe(true);
  });

  it('RED approval requires finance_manager or super_admin', () => {
    const inv = { ...baseInvoice, riskLevel: 'red' as const, status: 'blocked' };
    expect(evaluateApproval({ invoice: inv, actor: otherApprover, action: 'approve' }).ok).toBe(false);
    expect(evaluateApproval({
      invoice: inv, actor: { userId: 'approver-3', role: 'finance_manager' }, action: 'approve', note: 'override reason',
    }).ok).toBe(true);
    expect(evaluateApproval({
      invoice: inv, actor: { userId: 'approver-4', role: 'super_admin' }, action: 'approve', note: 'override reason',
    }).ok).toBe(true);
    // Reject of RED by a non-elevated approver is still allowed (no override needed to reject).
    expect(evaluateApproval({ invoice: inv, actor: otherApprover, action: 'reject' }).ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Israel ITA Digital Invoice Law 2026 — SHAAM allocation requirement
// ─────────────────────────────────────────────────────────────────────────────

describe('supplier-invoice screening — SHAAM allocation', () => {
  it('does not add the check when shaamAllocationRequired is false (below threshold)', () => {
    const checks = buildChecks({ ...okFacts, shaamAllocationRequired: false });
    expect(checks.find(c => c.type === 'shaam_allocation_missing')).toBeUndefined();
  });

  it('does not add the check when allocation number IS present', () => {
    const checks = buildChecks({
      ...okFacts,
      shaamAllocationRequired: true,
      shaamAllocationNumberOnInvoice: '123456789',
    });
    expect(checks.find(c => c.type === 'shaam_allocation_missing')).toBeUndefined();
  });

  it('adds a hard fail (90 score) when SHAAM is required but allocation is missing', () => {
    const checks = buildChecks({
      ...okFacts,
      shaamAllocationRequired: true,
      shaamAllocationNumberOnInvoice: null,
    });
    const c = checks.find(c => c.type === 'shaam_allocation_missing');
    expect(c).toBeDefined();
    expect(c?.result).toBe('fail');
    expect(c?.scoreImpact).toBe(90);
  });

  it('treats an empty / whitespace-only allocation number as missing', () => {
    const checks = buildChecks({
      ...okFacts,
      shaamAllocationRequired: true,
      shaamAllocationNumberOnInvoice: '   ',
    });
    expect(checks.find(c => c.type === 'shaam_allocation_missing')).toBeDefined();
  });

  it('shaam_allocation_missing pushes the invoice into RED (score >= 70)', () => {
    const checks = buildChecks({
      ...okFacts,
      shaamAllocationRequired: true,
      shaamAllocationNumberOnInvoice: null,
    });
    const score = computeRiskScore(checks);
    expect(score).toBeGreaterThanOrEqual(70);
    expect(riskLevel(score)).toBe('red');
    expect(mapToInvoiceStatus(riskLevel(score))).toBe('blocked');
  });
});
