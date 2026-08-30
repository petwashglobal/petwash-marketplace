/**
 * ProviderHomeSectionsEvaluator — Program 3 rendering brain.
 */
import { describe, it, expect } from 'vitest';
import {
  composeProviderHome,
  type ProviderHomeInput,
} from '../services/marketplace/ProviderHomeSectionsEvaluator';

const empty: ProviderHomeInput = {
  hasActiveJobNow: false,
  handoffsDueNext30min: 0,
  newRequestsAwaitingResponse: 0,
  changeProposalsAwaitingResponse: 0,
  complianceBlockers: 0,
  earningsAnomalies: 0,
  upcomingJobsNext24h: 0,
  unreadMessages: 0,
  isProfileComplete: true,
};

describe('composeProviderHome', () => {
  it('empty state → only CALENDAR + PERFORMANCE (baseline surfaces)', () => {
    const codes = composeProviderHome(empty).map((s) => s.code);
    expect(codes).toEqual(['CALENDAR', 'PERFORMANCE']);
  });

  it('active job → first section', () => {
    const codes = composeProviderHome({ ...empty, hasActiveJobNow: true }).map((s) => s.code);
    expect(codes[0]).toBe('ACTIVE_JOB');
  });

  it('handoff due beats new requests when both present', () => {
    const codes = composeProviderHome({
      ...empty,
      handoffsDueNext30min: 1,
      newRequestsAwaitingResponse: 3,
    }).map((s) => s.code);
    expect(codes[0]).toBe('HANDOFF_DUE');
    expect(codes[1]).toBe('NEW_REQUESTS');
  });

  it('compliance blockers appear with count', () => {
    const s = composeProviderHome({ ...empty, complianceBlockers: 2 });
    const cb = s.find((x) => x.code === 'COMPLIANCE_BLOCKERS');
    expect(cb?.count).toBe(2);
  });

  it('incomplete profile → PROFILE section appended', () => {
    const codes = composeProviderHome({ ...empty, isProfileComplete: false }).map((s) => s.code);
    expect(codes).toContain('PROFILE');
  });

  it('complete profile → PROFILE not shown', () => {
    const codes = composeProviderHome({ ...empty, isProfileComplete: true }).map((s) => s.code);
    expect(codes).not.toContain('PROFILE');
  });

  it('doctrine priority order — full snapshot', () => {
    const codes = composeProviderHome({
      hasActiveJobNow: true,
      handoffsDueNext30min: 1,
      newRequestsAwaitingResponse: 2,
      changeProposalsAwaitingResponse: 1,
      complianceBlockers: 1,
      earningsAnomalies: 1,
      upcomingJobsNext24h: 2,
      unreadMessages: 3,
      isProfileComplete: false,
    }).map((s) => s.code);
    expect(codes).toEqual([
      'ACTIVE_JOB',
      'HANDOFF_DUE',
      'NEW_REQUESTS',
      'NEEDS_RESPONSE',
      'COMPLIANCE_BLOCKERS',
      'EARNINGS_ANOMALIES',
      'UPCOMING_JOBS',
      'MESSAGES',
      'CALENDAR',
      'PERFORMANCE',
      'PROFILE',
    ]);
  });
});
