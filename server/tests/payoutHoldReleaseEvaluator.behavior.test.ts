/**
 * PayoutHoldReleaseEvaluator — provider payout release rules.
 */
import { describe, it, expect } from 'vitest';
import { evaluatePayoutHold } from '../services/marketplace/PayoutHoldReleaseEvaluator';

const now = new Date('2026-09-10T10:00:00Z');
const completedNDaysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe('PayoutHoldReleaseEvaluator', () => {
  it('holdDays undefined → BLOCKED(POLICY_NOT_CONFIGURED) (§21-§22)', () => {
    const out = evaluatePayoutHold({
      bookingCompletedAt: completedNDaysAgo(5),
      now,
      holdDays: undefined,
      hasOpenDispute: false,
      hasPendingRefund: false,
    });
    expect(out.code).toBe('BLOCKED');
  });

  it('booking not completed → BLOCKED(NOT_COMPLETED_YET)', () => {
    const out = evaluatePayoutHold({
      bookingCompletedAt: undefined,
      now,
      holdDays: 3,
      hasOpenDispute: false,
      hasPendingRefund: false,
    });
    expect(out.code).toBe('BLOCKED');
  });

  it('dispute open → ON_HOLD(DISPUTE_OPEN)', () => {
    const out = evaluatePayoutHold({
      bookingCompletedAt: completedNDaysAgo(10),
      now,
      holdDays: 3,
      hasOpenDispute: true,
      hasPendingRefund: false,
    });
    expect(out.code).toBe('ON_HOLD');
    if (out.code !== 'ON_HOLD') throw new Error();
    expect(out.reasonCode).toBe('DISPUTE_OPEN');
  });

  it('pending refund → ON_HOLD(REFUND_PENDING)', () => {
    const out = evaluatePayoutHold({
      bookingCompletedAt: completedNDaysAgo(10),
      now,
      holdDays: 3,
      hasOpenDispute: false,
      hasPendingRefund: true,
    });
    expect(out.code).toBe('ON_HOLD');
  });

  it('inside hold window → ON_HOLD(HOLD_WINDOW_NOT_ELAPSED)', () => {
    const out = evaluatePayoutHold({
      bookingCompletedAt: completedNDaysAgo(1),
      now,
      holdDays: 3,
      hasOpenDispute: false,
      hasPendingRefund: false,
    });
    expect(out.code).toBe('ON_HOLD');
  });

  it('hold elapsed, no dispute/refund → RELEASE_ALLOWED', () => {
    const out = evaluatePayoutHold({
      bookingCompletedAt: completedNDaysAgo(5),
      now,
      holdDays: 3,
      hasOpenDispute: false,
      hasPendingRefund: false,
    });
    expect(out.code).toBe('RELEASE_ALLOWED');
  });

  it('review needed but review not submitted + window open → ON_HOLD(REVIEW_WINDOW_OPEN)', () => {
    const out = evaluatePayoutHold({
      bookingCompletedAt: completedNDaysAgo(4),
      now,
      holdDays: 3,
      hasOpenDispute: false,
      hasPendingRefund: false,
      reviewNeededBeforePayout: true,
      reviewSubmitted: false,
      reviewWindowDays: 7,
    });
    expect(out.code).toBe('ON_HOLD');
    if (out.code !== 'ON_HOLD') throw new Error();
    expect(out.reasonCode).toBe('REVIEW_WINDOW_OPEN');
  });

  it('review submitted before window elapses → RELEASE_ALLOWED', () => {
    const out = evaluatePayoutHold({
      bookingCompletedAt: completedNDaysAgo(4),
      now,
      holdDays: 3,
      hasOpenDispute: false,
      hasPendingRefund: false,
      reviewNeededBeforePayout: true,
      reviewSubmitted: true,
      reviewWindowDays: 7,
    });
    expect(out.code).toBe('RELEASE_ALLOWED');
  });
});
