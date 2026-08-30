/**
 * BookingJourneyResolver — CEO NEXT-AUTO §14 / Doctrine §84-§87.
 *
 * Exercises the §86 invariant: same entity, different actor →
 * different JourneyState (waitingOn, obligation, primaryAction).
 */
import { describe, it, expect } from 'vitest';
import {
  resolveBookingJourney,
  type BookingJourneySnapshot,
} from '../services/marketplace/BookingJourneyResolver';

function snap(over: Partial<BookingJourneySnapshot> = {}): BookingJourneySnapshot {
  return {
    bookingId: 'B-1',
    status: 'REQUESTED',
    customerUid: 'sarah',
    providerUid: 'maya',
    ...over,
  };
}

describe('§86 — same entity → different projection per actor', () => {
  it('REQUESTED: customer waits on provider; provider is obliged to respond', () => {
    const s = snap({ status: 'REQUESTED', requestExpiresAt: '2026-09-01T00:00:00Z' });
    const cust = resolveBookingJourney({ snapshot: s, actorUid: 'sarah', actorRole: 'CUSTOMER' });
    const prov = resolveBookingJourney({ snapshot: s, actorUid: 'maya', actorRole: 'PROVIDER' });
    expect(cust.waitingOn).toBe('PROVIDER');
    expect(cust.primaryAction?.actionType).toBe('MESSAGE_PROVIDER');
    expect(prov.waitingOn).toBe('PROVIDER');
    expect(prov.obligations.some((o) => o.type === 'RESPOND_TO_PROVIDER_REQUEST' && o.severity === 'REQUIRED')).toBe(true);
    expect(prov.primaryAction?.actionType).toBe('BOOKING_ACCEPT');
  });

  it('PROVIDER_PROPOSED_CHANGE: customer must REVIEW; provider must WAIT', () => {
    const s = snap({ status: 'PROVIDER_PROPOSED_CHANGE' });
    const cust = resolveBookingJourney({ snapshot: s, actorUid: 'sarah', actorRole: 'CUSTOMER' });
    const prov = resolveBookingJourney({ snapshot: s, actorUid: 'maya', actorRole: 'PROVIDER' });
    expect(cust.waitingOn).toBe('CUSTOMER');
    expect(cust.primaryAction?.actionType).toBe('BOOKING_ACCEPT_PROPOSED_CHANGE');
    expect(cust.obligations.some((o) => o.type === 'REVIEW_PROPOSED_CHANGE')).toBe(true);
    expect(prov.obligations.some((o) => o.type === 'WAIT')).toBe(true);
  });

  it('CONFIRMED with amountDueCents > 0: customer owes PAY (URGENT)', () => {
    const s = snap({ status: 'CONFIRMED', amountDueCents: 26000, currency: 'ILS' });
    const cust = resolveBookingJourney({ snapshot: s, actorUid: 'sarah', actorRole: 'CUSTOMER' });
    expect(cust.obligations.some((o) => o.type === 'PAY' && o.severity === 'REQUIRED')).toBe(true);
    expect(cust.attentionPriority).toBe('URGENT');
    expect(cust.primaryAction?.actionType).toBe('CUSTOMER_PAY_BOOKING');
    expect(cust.money?.labelCode).toBe('AMOUNT_DUE');
  });

  it('IN_PROGRESS: return handoff pending → customer must VERIFY; provider must ISSUE', () => {
    const s = snap({ status: 'IN_PROGRESS', returnHandoffVerified: false });
    const cust = resolveBookingJourney({ snapshot: s, actorUid: 'sarah', actorRole: 'CUSTOMER' });
    const prov = resolveBookingJourney({ snapshot: s, actorUid: 'maya', actorRole: 'PROVIDER' });
    expect(cust.primaryAction?.actionType).toBe('HANDOFF_VERIFY_CODE');
    expect(prov.primaryAction?.actionType).toBe('HANDOFF_ISSUE_CODE');
  });

  it('COMPLETED with no customer rating: customer gets OPTIONAL rate obligation', () => {
    const s = snap({ status: 'COMPLETED', hasCustomerRating: false });
    const cust = resolveBookingJourney({ snapshot: s, actorUid: 'sarah', actorRole: 'CUSTOMER' });
    expect(cust.obligations.some((o) => o.type === 'RATE_COMPLETED_SERVICE' && o.severity === 'OPTIONAL')).toBe(true);
    expect(cust.attentionPriority).toBe('INFO');
  });

  it('CANCELLED: terminal, waitingOn=NONE, primary=FIND_PROVIDER', () => {
    const s = snap({ status: 'CANCELLED' });
    const cust = resolveBookingJourney({ snapshot: s, actorUid: 'sarah', actorRole: 'CUSTOMER' });
    expect(cust.waitingOn).toBe('NONE');
    expect(cust.primaryAction?.actionType).toBe('FIND_PROVIDER');
  });
});

describe('§75 — REQUIRED obligations always outrank informational', () => {
  it('PROVIDER on REQUESTED has REQUIRED obligation → hasRequiredObligation() true', () => {
    const s = snap({ status: 'REQUESTED', requestExpiresAt: '2026-09-01T00:00:00Z' });
    const prov = resolveBookingJourney({ snapshot: s, actorUid: 'maya', actorRole: 'PROVIDER' });
    expect(prov.obligations.some((o) => o.severity === 'REQUIRED')).toBe(true);
  });
});

describe('deadlines', () => {
  it('request expiry surfaces as a hard-cutoff deadline', () => {
    const s = snap({ status: 'REQUESTED', requestExpiresAt: '2026-09-01T00:00:00Z' });
    const prov = resolveBookingJourney({ snapshot: s, actorUid: 'maya', actorRole: 'PROVIDER' });
    expect(prov.deadlines).toContainEqual({ reasonCode: 'REQUEST_EXPIRES', dueAt: '2026-09-01T00:00:00Z', hardCutoff: true });
  });
});
