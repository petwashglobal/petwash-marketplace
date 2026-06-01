import { describe, expect, it } from 'vitest';
import {
  calculateProviderPayoutAfterDiscount,
  evaluateOperatingAction,
  type OperatingDecision,
  type OperatingInput,
} from '../../shared/petwash-operating-system';

function codes(decision: OperatingDecision): string[] {
  return decision.blockers.map((blocker) => blocker.code);
}

function baseInput(overrides: Partial<OperatingInput>): OperatingInput {
  return {
    actionType: 'PROVIDER_ACTIVATION',
    actor: { id: 'finance-1', role: 'finance' },
    targetId: 'target-1',
    ...overrides,
    facts: {
      ...(overrides.facts ?? {}),
    },
  };
}

describe('PetWash operating system control logic', () => {
  it('blocks provider activation until identity, tax, contract, bank, insurance, compliance, owner, manager, and reconfirmation checks pass', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'PROVIDER_ACTIVATION',
      taxClassification: 'private_individual',
      facts: {
        reconfirmationExpired: true,
      },
    }));

    expect(result.allowed).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining([
      'PROVIDER_IDENTITY_REQUIRED',
      'PROVIDER_TAX_DECLARATION_REQUIRED',
      'PROVIDER_CONTRACT_REQUIRED',
      'PROVIDER_BANK_REQUIRED',
      'PROVIDER_INSURANCE_REQUIRED',
      'PROVIDER_COMPLIANCE_REQUIRED',
      'PROVIDER_OWNER_APPROVAL_REQUIRED',
      'PROVIDER_MANAGER_APPROVAL_REQUIRED',
      'PROVIDER_RECONFIRMATION_EXPIRED',
      'PRIVATE_INDIVIDUAL_LEGAL_REVIEW_REQUIRED',
      'PRIVATE_INDIVIDUAL_ACCOUNTANT_REVIEW_REQUIRED',
    ]));
    expect(result.requiredApprovals).toEqual(expect.arrayContaining(['NIR', 'LEGAL', 'ACCOUNTANT', 'FINANCE', 'PROVIDER_MANAGER']));
  });

  it('blocks עוסק פטור provider activation when uploaded document contains VAT claim logic', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'PROVIDER_ACTIVATION',
      taxClassification: 'patur',
      facts: {
        identityApproved: true,
        taxDeclarationSigned: true,
        contractSigned: true,
        bankVerified: true,
        insuranceWaivedByCompliance: true,
        complianceApproved: true,
        ownerApproved: true,
        providerManagerApproved: true,
        documentHasVat: true,
      },
    }));

    expect(result.allowed).toBe(false);
    expect(codes(result)).toContain('OSEK_PATUR_VAT_BLOCKED');
  });

  it('requires a completed job, collected customer money, tax/VAT checks, approval, transfer reference, and bank match before provider payout', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'PROVIDER_PAYOUT',
      bankMatchStatus: 'missing',
      facts: {
        providerActive: true,
        jobCompleted: false,
        customerPaymentReceivedOrApproved: false,
        openComplaintOrRefundHold: true,
      },
    }));

    expect(result.allowed).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining([
      'JOB_COMPLETION_REQUIRED',
      'CUSTOMER_PAYMENT_REQUIRED',
      'PROVIDER_INVOICE_REQUIRED',
      'PROVIDER_BANK_REQUIRED',
      'PROVIDER_TAX_CHECK_REQUIRED',
      'PROVIDER_VAT_CHECK_REQUIRED',
      'OPEN_COMPLAINT_OR_REFUND_HOLD',
      'PAYOUT_APPROVAL_REQUIRED',
      'BANK_TRANSFER_REFERENCE_REQUIRED',
      'BANK_MATCH_STATUS_REQUIRED',
    ]));
  });

  it('does not reduce provider payout when PetWash funds a customer discount unless the signed agreement allows it', () => {
    const payout = calculateProviderPayoutAfterDiscount({
      originalCustomerPriceCents: 10_000,
      discountAmountCents: 2_000,
      finalCustomerPaidCents: 8_000,
      providerBasePayoutCents: 7_000,
      discountFundedBy: 'PET_WASH',
      providerAgreementAllowsDiscountReduction: false,
    });

    expect(payout.finalProviderPayoutCents).toBe(7_000);
    expect(payout.providerPayoutAdjustmentCents).toBe(0);
    expect(payout.agreementRuleUsed).toBe('petwash_discount_does_not_reduce_provider_payout_by_default');
  });

  it('reduces provider payout only when the provider funded the discount or shared reduction is contractually allowed', () => {
    const providerFunded = calculateProviderPayoutAfterDiscount({
      originalCustomerPriceCents: 10_000,
      discountAmountCents: 2_000,
      finalCustomerPaidCents: 8_000,
      providerBasePayoutCents: 7_000,
      discountFundedBy: 'PROVIDER',
    });

    const sharedWithoutAgreement = calculateProviderPayoutAfterDiscount({
      originalCustomerPriceCents: 10_000,
      discountAmountCents: 2_000,
      finalCustomerPaidCents: 8_000,
      providerBasePayoutCents: 7_000,
      discountFundedBy: 'SHARED',
      providerAgreementAllowsDiscountReduction: false,
    });

    expect(providerFunded.finalProviderPayoutCents).toBe(5_000);
    expect(sharedWithoutAgreement.finalProviderPayoutCents).toBe(7_000);
  });

  it('blocks supplier payment when invoice, duplicate, VAT, bank, approval, recent bank-change, or עוסק פטור VAT evidence is unsafe', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'SUPPLIER_PAYMENT',
      taxClassification: 'patur',
      bankMatchStatus: 'pending_match',
      facts: {
        supplierApproved: true,
        supplierInvoiceUploaded: true,
        duplicateCheckPassed: true,
        vatTreatmentChecked: true,
        bankVerified: true,
        bankAccountRecentlyChanged: true,
        paymentApproved: true,
        documentHasVat: true,
      },
    }));

    expect(result.allowed).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining([
      'SUPPLIER_BANK_CHANGE_SECOND_APPROVAL_REQUIRED',
      'OSEK_PATUR_SUPPLIER_VAT_BLOCKED',
      'VAT_ISSUE_ACCOUNTANT_REVIEW_REQUIRED',
    ]));
  });

  it('keeps employee reimbursement separate and blocks the flow if the person is accidentally treated as a provider', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'EMPLOYEE_REIMBURSEMENT',
      bankMatchStatus: 'matched',
      facts: {
        employeeProfileExists: true,
        personIsProvider: true,
        receiptUploaded: true,
        businessPurposeRecorded: true,
        managerApproved: true,
        reimbursementApproved: true,
      },
    }));

    expect(result.allowed).toBe(false);
    expect(codes(result)).toContain('EMPLOYEE_PROVIDER_MIX_BLOCKED');
    expect(result.requiredApprovals).toContain('LEGAL');
  });

  it('blocks refunds without original payment and escalates high-risk or fraud/chargeback/legal cases', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'CUSTOMER_REFUND',
      bankMatchStatus: 'pending_match',
      facts: {
        refundReasonSelected: true,
        evidenceAttachedIfRequired: true,
        providerPayoutImpactChecked: true,
        approvalThresholdApplied: true,
        sumitCreditNoteRequirementChecked: true,
        highRiskRefund: true,
        fraudChargebackOrLegalIssue: true,
      },
    }));

    expect(result.allowed).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining([
      'ORIGINAL_PAYMENT_REQUIRED',
      'HIGH_REFUND_NIR_APPROVAL_REQUIRED',
      'FRAUD_REFUND_NIR_APPROVAL_REQUIRED',
      'FRAUD_REFUND_ACCOUNTANT_REVIEW_REQUIRED',
      'FRAUD_REFUND_LEGAL_REVIEW_REQUIRED',
    ]));
  });

  it('protects wallet and gift-card credits from missing receipts, refund-case gaps, paid/free mixing, over-redemption, cash-out, and hidden paid expiry', () => {
    const paidGift = evaluateOperatingAction(baseInput({
      actionType: 'WALLET_CREDIT_CREATE',
      creditType: 'PAID_GIFT_CARD',
      paidOrFree: 'paid',
      facts: {
        vatStatusReviewed: false,
      },
    }));

    const refundCredit = evaluateOperatingAction(baseInput({
      actionType: 'WALLET_CREDIT_CREATE',
      creditType: 'REFUND_CREDIT',
      paidOrFree: 'free',
      facts: {
        vatStatusReviewed: true,
      },
    }));

    const promoCashOut = evaluateOperatingAction(baseInput({
      actionType: 'WALLET_CREDIT_REDEEM',
      creditType: 'PROMOTIONAL_CREDIT',
      paidOrFree: 'free',
      facts: {
        cashOutRequested: true,
        vatStatusReviewed: true,
      },
      money: {
        creditRemainingBalanceCents: 500,
        creditRedemptionAmountCents: 600,
      },
    }));

    const paidExpiry = evaluateOperatingAction(baseInput({
      actionType: 'WALLET_CREDIT_EXPIRE',
      creditType: 'E_GIFT_CARD',
      paidOrFree: 'paid',
      facts: {
        vatStatusReviewed: true,
      },
    }));

    expect(codes(paidGift)).toEqual(expect.arrayContaining([
      'PAID_GIFT_CARD_PAYMENT_RECEIPT_REQUIRED',
      'CREDIT_VAT_ACCOUNTANT_PENDING',
    ]));
    expect(codes(refundCredit)).toContain('REFUND_CREDIT_CASE_REQUIRED');
    expect(codes(promoCashOut)).toEqual(expect.arrayContaining([
      'PROMO_CREDIT_CASH_OUT_BLOCKED',
      'CREDIT_REDEMPTION_ORDER_REQUIRED',
      'CREDIT_REDEMPTION_EXCEEDS_BALANCE',
    ]));
    expect(codes(paidExpiry)).toEqual(expect.arrayContaining([
      'PAID_BALANCE_EXPIRY_NOT_ALLOWED',
      'CREDIT_EXPIRY_RULE_REQUIRED',
    ]));
  });

  it('requires Nir approval for manual staff wallet credit above threshold', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'WALLET_CREDIT_CREATE',
      creditType: 'GOODWILL_CREDIT',
      paidOrFree: 'free',
      facts: {
        manualStaffCredit: true,
        vatStatusReviewed: true,
      },
      money: {
        manualCreditThresholdCents: 5_000,
        creditOriginalAmountCents: 7_500,
      },
    }));

    expect(result.allowed).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining([
      'MANUAL_CREDIT_NIR_APPROVAL_REQUIRED',
      'MANUAL_CREDIT_CONTROL_APPROVAL_REQUIRED',
      'MANUAL_CREDIT_EVIDENCE_REQUIRED',
    ]));
  });

  it('blocks official SUMIT posting without local approval, document type, VAT review, evidence, idempotency, and עוסק פטור VAT protection', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'SUMIT_OFFICIAL_POSTING',
      taxClassification: 'patur',
      facts: {
        documentHasVat: true,
        classificationConflict: true,
        highRiskFlagResolved: false,
      },
    }));

    expect(result.allowed).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining([
      'LOCAL_CONTROL_APPROVAL_REQUIRED',
      'SUMIT_DOCUMENT_TYPE_REQUIRED',
      'SUMIT_VAT_REVIEW_REQUIRED',
      'SUMIT_SOURCE_EVIDENCE_REQUIRED',
      'HIGH_RISK_FLAG_UNRESOLVED',
      'CLASSIFICATION_CONFLICT_BLOCKED',
      'SUMIT_OSEK_PATUR_VAT_BLOCKED',
      'SUMIT_IDEMPOTENCY_REQUIRED',
    ]));
  });

  it('keeps bank reconciliation open unless imported source, category, link or exception, and stale/month-end reviews are handled', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'BANK_MATCH_CLOSE',
      facts: {
        bankTransactionImported: true,
        sourceAccountKnown: true,
        unmatchedOlderThan7Days: true,
        monthEndUnmatched: true,
      },
    }));

    expect(result.allowed).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining([
      'BANK_CATEGORY_REQUIRED',
      'BANK_LINK_OR_EXCEPTION_REQUIRED',
      'BANK_UNMATCHED_OLDER_THAN_7_DAYS',
      'MONTH_END_BANK_ACCOUNTANT_REVIEW_REQUIRED',
      'MONTH_END_BANK_NIR_REVIEW_REQUIRED',
    ]));
  });

  it('classifies Nir owner funding as loan/capital evidence, never income or VAT, and treats K9000 as an asset', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'OWNER_FUNDING_RECORD',
      facts: {},
    }));

    expect(result.allowed).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining([
      'NIR_FUNDING_SOURCE_REQUIRED',
      'OWNER_FUNDING_NOT_INCOME_REQUIRED',
      'OWNER_LOAN_NO_VAT_REQUIRED',
      'K9000_ASSET_CAPITALIZATION_REQUIRED',
      'OWNER_REPAYMENT_CLASSIFICATION_REQUIRED',
    ]));
  });

  it('blocks manual financial adjustments without evidence, control approval, VAT review, idempotency, and owner approval above threshold', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'MANUAL_FINANCIAL_ADJUSTMENT',
      facts: {
        refundReasonSelected: true,
      },
      money: {
        amountCents: 75_000,
        manualCreditThresholdCents: 50_000,
      },
    }));

    expect(result.allowed).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining([
      'MANUAL_ADJUSTMENT_EVIDENCE_REQUIRED',
      'MANUAL_ADJUSTMENT_CONTROL_APPROVAL_REQUIRED',
      'MANUAL_ADJUSTMENT_VAT_REVIEW_REQUIRED',
      'MANUAL_ADJUSTMENT_IDEMPOTENCY_REQUIRED',
      'MANUAL_ADJUSTMENT_NIR_APPROVAL_REQUIRED',
    ]));
  });

  it('blocks automation from approving money actions and blocks self-approval', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'CUSTOMER_REFUND',
      actor: { id: 'agent-1', role: 'ai_agent' },
      bankMatchStatus: 'matched',
      approvals: [
        { approver: 'NIR', actorId: 'agent-1', status: 'approved' },
      ],
      facts: {
        originalOrderOrPaymentExists: true,
        refundReasonSelected: true,
        evidenceAttachedIfRequired: true,
        providerPayoutImpactChecked: true,
        approvalThresholdApplied: true,
        sumitCreditNoteRequirementChecked: true,
        highRiskRefund: true,
      },
    }));

    expect(result.allowed).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining([
      'AI_CANNOT_APPROVE_MONEY_ACTION',
      'SELF_APPROVAL_BLOCKED',
      'HIGH_REFUND_NIR_APPROVAL_REQUIRED',
    ]));
  });

  it('allows a fully reviewed provider activation when all controls and independent approvals exist', () => {
    const result = evaluateOperatingAction(baseInput({
      actionType: 'PROVIDER_ACTIVATION',
      taxClassification: 'private_individual',
      approvals: [
        { approver: 'LEGAL', actorId: 'legal-1', status: 'approved' },
        { approver: 'ACCOUNTANT', actorId: 'accountant-1', status: 'approved' },
      ],
      facts: {
        identityApproved: true,
        taxDeclarationSigned: true,
        contractSigned: true,
        bankVerified: true,
        insuranceApproved: true,
        complianceApproved: true,
        ownerApproved: true,
        providerManagerApproved: true,
      },
    }));

    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.riskLevel).toBe('LOW');
    expect(result.audit.hashChainRequired).toBe(true);
  });
});
