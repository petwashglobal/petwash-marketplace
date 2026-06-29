import { describe, it, expect } from 'vitest';
import { computeInboxRowStatus } from '../services/inboxSmartStatus';

describe('inboxSmartStatus — smart inbox badge + next-action rules', () => {
  it('no provider reply → Waiting for provider · Contact more providers', () => {
    const r = computeInboxRowStatus({ threadType: 'BOOKING', bookingStatus: 'pending', providerReplied: false });
    expect(r.badge).toBe('WAITING_FOR_PROVIDER');
    expect(r.action).toBe('CONTACT_MORE_PROVIDERS');
  });

  it('provider accepted + unpaid → Payment required · Confirm & Pay', () => {
    const r = computeInboxRowStatus({ threadType: 'BOOKING', bookingStatus: 'accepted', paymentStatus: 'unpaid' });
    expect(r.badge).toBe('PAYMENT_REQUIRED');
    expect(r.action).toBe('CONFIRM_AND_PAY');
  });

  it('payment failed → Payment required · Try payment again', () => {
    const r = computeInboxRowStatus({ threadType: 'BOOKING', bookingStatus: 'accepted', paymentStatus: 'failed' });
    expect(r.action).toBe('TRY_PAYMENT_AGAIN');
  });

  it('confirmed + incomplete pet profile → Complete pet profile', () => {
    const r = computeInboxRowStatus({ threadType: 'BOOKING', bookingStatus: 'confirmed', petProfileComplete: false });
    expect(r.badge).toBe('BOOKING_CONFIRMED');
    expect(r.action).toBe('COMPLETE_PET_PROFILE');
  });

  it('confirmed + starts soon → Starts soon · View care notes', () => {
    const r = computeInboxRowStatus({ threadType: 'BOOKING', bookingStatus: 'confirmed', petProfileComplete: true, startsSoon: true });
    expect(r.badge).toBe('STARTS_SOON');
    expect(r.action).toBe('VIEW_CARE_NOTES');
  });

  it('active booking → Active now · View booking', () => {
    expect(computeInboxRowStatus({ threadType: 'BOOKING', bookingStatus: 'in_progress' }).badge).toBe('ACTIVE_NOW');
  });

  it('completed → Completed · Review / Tip', () => {
    const r = computeInboxRowStatus({ threadType: 'BOOKING', bookingStatus: 'completed' });
    expect(r.badge).toBe('COMPLETED');
    expect(r.action).toBe('REVIEW_TIP');
  });

  it('cancelled → Cancelled', () => {
    expect(computeInboxRowStatus({ threadType: 'BOOKING', bookingStatus: 'cancelled' }).badge).toBe('CANCELLED');
  });

  it('incident open → Incident open · View case (wins over everything)', () => {
    const r = computeInboxRowStatus({ threadType: 'INCIDENT', caseId: 'c1' } as any);
    expect(r.badge).toBe('INCIDENT_OPEN');
    expect(r.action).toBe('VIEW_CASE');
  });

  it('support waiting on user → Support waiting · Upload evidence', () => {
    const r = computeInboxRowStatus({ threadType: 'SUPPORT', supportWaitingOnUser: true });
    expect(r.badge).toBe('SUPPORT_WAITING');
    expect(r.action).toBe('UPLOAD_EVIDENCE');
  });

  it('archived → Archived (no money/legal loss, still readable)', () => {
    expect(computeInboxRowStatus({ threadType: 'BOOKING', threadStatus: 'archived', bookingStatus: 'accepted' }).badge).toBe('ARCHIVED');
  });

  it('franchise / public support default to an open support row', () => {
    expect(computeInboxRowStatus({ threadType: 'FRANCHISE' }).badge).toBe('SUPPORT_WAITING');
    expect(computeInboxRowStatus({ threadType: 'SUPPORT' }).badge).toBe('SUPPORT_WAITING');
  });

  it('every result carries bilingual badge + action labels', () => {
    const r = computeInboxRowStatus({ threadType: 'BOOKING', bookingStatus: 'accepted', paymentStatus: 'unpaid' });
    expect(r.badgeLabel.he).toBeTruthy();
    expect(r.actionLabel.en).toBe('Confirm & Pay');
    expect(r.actionLabel.he).toBe('אישור ותשלום');
  });
});
