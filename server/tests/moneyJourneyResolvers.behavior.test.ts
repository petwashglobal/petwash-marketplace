/**
 * Wallet + eGift + Payout JourneyResolvers — CEO NEXT-AUTO §14 refills.
 */
import { describe, it, expect } from 'vitest';
import { resolveWalletJourney } from '../services/marketplace/WalletJourneyResolver';
import { resolveEGiftJourney } from '../services/marketplace/EGiftJourneyResolver';
import { resolvePayoutJourney } from '../services/marketplace/PayoutJourneyResolver';

describe('Wallet — §12 payment uncertainty routing', () => {
  it('PAYMENT_PENDING → VIEW_TOPUP_STATUS, NEVER TOPUP_AGAIN', () => {
    const r = resolveWalletJourney({
      snapshot: { topupId: 'W-1', status: 'PAYMENT_PENDING', customerUid: 'sarah', amountCents: 5000 },
      actorUid: 'sarah',
    });
    expect(r.waitingOn).toBe('PAYMENT_PROVIDER');
    expect(r.primaryAction?.actionType).toBe('VIEW_TOPUP_STATUS');
    expect(r.primaryAction?.actionType).not.toBe('TOPUP_AGAIN');
  });

  it('CAPTURED → VIEW_WALLET_BALANCE + INFO priority', () => {
    const r = resolveWalletJourney({
      snapshot: { topupId: 'W-1', status: 'CAPTURED', customerUid: 'sarah', amountCents: 5000 },
      actorUid: 'sarah',
    });
    expect(r.primaryAction?.actionType).toBe('VIEW_WALLET_BALANCE');
    expect(r.attentionPriority).toBe('INFO');
  });

  it('FAILED_FINAL suggests START_NEW_TOPUP (not "retry the failed one")', () => {
    const r = resolveWalletJourney({
      snapshot: { topupId: 'W-1', status: 'FAILED_FINAL', customerUid: 'sarah', amountCents: 5000 },
      actorUid: 'sarah',
    });
    expect(r.primaryAction?.actionType).toBe('START_NEW_TOPUP');
  });
});

describe('eGift — buyer vs recipient projections', () => {
  it('BUYER on CREATED → PAY REQUIRED, primary CONTINUE_CHECKOUT', () => {
    const r = resolveEGiftJourney({
      snapshot: { giftId: 'G-1', status: 'CREATED', buyerUid: 'sarah', amountCents: 20000 },
      actorUid: 'sarah', actorRole: 'BUYER',
    });
    expect(r.obligations.some((o) => o.type === 'PAY' && o.severity === 'REQUIRED')).toBe(true);
    expect(r.primaryAction?.actionType).toBe('CONTINUE_CHECKOUT');
    expect(r.money?.labelCode).toBe('GIFT_AMOUNT');
  });

  it('BUYER on PAYMENT_PENDING → VIEW_PAYMENT_STATUS (§12)', () => {
    const r = resolveEGiftJourney({
      snapshot: { giftId: 'G-1', status: 'PAYMENT_PENDING', buyerUid: 'sarah', amountCents: 20000 },
      actorUid: 'sarah', actorRole: 'BUYER',
    });
    expect(r.primaryAction?.actionType).toBe('VIEW_PAYMENT_STATUS');
  });

  it('RECIPIENT on DELIVERED_TO_RECIPIENT → REDEEM_GIFT, buyer money HIDDEN', () => {
    const r = resolveEGiftJourney({
      snapshot: { giftId: 'G-1', status: 'DELIVERED_TO_RECIPIENT', buyerUid: 'sarah', recipientUid: 'maya', amountCents: 20000 },
      actorUid: 'maya', actorRole: 'RECIPIENT',
    });
    expect(r.primaryAction?.actionType).toBe('REDEEM_GIFT');
    expect(r.money).toBeUndefined();
  });

  it('expiry surfaces as hard-cutoff deadline for both actors', () => {
    const r = resolveEGiftJourney({
      snapshot: { giftId: 'G-1', status: 'DELIVERED_TO_RECIPIENT', buyerUid: 'sarah', recipientUid: 'maya', amountCents: 20000, expiresAt: '2027-01-01T00:00:00Z' },
      actorUid: 'maya', actorRole: 'RECIPIENT',
    });
    expect(r.deadlines).toContainEqual({ reasonCode: 'GIFT_EXPIRES', dueAt: '2027-01-01T00:00:00Z', hardCutoff: true });
  });
});

describe('Payout — provider view only', () => {
  it('PENDING_HOLD → waitingOn=PETWASH, INFO priority, primary VIEW_PAYOUT', () => {
    const r = resolvePayoutJourney({
      snapshot: { payoutId: 'P-1', status: 'PENDING_HOLD', providerUid: 'maya', amountCents: 26000, holdReleasesAt: '2026-09-01T00:00:00Z' },
      actorUid: 'maya',
    });
    expect(r.waitingOn).toBe('PETWASH');
    expect(r.primaryAction?.actionType).toBe('VIEW_PAYOUT');
    expect(r.deadlines).toContainEqual({ reasonCode: 'PAYOUT_HOLD_RELEASES', dueAt: '2026-09-01T00:00:00Z', hardCutoff: false });
  });

  it('TRANSFERRING → waitingOn=PAYMENT_PROVIDER, primary VIEW_PAYOUT_STATUS', () => {
    const r = resolvePayoutJourney({
      snapshot: { payoutId: 'P-1', status: 'TRANSFERRING', providerUid: 'maya', amountCents: 26000 },
      actorUid: 'maya',
    });
    expect(r.waitingOn).toBe('PAYMENT_PROVIDER');
    expect(r.primaryAction?.actionType).toBe('VIEW_PAYOUT_STATUS');
  });

  it('FAILED → URGENT with primary CONTACT_SUPPORT', () => {
    const r = resolvePayoutJourney({
      snapshot: { payoutId: 'P-1', status: 'FAILED', providerUid: 'maya', amountCents: 26000 },
      actorUid: 'maya',
    });
    expect(r.attentionPriority).toBe('URGENT');
    expect(r.primaryAction?.actionType).toBe('CONTACT_SUPPORT');
  });
});
