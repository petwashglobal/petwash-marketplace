/**
 * Pet profile freshness — behavior pins (CEO §21, §22, §34, §48).
 *
 * §21 correction: thresholds are POLICY-CONFIGURED — no engineer-invented
 * month numbers. Unconfigured caller → POLICY_NOT_CONFIGURED.
 */
import { describe, it, expect } from 'vitest';
import {
  canTouchFreshness,
  evaluateFreshness,
  petsNeedingAttention,
  type PetFreshnessEntry,
  type PetProfileReviewPolicy,
} from '../../shared/marketplace/petProfileFreshness';
import { getBusinessDecision } from '../../shared/marketplace/businessDecisionRegistry';

const NOW = '2026-08-30T00:00:00Z';
function daysAgo(n: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

// A test-only policy — represents what a call site would pass IF the
// business had approved thresholds. It carries no doctrinal weight.
const TEST_POLICY: PetProfileReviewPolicy = {
  adultThresholds: { reviewSoonAfterDays: 150, staleAfterDays: 210 },
  youngAnimalThresholds: { reviewSoonAfterDays: 45, staleAfterDays: 90 },
  youngAnimalUpToMonths: 12,
};

describe('POLICY_NOT_CONFIGURED default (CEO §21 discipline)', () => {
  it('no policy supplied → POLICY_NOT_CONFIGURED (never a guess)', () => {
    const s = evaluateFreshness({ lastReviewedAt: daysAgo(30), now: NOW });
    expect(s).toBe('POLICY_NOT_CONFIGURED');
  });

  it('KYA_DEFAULT_REVIEW_INTERVAL is UNDECIDED in the business registry', () => {
    const d = getBusinessDecision('KYA_DEFAULT_REVIEW_INTERVAL');
    expect(d).toBeDefined();
    expect(d!.status).toBe('UNDECIDED');
  });
});

describe('with an explicit test policy — bands + boundaries', () => {
  it('adult reviewed 30 days ago → FRESH', () => {
    expect(evaluateFreshness({ lastReviewedAt: daysAgo(30), now: NOW, policy: TEST_POLICY })).toBe('FRESH');
  });

  it('adult reviewed 160 days ago → REVIEW_SOON', () => {
    expect(evaluateFreshness({ lastReviewedAt: daysAgo(160), now: NOW, policy: TEST_POLICY })).toBe('REVIEW_SOON');
  });

  it('adult reviewed 220 days ago → STALE', () => {
    expect(evaluateFreshness({ lastReviewedAt: daysAgo(220), now: NOW, policy: TEST_POLICY })).toBe('STALE');
  });

  it('young animal thresholds honoured when ageMonths < policy cutoff', () => {
    const puppy = evaluateFreshness({ lastReviewedAt: daysAgo(60), ageMonths: 6, now: NOW, policy: TEST_POLICY });
    const adult = evaluateFreshness({ lastReviewedAt: daysAgo(60), ageMonths: 24, now: NOW, policy: TEST_POLICY });
    expect(puppy).toBe('REVIEW_SOON');
    expect(adult).toBe('FRESH');
  });
});

describe('canTouchFreshness — "Everything is still correct"', () => {
  it('FRESH → cannot touch', () => {
    expect(canTouchFreshness('FRESH')).toBe(false);
  });

  it('REVIEW_SOON + STALE → can touch', () => {
    expect(canTouchFreshness('REVIEW_SOON')).toBe(true);
    expect(canTouchFreshness('STALE')).toBe(true);
  });

  it('POLICY_NOT_CONFIGURED → cannot touch (no engine-configured window)', () => {
    expect(canTouchFreshness('POLICY_NOT_CONFIGURED')).toBe(false);
  });
});

describe('petsNeedingAttention — drops FRESH and POLICY_NOT_CONFIGURED', () => {
  it('ranks STALE > REVIEW_SOON; ignores FRESH and unconfigured', () => {
    const entries: PetFreshnessEntry[] = [
      { petId: 'fresh', status: 'FRESH', lastReviewedAt: daysAgo(10) },
      { petId: 'stale', status: 'STALE', lastReviewedAt: daysAgo(300) },
      { petId: 'soon', status: 'REVIEW_SOON', lastReviewedAt: daysAgo(180) },
      { petId: 'unconf', status: 'POLICY_NOT_CONFIGURED', lastReviewedAt: daysAgo(400) },
    ];
    const out = petsNeedingAttention(entries);
    expect(out.map((e) => e.petId)).toEqual(['stale', 'soon']);
  });
});
