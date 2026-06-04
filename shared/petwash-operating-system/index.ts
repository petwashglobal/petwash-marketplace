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
  | 'COMPLIANCE'
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

export type PetWashBusinessLine =
  | 'STATION'
  | 'SHOP'
  | 'PLATFORM'
  | 'SUPPLIER_PAYABLE'
  | 'FRANCHISE';

export type PetWashRole =
  | 'customer'
  | 'provider_applicant'
  | 'provider_pending_review'
  | 'provider_approved'
  | 'provider_suspended'
  | 'provider_rejected'
  | 'supplier_applicant'
  | 'supplier_approved'
  | 'merchant_partner'
  | 'academy_partner'
  | 'staff'
  | 'admin'
  | 'super_admin'
  | 'finance_admin'
  | 'compliance_admin'
  | 'support_admin';

export type PetWashSurface =
  | 'CUSTOMER_APP'
  | 'PROVIDER_APPLY'
  | 'PROVIDER_DASHBOARD'
  | 'PARTNER_PORTAL'
  | 'ADMIN_CONTROL_PLANE';

export type RoleSource =
  | 'database'
  | 'server_claims'
  | 'client_body'
  | 'query'
  | 'local_storage';

export type ProviderComplianceStatus =
  | 'draft'
  | 'submitted'
  | 'pending_kyc'
  | 'pending_documents'
  | 'pending_tax_declaration'
  | 'pending_insurance_review'
  | 'pending_admin_review'
  | 'approved'
  | 'compliance_expiring'
  | 'compliance_expired'
  | 'suspended'
  | 'rejected'
  | 'terminated';

export type PetWashPassKind = 'CUSTOMER_MEMBER_PASS' | 'PROVIDER_PARTNER_PASS';
export type PetWashPassOperation =
  | 'CUSTOMER_REDEMPTION'
  | 'PROVIDER_CHECK_IN'
  | 'DISPLAY_CUSTOMER_WALLET'
  | 'DISPLAY_PROVIDER_EARNINGS'
  | 'DISPLAY_PROVIDER_TAX_OR_KYC'
  | 'REISSUE'
  | 'REVOKE';
export type PetWashPassQrScope =
  | 'customer_wallet_redemption'
  | 'provider_identity_attendance'
  | 'unknown';

export type LedgerEntryKind =
  | 'CUSTOMER_WALLET_LIABILITY'
  | 'PROVIDER_PAYABLE'
  | 'SUPPLIER_PAYABLE'
  | 'REVENUE'
  | 'OWNER_LOAN'
  | 'TAX_DOCUMENT';

export type MoneyEventState =
  | 'authorized'
  | 'pending'
  | 'captured'
  | 'settled'
  | 'wallet_load'
  | 'wallet_redeem'
  | 'credit_grant'
  | 'split_payment'
  | 'split_settlement'
  | 'refund'
  | 'partial_refund'
  | 'cancellation_penalty'
  | 'no_show'
  | 'declined'
  | 'timeout'
  | 'failed'
  | 'chargeback_dispute';

export type PaymentCaptureRail = 'NAYAX' | 'UPAY' | 'SUMIT';
export type LegalDocumentIssuer = 'SUMIT' | 'UPAY' | 'NAYAX' | 'NONE';

export type PetWashFeatureFlagKey =
  | 'role_separation_v2'
  | 'auth_no_client_role_trust'
  | 'provider_onboarding_v2'
  | 'provider_state_machine'
  | 'provider_digital_signature'
  | 'provider_renewal_6mo'
  | 'provider_pass'
  | 'customer_pass_v2'
  | 'admin_mfa'
  | 'partner_portal'
  | 'line_a_station.live'
  | 'line_a_member_signup.live'
  | 'line_b_shop_vending.live'
  | 'line_b_shop_online.live'
  | 'line_c_platform_waitlist.live'
  | 'line_c_platform_booking.live'
  | 'line_c_platform_payout.live'
  | 'line_c_provider_auto_approve.live'
  | 'line_d_supplier_invoice_ingest.live'
  | 'line_d_supplier_invoice_auto_approve.live'
  | 'line_d_supplier_auto_pay.live'
  | 'line_e_franchise.live';

export type ProviderCareRole =
  | 'mobile_wash_operator'
  | 'station_operator'
  | 'groomer'
  | 'station_host'
  | 'technician'
  | 'trainer'
  | 'pet_sitter'
  | 'dog_walker';

export type ProviderDeclarationKind =
  | 'truthfulness'
  | 'legal_right_to_work'
  | 'tax_status'
  | 'insurance_status'
  | 'animal_welfare'
  | 'privacy_notice'
  | 'code_of_conduct';

export type ElectronicSignatureTier = 'none' | 'basic' | 'secure' | 'certified';

export type AgentLane = 'CODEX' | 'CLAUDE' | 'XCODE' | 'HUMAN' | 'CI';
export type AgentWorkKind =
  | 'NEW_SCREEN'
  | 'ARCHITECTURE_DECISION'
  | 'API_CLIENT'
  | 'AUTH'
  | 'PAYMENTS'
  | 'KYC'
  | 'UNKNOWN_BUG'
  | 'TESTS'
  | 'LEGAL_TEXT'
  | 'WATCHDOG'
  | 'PRODUCTION_RELEASE';

export type WatchdogName =
  | 'Sentinel'
  | 'Ledger-Keeper'
  | 'Compliance-Hound'
  | 'Welfare-Guard'
  | 'Evidence-Vault'
  | 'Privacy-Warden';

export type WatchdogAction =
  | 'none'
  | 'step_up_auth'
  | 'lock_account'
  | 'hold_money'
  | 'block_job_assignment'
  | 'pause_provider'
  | 'legal_hold'
  | 'throttle_data_access'
  | 'notify_dpo'
  | 'notify_finance'
  | 'notify_provider_manager';

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

export interface ArchitectureDecision {
  allowed: boolean;
  version: string;
  riskLevel: OperatingRiskLevel;
  blockers: OperatingBlocker[];
}

export interface RoleSeparationInput {
  requestedSurface: PetWashSurface;
  serverRoles: PetWashRole[];
  roleSources?: RoleSource[];
  clientClaimedRole?: PetWashRole;
  providerStatus?: ProviderComplianceStatus;
  providerComplianceValid?: boolean;
  adminMfaVerified?: boolean;
}

export interface RoleSeparationDecision extends ArchitectureDecision {
  effectiveRoles: PetWashRole[];
  ignoredClientRole: boolean;
}

export interface PassSeparationInput {
  passKind: PetWashPassKind;
  operation: PetWashPassOperation;
  qrScope: PetWashPassQrScope;
  ledgerKind?: LedgerEntryKind;
  sharesSerialWithOtherPassType?: boolean;
  exposesProviderEarnings?: boolean;
  exposesProviderTaxOrKyc?: boolean;
}

export interface LedgerSeparationInput {
  ledgerKind: LedgerEntryKind;
  businessLine?: PetWashBusinessLine;
  moneyEventState: MoneyEventState;
  appendOnly: boolean;
  sourceEventId?: string;
  idempotencyKey?: string;
  vatRateStoredOnTransaction?: boolean;
  attemptsToMixCustomerCreditWithProviderPayable?: boolean;
  creditType?: CreditType;
  paidOrFree?: 'paid' | 'free';
  providerJobOrBookingId?: string;
}

export interface PaymentRailControlInput {
  captureRail: PaymentCaptureRail;
  businessLine: PetWashBusinessLine;
  moneyEventState: MoneyEventState;
  documentIssuer: LegalDocumentIssuer;
  sumitDocumentLinked?: boolean;
  externalTransactionId?: string;
  idempotencyKey?: string;
  upayInvoicingDisabled?: boolean;
  nayaxInvoicingDisabled?: boolean;
  refundCreditNoteIssuedBySumit?: boolean;
  splitSettlementReconciles?: boolean;
  allocationNumberRequired?: boolean;
  allocationNumberVerified?: boolean;
}

export interface LaunchFeatureFlagState {
  key: PetWashFeatureFlagKey;
  live: boolean;
  reason: string;
}

export interface ProviderCareOnboardingInput {
  providerRole?: ProviderCareRole;
  serviceAreaDeclared?: boolean;
  passkeyOrAppleAuthCreated?: boolean;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  declarationsAccepted?: Partial<Record<ProviderDeclarationKind, boolean>>;
  sensitiveDeclarationEnabled?: boolean;
  counselApprovedSensitiveDeclarations?: boolean;
  identityVaultUsed?: boolean;
  rawIdExposedOutsideVault?: boolean;
  documentsEncryptedBeforeUpload?: boolean;
  documentExpiryTracked?: boolean;
  lapsedInsuranceOrLicense?: boolean;
  verificationStatus?: ProviderComplianceStatus;
  contractSignatureTier?: ElectronicSignatureTier;
  contractVersionPinned?: boolean;
  contractEvidenceHashStored?: boolean;
  trainingCompleted?: boolean;
  welfareTrainingCompleted?: boolean;
  equipmentOrStationPaired?: boolean;
  complianceGateGreen?: boolean;
}

export interface AgentChangeDoctrineInput {
  workKind: AgentWorkKind;
  implementingLane: AgentLane;
  checkedByLane?: AgentLane;
  shipsVia?: AgentLane;
  rootCauseIdentified?: boolean;
  duplicateSystemCheckDone?: boolean;
  staleCodeRemovalReviewed?: boolean;
  temporaryHackIntroduced?: boolean;
  temporaryHackExpiryTask?: boolean;
  featureFlagPresent?: boolean;
  rollbackDocumented?: boolean;
  automatedTestsPass?: boolean;
  securityReviewDone?: boolean;
  privacyReviewDone?: boolean;
  accessibilityReviewDone?: boolean;
  humanReviewDone?: boolean;
  xcodeBuildOrCiGatePassed?: boolean;
  secretsOrPiiInLogs?: boolean;
  largeUnrevertibleChange?: boolean;
}

export interface WatchdogSignalInput {
  watchdog: WatchdogName;
  signalStatus: 'clean' | 'warning' | 'hit';
  actionTaken: WatchdogAction;
  auditEventWritten?: boolean;
  humanQueueCreated?: boolean;
  affectedProviderId?: string;
  affectedMoneyMovementId?: string;
  affectedPrivacySubjectId?: string;
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

function architectureDecision(blockers: OperatingBlocker[]): ArchitectureDecision {
  return {
    allowed: blockers.length === 0,
    version: PETWASH_OPERATING_SYSTEM_VERSION,
    riskLevel: riskFromBlockers(blockers),
    blockers,
  };
}

function hasAnyRole(roles: PetWashRole[], allowed: PetWashRole[]): boolean {
  return roles.some((role) => allowed.includes(role));
}

export function evaluateRoleSeparation(input: RoleSeparationInput): RoleSeparationDecision {
  const blockers: OperatingBlocker[] = [];
  const roleSources = input.roleSources ?? ['database'];
  const trustedRoles = input.serverRoles.filter(Boolean);
  const ignoredClientRole = Boolean(input.clientClaimedRole || roleSources.some((source) => (
    source === 'client_body' || source === 'query' || source === 'local_storage'
  )));

  if (trustedRoles.length === 0) {
    blockers.push(blocker(
      'TRUSTED_SERVER_ROLE_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'A role must come from server claims or the database, never from client state.',
      'Load backend-derived roles before routing or authorizing the user.',
    ));
  }

  if (ignoredClientRole) {
    blockers.push(blocker(
      'CLIENT_ROLE_IGNORED',
      'HIGH',
      'ENGINEERING',
      'Client-supplied role was ignored and must not influence routing or permissions.',
      'Use database roles/custom claims only and remove client role trust from the caller.',
    ));
  }

  if (input.requestedSurface === 'ADMIN_CONTROL_PLANE') {
    if (!hasAnyRole(trustedRoles, ['admin', 'super_admin', 'finance_admin', 'compliance_admin', 'support_admin'])) {
      blockers.push(blocker(
        'ADMIN_ROLE_REQUIRED',
        'BLOCKED',
        'NIR',
        'Admin control plane requires an admin/staff role granted by the backend.',
        'Route non-admin users away from /admin and request proper RBAC approval.',
      ));
    }
    if (!input.adminMfaVerified) {
      blockers.push(blocker(
        'ADMIN_MFA_REQUIRED',
        'BLOCKED',
        'ENGINEERING',
        'Admin control plane requires MFA.',
        'Complete MFA before opening the admin surface.',
      ));
    }
  }

  if (input.requestedSurface === 'PROVIDER_DASHBOARD') {
    if (!trustedRoles.includes('provider_approved') || input.providerStatus !== 'approved') {
      blockers.push(blocker(
        'PROVIDER_APPROVAL_REQUIRED',
        'BLOCKED',
        'PROVIDER_MANAGER',
        'Provider dashboard is only for approved providers.',
        'Keep applicant on onboarding/status page until admin approval is complete.',
      ));
    }
    if (!input.providerComplianceValid) {
      blockers.push(blocker(
        'PROVIDER_COMPLIANCE_VALID_REQUIRED',
        'BLOCKED',
        'LEGAL',
        'Approved provider still needs valid compliance before receiving jobs.',
        'Renew declarations/documents or suspend job access until compliance is valid.',
      ));
    }
  }

  if (input.requestedSurface === 'PARTNER_PORTAL' && !hasAnyRole(trustedRoles, [
    'supplier_applicant',
    'supplier_approved',
    'merchant_partner',
    'academy_partner',
    'admin',
    'super_admin',
  ])) {
    blockers.push(blocker(
      'PARTNER_ROLE_REQUIRED',
      'BLOCKED',
      'FINANCE',
      'Partner portal requires supplier/merchant/academy role granted by the backend.',
      'Create or approve a partner profile before opening the portal.',
    ));
  }

  return {
    ...architectureDecision(blockers),
    effectiveRoles: trustedRoles,
    ignoredClientRole,
  };
}

export function evaluatePassSeparation(input: PassSeparationInput): ArchitectureDecision {
  const blockers: OperatingBlocker[] = [];

  if (input.sharesSerialWithOtherPassType) {
    blockers.push(blocker(
      'PASS_SERIAL_SCOPE_MUST_BE_UNIQUE',
      'BLOCKED',
      'ENGINEERING',
      'Customer and provider passes must not share serials or QR semantics.',
      'Issue separate serials/tokens per pass type.',
    ));
  }

  if (input.passKind === 'CUSTOMER_MEMBER_PASS') {
    if (input.qrScope !== 'customer_wallet_redemption') {
      blockers.push(blocker(
        'CUSTOMER_PASS_QR_SCOPE_REQUIRED',
        'BLOCKED',
        'ENGINEERING',
        'Customer member pass QR must be scoped to customer identity/redemption only.',
        'Regenerate the pass with customer_wallet_redemption scope.',
      ));
    }
    if (input.operation === 'PROVIDER_CHECK_IN') {
      blockers.push(blocker(
        'CUSTOMER_PASS_CANNOT_CHECK_IN_PROVIDER',
        'BLOCKED',
        'PROVIDER_MANAGER',
        'Customer pass cannot be used for provider attendance or job check-in.',
        'Use the separate Provider Partner Pass.',
      ));
    }
  }

  if (input.passKind === 'PROVIDER_PARTNER_PASS') {
    if (input.qrScope !== 'provider_identity_attendance') {
      blockers.push(blocker(
        'PROVIDER_PASS_QR_SCOPE_REQUIRED',
        'BLOCKED',
        'ENGINEERING',
        'Provider pass QR must be scoped to provider identity/attendance only.',
        'Regenerate the pass with provider_identity_attendance scope.',
      ));
    }
    if (input.operation === 'CUSTOMER_REDEMPTION' || input.operation === 'DISPLAY_CUSTOMER_WALLET' || input.ledgerKind === 'CUSTOMER_WALLET_LIABILITY') {
      blockers.push(blocker(
        'PROVIDER_PASS_CANNOT_USE_CUSTOMER_WALLET',
        'BLOCKED',
        'FINANCE',
        'Provider pass must not redeem customer wallet credit or expose customer stored value.',
        'Use the customer member pass for wallet redemption and provider pass for attendance only.',
      ));
    }
    if (input.operation === 'DISPLAY_PROVIDER_EARNINGS' || input.exposesProviderEarnings) {
      blockers.push(blocker(
        'PROVIDER_PASS_EARNINGS_PRIVATE',
        'BLOCKED',
        'FINANCE',
        'Provider pass must not expose earnings or payout data.',
        'Show earnings only inside the authenticated provider dashboard.',
      ));
    }
    if (input.operation === 'DISPLAY_PROVIDER_TAX_OR_KYC' || input.exposesProviderTaxOrKyc) {
      blockers.push(blocker(
        'PROVIDER_PASS_TAX_KYC_PRIVATE',
        'BLOCKED',
        'LEGAL',
        'Provider pass must not expose tax, KYC, insurance, ID, or private compliance records.',
        'Keep sensitive compliance data in the admin/provider portal only.',
      ));
    }
  }

  return architectureDecision(blockers);
}

export function evaluateLedgerSeparation(input: LedgerSeparationInput): ArchitectureDecision {
  const blockers: OperatingBlocker[] = [];

  if (!input.appendOnly) {
    blockers.push(blocker(
      'LEDGER_APPEND_ONLY_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Money ledgers must be append-only so evidence cannot silently disappear.',
      'Record a compensating entry instead of mutating or deleting ledger history.',
    ));
  }
  if (!input.sourceEventId) {
    blockers.push(blocker(
      'LEDGER_SOURCE_EVENT_REQUIRED',
      'BLOCKED',
      'FINANCE',
      'Ledger entry requires a source event from booking, station, rail, refund, or admin control.',
      'Link the source event before recording ledger movement.',
    ));
  }
  if (!input.idempotencyKey) {
    blockers.push(blocker(
      'LEDGER_IDEMPOTENCY_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Ledger entry requires idempotency to prevent duplicate money events.',
      'Create a stable idempotency key from source system and event id.',
    ));
  }
  if (!input.businessLine) {
    blockers.push(blocker(
      'BUSINESS_LINE_REQUIRED',
      'BLOCKED',
      'ACCOUNTANT',
      'Every money event must carry a business line.',
      'Tag the event as station, shop, platform, supplier payable, or franchise.',
    ));
  }
  if (!input.vatRateStoredOnTransaction) {
    blockers.push(blocker(
      'TRANSACTION_VAT_RATE_REQUIRED',
      'BLOCKED',
      'ACCOUNTANT',
      'VAT rate must be stored on the transaction, not read only from a future global value.',
      'Persist the VAT rate used at transaction time.',
    ));
  }
  if (input.attemptsToMixCustomerCreditWithProviderPayable) {
    blockers.push(blocker(
      'CUSTOMER_WALLET_PROVIDER_PAYABLE_MIX_BLOCKED',
      'BLOCKED',
      'ACCOUNTANT',
      'Customer stored value is a customer liability and cannot be mixed with provider payables.',
      'Use separate wallet and provider-payable ledgers.',
    ));
  }
  if (input.ledgerKind === 'PROVIDER_PAYABLE' && input.creditType) {
    blockers.push(blocker(
      'PROVIDER_PAYABLE_CREDIT_TYPE_BLOCKED',
      'BLOCKED',
      'FINANCE',
      'Provider payable cannot be represented as a customer credit type.',
      'Create a provider payable entry linked to the completed job/booking.',
    ));
  }
  if (input.ledgerKind === 'PROVIDER_PAYABLE' && !input.providerJobOrBookingId) {
    blockers.push(blocker(
      'PROVIDER_PAYABLE_JOB_LINK_REQUIRED',
      'BLOCKED',
      'PROVIDER_MANAGER',
      'Provider payable must link to a completed job or booking.',
      'Link the payable to the completed service record.',
    ));
  }
  if (input.paidOrFree === 'paid' && input.creditType && isFreeCredit(input.creditType)) {
    blockers.push(blocker(
      'PAID_FREE_LEDGER_MIX_BLOCKED',
      'BLOCKED',
      'ACCOUNTANT',
      'Paid customer credit and free promotional credit must stay separated.',
      'Use distinct credit types and ledger entries.',
    ));
  }

  return architectureDecision(blockers);
}

function moneyStateNeedsSumitDocument(state: MoneyEventState): boolean {
  return state === 'captured' ||
    state === 'settled' ||
    state === 'wallet_redeem' ||
    state === 'refund' ||
    state === 'partial_refund' ||
    state === 'cancellation_penalty';
}

export function evaluatePaymentRailControl(input: PaymentRailControlInput): ArchitectureDecision {
  const blockers: OperatingBlocker[] = [];

  if (!input.externalTransactionId) {
    blockers.push(blocker(
      'RAIL_EXTERNAL_TRANSACTION_ID_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Rail event needs the provider transaction id for traceability.',
      'Persist Nayax/UPay/SUMIT transaction id before ledger posting.',
    ));
  }
  if (!input.idempotencyKey) {
    blockers.push(blocker(
      'RAIL_IDEMPOTENCY_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Rail ingestion requires idempotency to avoid double charging or double invoicing.',
      'Create an idempotency key from rail, transaction id, and event state.',
    ));
  }
  if (input.captureRail === 'UPAY' && input.upayInvoicingDisabled !== true) {
    blockers.push(blocker(
      'UPAY_INVOICING_MUST_BE_DISABLED',
      'BLOCKED',
      'ACCOUNTANT',
      'UPay may capture payment, but PetWash documents must be issued only by SUMIT.',
      'Disable UPay invoicing for this flow or do not activate the rail.',
    ));
  }
  if (input.captureRail === 'NAYAX' && input.nayaxInvoicingDisabled !== true) {
    blockers.push(blocker(
      'NAYAX_INVOICING_MUST_BE_DISABLED',
      'BLOCKED',
      'ACCOUNTANT',
      'Nayax may capture station payments, but PetWash documents must be issued only by SUMIT.',
      'Disable Nayax invoicing/document generation for this flow.',
    ));
  }
  if (moneyStateNeedsSumitDocument(input.moneyEventState)) {
    if (input.documentIssuer !== 'SUMIT') {
      blockers.push(blocker(
        'SUMIT_ONLY_LEGAL_DOCUMENT_REQUIRED',
        'BLOCKED',
        'ACCOUNTANT',
        'One sale must create one legal document, and SUMIT is the system of record.',
        'Route official invoice/receipt/credit-note creation through SUMIT only.',
      ));
    }
    if (!input.sumitDocumentLinked) {
      blockers.push(blocker(
        'SUMIT_DOCUMENT_LINK_REQUIRED',
        'BLOCKED',
        'ACCOUNTANT',
        'Captured/settled/refund event must link to the SUMIT document.',
        'Create or link the SUMIT document before closing the event.',
      ));
    }
  }
  if ((input.moneyEventState === 'refund' || input.moneyEventState === 'partial_refund') && !input.refundCreditNoteIssuedBySumit) {
    blockers.push(blocker(
      'SUMIT_CREDIT_NOTE_REQUIRED',
      'BLOCKED',
      'ACCOUNTANT',
      'Refunds and partial refunds require SUMIT credit-note handling.',
      'Create/link the SUMIT credit note before the refund is closed.',
    ));
  }
  if (input.moneyEventState === 'split_settlement' && !input.splitSettlementReconciles) {
    blockers.push(blocker(
      'SPLIT_SETTLEMENT_RECONCILIATION_REQUIRED',
      'BLOCKED',
      'FINANCE',
      'Split settlement must reconcile to the cent before statements or payouts.',
      'Reconcile PetWash/provider/franchise allocations against the source event.',
    ));
  }
  if (input.allocationNumberRequired && !input.allocationNumberVerified) {
    blockers.push(blocker(
      'INVOICE_ISRAEL_ALLOCATION_VERIFICATION_REQUIRED',
      'BLOCKED',
      'ACCOUNTANT',
      'Invoice Israel allocation number is required and not verified.',
      'Verify allocation number before payment/posting.',
    ));
  }

  return architectureDecision(blockers);
}

export function getLaunchFeatureFlagDefaults(): LaunchFeatureFlagState[] {
  return [
    { key: 'role_separation_v2', live: false, reason: 'Ship behind flag; enable after route guard tests pass.' },
    { key: 'auth_no_client_role_trust', live: false, reason: 'Enable after backend-derived role checks are wired.' },
    { key: 'provider_onboarding_v2', live: false, reason: 'Requires provider application persistence and review queue.' },
    { key: 'provider_state_machine', live: false, reason: 'Requires persisted state machine and admin transition audit.' },
    { key: 'provider_digital_signature', live: false, reason: 'Requires evidence storage and legal-approved declaration versions.' },
    { key: 'provider_renewal_6mo', live: false, reason: 'Requires scheduler, reminders, and compliance-expired blocking.' },
    { key: 'provider_pass', live: false, reason: 'Requires separate provider pass semantics and no wallet/payable mixing.' },
    { key: 'customer_pass_v2', live: false, reason: 'Requires customer pass tokens, revocation, and wallet terms.' },
    { key: 'admin_mfa', live: true, reason: 'Admin control surfaces require MFA.' },
    { key: 'partner_portal', live: false, reason: 'Supplier/merchant portal is future-ready, not active until onboarding exists.' },
    { key: 'line_a_station.live', live: true, reason: 'Station line may go live only through approved K9000/SUMIT controls.' },
    { key: 'line_a_member_signup.live', live: true, reason: 'Member signup is launch scope.' },
    { key: 'line_b_shop_vending.live', live: false, reason: 'Retail/vending is not active until inventory/accounting controls are ready.' },
    { key: 'line_b_shop_online.live', live: false, reason: 'Online shop is not active until stock, refund, VAT, and SUMIT rules are ready.' },
    { key: 'line_c_platform_waitlist.live', live: true, reason: 'Provider waitlist can collect applications with manual review only.' },
    { key: 'line_c_platform_booking.live', live: false, reason: 'Platform booking is blocked until provider KYC, terms, payout, and control gates are ready.' },
    { key: 'line_c_platform_payout.live', live: false, reason: 'Provider payouts are blocked until payable ledger and approval gates are live.' },
    { key: 'line_c_provider_auto_approve.live', live: false, reason: 'Sensitive services must never auto-approve providers.' },
    { key: 'line_d_supplier_invoice_ingest.live', live: true, reason: 'Supplier invoice ingest is allowed as controlled pre-accounting intake.' },
    { key: 'line_d_supplier_invoice_auto_approve.live', live: false, reason: 'Supplier invoice auto-approval is blocked.' },
    { key: 'line_d_supplier_auto_pay.live', live: false, reason: 'Supplier auto-pay is blocked; human control required.' },
    { key: 'line_e_franchise.live', live: false, reason: 'Franchise/location partner flow requires separate legal/accounting workflow.' },
  ];
}

const REQUIRED_PROVIDER_DECLARATIONS: ProviderDeclarationKind[] = [
  'truthfulness',
  'legal_right_to_work',
  'tax_status',
  'insurance_status',
  'animal_welfare',
  'privacy_notice',
  'code_of_conduct',
];

function signatureTierRank(tier: ElectronicSignatureTier | undefined): number {
  if (tier === 'certified') return 3;
  if (tier === 'secure') return 2;
  if (tier === 'basic') return 1;
  return 0;
}

function isSensitiveWorkKind(kind: AgentWorkKind): boolean {
  return kind === 'AUTH' ||
    kind === 'PAYMENTS' ||
    kind === 'KYC' ||
    kind === 'WATCHDOG' ||
    kind === 'PRODUCTION_RELEASE';
}

export function evaluateProviderCareOnboarding(input: ProviderCareOnboardingInput): ArchitectureDecision {
  const blockers: OperatingBlocker[] = [];

  if (!input.providerRole) {
    blockers.push(blocker(
      'PROVIDER_ROLE_REQUIRED',
      'BLOCKED',
      'PROVIDER_MANAGER',
      'Provider cannot onboard without a declared operating role.',
      'Select provider role before collecting role-specific declarations and documents.',
    ));
  }
  if (!input.serviceAreaDeclared) {
    blockers.push(blocker(
      'PROVIDER_SERVICE_AREA_REQUIRED',
      'BLOCKED',
      'PROVIDER_MANAGER',
      'Provider service area is missing.',
      'Collect service area before routing, scheduling, or job eligibility.',
    ));
  }
  if (!input.passkeyOrAppleAuthCreated) {
    blockers.push(blocker(
      'PROVIDER_PASSKEY_OR_APPLE_AUTH_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Provider app identity must be phishing-resistant.',
      'Create passkey or Sign in with Apple identity before provider onboarding continues.',
    ));
  }
  if (!input.phoneVerified || !input.emailVerified) {
    blockers.push(blocker(
      'PROVIDER_PHONE_EMAIL_VERIFICATION_REQUIRED',
      'BLOCKED',
      'PROVIDER_MANAGER',
      'Provider phone and email must both be verified.',
      'Complete OTP/email verification before document intake.',
    ));
  }

  for (const declaration of REQUIRED_PROVIDER_DECLARATIONS) {
    if (input.declarationsAccepted?.[declaration] !== true) {
      blockers.push(blocker(
        `PROVIDER_DECLARATION_${declaration.toUpperCase()}_REQUIRED`,
        'BLOCKED',
        declaration === 'privacy_notice' ? 'LEGAL' : 'PROVIDER_MANAGER',
        `Provider declaration is missing: ${declaration}.`,
        'Collect the discrete, timestamped declaration before activation.',
      ));
    }
  }

  if (input.sensitiveDeclarationEnabled && !input.counselApprovedSensitiveDeclarations) {
    blockers.push(blocker(
      'SENSITIVE_DECLARATION_COUNSEL_APPROVAL_REQUIRED',
      'BLOCKED',
      'LEGAL',
      'Sensitive declarations need explicit legal approval before collection.',
      'Disable the sensitive question or attach approved declaration wording.',
    ));
  }
  if (!input.identityVaultUsed) {
    blockers.push(blocker(
      'IDENTITY_VAULT_REQUIRED',
      'BLOCKED',
      'LEGAL',
      'Raw identity data must live only in the isolated Identity Vault.',
      'Route ID/KYC uploads into the vault and expose only verification decisions to the app.',
    ));
  }
  if (input.rawIdExposedOutsideVault) {
    blockers.push(blocker(
      'RAW_ID_OUTSIDE_VAULT_BLOCKED',
      'BLOCKED',
      'LEGAL',
      'Raw ID data was exposed outside the Identity Vault boundary.',
      'Stop the flow, remove the exposure, and keep only masked/tokenized references outside the vault.',
    ));
  }
  if (!input.documentsEncryptedBeforeUpload) {
    blockers.push(blocker(
      'PROVIDER_DOCUMENT_ENCRYPTION_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Provider documents must be encrypted before upload/storage.',
      'Encrypt document blobs before upload and store only encrypted references.',
    ));
  }
  if (!input.documentExpiryTracked) {
    blockers.push(blocker(
      'PROVIDER_DOCUMENT_EXPIRY_TRACKING_REQUIRED',
      'BLOCKED',
      'COMPLIANCE',
      'Provider document expiry dates must be tracked.',
      'Record expiry metadata and create renewal reminders/holds.',
    ));
  }
  if (input.lapsedInsuranceOrLicense) {
    blockers.push(blocker(
      'LAPSED_INSURANCE_OR_LICENSE_JOB_HOLD',
      'BLOCKED',
      'LEGAL',
      'Lapsed insurance or license blocks new job assignment.',
      'Hold provider from new jobs until the renewed document is verified.',
    ));
  }
  if (input.verificationStatus !== 'approved') {
    blockers.push(blocker(
      'PROVIDER_VERIFICATION_APPROVAL_REQUIRED',
      'BLOCKED',
      'PROVIDER_MANAGER',
      'Provider verification is not approved.',
      'Finish KYC/document review before provider activation.',
    ));
  }
  if (signatureTierRank(input.contractSignatureTier) < signatureTierRank('secure')) {
    blockers.push(blocker(
      'PROVIDER_SECURE_SIGNATURE_REQUIRED',
      'BLOCKED',
      'LEGAL',
      'Provider contract requires at least secure electronic signature evidence.',
      'Use a secure or certified signature flow for the provider agreement.',
    ));
  }
  if (!input.contractVersionPinned || !input.contractEvidenceHashStored) {
    blockers.push(blocker(
      'PROVIDER_CONTRACT_EVIDENCE_REQUIRED',
      'BLOCKED',
      'LEGAL',
      'Provider contract version and evidence hash must be sealed.',
      'Pin the agreement version and store signature metadata/hash in the evidence vault.',
    ));
  }
  if (!input.trainingCompleted || !input.welfareTrainingCompleted) {
    blockers.push(blocker(
      'PROVIDER_TRAINING_REQUIRED',
      'BLOCKED',
      'PROVIDER_MANAGER',
      'Provider training and animal-welfare training must be completed.',
      'Complete required training modules and comprehension checks before first job.',
    ));
  }
  if (!input.equipmentOrStationPaired) {
    blockers.push(blocker(
      'PROVIDER_EQUIPMENT_OR_STATION_PAIRING_REQUIRED',
      'BLOCKED',
      'PROVIDER_MANAGER',
      'Provider is not paired with required equipment/station context.',
      'Pair provider to approved station, vehicle, equipment, or service context.',
    ));
  }
  if (!input.complianceGateGreen) {
    blockers.push(blocker(
      'PROVIDER_FIRST_JOB_COMPLIANCE_GATE_REQUIRED',
      'BLOCKED',
      'COMPLIANCE',
      'First-job gate is not green.',
      'Confirm documents, declarations, contract, training, insurance, and role readiness before job access.',
    ));
  }

  return architectureDecision(blockers);
}

export function evaluateAgentChangeDoctrine(input: AgentChangeDoctrineInput): ArchitectureDecision {
  const blockers: OperatingBlocker[] = [];
  const sensitive = isSensitiveWorkKind(input.workKind);

  if (input.secretsOrPiiInLogs) {
    blockers.push(blocker(
      'SECRETS_OR_PII_IN_LOGS_BLOCKED',
      'BLOCKED',
      'ENGINEERING',
      'Secrets or personal data must never be printed or committed.',
      'Remove the exposure, rotate affected secrets if needed, and keep logs masked.',
    ));
  }
  if (input.largeUnrevertibleChange) {
    blockers.push(blocker(
      'CHANGE_MUST_BE_SMALL_REVIEWABLE_REVERTIBLE',
      'BLOCKED',
      'ENGINEERING',
      'Large unrevertible changes are not allowed for PetWash launch work.',
      'Split into small PRs with a tested rollback path.',
    ));
  }
  if (!input.duplicateSystemCheckDone || !input.staleCodeRemovalReviewed) {
    blockers.push(blocker(
      'DUPLICATE_AND_STALE_CODE_CHECK_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Every agent must check for duplicate systems, stale code, and old unsafe shortcuts before adding more code.',
      'Run the module/bypass scan and remove or gate old paths safely.',
    ));
  }
  if (input.temporaryHackIntroduced && !input.temporaryHackExpiryTask) {
    blockers.push(blocker(
      'TEMP_HACK_EXPIRY_TASK_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Temporary hacks require an expiry note and removal task.',
      'Add tracked removal work or replace the hack with a proper implementation.',
    ));
  }
  if (input.workKind === 'UNKNOWN_BUG' && !input.rootCauseIdentified) {
    blockers.push(blocker(
      'ROOT_CAUSE_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Unknown bugs require root cause before shipping a fix.',
      'Trace the failure and prove the cause before changing production behavior.',
    ));
  }
  if (sensitive && (!input.featureFlagPresent || !input.rollbackDocumented)) {
    blockers.push(blocker(
      'FEATURE_FLAG_AND_ROLLBACK_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Sensitive work must ship behind a tested feature flag with rollback notes.',
      'Add a feature flag and document rollback before merge.',
    ));
  }
  if (!input.automatedTestsPass) {
    blockers.push(blocker(
      'AUTOMATED_TESTS_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Automated tests must pass before the change can move forward.',
      'Run focused tests and add missing coverage for the changed behavior.',
    ));
  }
  if (sensitive && !input.securityReviewDone) {
    blockers.push(blocker(
      'SECURITY_REVIEW_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Auth, payment, KYC, watchdog, and production-release work requires security review.',
      'Complete security review before merge.',
    ));
  }
  if ((input.workKind === 'KYC' || input.workKind === 'LEGAL_TEXT') && !input.privacyReviewDone) {
    blockers.push(blocker(
      'PRIVACY_REVIEW_REQUIRED',
      'BLOCKED',
      'LEGAL',
      'KYC, declarations, consents, and legal text require privacy review.',
      'Complete privacy/legal review before collecting or displaying sensitive data.',
    ));
  }
  if (input.workKind === 'NEW_SCREEN' && !input.accessibilityReviewDone) {
    blockers.push(blocker(
      'ACCESSIBILITY_REVIEW_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'New screens require accessibility review before release.',
      'Check VoiceOver, contrast, touch targets, Dynamic Type, RTL, and reduced motion.',
    ));
  }
  if (!input.humanReviewDone) {
    blockers.push(blocker(
      'HUMAN_REVIEW_REQUIRED',
      'BLOCKED',
      'NIR',
      'AI-generated or agent-generated work cannot reach main unreviewed.',
      'Request human review before merge/release.',
    ));
  }
  if ((input.workKind === 'NEW_SCREEN' || input.workKind === 'PRODUCTION_RELEASE') && input.shipsVia !== 'XCODE' && !input.xcodeBuildOrCiGatePassed) {
    blockers.push(blocker(
      'XCODE_OR_CI_SHIPPING_GATE_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'App/UI release work must pass Xcode or CI shipping gate.',
      'Build/test through Xcode or CI before release.',
    ));
  }
  if (input.workKind === 'ARCHITECTURE_DECISION' && input.implementingLane !== 'CLAUDE' && input.checkedByLane !== 'HUMAN') {
    blockers.push(blocker(
      'ARCHITECTURE_DECISION_REVIEW_REQUIRED',
      'BLOCKED',
      'NIR',
      'Architecture decisions need judgment and human sign-off.',
      'Create an ADR/design note and route it for review before implementation.',
    ));
  }

  return architectureDecision(blockers);
}

export function evaluateWatchdogSignal(input: WatchdogSignalInput): ArchitectureDecision {
  const blockers: OperatingBlocker[] = [];

  if (input.signalStatus === 'clean') return architectureDecision(blockers);

  if (!input.auditEventWritten) {
    blockers.push(blocker(
      'WATCHDOG_AUDIT_EVENT_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Watchdog warning/hit must write an audit event.',
      'Record the watchdog signal, action, affected entity, and timestamp.',
    ));
  }
  if (input.signalStatus === 'hit' && !input.humanQueueCreated) {
    blockers.push(blocker(
      'WATCHDOG_HUMAN_QUEUE_REQUIRED',
      'BLOCKED',
      'NIR',
      'Critical watchdog hits require a human review queue item.',
      'Create an admin queue item with required approver and next safe action.',
    ));
  }
  if (input.watchdog === 'Sentinel' && input.signalStatus === 'hit' && input.actionTaken !== 'step_up_auth' && input.actionTaken !== 'lock_account') {
    blockers.push(blocker(
      'SENTINEL_STEP_UP_OR_LOCK_REQUIRED',
      'BLOCKED',
      'ENGINEERING',
      'Auth anomaly requires step-up authentication or account lock.',
      'Step up authentication or lock the account until reviewed.',
    ));
  }
  if (input.watchdog === 'Ledger-Keeper' && input.signalStatus === 'hit' && input.actionTaken !== 'hold_money') {
    blockers.push(blocker(
      'LEDGER_KEEPER_MONEY_HOLD_REQUIRED',
      'BLOCKED',
      'FINANCE',
      'Financial irregularity requires holding money movement.',
      'Hold payout/refund/payment and notify finance.',
    ));
  }
  if (input.watchdog === 'Compliance-Hound' && input.signalStatus === 'hit' && input.actionTaken !== 'block_job_assignment') {
    blockers.push(blocker(
      'COMPLIANCE_HOUND_JOB_BLOCK_REQUIRED',
      'BLOCKED',
      'COMPLIANCE',
      'Compliance lapse requires blocking job assignment.',
      'Hold provider from jobs until documents/compliance are restored.',
    ));
  }
  if (input.watchdog === 'Welfare-Guard' && input.signalStatus === 'hit' && input.actionTaken !== 'pause_provider') {
    blockers.push(blocker(
      'WELFARE_GUARD_PROVIDER_PAUSE_REQUIRED',
      'BLOCKED',
      'PROVIDER_MANAGER',
      'Animal welfare hit requires provider pause and escalation.',
      'Pause provider access and escalate the complaint/incident.',
    ));
  }
  if (input.watchdog === 'Evidence-Vault' && input.signalStatus === 'hit' && input.actionTaken !== 'legal_hold') {
    blockers.push(blocker(
      'EVIDENCE_VAULT_LEGAL_HOLD_REQUIRED',
      'BLOCKED',
      'LEGAL',
      'Evidence tamper signal requires legal hold.',
      'Preserve evidence, block deletion, and alert legal.',
    ));
  }
  if (input.watchdog === 'Privacy-Warden' && input.signalStatus === 'hit' && input.actionTaken !== 'throttle_data_access' && input.actionTaken !== 'notify_dpo') {
    blockers.push(blocker(
      'PRIVACY_WARDEN_THROTTLE_OR_DPO_REQUIRED',
      'BLOCKED',
      'LEGAL',
      'Personal-data access anomaly requires throttling or DPO notification.',
      'Throttle/export-block the actor and notify privacy owner/DPO.',
    ));
  }

  return architectureDecision(blockers);
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
