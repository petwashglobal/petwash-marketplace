/**
 * ProviderApplication state machine — CEO Business Doctrine §17.7,
 * §72; Provider Onboarding.
 *
 * Every provider application moves through this deterministic set of
 * phases. Callers CANNOT POST `phase = APPROVED`; they invoke the
 * doctrine's structured actions (PROVIDER_APPLICATION_SUBMIT etc.)
 * and the server validates the transition here.
 */

export type ProviderApplicationPhase =
  | 'NOT_STARTED'
  | 'DRAFT'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

/**
 * Legal transitions. Anything not enumerated is refused.
 */
const TRANSITIONS: Record<ProviderApplicationPhase, ProviderApplicationPhase[]> = {
  NOT_STARTED: ['DRAFT'],
  DRAFT: ['READY_TO_SUBMIT', 'WITHDRAWN'],
  READY_TO_SUBMIT: ['DRAFT', 'SUBMITTED', 'WITHDRAWN'],   // may go back to DRAFT on further edits
  SUBMITTED: ['UNDER_REVIEW', 'WITHDRAWN'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'WITHDRAWN'],
  CHANGES_REQUESTED: ['DRAFT', 'READY_TO_SUBMIT', 'WITHDRAWN'],  // applicant fixes then re-submits
  APPROVED: [],                                            // terminal
  REJECTED: ['DRAFT'],                                     // may retry after time
  WITHDRAWN: ['DRAFT'],                                    // may reopen
};

export function canTransitionProviderApplication(
  from: ProviderApplicationPhase,
  to: ProviderApplicationPhase,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextProviderApplicationPhases(
  from: ProviderApplicationPhase,
): ProviderApplicationPhase[] {
  return TRANSITIONS[from] ?? [];
}

export function isTerminalProviderApplicationPhase(
  phase: ProviderApplicationPhase,
): boolean {
  return TRANSITIONS[phase]?.length === 0;
}

/**
 * Readiness gate the SUBMIT action consults. All must be true.
 */
export interface ApplicationReadiness {
  hasAcceptedActiveAgreement: boolean;
  missingChecklistItems: number;
  hasVerifiedIdentityDocument: boolean;
  hasPublishedAtLeastOneService: boolean;
  hasBankAccount: boolean;
}

export interface ReadinessResult {
  ready: boolean;
  reasons: string[];                   // stable slugs; UI translates
}

export function evaluateSubmitReadiness(input: ApplicationReadiness): ReadinessResult {
  const reasons: string[] = [];
  if (!input.hasAcceptedActiveAgreement) reasons.push('AGREEMENT_REACCEPTANCE_REQUIRED');
  if (input.missingChecklistItems > 0) reasons.push('CONSENT_REQUIRED');
  if (!input.hasVerifiedIdentityDocument) reasons.push('IDENTITY_DOCUMENT_MISSING');
  if (!input.hasPublishedAtLeastOneService) reasons.push('SERVICE_MISSING');
  if (!input.hasBankAccount) reasons.push('BANK_ACCOUNT_MISSING');
  return { ready: reasons.length === 0, reasons };
}

/**
 * Business rule: an APPROVED provider can perform provider actions
 * (accept bookings, update rate). All other phases block the surface.
 */
export function isProviderApplicationOperational(
  phase: ProviderApplicationPhase,
): boolean {
  return phase === 'APPROVED';
}
