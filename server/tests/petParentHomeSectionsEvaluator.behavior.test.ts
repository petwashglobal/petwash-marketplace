/**
 * PetParentHomeSectionsEvaluator — Program 2 rendering brain.
 */
import { describe, it, expect } from 'vitest';
import {
  composePetParentHome,
  type PetParentHomeInput,
} from '../services/marketplace/PetParentHomeSectionsEvaluator';

const empty: PetParentHomeInput = {
  hasSafetyAlert: false,
  hasPaymentUncertainty: false,
  bookingDeadlineCount: 0,
  hasCurrentService: false,
  upcomingCount: 0,
  requiredProfileCount: 0,
  refundInProgress: false,
  unreadMessages: 0,
  ordersInFlightCount: 0,
  hasEligibleBookAgain: false,
  showRecommendations: false,
  hasMarketingConsent: false,
  hasPendingMarketingOffer: false,
};

describe('composePetParentHome — CEO priority order', () => {
  it('empty state → dashboard baselines only (MY_PETS + WALLET_EGIFT + PRESTIGE + RECENT)', () => {
    expect(composePetParentHome(empty).map((s) => s.code)).toEqual([
      'MY_PETS', 'WALLET_EGIFT', 'PRESTIGE', 'RECENT',
    ]);
  });

  it('SAFETY beats PAYMENT_UNCERTAIN which beats BOOKING_DEADLINE', () => {
    const codes = composePetParentHome({
      ...empty,
      hasSafetyAlert: true,
      hasPaymentUncertainty: true,
      bookingDeadlineCount: 1,
    }).map((s) => s.code);
    expect(codes.slice(0, 3)).toEqual(['SAFETY_ALERT', 'PAYMENT_UNCERTAIN', 'BOOKING_DEADLINE']);
  });

  it('marketing NEVER appears before REQUIRED_PROFILE (§75)', () => {
    const codes = composePetParentHome({
      ...empty,
      requiredProfileCount: 1,
      hasMarketingConsent: true,
      hasPendingMarketingOffer: true,
    }).map((s) => s.code);
    const reqIdx = codes.indexOf('REQUIRED_PROFILE');
    const mktIdx = codes.indexOf('MARKETING');
    expect(reqIdx).toBeGreaterThan(-1);
    expect(mktIdx).toBeGreaterThan(-1);
    expect(reqIdx).toBeLessThan(mktIdx);
  });

  it('marketing suppressed without consent', () => {
    const codes = composePetParentHome({
      ...empty,
      hasMarketingConsent: false,
      hasPendingMarketingOffer: true,
    }).map((s) => s.code);
    expect(codes).not.toContain('MARKETING');
  });

  it('BOOK_AGAIN appears only when eligible', () => {
    expect(composePetParentHome({ ...empty, hasEligibleBookAgain: true }).map((s) => s.code))
      .toContain('BOOK_AGAIN');
    expect(composePetParentHome({ ...empty, hasEligibleBookAgain: false }).map((s) => s.code))
      .not.toContain('BOOK_AGAIN');
  });

  it('CURRENT_SERVICE + UPCOMING both present when both flagged', () => {
    const codes = composePetParentHome({
      ...empty,
      hasCurrentService: true,
      upcomingCount: 2,
    }).map((s) => s.code);
    expect(codes).toContain('CURRENT_SERVICE');
    expect(codes).toContain('UPCOMING');
  });

  it('ORDERS appears only when ordersInFlightCount > 0', () => {
    expect(composePetParentHome({ ...empty, ordersInFlightCount: 2 }).map((s) => s.code)).toContain('ORDERS');
    expect(composePetParentHome({ ...empty }).map((s) => s.code)).not.toContain('ORDERS');
  });
});
