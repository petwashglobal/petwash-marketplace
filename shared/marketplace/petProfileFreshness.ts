/**
 * Pet profile freshness — CEO Business Doctrine §34 + SECURITY §21, §22.
 *
 * §21 correction: thresholds are POLICY-CONFIGURED, not engineer-invented.
 * The `evaluateFreshness` function accepts thresholds explicitly; there
 * are NO hardcoded default months. If a caller does not supply a
 * PetProfileReviewPolicy, freshness is UNKNOWN (POLICY_NOT_CONFIGURED)
 * — not "FRESH" and not "STALE".
 *
 * §22 discipline: freshness is ATTENTION signal only. Booking / Shop /
 * K9000 / Prestige eligibility MUST NOT gate on freshness — the
 * booking pipeline has its own care-confirmation step where needed.
 */

export type FreshnessStatus = 'FRESH' | 'REVIEW_SOON' | 'STALE' | 'POLICY_NOT_CONFIGURED';

export interface FreshnessThresholds {
  reviewSoonAfterDays: number;
  staleAfterDays: number;
}

/**
 * Policy that the caller must supply. Dimensions per §21: species, age
 * band, service type, medical relevance, active-booking presence. This
 * interface documents the dimensions; the initial implementation
 * accepts a single `adult` + `youngAnimal` band and callers who need
 * more dimensions build a richer policy layer above.
 *
 * The shipped implementation has NO baked-in default values — an
 * unconfigured caller receives POLICY_NOT_CONFIGURED, not a guess.
 */
export interface PetProfileReviewPolicy {
  adultThresholds: FreshnessThresholds;
  youngAnimalThresholds?: FreshnessThresholds;
  youngAnimalUpToMonths?: number;
}

export interface PetFreshnessInput {
  lastReviewedAt: string;              // ISO — a Touch or a real edit
  ageMonths?: number;
  now: string;                         // server time, ISO
  policy?: PetProfileReviewPolicy;     // undefined → POLICY_NOT_CONFIGURED
}

export function evaluateFreshness(input: PetFreshnessInput): FreshnessStatus {
  const policy = input.policy;
  if (!policy) return 'POLICY_NOT_CONFIGURED';

  const isYoung =
    policy.youngAnimalThresholds &&
    typeof input.ageMonths === 'number' &&
    typeof policy.youngAnimalUpToMonths === 'number' &&
    input.ageMonths < policy.youngAnimalUpToMonths;

  const thresholds = isYoung ? policy.youngAnimalThresholds! : policy.adultThresholds;

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
 * touch) or POLICY_NOT_CONFIGURED (no engine-configured window yet).
 */
export function canTouchFreshness(status: FreshnessStatus): boolean {
  return status === 'REVIEW_SOON' || status === 'STALE';
}

/**
 * Stack-rank pets that need attention. STALE > REVIEW_SOON. FRESH
 * pets drop out entirely. POLICY_NOT_CONFIGURED pets also drop out —
 * the engine cannot yet claim they need attention.
 */
export interface PetFreshnessEntry {
  petId: string;
  status: FreshnessStatus;
  lastReviewedAt: string;
}

export function petsNeedingAttention(
  entries: PetFreshnessEntry[],
): PetFreshnessEntry[] {
  const rank: Record<FreshnessStatus, number> = {
    STALE: 2,
    REVIEW_SOON: 1,
    FRESH: 0,
    POLICY_NOT_CONFIGURED: 0,
  };
  return entries
    .filter((e) => e.status === 'STALE' || e.status === 'REVIEW_SOON')
    .sort((a, b) => rank[b.status] - rank[a.status]);
}
