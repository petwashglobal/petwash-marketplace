/**
 * EGiftRedemptionEvaluator — Program 19.
 */
import { describe, it, expect } from 'vitest';
import { evaluateRedemption, type GiftSnapshot } from '../services/marketplace/EGiftRedemptionEvaluator';

const g = (o: Partial<GiftSnapshot> = {}): GiftSnapshot => ({
  giftId: 'G-1',
  status: 'DELIVERED_TO_RECIPIENT',
  recipientUid: 'maya',
  amountCents: 20000,
  currency: 'ILS',
  ...o,
});

describe('EGiftRedemptionEvaluator', () => {
  it('happy path → ALLOWED with correct remaining', () => {
    const out = evaluateRedemption({ gift: g(), actorUid: 'maya', amountToRedeemCents: 5000 });
    expect(out.code).toBe('ALLOWED');
    if (out.code !== 'ALLOWED') throw new Error();
    expect(out.remainingCents).toBe(15000);
  });

  it('CANCELLED → BLOCKED(GIFT_CANCELLED)', () => {
    const out = evaluateRedemption({ gift: g({ status: 'CANCELLED' }), actorUid: 'maya', amountToRedeemCents: 1 });
    expect(out.code).toBe('BLOCKED');
    if (out.code !== 'BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('GIFT_CANCELLED');
  });

  it('REDEEMED → BLOCKED(GIFT_ALREADY_REDEEMED)', () => {
    const out = evaluateRedemption({ gift: g({ status: 'REDEEMED' }), actorUid: 'maya', amountToRedeemCents: 1 });
    expect(out.code).toBe('BLOCKED');
    if (out.code !== 'BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('GIFT_ALREADY_REDEEMED');
  });

  it('CREATED / PAYMENT_PENDING / PAID → BLOCKED(GIFT_NOT_DELIVERED) (buyer receipt ≠ recipient value)', () => {
    for (const status of ['CREATED', 'PAYMENT_PENDING', 'PAID'] as const) {
      const out = evaluateRedemption({ gift: g({ status }), actorUid: 'maya', amountToRedeemCents: 1 });
      expect(out.code).toBe('BLOCKED');
      if (out.code !== 'BLOCKED') throw new Error();
      expect(out.reasonCode).toBe('GIFT_NOT_DELIVERED');
    }
  });

  it('wrong recipient → BLOCKED(GIFT_NOT_A_PARTY)', () => {
    const out = evaluateRedemption({ gift: g({ recipientUid: 'someone-else' }), actorUid: 'maya', amountToRedeemCents: 1 });
    expect(out.code).toBe('BLOCKED');
    if (out.code !== 'BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('GIFT_NOT_A_PARTY');
  });

  it('expired gift → BLOCKED(GIFT_EXPIRED)', () => {
    const out = evaluateRedemption({
      gift: g({ expiresAt: '2026-01-01T00:00:00Z' }),
      actorUid: 'maya',
      amountToRedeemCents: 1,
      now: new Date('2026-08-30T10:00:00Z'),
    });
    expect(out.code).toBe('BLOCKED');
    if (out.code !== 'BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('GIFT_EXPIRED');
  });

  it('amount exceeds balance → INSUFFICIENT_BALANCE', () => {
    const out = evaluateRedemption({ gift: g(), actorUid: 'maya', amountToRedeemCents: 999999 });
    expect(out.code).toBe('BLOCKED');
    if (out.code !== 'BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('INSUFFICIENT_BALANCE');
  });

  it('non-positive amount → INVALID_AMOUNT', () => {
    const out = evaluateRedemption({ gift: g(), actorUid: 'maya', amountToRedeemCents: 0 });
    expect(out.code).toBe('BLOCKED');
    if (out.code !== 'BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('INVALID_AMOUNT');
  });
});
