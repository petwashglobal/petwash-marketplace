/**
 * OfflineDraftGuard — Program 48.
 */
import { describe, it, expect } from 'vitest';
import { evaluateOfflineAction } from '../services/marketplace/OfflineDraftGuard';

describe('OfflineDraftGuard', () => {
  it('any action online + no unreconciled payment → ATTEMPT_NOW', () => {
    expect(evaluateOfflineAction({ action: 'CHAT_DRAFT', connectivity: 'ONLINE', hasUnreconciledPayment: false }).code).toBe('ATTEMPT_NOW');
    expect(evaluateOfflineAction({ action: 'PAYMENT_INITIATE', connectivity: 'ONLINE', hasUnreconciledPayment: false }).code).toBe('ATTEMPT_NOW');
  });

  it('CHAT_DRAFT / MESSAGE_SEND offline → QUEUE_LOCAL (drafts survive)', () => {
    const out = evaluateOfflineAction({ action: 'MESSAGE_SEND', connectivity: 'OFFLINE', hasUnreconciledPayment: false });
    expect(out.code).toBe('QUEUE_LOCAL');
    if (out.code !== 'QUEUE_LOCAL') throw new Error();
    expect(out.reasonCode).toBe('DRAFT_SAFE_LOCAL');
  });

  it('FAVOURITE_TOGGLE offline → QUEUE_LOCAL', () => {
    expect(evaluateOfflineAction({ action: 'FAVOURITE_TOGGLE', connectivity: 'OFFLINE', hasUnreconciledPayment: false }).code).toBe('QUEUE_LOCAL');
  });

  it('PAYMENT_INITIATE offline → BLOCK(NETWORK_REQUIRED)', () => {
    const out = evaluateOfflineAction({ action: 'PAYMENT_INITIATE', connectivity: 'OFFLINE', hasUnreconciledPayment: false });
    expect(out.code).toBe('BLOCK');
    if (out.code !== 'BLOCK') throw new Error();
    expect(out.reasonCode).toBe('NETWORK_REQUIRED');
  });

  it('WALLET_TOPUP with unreconciled payment online → BLOCK(RECONCILE_BEFORE_MUTATE)', () => {
    const out = evaluateOfflineAction({ action: 'WALLET_TOPUP', connectivity: 'ONLINE', hasUnreconciledPayment: true });
    expect(out.code).toBe('BLOCK');
    if (out.code !== 'BLOCK') throw new Error();
    expect(out.reasonCode).toBe('RECONCILE_BEFORE_MUTATE');
  });

  it('BOOKING_ACCEPT UNSTABLE → BLOCK(NETWORK_REQUIRED) (not draft-safe)', () => {
    expect(evaluateOfflineAction({ action: 'BOOKING_ACCEPT', connectivity: 'UNSTABLE', hasUnreconciledPayment: false }).code).toBe('BLOCK');
  });

  it('HANDOFF_VERIFY with unreconciled payment → BLOCK regardless of online state', () => {
    expect(evaluateOfflineAction({ action: 'HANDOFF_VERIFY', connectivity: 'ONLINE', hasUnreconciledPayment: true }).code).toBe('BLOCK');
  });

  it('DISMISS_ATTENTION UNSTABLE → QUEUE_LOCAL (safe UX)', () => {
    expect(evaluateOfflineAction({ action: 'DISMISS_ATTENTION', connectivity: 'UNSTABLE', hasUnreconciledPayment: false }).code).toBe('QUEUE_LOCAL');
  });
});
