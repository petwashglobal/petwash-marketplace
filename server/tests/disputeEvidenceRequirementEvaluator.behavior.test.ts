/**
 * DisputeEvidenceRequirementEvaluator — Program 15 evidence gating.
 */
import { describe, it, expect } from 'vitest';
import {
  requirementsForDispute,
  missingRequired,
} from '../services/marketplace/DisputeEvidenceRequirementEvaluator';

describe('requirementsForDispute', () => {
  it('PET_INJURY requires INCIDENT_NARRATIVE + VET_REPORT', () => {
    const out = requirementsForDispute('PET_INJURY');
    expect(out.required).toEqual(['INCIDENT_NARRATIVE', 'VET_REPORT']);
    expect(out.recommended).toContain('PHOTOS');
  });

  it('DAMAGED_PROPERTY requires INCIDENT_NARRATIVE + PHOTOS', () => {
    expect(requirementsForDispute('DAMAGED_PROPERTY').required).toEqual(['INCIDENT_NARRATIVE', 'PHOTOS']);
  });

  it('NO_SHOW requires narrative + timestamped messages', () => {
    expect(requirementsForDispute('NO_SHOW').required).toEqual(['INCIDENT_NARRATIVE', 'TIMESTAMPED_MESSAGES']);
  });

  it('FRAUDULENT_CHARGE requires REDACTED bank statement (not raw)', () => {
    const r = requirementsForDispute('FRAUDULENT_CHARGE').required;
    expect(r).toContain('BANK_STATEMENT_REDACTED');
  });

  it('OTHER falls back to narrative only', () => {
    expect(requirementsForDispute('OTHER').required).toEqual(['INCIDENT_NARRATIVE']);
  });
});

describe('missingRequired', () => {
  it('nothing submitted → returns the full required list', () => {
    expect(missingRequired('PET_INJURY', [])).toEqual(['INCIDENT_NARRATIVE', 'VET_REPORT']);
  });

  it('narrative alone still needs VET_REPORT for PET_INJURY', () => {
    expect(missingRequired('PET_INJURY', ['INCIDENT_NARRATIVE'])).toEqual(['VET_REPORT']);
  });

  it('all required submitted → empty list', () => {
    expect(missingRequired('PET_INJURY', ['INCIDENT_NARRATIVE', 'VET_REPORT'])).toEqual([]);
  });

  it('recommended alone does not satisfy required', () => {
    expect(missingRequired('PET_INJURY', ['PHOTOS'])).toEqual(['INCIDENT_NARRATIVE', 'VET_REPORT']);
  });
});
