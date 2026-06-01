import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import {
  evaluateOperatingControlGate,
  PETWASH_OPERATING_CONTROL_BLOCKED,
} from '../../server/lib/petwashOperatingControlGateway';

function req(body: Record<string, unknown> = {}, user: Record<string, unknown> = {}): Request {
  return {
    body,
    user: {
      uid: 'finance-1',
      role: 'finance',
      ...user,
    },
    headers: {},
  } as unknown as Request;
}

describe('PetWash operating-control gateway', () => {
  it('fails closed with route, reason codes, approvers, evidence, and next actions', () => {
    const result = evaluateOperatingControlGate(req(), {
      actionType: 'MANUAL_FINANCIAL_ADJUSTMENT',
      route: 'POST /api/admin/finance/adjustment',
      targetId: 'manual-adjustment:unlinked',
      facts: {
        refundReasonSelected: true,
      },
      money: {
        amountCents: 75_000,
        manualCreditThresholdCents: 50_000,
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(409);
    expect(result.payload?.code).toBe(PETWASH_OPERATING_CONTROL_BLOCKED);
    expect(result.payload?.route).toBe('POST /api/admin/finance/adjustment');
    expect(result.payload?.riskLevel).toBe('BLOCKED');
    expect(result.payload?.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'MANUAL_ADJUSTMENT_EVIDENCE_REQUIRED',
      'MANUAL_ADJUSTMENT_CONTROL_APPROVAL_REQUIRED',
      'MANUAL_ADJUSTMENT_VAT_REVIEW_REQUIRED',
      'MANUAL_ADJUSTMENT_IDEMPOTENCY_REQUIRED',
      'MANUAL_ADJUSTMENT_NIR_APPROVAL_REQUIRED',
    ]));
    expect(result.payload?.requiredApprovals).toEqual(expect.arrayContaining(['ACCOUNTANT', 'FINANCE', 'ENGINEERING', 'NIR']));
    expect(result.payload?.nextActions).toContain('Route adjustment to Nir approval queue.');
  });

  it('merges route defaults with operatingControl payload and allows a reviewed adjustment', () => {
    const result = evaluateOperatingControlGate(req({
      operatingControl: {
        facts: {
          sourceEvidenceExists: true,
          localControlApproved: true,
          vatStatusReviewed: true,
          idempotencyKeyExists: true,
        },
        approvals: [
          { approver: 'NIR', actorId: 'nir-1', status: 'approved' },
        ],
      },
    }), {
      actionType: 'MANUAL_FINANCIAL_ADJUSTMENT',
      route: 'POST /api/admin/finance/adjustment',
      targetId: 'manual-adjustment:payment-1',
      facts: {
        refundReasonSelected: true,
      },
      money: {
        amountCents: 75_000,
        manualCreditThresholdCents: 50_000,
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.decision.blockers).toEqual([]);
  });

  it('blocks self-approval even when the requested approver is present', () => {
    const result = evaluateOperatingControlGate(req({
      operatingControl: {
        facts: {
          sourceEvidenceExists: true,
          localControlApproved: true,
          vatStatusReviewed: true,
          idempotencyKeyExists: true,
        },
        approvals: [
          { approver: 'NIR', actorId: 'finance-1', status: 'approved' },
        ],
      },
    }), {
      actionType: 'MANUAL_FINANCIAL_ADJUSTMENT',
      route: 'POST /api/admin/finance/adjustment',
      targetId: 'manual-adjustment:payment-1',
      facts: {
        refundReasonSelected: true,
      },
      money: {
        amountCents: 75_000,
        manualCreditThresholdCents: 50_000,
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.payload?.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'SELF_APPROVAL_BLOCKED',
      'MANUAL_ADJUSTMENT_NIR_APPROVAL_REQUIRED',
    ]));
  });

  it('blocks admin wallet credit without local control, source evidence, and accountant VAT review', () => {
    const result = evaluateOperatingControlGate(req(), {
      actionType: 'WALLET_CREDIT_CREATE',
      route: 'POST /api/credit-wallet/admin/inject',
      targetId: 'wallet:user-1',
      creditType: 'GOODWILL_CREDIT',
      paidOrFree: 'free',
      facts: {
        manualStaffCredit: true,
      },
      money: {
        creditOriginalAmountCents: 1_000,
        manualCreditThresholdCents: 5_000,
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.payload?.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'CREDIT_VAT_ACCOUNTANT_PENDING',
      'MANUAL_CREDIT_CONTROL_APPROVAL_REQUIRED',
      'MANUAL_CREDIT_EVIDENCE_REQUIRED',
    ]));
  });

  it('blocks official SUMIT posting without accountant-ready control facts', () => {
    const result = evaluateOperatingControlGate(req(), {
      actionType: 'SUMIT_OFFICIAL_POSTING',
      route: 'POST /api/supplier-invoices/:id/send-to-sumit',
      targetId: 'supplier-invoice:9',
      facts: {
        sourceEvidenceExists: true,
        idempotencyKeyExists: true,
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.payload?.blockers.map((blocker) => blocker.code)).toEqual(expect.arrayContaining([
      'LOCAL_CONTROL_APPROVAL_REQUIRED',
      'SUMIT_DOCUMENT_TYPE_REQUIRED',
      'SUMIT_VAT_REVIEW_REQUIRED',
    ]));
  });
});
