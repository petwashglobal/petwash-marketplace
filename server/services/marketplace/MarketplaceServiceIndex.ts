/**
 * MarketplaceServiceIndex — CEO doctrine navigability.
 *
 * Machine-readable catalog of every marketplace service the doctrine
 * has crystallised so far, with the CEO Program section each one
 * satisfies and the section slug the doctrine tests pin against.
 *
 * This file is not consumed by the runtime — it's a source-anchored
 * map used by the doctrine tests and by developer tooling to answer
 * "which service already covers X" without grepping.
 *
 * Every service in this map MUST exist as a real file under
 * server/services/marketplace/. Deleting a service without pruning
 * this entry is caught by the marketplaceServiceIndex regression pin.
 */

export type ServiceKind = 'RESOLVER' | 'LOADER' | 'EVALUATOR' | 'DISPATCHER' | 'ROUTER' | 'AGGREGATOR' | 'POLICY';

export interface ServiceEntry {
  path: string;                             // relative to server/services/marketplace/
  kind: ServiceKind;
  programCode: string;                      // e.g. 'PROGRAM_5' or 'DOCTRINE_84'
  summary: string;
}

/**
 * The single index. Additions land here in the SAME commit as the
 * service file they describe. Removals must land together with the
 * file deletion.
 */
export const MARKETPLACE_SERVICE_INDEX: readonly ServiceEntry[] = [
  // Journey resolvers (pure) — one per entity kind.
  { path: 'BookingJourneyResolver.ts', kind: 'RESOLVER', programCode: 'DOCTRINE_84', summary: 'Booking JourneyState projection' },
  { path: 'ShopJourneyResolver.ts', kind: 'RESOLVER', programCode: 'PROGRAM_16', summary: 'Shop order JourneyState projection' },
  { path: 'WalletJourneyResolver.ts', kind: 'RESOLVER', programCode: 'PROGRAM_18', summary: 'Wallet top-up JourneyState projection' },
  { path: 'EGiftJourneyResolver.ts', kind: 'RESOLVER', programCode: 'PROGRAM_19', summary: 'eGift JourneyState projection (buyer + recipient)' },
  { path: 'K9000JourneyResolver.ts', kind: 'RESOLVER', programCode: 'PROGRAM_17', summary: 'K9000 station-session JourneyState projection' },
  { path: 'PayoutJourneyResolver.ts', kind: 'RESOLVER', programCode: 'DOCTRINE_84', summary: 'Provider payout JourneyState projection' },
  { path: 'RefundJourneyResolver.ts', kind: 'RESOLVER', programCode: 'PROGRAM_15', summary: 'Refund JourneyState projection' },
  { path: 'SupportCaseJourneyResolver.ts', kind: 'RESOLVER', programCode: 'DOCTRINE_86', summary: 'Support case per-actor projection' },
  { path: 'PrestigeJourneyResolver.ts', kind: 'RESOLVER', programCode: 'PROGRAM_20', summary: 'Prestige membership capability projection' },
  { path: 'ProviderApplicationJourneyResolver.ts', kind: 'RESOLVER', programCode: 'PROGRAM_21', summary: 'Provider application projection' },
  { path: 'PetKyaJourneyResolver.ts', kind: 'RESOLVER', programCode: 'DOCTRINE_21_22', summary: 'Pet KYA freshness projection' },

  // Dispatch + registry.
  { path: 'JourneyStateService.ts', kind: 'DISPATCHER', programCode: 'DOCTRINE_84', summary: 'Kind → JourneyLoader dispatch registry' },
  { path: 'registerJourneyLoaders.ts', kind: 'DISPATCHER', programCode: 'DOCTRINE_84', summary: 'Boot-time loader registrations' },

  // Live loaders (bridge DB → resolver).
  { path: 'loaders/PrestigeJourneyLoader.ts', kind: 'LOADER', programCode: 'DOCTRINE_84', summary: 'privilege_members → resolvePrestigeJourney' },
  { path: 'loaders/RefundJourneyLoader.ts', kind: 'LOADER', programCode: 'DOCTRINE_84', summary: 'refund_transactions → resolveRefundJourney' },
  { path: 'loaders/PetKyaJourneyLoader.ts', kind: 'LOADER', programCode: 'DOCTRINE_84', summary: 'pets → resolvePetKyaJourney' },
  { path: 'loaders/SupportCaseJourneyLoader.ts', kind: 'LOADER', programCode: 'DOCTRINE_84', summary: 'SupportCaseStore → resolveSupportCaseJourney' },
  { path: 'loaders/BookingJourneyLoader.ts', kind: 'LOADER', programCode: 'DOCTRINE_84', summary: 'bookings → resolveBookingJourney' },

  // Endpoints.
  { path: '../../routes/marketplace-journey.ts', kind: 'ROUTER', programCode: 'DOCTRINE_84', summary: 'GET /api/marketplace/journey/:kind/:id' },
  { path: '../../routes/marketplace-documents.ts', kind: 'ROUTER', programCode: 'PROGRAM_11', summary: 'GET /api/marketplace/documents/:id' },

  // Aggregators / stores.
  { path: 'CommunicationHubService.ts', kind: 'AGGREGATOR', programCode: 'DOCTRINE_21', summary: 'Unified Inbox composition (bookingChat + threadChat + attention + documents)' },
  { path: 'DocumentDetailService.ts', kind: 'AGGREGATOR', programCode: 'PROGRAM_11', summary: 'digital_receipts detail projection' },
  { path: 'JourneyCheckpointService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_32', summary: 'Abandoned-journey checkpoint + resume' },
  { path: 'AiConciergeContextService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_35', summary: 'AI Concierge context bundle' },
  { path: 'TransactionPassportService.ts', kind: 'AGGREGATOR', programCode: 'PROGRAM_12', summary: 'Transaction passport shape + source registry' },
  { path: 'AttentionFeedComposer.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_37', summary: 'One attention feed across all domains' },

  // Pure evaluators.
  { path: 'PetEligibilityService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_5', summary: 'Multi-pet household eligibility' },
  { path: 'NotificationPriorityService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_34', summary: 'Deliver / defer / drop verdict' },
  { path: 'NotificationComposer.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_33', summary: 'Send-ready notification composition' },
  { path: 'ActionConfirmationPolicy.ts', kind: 'POLICY', programCode: 'PROGRAM_39', summary: 'Confirmation UX per action slug' },
  { path: 'ProviderPricingService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_22', summary: 'Per-service rate model → line-item breakdown' },
  { path: 'ProviderAvailabilityService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_23', summary: 'Per-service availability + exceptions + conflicts' },
  { path: 'ProviderCancellationService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_14', summary: 'Provider cancel preview (full refund + integrity impact)' },
  { path: 'ProviderServiceApprovalEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_21', summary: 'Per-service approval buckets' },
  { path: 'MessageSafetyClassifier.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_7', summary: 'Chat safety verdict + reason codes' },
  { path: 'ChatAttachmentPolicyService.ts', kind: 'POLICY', programCode: 'PROGRAM_8', summary: 'Chat attachment mime + size + purpose gate' },
  { path: 'CommunicationScopingService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_8', summary: 'Thread-per-entity scoping + status' },
  { path: 'FavouriteScopingService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_30', summary: 'Provider vs Provider+Service favourite scope' },
  { path: 'DeepLinkResolver.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_33', summary: 'Notification kind → canonical route' },
  { path: 'StaleStateDetector.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_40', summary: 'Stale-state detection for two-device resilience' },
  { path: 'RegistrationResumeService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_43', summary: 'Progressive signup resume router' },
  { path: 'MultiRoleSwitchGuard.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_44', summary: 'Workspace switch permissibility' },
  { path: 'IncidentSeverityClassifier.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_25', summary: 'Live-service incident severity + escalation' },
  { path: 'ReviewEligibilityService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_28', summary: 'Review eligibility gate' },
  { path: 'SavedSearchService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_31', summary: 'Saved-search store + isSameSearch' },
  { path: 'WalletLedgerAuthorityService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_18', summary: 'Ledger-authoritative wallet balance projection' },
  { path: 'EGiftRedemptionEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_19', summary: 'Recipient-side redemption gate' },
  { path: 'K9000OutcomeDiscriminator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_17', summary: 'Payment/machine outcome routing' },
  { path: 'PrestigeBenefitEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_20', summary: 'Tier + actor leg → applied benefits' },
  { path: 'CompleteJobPolicy.ts', kind: 'POLICY', programCode: 'PROGRAM_27', summary: 'Service-specific completion signals' },
  { path: 'PaymentUncertaintyResolver.ts', kind: 'EVALUATOR', programCode: 'DOCTRINE_12', summary: '§12 payment uncertainty verdict' },
  { path: 'AdminSearchDescriptor.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_50', summary: 'Admin search channel routing' },
  { path: 'OffPlatformEscalationAuditor.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_7', summary: 'Pair-level circumvention/abuse/threat roll-up' },
  { path: 'PolicyStatusService.ts', kind: 'EVALUATOR', programCode: 'DOCTRINE_21_22', summary: 'BusinessDecisionRegistry status by domain' },
  { path: 'StartJobPreflightService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_24', summary: 'Start-job preconditions per-service' },
  { path: 'OfflineDraftGuard.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_48', summary: 'Offline / bad-network action verdict' },
  { path: 'HouseholdCompositionService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_5', summary: 'Household composition + equivalence' },
  { path: 'PayoutHoldReleaseEvaluator.ts', kind: 'EVALUATOR', programCode: 'DOCTRINE_12', summary: 'Provider payout hold + release gate' },
  { path: 'IdempotencyKeyComposer.ts', kind: 'EVALUATOR', programCode: 'DOCTRINE_IDEMPOTENCY', summary: 'Canonical idempotency key from (action, actor, entity, salt)' },
  { path: 'InboxFirstLoadBudget.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_49', summary: 'First-load / follow-page bounded inbox budget' },
  { path: 'AttachmentOwnershipGuard.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_41', summary: 'Attachment read allow list — owner, party, explicit share' },
  { path: 'ProviderPayoutDestinationValidator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_41', summary: 'IL bank account shape validation + masked projection' },
  { path: 'BookAgainPrefillEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_29', summary: 'Book Again prefill + revalidation checklist' },
  { path: 'CallAuthorizationEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_9', summary: 'Call surface authorization + masking discipline' },
  { path: 'CategoryFilterEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_10', summary: 'Inbox item → category tab (Pet Parent vs Provider)' },
  { path: 'HandoffCodeSpec.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_26', summary: 'Handoff code shape / hash / timing-safe verify / TTL' },
  { path: 'HouseholdPetEligibilitySynthesizer.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_46', summary: 'Household × capability → book-all / subset / decline hint' },
  { path: 'PolicyGateBundle.ts', kind: 'EVALUATOR', programCode: 'DOCTRINE_21_22', summary: 'Aggregate multi-policy gate for critical actions' },
  { path: 'ContactMaskingService.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_41', summary: 'PII masking: email, IL phone, account, national id' },
  { path: 'DisputeEvidenceRequirementEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_15', summary: 'Dispute kind → required + recommended evidence codes' },
  { path: 'RebookingSpanEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_29', summary: 'Book-Again cadence → next N future candidate starts' },
  { path: 'CalendarConflictReleaseEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_14', summary: 'Trigger → release slot / keep blocked verdict' },
  { path: 'ReviewSubmissionValidator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_28', summary: 'Review payload shape + safety validation' },
  { path: 'SupportCaseAutoCloseEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_13', summary: 'Support case auto-close after RESOLVED window' },
  { path: 'ProviderApplicationCompletenessEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_21', summary: 'Provider application readiness — sections + doc completeness' },
  { path: 'ProviderHomeSectionsEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_3', summary: 'Ordered section list for /provider/today rendering' },
  { path: 'PetParentHomeSectionsEvaluator.ts', kind: 'EVALUATOR', programCode: 'PROGRAM_2', summary: 'Ordered section list for /pet-parent/home rendering' },
  { path: 'ProfileFieldAuthorityMap.ts', kind: 'POLICY', programCode: 'P0_MY_ACCOUNT', summary: 'Canonical authority classification per personal profile field' },
  { path: 'ProfileCompletenessService.ts', kind: 'EVALUATOR', programCode: 'P0_MY_ACCOUNT', summary: 'profileState / missingFields / requiredActions from users snapshot' },
  { path: 'ContactChangeStateMachine.ts', kind: 'EVALUATOR', programCode: 'P0_MY_ACCOUNT', summary: 'Change-mobile / change-email OTP handshake state machine' },
  { path: 'UpdateProfileService.ts', kind: 'EVALUATOR', programCode: 'P0_MY_ACCOUNT', summary: 'Atomic canonical write + Firebase-claim fan-out + split-brain guard' },
  { path: 'PrestigeMirrorRefreshService.ts', kind: 'EVALUATOR', programCode: 'P0_MY_ACCOUNT', summary: 'Refresh privilege_members MIRROR on canonical identity change' },
  { path: '../../routes/me-profile.ts', kind: 'ROUTER', programCode: 'P0_MY_ACCOUNT', summary: 'GET/PATCH /api/me/profile + POST /api/me/contact-change/*' },
  { path: '../../../client/src/pages/MyAccountCanonical.tsx', kind: 'ROUTER', programCode: 'P0_MY_ACCOUNT', summary: 'Slug-only canonical MyAccount scaffold at /my-account/canonical' },
  { path: 'NayaxFiscalDocumentGuard.ts', kind: 'EVALUATOR', programCode: 'P0_NAYAX', summary: 'Refuses assuming Nayax auto-issued a fiscal document while module/engine unresolved' },
  { path: '../../../shared/auth/otpPurposeRegistry.ts', kind: 'EVALUATOR', programCode: 'P0_CEP', summary: 'Purpose-scoped OTP consumption verdict — no cross-purpose reuse (CEO Batch §4)' },
];

/** Small guards used by regression pins. */
export function serviceKindOf(path: string): ServiceKind | undefined {
  return MARKETPLACE_SERVICE_INDEX.find((e) => e.path === path)?.kind;
}
export function servicesForProgram(programCode: string): ServiceEntry[] {
  return MARKETPLACE_SERVICE_INDEX.filter((e) => e.programCode === programCode);
}
