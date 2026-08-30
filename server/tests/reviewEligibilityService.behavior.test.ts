/**
 * ReviewEligibilityService — Program 28.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateReviewEligibility,
  type ReviewEligibilityInput,
} from '../services/marketplace/ReviewEligibilityService';

const baseline: ReviewEligibilityInput = {
  bookingStatus: 'COMPLETED',
  serviceVerified: true,
  actorRole: 'CUSTOMER',
  actorUid: 'sarah',
  customerUid: 'sarah',
  providerUid: 'maya',
  hasExistingReview: false,
  completedAt: '2026-08-30T10:00:00Z',
  now: new Date('2026-09-01T10:00:00Z'),
  reviewWindowDays: 14,
};

describe('ReviewEligibilityService', () => {
  it('all conditions met → ELIGIBLE', () => {
    expect(evaluateReviewEligibility(baseline).code).toBe('ELIGIBLE');
  });

  it('booking not COMPLETED → INELIGIBLE(BOOKING_NOT_COMPLETED)', () => {
    const out = evaluateReviewEligibility({ ...baseline, bookingStatus: 'CONFIRMED' });
    expect(out.code).toBe('INELIGIBLE');
    if (out.code !== 'INELIGIBLE') throw new Error();
    expect(out.reasonCode).toBe('BOOKING_NOT_COMPLETED');
  });

  it('service NOT verified → INELIGIBLE(SERVICE_NOT_VERIFIED) — no off-platform reviews', () => {
    const out = evaluateReviewEligibility({ ...baseline, serviceVerified: false });
    if (out.code !== 'INELIGIBLE') throw new Error();
    expect(out.reasonCode).toBe('SERVICE_NOT_VERIFIED');
  });

  it('provider trying to review self → SELF_REVIEW_BLOCKED', () => {
    const out = evaluateReviewEligibility({
      ...baseline,
      actorRole: 'CUSTOMER',       // typed as customer but same uid as provider
      customerUid: 'maya',
      actorUid: 'maya',
    });
    if (out.code !== 'INELIGIBLE') throw new Error();
    expect(out.reasonCode).toBe('SELF_REVIEW_BLOCKED');
  });

  it('provider attempting review from PROVIDER role → ACTOR_NOT_CUSTOMER', () => {
    const out = evaluateReviewEligibility({ ...baseline, actorRole: 'PROVIDER', actorUid: 'maya' });
    if (out.code !== 'INELIGIBLE') throw new Error();
    expect(out.reasonCode).toBe('ACTOR_NOT_CUSTOMER');
  });

  it('already-reviewed → ALREADY_REVIEWED', () => {
    const out = evaluateReviewEligibility({ ...baseline, hasExistingReview: true });
    if (out.code !== 'INELIGIBLE') throw new Error();
    expect(out.reasonCode).toBe('ALREADY_REVIEWED');
  });

  it('reviewWindowDays undefined → POLICY_NOT_CONFIGURED (§21-§22 discipline)', () => {
    const out = evaluateReviewEligibility({ ...baseline, reviewWindowDays: undefined });
    if (out.code !== 'INELIGIBLE') throw new Error();
    expect(out.reasonCode).toBe('POLICY_NOT_CONFIGURED');
  });

  it('past the review window → REVIEW_WINDOW_LAPSED', () => {
    const out = evaluateReviewEligibility({
      ...baseline,
      completedAt: '2026-07-01T10:00:00Z',
      now: new Date('2026-09-01T10:00:00Z'),
      reviewWindowDays: 14,
    });
    if (out.code !== 'INELIGIBLE') throw new Error();
    expect(out.reasonCode).toBe('REVIEW_WINDOW_LAPSED');
  });
});
