/**
 * EGiftRedemptionEvaluator — CEO PROGRAM 19 (eGift).
 *
 * Pure evaluator. Doctrine: "Buyer receipt ≠ recipient value."
 * The recipient's redemption is INDEPENDENT of the buyer's payment
 * evidence. This service decides whether a recipient's redemption
 * attempt is valid at THIS moment for THIS actor.
 */

export type GiftStatus =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'DELIVERED_TO_RECIPIENT'
  | 'REDEEMED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface GiftSnapshot {
  giftId: string;
  status: GiftStatus;
  recipientUid?: string;                     // may be unset until claimed
  amountCents: number;
  currency: 'ILS';
  expiresAt?: string;                        // ISO
}

export interface RedemptionInput {
  gift: GiftSnapshot;
  actorUid: string;
  amountToRedeemCents: number;
  now?: Date;
}

export type RedemptionOutcome =
  | { code: 'ALLOWED'; remainingCents: number }
  | { code: 'BLOCKED'; reasonCode:
      | 'GIFT_NOT_DELIVERED'
      | 'GIFT_NOT_A_PARTY'
      | 'GIFT_EXPIRED'
      | 'GIFT_ALREADY_REDEEMED'
      | 'GIFT_CANCELLED'
      | 'INSUFFICIENT_BALANCE'
      | 'INVALID_AMOUNT' };

export function evaluateRedemption(input: RedemptionInput): RedemptionOutcome {
  const g = input.gift;
  if (g.status === 'CANCELLED') return { code: 'BLOCKED', reasonCode: 'GIFT_CANCELLED' };
  if (g.status === 'REDEEMED') return { code: 'BLOCKED', reasonCode: 'GIFT_ALREADY_REDEEMED' };
  if (g.status !== 'DELIVERED_TO_RECIPIENT') return { code: 'BLOCKED', reasonCode: 'GIFT_NOT_DELIVERED' };
  if (g.recipientUid && g.recipientUid !== input.actorUid) return { code: 'BLOCKED', reasonCode: 'GIFT_NOT_A_PARTY' };
  if (g.expiresAt) {
    const now = input.now ?? new Date();
    if (Date.parse(g.expiresAt) < now.getTime()) return { code: 'BLOCKED', reasonCode: 'GIFT_EXPIRED' };
  }
  if (!Number.isFinite(input.amountToRedeemCents) || input.amountToRedeemCents <= 0) {
    return { code: 'BLOCKED', reasonCode: 'INVALID_AMOUNT' };
  }
  if (input.amountToRedeemCents > g.amountCents) {
    return { code: 'BLOCKED', reasonCode: 'INSUFFICIENT_BALANCE' };
  }
  return { code: 'ALLOWED', remainingCents: g.amountCents - input.amountToRedeemCents };
}
