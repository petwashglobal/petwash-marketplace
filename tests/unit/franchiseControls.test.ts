import { describe, expect, it } from 'vitest';
import {
  FRANCHISE_EVIDENCE_RULES,
  FORBIDDEN_PUBLIC_FRANCHISE_CLAIMS,
  evaluateFranchisePartnerActivation,
  type FranchiseEvidenceState,
  type FranchiseEvidenceType,
} from '../../shared/franchiseControls';

function approvedEvidence(): Record<FranchiseEvidenceType, FranchiseEvidenceState> {
  return FRANCHISE_EVIDENCE_RULES.reduce((acc, rule) => {
    acc[rule.type] = 'APPROVED';
    return acc;
  }, {} as Record<FranchiseEvidenceType, FranchiseEvidenceState>);
}

describe('franchise/location partner controls', () => {
  it('blocks activation until NDA, contracts, site, support, supply, finance, insurance, bank, and Nir approval evidence exists', () => {
    const result = evaluateFranchisePartnerActivation({
      status: 'INFO_REQUESTED',
      evidence: {},
    });

    expect(result.allowed).toBe(false);
    expect(result.missingEvidence).toContain('NDA_SIGNED');
    expect(result.missingEvidence).toContain('LEGAL_PARTNER_AGREEMENT');
    expect(result.missingEvidence).toContain('SUPPLY_SUPPORT_MODEL');
    expect(result.missingEvidence).toContain('TRAINING_MANUAL_VERSION');
    expect(result.missingEvidence).toContain('NIR_APPROVAL');
    expect(result.requiresApprovers).toEqual(expect.arrayContaining(['legal', 'accountant', 'operations', 'finance', 'nir']));
  });

  it('allows the activation review only after all required evidence is approved and the case is waiting for owner approval execution', () => {
    const result = evaluateFranchisePartnerActivation({
      status: 'NIR_APPROVAL_REQUIRED',
      evidence: approvedEvidence(),
    });

    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.missingEvidence).toEqual([]);
  });

  it('blocks AI from approving a partner or site by itself', () => {
    const result = evaluateFranchisePartnerActivation({
      status: 'NIR_APPROVAL_REQUIRED',
      evidence: approvedEvidence(),
      aiRecommendedApproval: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers.join(' ')).toContain('AI may flag and suggest next checks');
  });

  it('blocks public finance and unverified scale claims', () => {
    const result = evaluateFranchisePartnerActivation({
      status: 'NIR_APPROVAL_REQUIRED',
      evidence: approvedEvidence(),
      publicCopyHasFinancialClaim: true,
      publicCopyHasUnverifiedScaleClaim: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers.join(' ')).toContain('Public finance');
    expect(result.blockers.join(' ')).toContain('Public scale claims');
  });

  it('keeps a concrete forbidden-claim list for public copy audits', () => {
    expect(FORBIDDEN_PUBLIC_FRANCHISE_CLAIMS).toContain('proven business model');
    expect(FORBIDDEN_PUBLIC_FRANCHISE_CLAIMS).toContain('global franchise network');
    expect(FORBIDDEN_PUBLIC_FRANCHISE_CLAIMS).toContain('92% success probability');
  });
});
