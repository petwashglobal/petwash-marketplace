/**
 * ProviderApplicationCompletenessEvaluator — CEO PROGRAM 21.
 *
 * Pure evaluator. Given the current draft of a provider application
 * + the required KYC document set, returns whether the draft is
 * READY_TO_SUBMIT or MISSING with the exact missing slugs. Callers
 * use this to gate the "Submit" CTA server-side.
 */

export type RequiredDocCode =
  | 'ID'
  | 'BANK_ACCOUNT'
  | 'INSURANCE'
  | 'VET_CERTIFICATE'
  | 'BACKGROUND_CHECK'
  | 'TAX_STATUS';

export interface ApplicationDraft {
  hasContactDetails: boolean;
  hasServicesDeclared: boolean;
  hasPricingDeclared: boolean;
  hasAvailabilityDeclared: boolean;
  uploadedDocs: RequiredDocCode[];
  hasAcceptedProviderTerms: boolean;
}

export interface RequirementProfile {
  requiredDocs: RequiredDocCode[];
}

export type ReadinessOutcome =
  | { code: 'READY_TO_SUBMIT' }
  | { code: 'INCOMPLETE'; missingSections: string[]; missingDocs: RequiredDocCode[] };

export function evaluateCompleteness(input: {
  draft: ApplicationDraft;
  profile: RequirementProfile;
}): ReadinessOutcome {
  const missingSections: string[] = [];
  if (!input.draft.hasContactDetails) missingSections.push('CONTACT_DETAILS');
  if (!input.draft.hasServicesDeclared) missingSections.push('SERVICES');
  if (!input.draft.hasPricingDeclared) missingSections.push('PRICING');
  if (!input.draft.hasAvailabilityDeclared) missingSections.push('AVAILABILITY');
  if (!input.draft.hasAcceptedProviderTerms) missingSections.push('PROVIDER_TERMS');

  const uploaded = new Set(input.draft.uploadedDocs);
  const missingDocs = input.profile.requiredDocs.filter((d) => !uploaded.has(d));

  if (missingSections.length === 0 && missingDocs.length === 0) return { code: 'READY_TO_SUBMIT' };
  return { code: 'INCOMPLETE', missingSections, missingDocs };
}
