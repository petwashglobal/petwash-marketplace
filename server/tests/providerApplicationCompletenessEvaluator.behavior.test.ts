/**
 * ProviderApplicationCompletenessEvaluator — Program 21 readiness gate.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateCompleteness,
  type ApplicationDraft,
  type RequirementProfile,
} from '../services/marketplace/ProviderApplicationCompletenessEvaluator';

const profile: RequirementProfile = {
  requiredDocs: ['ID', 'BANK_ACCOUNT', 'INSURANCE'],
};

const completeDraft: ApplicationDraft = {
  hasContactDetails: true,
  hasServicesDeclared: true,
  hasPricingDeclared: true,
  hasAvailabilityDeclared: true,
  uploadedDocs: ['ID', 'BANK_ACCOUNT', 'INSURANCE'],
  hasAcceptedProviderTerms: true,
};

describe('ProviderApplicationCompletenessEvaluator', () => {
  it('everything filled + all docs uploaded → READY_TO_SUBMIT', () => {
    expect(evaluateCompleteness({ draft: completeDraft, profile }).code).toBe('READY_TO_SUBMIT');
  });

  it('missing CONTACT_DETAILS + PROVIDER_TERMS → INCOMPLETE listing both', () => {
    const out = evaluateCompleteness({
      draft: { ...completeDraft, hasContactDetails: false, hasAcceptedProviderTerms: false },
      profile,
    });
    expect(out.code).toBe('INCOMPLETE');
    if (out.code !== 'INCOMPLETE') throw new Error();
    expect(out.missingSections).toEqual(['CONTACT_DETAILS', 'PROVIDER_TERMS']);
  });

  it('missing INSURANCE doc → INCOMPLETE with the exact doc code', () => {
    const out = evaluateCompleteness({
      draft: { ...completeDraft, uploadedDocs: ['ID', 'BANK_ACCOUNT'] },
      profile,
    });
    expect(out.code).toBe('INCOMPLETE');
    if (out.code !== 'INCOMPLETE') throw new Error();
    expect(out.missingDocs).toEqual(['INSURANCE']);
  });

  it('extra optional docs uploaded do not affect readiness', () => {
    const out = evaluateCompleteness({
      draft: { ...completeDraft, uploadedDocs: ['ID', 'BANK_ACCOUNT', 'INSURANCE', 'VET_CERTIFICATE'] },
      profile,
    });
    expect(out.code).toBe('READY_TO_SUBMIT');
  });

  it('empty draft → many missingSections + all requiredDocs missing', () => {
    const empty: ApplicationDraft = {
      hasContactDetails: false,
      hasServicesDeclared: false,
      hasPricingDeclared: false,
      hasAvailabilityDeclared: false,
      uploadedDocs: [],
      hasAcceptedProviderTerms: false,
    };
    const out = evaluateCompleteness({ draft: empty, profile });
    expect(out.code).toBe('INCOMPLETE');
    if (out.code !== 'INCOMPLETE') throw new Error();
    expect(out.missingSections).toEqual(['CONTACT_DETAILS', 'SERVICES', 'PRICING', 'AVAILABILITY', 'PROVIDER_TERMS']);
    expect(out.missingDocs).toEqual(['ID', 'BANK_ACCOUNT', 'INSURANCE']);
  });
});
