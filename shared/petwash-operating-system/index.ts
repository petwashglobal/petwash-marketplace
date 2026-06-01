export const PETWASH_OPERATING_SYSTEM_VERSION = 'petwash-operating-system-2026-06-01';

export type OperatingActionType =
  | 'PROVIDER_ACTIVATION'
  | 'PROVIDER_PAYOUT'
  | 'SUPPLIER_PAYMENT'
  | 'EMPLOYEE_REIMBURSEMENT'
  | 'CUSTOMER_REFUND'
  | 'WALLET_CREDIT_CREATE'
  | 'WALLET_CREDIT_REDEEM'
  | 'WALLET_CREDIT_EXPIRE'
  | 'SUMIT_OFFICIAL_POSTING'
  | 'BANK_MATCH_CLOSE'
  | 'OWNER_FUNDING_RECORD'
  | 'MANUAL_FINANCIAL_ADJUSTMENT';

export type OperatingActorRole =
  | 'system'
  | 'ai_agent'
  | 'support'
  | 'provider_manager'
  | 'finance'
  | 'accountant'
  | 'legal'
  | 'nir'
  | 'admin';

export type OperatingApprover =
  | 'NIR'
  | 'ACCOUNTANT'
  | 'LEGAL'
  | 'FINANCE'
  | 'PROVIDER_MANAGER'
  | 'SUPPORT'
  | 'ENGINEERING';
export type OperatingSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
export type OperatingRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
export type EvidenceState = 'MISSING' | 'PENDING_REVIEW' | 'APPROVED' | 'WAIVED_BY_OWNER';
export type TaxClassification = 'patur' | 'murshe' | 'chevra' | 'private_individual' | 'unknown';
export type BankMatchStatus = 'missing' | 'pending_match' | 'matched' | 'exception_open' | 'closed';
export type CreditType =
  | 'PAID_GIFT_CARD'
  | 'E_GIFT_CARD'
  | 'STORE_CREDIT'
  | 'REFUND_CREDIT'
  | 'PROMOTIONAL_CREDIT'
  | 'BIRTHDAY_CREDIT'
  | 'LOYALTY_CREDIT'
  | 'GOODWILL_CREDIT';

export interface OperatingActor {
  id: string;
  role: OperatingActorRole;
}

export interface ApprovalFact {
  approver: OperatingApprover;
  actorId: string;
  status: 'approved' | 'denied' | 'pending';
}

export interface OperatingFacts {
  identityApproved?: boolean;
  taxDeclarationSigned?: boolean;
  contractSigned?: boolean;
  bankVerified?: boolean;
  insuranceApproved?: boolean;
  insuranceWaivedByCompliance?: boolean;
  complianceApproved?: boolean;
  ownerApproved?: boolean;
  providerManagerApproved?: boolean;
  reconfirmationExpired?: boolean;
  providerActive?: boolean;
  jobCompleted?: boolean;
  customerPaymentReceivedOrApproved?: boolean;
  providerInvoiceUploadedIfRequired?: boolean;
  taxStatusChecked?: boolean;
  vatTreatmentChecked?: boolean;
  openComplaintOrRefundHold?: boolean;
  payoutApproved?: boolean;
  bankTransferReferenceCreated?: boolean;
  supplierApproved?: boolean;
  supplierInvoiceUploaded?: boolean;
  duplicateCheckPassed?: boolean;
  paymentApproved?: boolean;
  bankAccountRecentlyChanged?: boolean;
  secondApprovalForBankChange?: boolean;
  accountantReviewCompleted?: boolean;
  documentHasVat?: boolean;
  employeeProfileExists?: boolean;
  personIsProvider?: boolean;
  receiptUploaded?: boolean;
  businessPurposeRecorded?: boolean;
  managerApproved?: boolean;
  reimbursementApproved?: boolean;
  originalOrderOrPaymentExists?: boolean;
  refundReasonSelected?: boolean;
  evidenceAttachedIfRequired?: boolean;
  providerPayoutImpactChecked?: boolean;
  approvalThresholdApplied?: boolean;
  sumitCreditNoteRequirementChecked?: boolean;
  highRiskRefund?: boolean;
  fraudChargebackOrLegalIssue?: boolean;
  paymentReferenceExists?: boolean;
  receiptReferenceExists?: boolean;
  refundCaseExists?: boolean;
  redemptionOrderLinked?: boolean;
  cashOutRequested?: boolean;
  manualStaffCredit?: boolean;
  expiryRuleDocumented?: boolean;
  legalExpiryAllowed?: boolean;
  localControlApproved?: boolean;
  documentTypeConfirmed?: boolean;
  vatStatusReviewed?: boolean;
  sourceEvidenceExists?: boolean;
  highRiskFlagResolved?: boolean;
  classificationConflict?: boolean;
  idempotencyKeyExists?: boolean;
  bankTransactionImported?: boolean;
  sourceAccountKnown?: boolean;
  transactionCategorySelected?: boolean;
  linkedRecordExists?: boolean;
  exceptionReasonExists?: boolean;
  unmatchedOlderThan7Days?: boolean;
  monthEndUnmatched?: boolean;
  nirFundingSourceRecorded?: boolean;
  ownerLoanMarkedNotIncome?: boolean;
  ownerLoanVatExcluded?: boolean;
  k9000AssetCapitalized?: boolean;
  repaymentClassificationAccountantApproved?: boolean;
}

export interface OperatingMoneyFacts {
  amountCents?: number;
  originalCustomerPriceCents?: number;
  discountAmountCents?: number;
  finalCustomerPaidCents?: number;
  discountFundedBy?: 'PET_WASH' | 'PROVIDER' | 'SUPPLIER' | 'FRANCHISEE' | 'SHARED';
  providerBasePayoutCents?: number;
  providerAgreementAllowsDiscountReduction?: boolean;
  manualCreditThresholdCents?: number;
  creditOriginalAmountCents?: number;
  creditRemainingBalanceCents?: number;
  creditRedemptionAmountCents?: number;
}

export interface OperatingInput {
  actionType: OperatingActionType;
  actor: OperatingActor;
  targetId: string;
  taxClassification?: TaxClassification;
  creditType?: CreditType;
  paidOrFree?: 'paid' | 'free';
  bankMatchStatus?: BankMatchStatus;
  facts: OperatingFacts;
  money?: OperatingMoneyFacts;
  approvals?: ApprovalFact[];
  evidence?: Partial<Record<string, EvidenceState>>;
}

export interface OperatingBlocker {
  code: string;
  severity: OperatingSeverity;
  approver: OperatingApprover;
  message: string;
  nextAction: string;
}

export interface OperatingAuditPlan {
  eventType: string;
  hashChainRequired: boolean;
  requiredFields: string[];
}

export interface ProviderPayoutDecision {
  originalCustomerPriceCents: number;
  discountAmountCents: number;
  finalCustomerPaidCents: number;
  providerBasePayoutCents: number;
  providerPayoutAdjustmentCents: number;
  finalProviderPayoutCents: number;
  agreementRuleUsed: string;
}

export interface OperatingDecision {
  allowed: boolean;
  version: string;
  riskLevel: OperatingRiskLevel;
  blockers: OperatingBlocker[];
  requiredApprovals: OperatingApprover[];
  requiredEvidence: string[];
  audit: OperatingAuditPlan;
  providerPayout?: ProviderPayoutDecision;
}

const MONEY_ACTIONS: OperatingActionType[] = [
  'PROVIDER_PAYOUT',
  'SUPPLIER_PAYMENT',
  'EMPLOYEE_REIMBURSEMENT',
  'CUSTOMER_REFUND',
  'WALLET_CREDIT_CREATE',
  'WALLET_CREDIT_REDEEM',
  'WALLET_CREDIT_EXPIRE',
  'SUMIT_OFFICIAL_POSTING',
  'BANK_MATCH_CLOSE',
  'OWNER_FUNDING_RECORD',
  'MANUAL_FINANCIAL_ADJUSTMENT',
];

function blocker(
  code: string,
  severity: OperatingSeverity,
  approver: OperatingApprover,
  message: string,
  nextAction: string,
): OperatingBlocker {
  return { code, severity, approver, message, nextAction };
}

function requireFact(
  blockers: OperatingBlocker[],
  facts: OperatingFacts,
  key: keyof OperatingFacts,
  code: string,
  approver: OperatingApprover,
  message: string,
  nextAction: string,
  severity: OperatingSeverity = 'BLOCKED',
): void {
  if (!facts[key]) blockers.push(blocker(code, severity, approver, message, nextAction));
}

function hasApproval(input: OperatingInput, approver: OperatingApprover): boolean {
  return (input.approvals ?? []).some((approval) => {
    if (approval.approver !== approver || approval.status !== 'approved') return false;
    return approval.actorId !== input.actor.id;
  });
}

function requireApproval(
  blockers: OperatingBlocker[],
  input: OperatingInput,
  approver: OperatingApprover,
  code: string,
  message: string,
  nextAction: string,
  severity: OperatingSeverity = 'BLOCKED',
): void {
  if (!hasApproval(input, approver)) blockers.push(blocker(code, severity, approver, message, nextAction));
}

function requireBankMatch(blockers: OperatingBlocker[], input: OperatingInput): void {
  if (input.bankMatchStatus !== 'pending_match' && input.bankMatchStatus !== 'matched') {
    blockers.push(blocker(
      'BANK_MATCH_STATUS_REQUIRED',
      'BLOCKED',
      'FINANCE',
      'Bank match status must exist and be pending_match or matched.',
      'Create a bank match record or keep the payment/refund in pending match.',
    ));
  }
}

function riskFromBlockers(blockers: OperatingBlocker[]): OperatingRiskLevel {
  if (blockers.some((b) => b.severity === 'BLOCKED')) return 'BLOCKED';
  if (blockers.some((b) => b.severity === 'HIGH')) return 'HIGH';
  if (blockers.some((b) => b.severity === 'MEDIUM')) return 'MEDIUM';
  return 'LOW';
}

function uniqueApprovers(blockers: OperatingBlocker[]): OperatingApprover[] {
  return Array.from(new Set(blockers.map((b) => b.approver)));
}

function requiredEvidenceFromBlockers(blockers: OperatingBlocker[]): string[] {
  const evidence = blockers
    .filter((b) => b.code.includes('EVIDENCE') || b.code.includes('DOCUMENT') || b.code.includes('INVOICE') || b.code.includes('RECEIPT'))
    .map((b) => b.code);
  return Array.from(new Set(evidence));
}

export function calculateProviderPayoutAfterDiscount(
  money: Required<Pick<
    OperatingMoneyFacts,
    'originalCustomerPriceCents' | 'discountAmountCents' | 'finalCustomerPaidCents' | 'providerBasePayoutCents'
  >> & Pick<OperatingMoneyFacts, 'discountFundedBy' | 'providerAgreementAllowsDiscountReduction'>,
): ProviderPayoutDecision {
  const fundedBy = money.discountFundedBy ?? 'PET_WASH';
  const canReduceProvider =
    fundedBy === 'PROVIDER' ||
    (fundedBy === 'SHARED' && money.providerAgreementAllowsDiscountReduction === true);
  const adjustment = canReduceProvider ? -Math.max(0, money.discountAmountCents) : 0;

  return {
    originalCustomerPriceCents: money.originalCustomerPriceCents,
    discountAmountCents: money.discountAmountCents,
    finalCustomerPaidCents: money.finalCustomerPaidCents,
    providerBasePayoutCents: money.providerBasePayoutCents,
    providerPayoutAdjustmentCents: adjustment,
    finalProviderPayoutCents: Math.max(0, money.providerBasePayoutCents + adjustment),
    agreementRuleUsed: canReduceProvider
      ? 'provider_discount_reduction_allowed_by_funding_or_signed_agreement'
      : 'petwash_discount_does_not_reduce_provider_payout_by_default',
  };
}

function auditPlan(input: OperatingInput): OperatingAuditPlan {
  return {
    eventType: `petwash.operating_control.${input.actionType.toLowerCase()}`,
    hashChainRequired: true,
    requiredFields: [
      'actorId',
      'actorRole',
      'actionType',
      'targetId',
      'controlResult',
      'blockerCodes',
      'requiredApprovals',
      'idempotencyKey',
      'createdAt',
    ],
  };
}

function applyCommonControls(input: OperatingInput, blockers: OperatingBlocker[]): void {
  if (input.actor.role === 'ai_agent' && MONEY_ACTIONS.includes(input.actionType)) {
    blockers.push(blocker(
      'AI_CANNOT_APPROVE_MONEY_ACTION',
      'BLOCKED',
      'NIR',
      'AI/automation may suggest, but it cannot approve money, VAT, SUMIT, bank, payout, or credit actions.',
      'Route the action to the human approval queue.',
    ));
  }

  if ((input.approvals ?? []).some((approval) => approval.status === 'approved' && approval.actorId === input.actor.id)) {
    blockers.push(blocker(
      'SELF_APPROVAL_BLOCKED',
      'BLOCKED',
      'NIR',
      'The actor cannot approve their own high-risk action.',
      'Request approval from a different authorized person.',
    ));
  }
}

function applyProviderActivation(input: OperatingInput, blockers: OperatingBlocker[]): void {
  const f = input.facts;
  requireFact(blockers, f, 'identityApproved', 'PROVIDER_IDENTITY_REQUIRED', 'PROVIDER_MANAGER', 'Provider identity is not approved.', 'Approve identity evidence before activation.');
  requireFact(blockers, f, 'taxDeclarationSigned', 'PROVIDER_TAX_DECLARATION_REQUIRED', 'ACCOUNTANT', 'Provider tax declaration is not signed.', 'Collect signed Israeli tax/business declaration.');
  requireFact(blockers, f, 'contractSigned', 'PROVIDER_CONTRACT_REQUIRED', 'LEGAL', 'Provider agreement is not signed.', 'Collect signed provider agreement and privacy/data terms.');
  requireFact(blockers, f, 'bankVerified', 'PROVIDER_BANK_REQUIRED', 'FINANCE', 'Provider bank details are not verified.', 'Verify bank account evidence before activation.');
  if (!f.insuranceApproved && !f.insuranceWaivedByCompliance) {
    blockers.push(blocker('PROVIDER_INSURANCE_REQUIRED', 'BLOCKED', 'LEGAL', 'Insurance is neither approved nor waived by compliance.', 'Approve insurance evidence or record a compliance waiver.'));
  }
  requireFact(blockers, f, 'complianceApproved', 'PROVIDER_COMPLIANCE_REQUIRED', 'LEGAL', 'Compliance review is not approved.', 'Complete compliance review.');
  requireFact(blockers, f, 'ownerApproved', 'PROVIDER_OWNER_APPROVAL_REQUIRED', 'NIR', 'Owner approval is missing.', 'Nir must approve provider activation.');
  requireFact(blockers, f, 'providerManagerApproved', 'PROVIDER_MANAGER_APPROVAL_REQUIRED', 'PROVIDER_MANAGER', 'Provider manager approval is missing.', 'Provider manager must approve operational readiness.');
  if (f.reconfirmationExpired) {
    blockers.push(blocker('PROVIDER_RECONFIRMATION_EXPIRED', 'BLOCKED', 'PROVIDER_MANAGER', 'Six-month reconfirmation is expired.', 'Reconfirm provider details and documents before activation.'));
  }
  if (input.taxClassification === 'private_individual') {
    requireApproval(blockers, input, 'LEGAL', 'PRIVATE_INDIVIDUAL_LEGAL_REVIEW_REQUIRED', 'Private individual provider requires legal review.', 'Legal must approve the relationship before activation.');
    requireApproval(blockers, input, 'ACCOUNTANT', 'PRIVATE_INDIVIDUAL_ACCOUNTANT_REVIEW_REQUIRED', 'Private individual provider requires accountant review.', 'Accountant must approve tax/payment handling.');
  }
  if (input.taxClassification === 'patur' && f.documentHasVat) {
    blockers.push(blocker('OSEK_PATUR_VAT_BLOCKED', 'BLOCKED', 'ACCOUNTANT', 'עוסק פטור document cannot include VAT claim logic.', 'Remove VAT claim or reclassify with accountant evidence.'));
  }
}

function applyProviderPayout(input: OperatingInput, blockers: OperatingBlocker[]): ProviderPayoutDecision | undefined {
  const f = input.facts;
  requireFact(blockers, f, 'providerActive', 'PROVIDER_MUST_BE_ACTIVE', 'PROVIDER_MANAGER', 'Provider is not active.', 'Activate provider through compliance flow before payout.');
  requireFact(blockers, f, 'jobCompleted', 'JOB_COMPLETION_REQUIRED', 'PROVIDER_MANAGER', 'Job/booking is not completed.', 'Close the job with completion evidence.');
  requireFact(blockers, f, 'customerPaymentReceivedOrApproved', 'CUSTOMER_PAYMENT_REQUIRED', 'FINANCE', 'Customer payment is not received or approved.', 'Verify payment/approved settlement before payout.');
  requireFact(blockers, f, 'providerInvoiceUploadedIfRequired', 'PROVIDER_INVOICE_REQUIRED', 'ACCOUNTANT', 'Provider invoice/receipt is missing where required.', 'Upload provider invoice/receipt or accountant waiver.');
  requireFact(blockers, f, 'bankVerified', 'PROVIDER_BANK_REQUIRED', 'FINANCE', 'Provider bank details are not verified.', 'Verify bank account before payout.');
  requireFact(blockers, f, 'taxStatusChecked', 'PROVIDER_TAX_CHECK_REQUIRED', 'ACCOUNTANT', 'Provider tax status is not checked.', 'Complete tax status review.');
  requireFact(blockers, f, 'vatTreatmentChecked', 'PROVIDER_VAT_CHECK_REQUIRED', 'ACCOUNTANT', 'VAT treatment is not checked.', 'Complete VAT treatment review.');
  if (f.openComplaintOrRefundHold) {
    blockers.push(blocker('OPEN_COMPLAINT_OR_REFUND_HOLD', 'BLOCKED', 'FINANCE', 'Open complaint/refund hold blocks payout.', 'Resolve complaint/refund impact before payout.'));
  }
  requireFact(blockers, f, 'payoutApproved', 'PAYOUT_APPROVAL_REQUIRED', 'FINANCE', 'Payout approval is missing.', 'Approve payout in finance queue.');
  requireFact(blockers, f, 'bankTransferReferenceCreated', 'BANK_TRANSFER_REFERENCE_REQUIRED', 'FINANCE', 'Bank transfer reference is missing.', 'Create transfer reference before payout execution.');
  requireBankMatch(blockers, input);

  const money = input.money;
  if (
    money?.originalCustomerPriceCents !== undefined &&
    money.discountAmountCents !== undefined &&
    money.finalCustomerPaidCents !== undefined &&
    money.providerBasePayoutCents !== undefined
  ) {
    return calculateProviderPayoutAfterDiscount({
      originalCustomerPriceCents: money.originalCustomerPriceCents,
      discountAmountCents: money.discountAmountCents,
      finalCustomerPaidCents: money.finalCustomerPaidCents,
      providerBasePayoutCents: money.providerBasePayoutCents,
      discountFundedBy: money.discountFundedBy,
      providerAgreementAllowsDiscountReduction: money.providerAgreementAllowsDiscountReduction,
    });
  }
  return undefined;
}

function applySupplierPayment(input: OperatingInput, blockers: OperatingBlocker[]): void {
  const f = input.facts;
  requireFact(blockers, f, 'supplierApproved', 'SUPPLIER_APPROVAL_REQUIRED', 'FINANCE', 'Supplier is not approved.', 'Approve supplier before payment.');
  requireFact(blockers, f, 'supplierInvoiceUploaded', 'SUPPLIER_INVOICE_REQUIRED', 'ACCOUNTANT', 'Supplier invoice is missing.', 'Upload supplier invoice.');
  requireFact(blockers, f, 'duplicateCheckPassed', 'DUPLICATE_CHECK_REQUIRED', 'FINANCE', 'Duplicate check did not pass.', 'Run duplicate invoice/payment check.');
  requireFact(blockers, f, 'vatTreatmentChecked', 'SUPPLIER_VAT_CHECK_REQUIRED', 'ACCOUNTANT', 'Supplier VAT is not checked.', 'Complete VAT review.');
  requireFact(blockers, f, 'bankVerified', 'SUPPLIER_BANK_REQUIRED', 'FINANCE', 'Supplier bank account is not verified.', 'Verify bank details.');
  if (f.bankAccountRecentlyChanged && !f.secondApprovalForBankChange) {
    blockers.push(blocker('SUPPLIER_BANK_CHANGE_SECOND_APPROVAL_REQUIRED', 'BLOCKED', 'NIR', 'Recent supplier bank change needs second approval.', 'Get second approval before payment.'));
  }
  requireFact(blockers, f, 'paymentApproved', 'SUPPLIER_PAYMENT_APPROVAL_REQUIRED', 'FINANCE', 'Supplier payment approval is missing.', 'Approve supplier payment.');
  if ((input.taxClassification === 'patur' || input.taxClassification === 'private_individual') && f.documentHasVat) {
    blockers.push(blocker('OSEK_PATUR_SUPPLIER_VAT_BLOCKED', 'BLOCKED', 'ACCOUNTANT', 'עוסק פטור/private document includes VAT.', 'Block payment until accountant corrects VAT treatment.'));
  }
  if (f.documentHasVat && !f.accountantReviewCompleted) {
    blockers.push(blocker('VAT_ISSUE_ACCOUNTANT_REVIEW_REQUIRED', 'BLOCKED', 'ACCOUNTANT', 'VAT/tax issue requires accountant review.', 'Complete accountant review before payment.'));
  }
  requireBankMatch(blockers, input);
}

function applyEmployeeReimbursement(input: OperatingInput, blockers: OperatingBlocker[]): void {
  const f = input.facts;
  requireFact(blockers, f, 'employeeProfileExists', 'EMPLOYEE_PROFILE_REQUIRED', 'FINANCE', 'Employee profile is missing.', 'Create/verify employee HR profile.');
  if (f.personIsProvider) {
    blockers.push(blocker('EMPLOYEE_PROVIDER_MIX_BLOCKED', 'BLOCKED', 'LEGAL', 'Employee reimbursement cannot be mixed with provider payment.', 'Separate employee HR/payroll flow from provider flow.'));
  }
  requireFact(blockers, f, 'receiptUploaded', 'EMPLOYEE_RECEIPT_REQUIRED', 'ACCOUNTANT', 'Receipt is missing.', 'Upload receipt.');
  requireFact(blockers, f, 'businessPurposeRecorded', 'BUSINESS_PURPOSE_REQUIRED', 'FINANCE', 'Business purpose is missing.', 'Record business purpose.');
  requireFact(blockers, f, 'managerApproved', 'MANAGER_APPROVAL_REQUIRED', 'FINANCE', 'Manager approval is missing.', 'Manager must approve reimbursement.');
  if (f.documentHasVat && !f.accountantReviewCompleted) {
    blockers.push(blocker('EMPLOYEE_VAT_REVIEW_REQUIRED', 'BLOCKED', 'ACCOUNTANT', 'VAT issue requires accountant review.', 'Complete accountant review.'));
  }
  requireFact(blockers, f, 'reimbursementApproved', 'REIMBURSEMENT_APPROVAL_REQUIRED', 'FINANCE', 'Reimbursement approval is missing.', 'Approve reimbursement.');
  requireBankMatch(blockers, input);
}

function applyRefund(input: OperatingInput, blockers: OperatingBlocker[]): void {
  const f = input.facts;
  requireFact(blockers, f, 'originalOrderOrPaymentExists', 'ORIGINAL_PAYMENT_REQUIRED', 'FINANCE', 'Original order/payment is missing.', 'Link original payment before refund.');
  requireFact(blockers, f, 'refundReasonSelected', 'REFUND_REASON_REQUIRED', 'SUPPORT', 'Refund reason is missing.', 'Select refund reason.');
  requireFact(blockers, f, 'evidenceAttachedIfRequired', 'REFUND_EVIDENCE_REQUIRED', 'FINANCE', 'Required refund evidence is missing.', 'Attach refund evidence.');
  requireFact(blockers, f, 'providerPayoutImpactChecked', 'PROVIDER_IMPACT_REQUIRED', 'FINANCE', 'Provider payout impact is not checked.', 'Check provider payout impact.');
  requireFact(blockers, f, 'approvalThresholdApplied', 'REFUND_THRESHOLD_REQUIRED', 'FINANCE', 'Refund threshold rule was not applied.', 'Apply refund approval matrix.');
  requireFact(blockers, f, 'sumitCreditNoteRequirementChecked', 'SUMIT_CREDIT_NOTE_CHECK_REQUIRED', 'ACCOUNTANT', 'SUMIT credit note requirement is not checked.', 'Accountant must decide credit note requirement.');
  if (f.highRiskRefund) {
    requireApproval(blockers, input, 'NIR', 'HIGH_REFUND_NIR_APPROVAL_REQUIRED', 'High-value/high-risk refund requires Nir approval.', 'Route to Nir approval queue.');
  }
  if (f.fraudChargebackOrLegalIssue) {
    requireApproval(blockers, input, 'NIR', 'FRAUD_REFUND_NIR_APPROVAL_REQUIRED', 'Fraud/chargeback/legal refund requires Nir approval.', 'Route to Nir approval queue.');
    requireApproval(blockers, input, 'ACCOUNTANT', 'FRAUD_REFUND_ACCOUNTANT_REVIEW_REQUIRED', 'Fraud/chargeback/legal refund requires accountant review.', 'Route to accountant review.');
    requireApproval(blockers, input, 'LEGAL', 'FRAUD_REFUND_LEGAL_REVIEW_REQUIRED', 'Fraud/chargeback/legal refund requires legal review.', 'Route to legal review.');
  }
  requireBankMatch(blockers, input);
}

function isFreeCredit(type: CreditType | undefined): boolean {
  return type === 'PROMOTIONAL_CREDIT' || type === 'BIRTHDAY_CREDIT' || type === 'LOYALTY_CREDIT' || type === 'GOODWILL_CREDIT';
}

function applyWalletCredit(input: OperatingInput, blockers: OperatingBlocker[]): void {
  const f = input.facts;
  const money = input.money ?? {};
  if ((input.creditType === 'PAID_GIFT_CARD' || input.creditType === 'E_GIFT_CARD') && (!f.paymentReferenceExists || !f.receiptReferenceExists)) {
    blockers.push(blocker('PAID_GIFT_CARD_PAYMENT_RECEIPT_REQUIRED', 'BLOCKED', 'ACCOUNTANT', 'Paid gift/e-gift card requires payment and receipt references.', 'Link real payment and SUMIT/receipt provider document before issuing.'));
  }
  if (input.creditType === 'REFUND_CREDIT' && !f.refundCaseExists) {
    blockers.push(blocker('REFUND_CREDIT_CASE_REQUIRED', 'BLOCKED', 'FINANCE', 'Refund credit requires a refund case.', 'Link refund case before issuing credit.'));
  }
  if (input.paidOrFree === 'paid' && isFreeCredit(input.creditType)) {
    blockers.push(blocker('PAID_FREE_CREDIT_MIX_BLOCKED', 'BLOCKED', 'ACCOUNTANT', 'Paid credit cannot be mixed with promotional/free credit.', 'Use separate ledgers and credit types.'));
  }
  if (f.cashOutRequested && isFreeCredit(input.creditType)) {
    blockers.push(blocker('PROMO_CREDIT_CASH_OUT_BLOCKED', 'BLOCKED', 'FINANCE', 'Promotional, birthday, loyalty, and goodwill credit cannot be cashed out by default.', 'Reject cash-out or route an owner/legal exception.'));
  }
  if (
    input.actionType === 'WALLET_CREDIT_CREATE' &&
    f.manualStaffCredit &&
    money.manualCreditThresholdCents !== undefined &&
    (money.creditOriginalAmountCents ?? 0) > money.manualCreditThresholdCents
  ) {
    requireApproval(blockers, input, 'NIR', 'MANUAL_CREDIT_NIR_APPROVAL_REQUIRED', 'Manual staff credit above threshold requires owner approval.', 'Route manual credit to Nir approval queue.');
  }
  if (input.actionType === 'WALLET_CREDIT_CREATE' && f.manualStaffCredit) {
    requireFact(blockers, f, 'localControlApproved', 'MANUAL_CREDIT_CONTROL_APPROVAL_REQUIRED', 'FINANCE', 'Manual staff credit is missing local control approval.', 'Approve the credit in the operating-control queue before changing balance.');
    requireFact(blockers, f, 'sourceEvidenceExists', 'MANUAL_CREDIT_EVIDENCE_REQUIRED', 'FINANCE', 'Manual staff credit is missing source evidence.', 'Link support ticket, refund case, owner approval, or campaign evidence before issuing credit.');
  }
  if (input.actionType === 'WALLET_CREDIT_REDEEM') {
    requireFact(blockers, f, 'redemptionOrderLinked', 'CREDIT_REDEMPTION_ORDER_REQUIRED', 'FINANCE', 'Credit redemption requires linked order.', 'Link redemption to order/booking.');
    if ((money.creditRedemptionAmountCents ?? 0) > (money.creditRemainingBalanceCents ?? 0)) {
      blockers.push(blocker('CREDIT_REDEMPTION_EXCEEDS_BALANCE', 'BLOCKED', 'FINANCE', 'Redemption exceeds remaining balance.', 'Reject redemption or correct balance.'));
    }
  }
  if (input.actionType === 'WALLET_CREDIT_EXPIRE') {
    if ((input.paidOrFree === 'paid' || input.creditType === 'PAID_GIFT_CARD' || input.creditType === 'E_GIFT_CARD') && !f.legalExpiryAllowed) {
      blockers.push(blocker('PAID_BALANCE_EXPIRY_NOT_ALLOWED', 'BLOCKED', 'LEGAL', 'Unused paid balance cannot silently disappear without documented legal rule.', 'Keep paid balance active or obtain legal/accountant rule.'));
    }
    requireFact(blockers, f, 'expiryRuleDocumented', 'CREDIT_EXPIRY_RULE_REQUIRED', 'LEGAL', 'Credit expiry rule is not documented.', 'Document and display legal expiry rule.');
  }
  if (!f.vatStatusReviewed) {
    blockers.push(blocker('CREDIT_VAT_ACCOUNTANT_PENDING', 'HIGH', 'ACCOUNTANT', 'Credit VAT/SUMIT status must remain accountant pending until confirmed.', 'Route to accountant/SUMIT review.'));
  }
}

function applySumitPosting(input: OperatingInput, blockers: OperatingBlocker[]): void {
  const f = input.facts;
  requireFact(blockers, f, 'localControlApproved', 'LOCAL_CONTROL_APPROVAL_REQUIRED', 'FINANCE', 'Local control status is not approved.', 'Approve local control state first.');
  requireFact(blockers, f, 'documentTypeConfirmed', 'SUMIT_DOCUMENT_TYPE_REQUIRED', 'ACCOUNTANT', 'SUMIT document type is not confirmed.', 'Confirm document type with accountant/SUMIT.');
  requireFact(blockers, f, 'vatStatusReviewed', 'SUMIT_VAT_REVIEW_REQUIRED', 'ACCOUNTANT', 'VAT status is not reviewed.', 'Complete VAT review.');
  requireFact(blockers, f, 'sourceEvidenceExists', 'SUMIT_SOURCE_EVIDENCE_REQUIRED', 'ACCOUNTANT', 'Source evidence is missing.', 'Attach source evidence before official posting.');
  if (f.highRiskFlagResolved === false) {
    blockers.push(blocker('HIGH_RISK_FLAG_UNRESOLVED', 'BLOCKED', 'NIR', 'High-risk flag is unresolved.', 'Resolve high-risk flag before SUMIT posting.'));
  }
  if (f.classificationConflict) {
    blockers.push(blocker('CLASSIFICATION_CONFLICT_BLOCKED', 'BLOCKED', 'LEGAL', 'Provider/supplier/employee classification conflict exists.', 'Resolve classification conflict.'));
  }
  if (input.taxClassification === 'patur' && f.documentHasVat) {
    blockers.push(blocker('SUMIT_OSEK_PATUR_VAT_BLOCKED', 'BLOCKED', 'ACCOUNTANT', 'עוסק פטור cannot create VAT claim posting.', 'Correct VAT treatment before SUMIT posting.'));
  }
  requireFact(blockers, f, 'idempotencyKeyExists', 'SUMIT_IDEMPOTENCY_REQUIRED', 'ENGINEERING', 'SUMIT idempotency key is missing.', 'Create stable idempotency key before posting.');
}

function applyBankMatchClose(input: OperatingInput, blockers: OperatingBlocker[]): void {
  const f = input.facts;
  requireFact(blockers, f, 'bankTransactionImported', 'BANK_TRANSACTION_IMPORTED_REQUIRED', 'FINANCE', 'Bank transaction was not imported safely.', 'Import bank transaction through approved read-only/import path.');
  requireFact(blockers, f, 'sourceAccountKnown', 'BANK_SOURCE_ACCOUNT_REQUIRED', 'FINANCE', 'Source account is unknown.', 'Identify source bank account.');
  requireFact(blockers, f, 'transactionCategorySelected', 'BANK_CATEGORY_REQUIRED', 'ACCOUNTANT', 'Transaction category is not selected.', 'Select accounting category.');
  if (!f.linkedRecordExists && !f.exceptionReasonExists) {
    blockers.push(blocker('BANK_LINK_OR_EXCEPTION_REQUIRED', 'BLOCKED', 'FINANCE', 'Bank match needs linked record or exception reason.', 'Link payment/refund/invoice/order or open exception.'));
  }
  if (f.unmatchedOlderThan7Days) {
    blockers.push(blocker('BANK_UNMATCHED_OLDER_THAN_7_DAYS', 'HIGH', 'FINANCE', 'Unmatched bank transaction older than 7 days requires exception review.', 'Open finance exception.'));
  }
  if (f.monthEndUnmatched) {
    requireApproval(blockers, input, 'ACCOUNTANT', 'MONTH_END_BANK_ACCOUNTANT_REVIEW_REQUIRED', 'Month-end unmatched item requires accountant review.', 'Route to accountant review.');
    requireApproval(blockers, input, 'NIR', 'MONTH_END_BANK_NIR_REVIEW_REQUIRED', 'Month-end unmatched item requires owner review.', 'Route to Nir review.');
  }
}

function applyOwnerFunding(input: OperatingInput, blockers: OperatingBlocker[]): void {
  const f = input.facts;
  requireFact(blockers, f, 'nirFundingSourceRecorded', 'NIR_FUNDING_SOURCE_REQUIRED', 'FINANCE', 'Nir funding source is not recorded.', 'Record director loan/source reference.');
  requireFact(blockers, f, 'ownerLoanMarkedNotIncome', 'OWNER_FUNDING_NOT_INCOME_REQUIRED', 'ACCOUNTANT', 'Owner funding must not be treated as income.', 'Classify as owner/director loan pending accountant.');
  requireFact(blockers, f, 'ownerLoanVatExcluded', 'OWNER_LOAN_NO_VAT_REQUIRED', 'ACCOUNTANT', 'Owner loan itself has no VAT.', 'Exclude loan movement from VAT.');
  requireFact(blockers, f, 'k9000AssetCapitalized', 'K9000_ASSET_CAPITALIZATION_REQUIRED', 'ACCOUNTANT', 'K9000 machine must be capital/asset item, not normal expense.', 'Link to asset register and accountant review.');
  requireFact(blockers, f, 'repaymentClassificationAccountantApproved', 'OWNER_REPAYMENT_CLASSIFICATION_REQUIRED', 'ACCOUNTANT', 'Repayment to Nir must not be salary/supplier/dividend unless accountant classifies it.', 'Accountant must classify repayment.');
}

function applyManualFinancialAdjustment(input: OperatingInput, blockers: OperatingBlocker[]): void {
  const f = input.facts;
  requireFact(blockers, f, 'refundReasonSelected', 'MANUAL_ADJUSTMENT_REASON_REQUIRED', 'FINANCE', 'Manual adjustment reason is missing.', 'Record a specific correction reason.');
  requireFact(blockers, f, 'sourceEvidenceExists', 'MANUAL_ADJUSTMENT_EVIDENCE_REQUIRED', 'ACCOUNTANT', 'Manual adjustment source evidence is missing.', 'Attach invoice, receipt, payment, booking, or correction evidence.');
  requireFact(blockers, f, 'localControlApproved', 'MANUAL_ADJUSTMENT_CONTROL_APPROVAL_REQUIRED', 'FINANCE', 'Manual adjustment local control is not approved.', 'Approve adjustment through finance control.');
  requireFact(blockers, f, 'vatStatusReviewed', 'MANUAL_ADJUSTMENT_VAT_REVIEW_REQUIRED', 'ACCOUNTANT', 'Manual adjustment VAT/accounting treatment is not reviewed.', 'Route adjustment to accountant/SUMIT review.');
  requireFact(blockers, f, 'idempotencyKeyExists', 'MANUAL_ADJUSTMENT_IDEMPOTENCY_REQUIRED', 'ENGINEERING', 'Manual adjustment idempotency key is missing.', 'Create stable idempotency key before recording adjustment.');
  if ((input.money?.amountCents ?? 0) >= (input.money?.manualCreditThresholdCents ?? Number.MAX_SAFE_INTEGER)) {
    requireApproval(blockers, input, 'NIR', 'MANUAL_ADJUSTMENT_NIR_APPROVAL_REQUIRED', 'Manual financial adjustment above threshold requires Nir approval.', 'Route adjustment to Nir approval queue.');
  }
}

export function evaluateOperatingAction(input: OperatingInput): OperatingDecision {
  const blockers: OperatingBlocker[] = [];
  applyCommonControls(input, blockers);

  let providerPayout: ProviderPayoutDecision | undefined;
  switch (input.actionType) {
    case 'PROVIDER_ACTIVATION':
      applyProviderActivation(input, blockers);
      break;
    case 'PROVIDER_PAYOUT':
      providerPayout = applyProviderPayout(input, blockers);
      break;
    case 'SUPPLIER_PAYMENT':
      applySupplierPayment(input, blockers);
      break;
    case 'EMPLOYEE_REIMBURSEMENT':
      applyEmployeeReimbursement(input, blockers);
      break;
    case 'CUSTOMER_REFUND':
      applyRefund(input, blockers);
      break;
    case 'WALLET_CREDIT_CREATE':
    case 'WALLET_CREDIT_REDEEM':
    case 'WALLET_CREDIT_EXPIRE':
      applyWalletCredit(input, blockers);
      break;
    case 'SUMIT_OFFICIAL_POSTING':
      applySumitPosting(input, blockers);
      break;
    case 'BANK_MATCH_CLOSE':
      applyBankMatchClose(input, blockers);
      break;
    case 'OWNER_FUNDING_RECORD':
      applyOwnerFunding(input, blockers);
      break;
    case 'MANUAL_FINANCIAL_ADJUSTMENT':
      applyManualFinancialAdjustment(input, blockers);
      break;
  }

  return {
    allowed: blockers.length === 0,
    version: PETWASH_OPERATING_SYSTEM_VERSION,
    riskLevel: riskFromBlockers(blockers),
    blockers,
    requiredApprovals: uniqueApprovers(blockers),
    requiredEvidence: requiredEvidenceFromBlockers(blockers),
    audit: auditPlan(input),
    providerPayout,
  };
}
