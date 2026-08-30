/**
 * Pet profile freshness — behavior pins (business §34, §85).
 */
import { describe, it, expect } from 'vitest';
import {
  canTouchFreshness,
  evaluateFreshness,
  petsNeedingAttention,
  DEFAULT_ADULT_THRESHOLDS,
  DEFAULT_YOUNG_ANIMAL_THRESHOLDS,
  type PetFreshnessEntry,
} from '../../shared/marketplace/petProfileFreshness';

const NOW = '2026-08-30T00:00:00Z';

// Helper: N days before NOW.
function daysAgo(n: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

describe('adult pet thresholds (~5 months REVIEW_SOON, ~7 months STALE)', () => {
  it('reviewed 30 days ago → FRESH', () => {
    const s = evaluateFreshness({ lastReviewedAt: daysAgo(30), now: NOW });
    expect(s).toBe('FRESH');
  });

  it('reviewed 160 days ago → REVIEW_SOON', () => {
    const s = evaluateFreshness({ lastReviewedAt: daysAgo(160), now: NOW });
    expect(s).toBe('REVIEW_SOON');
  });

  it('reviewed 220 days ago → STALE', () => {
    const s = evaluateFreshness({ lastReviewedAt: daysAgo(220), now: NOW });
    expect(s).toBe('STALE');
  });

  it('boundary exactly at reviewSoonAfterDays → REVIEW_SOON', () => {
    const s = evaluateFreshness({
      lastReviewedAt: daysAgo(DEFAULT_ADULT_THRESHOLDS.reviewSoonAfterDays),
      now: NOW,
    });
    expect(s).toBe('REVIEW_SOON');
  });

  it('boundary exactly at staleAfterDays → STALE', () => {
    const s = evaluateFreshness({
      lastReviewedAt: daysAgo(DEFAULT_ADULT_THRESHOLDS.staleAfterDays),
      now: NOW,
    });
    expect(s).toBe('STALE');
  });
});

describe('young animal thresholds (< 12 months age → tighter window)', () => {
  it('puppy 60 days since review → REVIEW_SOON (adult would still be FRESH)', () => {
    const puppy = evaluateFreshness({ lastReviewedAt: daysAgo(60), ageMonths: 6, now: NOW });
    const adult = evaluateFreshness({ lastReviewedAt: daysAgo(60), ageMonths: 24, now: NOW });
    expect(puppy).toBe('REVIEW_SOON');
    expect(adult).toBe('FRESH');
  });

  it('kitten 100 days since review → STALE (adult would still be FRESH)', () => {
    const kitten = evaluateFreshness({ lastReviewedAt: daysAgo(100), ageMonths: 3, now: NOW });
    const adult = evaluateFreshness({ lastReviewedAt: daysAgo(100), ageMonths: 36, now: NOW });
    expect(kitten).toBe('STALE');
    expect(adult).toBe('FRESH');
  });

  it('young-animal thresholds sanity: reviewSoon < stale', () => {
    expect(DEFAULT_YOUNG_ANIMAL_THRESHOLDS.reviewSoonAfterDays).toBeLessThan(
      DEFAULT_YOUNG_ANIMAL_THRESHOLDS.staleAfterDays,
    );
  });
});

describe('canTouchFreshness (§34 "Everything is still correct")', () => {
  it('FRESH → cannot touch (nothing to do)', () => {
    expect(canTouchFreshness('FRESH')).toBe(false);
  });

  it('REVIEW_SOON → can touch', () => {
    expect(canTouchFreshness('REVIEW_SOON')).toBe(true);
  });

  it('STALE → can touch', () => {
    expect(canTouchFreshness('STALE')).toBe(true);
  });
});

describe('petsNeedingAttention — STALE beats REVIEW_SOON, FRESH drops out', () => {
  it('ranks STALE > REVIEW_SOON; drops FRESH', () => {
    const entries: PetFreshnessEntry[] = [
      { petId: 'fresh', status: 'FRESH', lastReviewedAt: daysAgo(10) },
      { petId: 'stale', status: 'STALE', lastReviewedAt: daysAgo(300) },
      { petId: 'soon', status: 'REVIEW_SOON', lastReviewedAt: daysAgo(180) },
    ];
    const out = petsNeedingAttention(entries);
    expect(out.map((e) => e.petId)).toEqual(['stale', 'soon']);
  });

  it('empty when everything is FRESH', () => {
    const entries: PetFreshnessEntry[] = [
      { petId: 'a', status: 'FRESH', lastReviewedAt: daysAgo(5) },
      { petId: 'b', status: 'FRESH', lastReviewedAt: daysAgo(15) },
    ];
    expect(petsNeedingAttention(entries)).toEqual([]);
  });
});

describe('invalid inputs never crash', () => {
  it('non-ISO lastReviewedAt → FRESH fallback (0 days ago)', () => {
    const s = evaluateFreshness({ lastReviewedAt: 'not-a-date', now: NOW });
    expect(s).toBe('FRESH');
  });

  it('future lastReviewedAt (clock skew) → FRESH', () => {
    const future = new Date(NOW);
    future.setUTCDate(future.getUTCDate() + 1);
    const s = evaluateFreshness({ lastReviewedAt: future.toISOString(), now: NOW });
    expect(s).toBe('FRESH');
  });
});
