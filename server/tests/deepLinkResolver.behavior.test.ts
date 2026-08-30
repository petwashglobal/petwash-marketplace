/**
 * DeepLinkResolver — Program 33.
 *
 * Doctrine examples:
 *   "Provider proposed new price" → proposal review.
 *   "Shop order ready" → pickup details.
 *   "Refund complete" → refund detail.
 *   Payment uncertainty → STATUS surface, never PAY_AGAIN.
 */
import { describe, it, expect } from 'vitest';
import { resolveDeepLink } from '../services/marketplace/DeepLinkResolver';

describe('DeepLinkResolver', () => {
  it('BOOKING_CHANGE_PROPOSED → proposal review, not generic inbox', () => {
    expect(resolveDeepLink('BOOKING_CHANGE_PROPOSED', { kind: 'booking', id: 'B-1' })).toBe('/bookings/B-1/proposal');
  });

  it('BOOKING_REQUEST_NEW → provider requests inbox (provider-side)', () => {
    expect(resolveDeepLink('BOOKING_REQUEST_NEW', { kind: 'booking', id: 'B-1' })).toBe('/provider/requests/B-1');
  });

  it('PAYMENT_UNCERTAIN → payment status (never /pay again)', () => {
    const url = resolveDeepLink('PAYMENT_UNCERTAIN', { kind: 'booking', id: 'B-1' });
    expect(url).toBe('/bookings/B-1/payment-status');
    // Must NOT be the "pay again" endpoint (which ends in exactly "/pay").
    expect(url.endsWith('/pay')).toBe(false);
  });

  it('WALLET_TOPUP_STATUS → status surface, never "top up again"', () => {
    const url = resolveDeepLink('WALLET_TOPUP_STATUS', { kind: 'wallet_topup', id: 'W-1' });
    expect(url).toBe('/wallet/topup/W-1/status');
  });

  it('REFUND_STATUS_CHANGED → refund detail', () => {
    expect(resolveDeepLink('REFUND_STATUS_CHANGED', { kind: 'refund', id: 'R-1' })).toBe('/refunds/R-1');
  });

  it('DOCUMENT_READY → document detail', () => {
    expect(resolveDeepLink('DOCUMENT_READY', { kind: 'document', id: 'D-42' })).toBe('/documents/D-42');
  });

  it('PROVIDER_KYC_MISSING → provider application (no id in URL)', () => {
    expect(resolveDeepLink('PROVIDER_KYC_MISSING', { kind: 'application', id: 'PA-1' })).toBe('/provider/application');
  });

  it('MESSAGE_NEW → inbox thread', () => {
    expect(resolveDeepLink('MESSAGE_NEW', { kind: 'thread', id: 'T-9' })).toBe('/inbox/threads/T-9');
  });

  it('PET_KYA_STALE → pet detail', () => {
    expect(resolveDeepLink('PET_KYA_STALE', { kind: 'pet', id: '42' })).toBe('/pets/42');
  });

  it('SAFETY_ALERT → support surface', () => {
    expect(resolveDeepLink('SAFETY_ALERT', { kind: 'support_case', id: 'SC-1' })).toBe('/support/SC-1');
  });

  it('entity id is URL-encoded to avoid path-traversal / injection', () => {
    const url = resolveDeepLink('BOOKING_ACCEPTED', { kind: 'booking', id: 'B/1?foo=bar' });
    expect(url).toBe('/bookings/B%2F1%3Ffoo%3Dbar');
  });
});
