/**
 * ProviderApplication state machine — behavior pins (business §17.7, §72).
 */
import { describe, it, expect } from 'vitest';
import {
  canTransitionProviderApplication,
  evaluateSubmitReadiness,
  isProviderApplicationOperational,
  isTerminalProviderApplicationPhase,
  nextProviderApplicationPhases,
} from '../../shared/marketplace/providerApplicationStateMachine';

describe('state machine transitions', () => {
  it('NOT_STARTED → DRAFT allowed', () => {
    expect(canTransitionProviderApplication('NOT_STARTED', 'DRAFT')).toBe(true);
  });

  it('DRAFT → READY_TO_SUBMIT allowed', () => {
    expect(canTransitionProviderApplication('DRAFT', 'READY_TO_SUBMIT')).toBe(true);
  });

  it('READY_TO_SUBMIT ↔ DRAFT allowed (further edits before submit)', () => {
    expect(canTransitionProviderApplication('READY_TO_SUBMIT', 'DRAFT')).toBe(true);
  });

  it('READY_TO_SUBMIT → SUBMITTED allowed', () => {
    expect(canTransitionProviderApplication('READY_TO_SUBMIT', 'SUBMITTED')).toBe(true);
  });

  it('SUBMITTED → UNDER_REVIEW allowed', () => {
    expect(canTransitionProviderApplication('SUBMITTED', 'UNDER_REVIEW')).toBe(true);
  });

  it('UNDER_REVIEW branches to APPROVED / REJECTED / CHANGES_REQUESTED', () => {
    for (const to of ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'] as const) {
      expect(canTransitionProviderApplication('UNDER_REVIEW', to)).toBe(true);
    }
  });

  it('CHANGES_REQUESTED loops back to DRAFT / READY_TO_SUBMIT', () => {
    expect(canTransitionProviderApplication('CHANGES_REQUESTED', 'DRAFT')).toBe(true);
    expect(canTransitionProviderApplication('CHANGES_REQUESTED', 'READY_TO_SUBMIT')).toBe(true);
  });

  it('APPROVED is terminal (no legal move out)', () => {
    for (const to of ['DRAFT', 'READY_TO_SUBMIT', 'SUBMITTED', 'REJECTED', 'WITHDRAWN'] as const) {
      expect(canTransitionProviderApplication('APPROVED', to)).toBe(false);
    }
    expect(isTerminalProviderApplicationPhase('APPROVED')).toBe(true);
  });

  it('REJECTED and WITHDRAWN can loop back to DRAFT (retry / reopen)', () => {
    expect(canTransitionProviderApplication('REJECTED', 'DRAFT')).toBe(true);
    expect(canTransitionProviderApplication('WITHDRAWN', 'DRAFT')).toBe(true);
  });

  it('WITHDRAWN allowed from every non-terminal phase', () => {
    for (const from of ['DRAFT', 'READY_TO_SUBMIT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED'] as const) {
      expect(canTransitionProviderApplication(from, 'WITHDRAWN')).toBe(true);
    }
  });

  it('client cannot skip DRAFT → APPROVED (no self-approval)', () => {
    expect(canTransitionProviderApplication('DRAFT', 'APPROVED')).toBe(false);
    expect(canTransitionProviderApplication('READY_TO_SUBMIT', 'APPROVED')).toBe(false);
  });

  it('nextProviderApplicationPhases surfaces the transition set', () => {
    expect(nextProviderApplicationPhases('UNDER_REVIEW').sort()).toEqual([
      'APPROVED',
      'CHANGES_REQUESTED',
      'REJECTED',
      'WITHDRAWN',
    ]);
  });
});

describe('evaluateSubmitReadiness', () => {
  it('all gates green → ready:true, reasons:[]', () => {
    const r = evaluateSubmitReadiness({
      hasAcceptedActiveAgreement: true,
      missingChecklistItems: 0,
      hasVerifiedIdentityDocument: true,
      hasPublishedAtLeastOneService: true,
      hasBankAccount: true,
    });
    expect(r.ready).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it('agreement not accepted → AGREEMENT_REACCEPTANCE_REQUIRED', () => {
    const r = evaluateSubmitReadiness({
      hasAcceptedActiveAgreement: false,
      missingChecklistItems: 0,
      hasVerifiedIdentityDocument: true,
      hasPublishedAtLeastOneService: true,
      hasBankAccount: true,
    });
    expect(r.ready).toBe(false);
    expect(r.reasons).toContain('AGREEMENT_REACCEPTANCE_REQUIRED');
  });

  it('checklist items missing → CONSENT_REQUIRED', () => {
    const r = evaluateSubmitReadiness({
      hasAcceptedActiveAgreement: true,
      missingChecklistItems: 2,
      hasVerifiedIdentityDocument: true,
      hasPublishedAtLeastOneService: true,
      hasBankAccount: true,
    });
    expect(r.reasons).toContain('CONSENT_REQUIRED');
  });

  it('multiple gates fail → each reason listed', () => {
    const r = evaluateSubmitReadiness({
      hasAcceptedActiveAgreement: false,
      missingChecklistItems: 1,
      hasVerifiedIdentityDocument: false,
      hasPublishedAtLeastOneService: false,
      hasBankAccount: false,
    });
    expect(r.ready).toBe(false);
    expect(r.reasons.sort()).toEqual([
      'AGREEMENT_REACCEPTANCE_REQUIRED',
      'BANK_ACCOUNT_MISSING',
      'CONSENT_REQUIRED',
      'IDENTITY_DOCUMENT_MISSING',
      'SERVICE_MISSING',
    ]);
  });
});

describe('isProviderApplicationOperational', () => {
  it('APPROVED → true (provider surface unlocked)', () => {
    expect(isProviderApplicationOperational('APPROVED')).toBe(true);
  });

  it('every non-APPROVED phase blocks the surface', () => {
    for (const p of ['NOT_STARTED', 'DRAFT', 'READY_TO_SUBMIT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'REJECTED', 'WITHDRAWN'] as const) {
      expect(isProviderApplicationOperational(p)).toBe(false);
    }
  });
});
