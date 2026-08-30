/**
 * PetParentHomeSectionsEvaluator — CEO PROGRAM 2 (Pet Parent Home Brain).
 *
 * Pure evaluator. Doctrine priority (§74 / §75):
 *   1 safety
 *   2 money uncertainty
 *   3 booking deadline
 *   4 active/upcoming service
 *   5 required profile/compliance
 *   6 refund
 *   7 messages
 *   8 optional recommendations
 *   9 marketing
 * The evaluator NEVER queries — it orders sections the caller has
 * already gathered. Sections with zero relevant items are dropped.
 * MY_PETS + BOOK_AGAIN + PRESTIGE + WALLET + RECENT are always
 * shown so the home stays a real dashboard.
 */

export type PetParentSection =
  | 'SAFETY_ALERT'
  | 'PAYMENT_UNCERTAIN'
  | 'BOOKING_DEADLINE'
  | 'CURRENT_SERVICE'
  | 'UPCOMING'
  | 'REQUIRED_PROFILE'
  | 'REFUND'
  | 'MESSAGES'
  | 'MY_PETS'
  | 'ORDERS'
  | 'WALLET_EGIFT'
  | 'PRESTIGE'
  | 'RECENT'
  | 'BOOK_AGAIN'
  | 'RECOMMENDATIONS'
  | 'MARKETING';

export interface PetParentHomeInput {
  hasSafetyAlert: boolean;
  hasPaymentUncertainty: boolean;
  bookingDeadlineCount: number;              // e.g. accept/decline pending
  hasCurrentService: boolean;
  upcomingCount: number;
  requiredProfileCount: number;              // KYA missing / phone verify / etc.
  refundInProgress: boolean;
  unreadMessages: number;
  ordersInFlightCount: number;
  hasEligibleBookAgain: boolean;
  showRecommendations: boolean;
  hasMarketingConsent: boolean;
  hasPendingMarketingOffer: boolean;
}

export interface Section {
  code: PetParentSection;
  count?: number;
  reasonCode: string;
}

export function composePetParentHome(input: PetParentHomeInput): Section[] {
  const out: Section[] = [];

  // 1 SAFETY
  if (input.hasSafetyAlert) out.push({ code: 'SAFETY_ALERT', reasonCode: 'SAFETY_ATTENTION' });
  // 2 MONEY UNCERTAINTY
  if (input.hasPaymentUncertainty) out.push({ code: 'PAYMENT_UNCERTAIN', reasonCode: 'PAYMENT_STATUS_UNCLEAR' });
  // 3 BOOKING DEADLINE
  if (input.bookingDeadlineCount > 0) out.push({ code: 'BOOKING_DEADLINE', count: input.bookingDeadlineCount, reasonCode: 'BOOKING_ACTION_DUE' });
  // 4 ACTIVE / UPCOMING
  if (input.hasCurrentService) out.push({ code: 'CURRENT_SERVICE', reasonCode: 'CURRENT_SERVICE_NOW' });
  if (input.upcomingCount > 0) out.push({ code: 'UPCOMING', count: input.upcomingCount, reasonCode: 'UPCOMING_JOBS' });
  // 5 REQUIRED PROFILE / COMPLIANCE
  if (input.requiredProfileCount > 0) out.push({ code: 'REQUIRED_PROFILE', count: input.requiredProfileCount, reasonCode: 'REQUIRED_PROFILE_ACTION' });
  // 6 REFUND
  if (input.refundInProgress) out.push({ code: 'REFUND', reasonCode: 'REFUND_IN_PROGRESS' });
  // 7 MESSAGES
  if (input.unreadMessages > 0) out.push({ code: 'MESSAGES', count: input.unreadMessages, reasonCode: 'UNREAD_MESSAGES' });

  // Baseline dashboard sections
  out.push({ code: 'MY_PETS', reasonCode: 'MY_PETS_SNAPSHOT' });
  if (input.ordersInFlightCount > 0) out.push({ code: 'ORDERS', count: input.ordersInFlightCount, reasonCode: 'ORDERS_IN_FLIGHT' });
  out.push({ code: 'WALLET_EGIFT', reasonCode: 'WALLET_EGIFT_SNAPSHOT' });
  out.push({ code: 'PRESTIGE', reasonCode: 'PRESTIGE_SNAPSHOT' });
  out.push({ code: 'RECENT', reasonCode: 'RECENT_ACTIVITY' });
  if (input.hasEligibleBookAgain) out.push({ code: 'BOOK_AGAIN', reasonCode: 'BOOK_AGAIN_ELIGIBLE' });

  // 8 RECOMMENDATIONS
  if (input.showRecommendations) out.push({ code: 'RECOMMENDATIONS', reasonCode: 'RECOMMENDATIONS_ELIGIBLE' });
  // 9 MARKETING — never before required attention; consent required.
  if (input.hasMarketingConsent && input.hasPendingMarketingOffer) {
    out.push({ code: 'MARKETING', reasonCode: 'MARKETING_OFFER' });
  }
  return out;
}
