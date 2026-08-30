/**
 * Pet profile freshness — CEO Business Doctrine §34.
 *
 * Pets change (age, medication, weight, vet, behaviour). The doctrine
 * says the app should nudge the owner to REVIEW the profile every so
 * often — the review can be a one-tap "Everything is still correct"
 * (the KYA_REVIEW_TIMESTAMP_TOUCH action) or a real edit.
 *
 * Rules:
 *   • Freshness is time-based ONLY on the last review timestamp.
 *   • The engine returns a status, never a UI string; the render
 *     layer maps status → copy so translations stay in one place.
 *   • Kittens / puppies (age < 12 months) get a shorter freshness
 *     window because they change quickly.
 */

export type FreshnessStatus = 'FRESH' | 'REVIEW_SOON' | 'STALE';

/** Days after which a pet's profile enters the given status band. */
export interface FreshnessThresholds {
  reviewSoonAfterDays: number;
  staleAfterDays: number;
}

export const DEFAULT_ADULT_THRESHOLDS: FreshnessThresholds = {
  reviewSoonAfterDays: 150,           // ~5 months
  staleAfterDays: 210,                 // ~7 months
};

export const DEFAULT_YOUNG_ANIMAL_THRESHOLDS: FreshnessThresholds = {
  reviewSoonAfterDays: 45,             // ~1.5 months
  staleAfterDays: 90,                  // ~3 months
};

export interface PetFreshnessInput {
  lastReviewedAt: string;              // ISO — a Touch or a real edit
  ageMonths?: number;                  // undefined → treat as adult
  now: string;                         // server time, ISO
}

export function evaluateFreshness(input: PetFreshnessInput): FreshnessStatus {
  const thresholds =
    input.ageMonths !== undefined && input.ageMonths < 12
      ? DEFAULT_YOUNG_ANIMAL_THRESHOLDS
      : DEFAULT_ADULT_THRESHOLDS;

  const days = daysBetween(input.lastReviewedAt, input.now);
  if (days >= thresholds.staleAfterDays) return 'STALE';
  if (days >= thresholds.reviewSoonAfterDays) return 'REVIEW_SOON';
  return 'FRESH';
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.floor((to - from) / (1000 * 60 * 60 * 24)));
}

/**
 * §34 UX bridge: the "Everything is still correct" action is a valid
 * response — a review does NOT require an edit. This helper returns
 * true when the KYA_REVIEW_TIMESTAMP_TOUCH action can bump the
 * freshness. Refuses when the current status is FRESH (nothing to
 * touch — the record is already up to date).
 */
export function canTouchFreshness(status: FreshnessStatus): boolean {
  return status !== 'FRESH';
}

/**
 * Stack-rank pets that need attention. STALE > REVIEW_SOON. FRESH
 * pets drop out entirely — no nudge needed.
 */
export interface PetFreshnessEntry {
  petId: string;
  status: FreshnessStatus;
  lastReviewedAt: string;
}

export function petsNeedingAttention(
  entries: PetFreshnessEntry[],
): PetFreshnessEntry[] {
  const rank: Record<FreshnessStatus, number> = { STALE: 2, REVIEW_SOON: 1, FRESH: 0 };
  return entries
    .filter((e) => e.status !== 'FRESH')
    .sort((a, b) => rank[b.status] - rank[a.status]);
}
