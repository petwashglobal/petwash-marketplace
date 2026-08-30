/**
 * AvailableActionsResolver — behavior pins (doctrine §40, §41, §42).
 *
 * Locks the doctrine's booking availability matrix — same actionType
 * hides / surfaces based on state + participant. Client cannot invent
 * buttons the server didn't authorise.
 */
import { describe, it, expect } from 'vitest';
import {
  bookingAvailableActions,
  confirmationMatchesCatalog,
  catalogCoverage,
  type BookingActionContext,
} from '../services/marketplace/AvailableActionsResolver';

const bookerCtx = (o: Partial<BookingActionContext> = {}): BookingActionContext => ({
  participant: 'BOOKER',
  bookingPhase: 'CONFIRMED',
  paymentPhase: 'PAID',
  ...o,
});

const providerCtx = (o: Partial<BookingActionContext> = {}): BookingActionContext => ({
  participant: 'PROVIDER',
  bookingPhase: 'CONFIRMED',
  paymentPhase: 'PAID',
  ...o,
});

function has(actions: ReturnType<typeof bookingAvailableActions>, type: string): boolean {
  return actions.some((a) => a.type === type);
}

describe('booking availability — accept flow', () => {
  it('provider on REQUESTED sees ACCEPT + DECLINE + PROPOSE_CHANGE', () => {
    const list = bookingAvailableActions(providerCtx({ bookingPhase: 'REQUESTED', paymentPhase: 'NOT_REQUIRED' }));
    expect(has(list, 'BOOKING_ACCEPT')).toBe(true);
    expect(has(list, 'BOOKING_DECLINE')).toBe(true);
    expect(has(list, 'BOOKING_PROPOSE_CHANGE')).toBe(true);
  });

  it('booker on REQUESTED does NOT see ACCEPT (only providers accept)', () => {
    const list = bookingAvailableActions(bookerCtx({ bookingPhase: 'REQUESTED' }));
    expect(has(list, 'BOOKING_ACCEPT')).toBe(false);
    expect(has(list, 'BOOKING_DECLINE')).toBe(false);
  });

  it('provider on CONFIRMED can no longer ACCEPT (already accepted)', () => {
    const list = bookingAvailableActions(providerCtx());
    expect(has(list, 'BOOKING_ACCEPT')).toBe(false);
  });
});

describe('booking availability — proposed change hand-off', () => {
  it('booker sees ACCEPT_PROPOSED_CHANGE only when a change is pending', () => {
    const noPending = bookingAvailableActions(bookerCtx({ proposedChangePending: false }));
    const withPending = bookingAvailableActions(bookerCtx({ proposedChangePending: true }));
    expect(has(noPending, 'BOOKING_ACCEPT_PROPOSED_CHANGE')).toBe(false);
    expect(has(withPending, 'BOOKING_ACCEPT_PROPOSED_CHANGE')).toBe(true);
  });

  it('provider does NOT see ACCEPT_PROPOSED_CHANGE — only bookers accept', () => {
    const list = bookingAvailableActions(providerCtx({ proposedChangePending: true }));
    expect(has(list, 'BOOKING_ACCEPT_PROPOSED_CHANGE')).toBe(false);
  });

  it('provider with an already-pending proposal does NOT see a second PROPOSE_CHANGE', () => {
    const list = bookingAvailableActions(providerCtx({ proposedChangePending: true }));
    expect(has(list, 'BOOKING_PROPOSE_CHANGE')).toBe(false);
  });
});

describe('booking availability — cancel by payment phase', () => {
  it('unpaid CONFIRMED → CUSTOMER_CANCEL_BOOKING_UNPAID', () => {
    const list = bookingAvailableActions(bookerCtx({ paymentPhase: 'UNPAID' }));
    expect(has(list, 'CUSTOMER_CANCEL_BOOKING_UNPAID')).toBe(true);
    expect(has(list, 'CUSTOMER_CANCEL_BOOKING_PAID')).toBe(false);
  });

  it('paid CONFIRMED → CUSTOMER_CANCEL_BOOKING_PAID with requiresPreview: true', () => {
    const list = bookingAvailableActions(bookerCtx({ paymentPhase: 'PAID' }));
    const cancel = list.find((a) => a.type === 'CUSTOMER_CANCEL_BOOKING_PAID');
    expect(cancel).toBeDefined();
    expect(cancel?.requiresPreview).toBe(true);
  });

  it('COMPLETED / CANCELLED / DISPUTED bookings never surface CANCEL', () => {
    for (const phase of ['COMPLETED', 'CANCELLED', 'DISPUTED'] as const) {
      const list = bookingAvailableActions(bookerCtx({ bookingPhase: phase }));
      expect(has(list, 'CUSTOMER_CANCEL_BOOKING_UNPAID')).toBe(false);
      expect(has(list, 'CUSTOMER_CANCEL_BOOKING_PAID')).toBe(false);
    }
  });
});

describe('booking availability — job lifecycle', () => {
  it('provider on CONFIRMED sees START_JOB (payment must have completed)', () => {
    const list = bookingAvailableActions(providerCtx({ bookingPhase: 'CONFIRMED' }));
    expect(has(list, 'BOOKING_START_JOB')).toBe(true);
    expect(has(list, 'BOOKING_COMPLETE_JOB')).toBe(false);
  });

  it('provider on ACCEPTED does NOT yet see START_JOB (waiting on payment)', () => {
    const list = bookingAvailableActions(providerCtx({ bookingPhase: 'ACCEPTED' }));
    expect(has(list, 'BOOKING_START_JOB')).toBe(false);
  });

  it('provider on IN_PROGRESS sees COMPLETE + VERIFY_RETURN (CEO §11 handshake)', () => {
    const list = bookingAvailableActions(providerCtx({ bookingPhase: 'IN_PROGRESS' }));
    expect(has(list, 'BOOKING_COMPLETE_JOB')).toBe(true);
    // Return is a two-sided handshake: booker ISSUES the code, provider VERIFIES.
    expect(has(list, 'RETURN_VERIFY_CODE')).toBe(true);
    expect(has(list, 'RETURN_ISSUE_CODE')).toBe(false); // that's the booker's action
  });

  it('booker on COMPLETED (no review yet) sees REVIEW_SUBMIT', () => {
    const list = bookingAvailableActions(bookerCtx({ bookingPhase: 'COMPLETED' }));
    expect(has(list, 'BOOKING_REVIEW_SUBMIT')).toBe(true);
  });

  it('booker on COMPLETED with existing review does NOT see REVIEW_SUBMIT again', () => {
    const list = bookingAvailableActions(bookerCtx({ bookingPhase: 'COMPLETED', hasExistingReview: true }));
    expect(has(list, 'BOOKING_REVIEW_SUBMIT')).toBe(false);
  });
});

describe('booking availability — structured changes', () => {
  it('CONFIRMED / IN_PROGRESS surface ADD_PET + EXTEND (either party)', () => {
    for (const phase of ['CONFIRMED', 'IN_PROGRESS'] as const) {
      const b = bookingAvailableActions(bookerCtx({ bookingPhase: phase }));
      const p = bookingAvailableActions(providerCtx({ bookingPhase: phase }));
      // CEO §9, §10 — actor-split intent.
      // Customer REQUESTS; provider PROPOSES. Never one boolean.
      expect(has(b, 'CUSTOMER_REQUEST_ADD_PET')).toBe(true);
      expect(has(b, 'CUSTOMER_REQUEST_EXTENSION')).toBe(true);
      expect(has(b, 'PROVIDER_PROPOSE_ADD_PET')).toBe(false);
      expect(has(p, 'PROVIDER_PROPOSE_ADD_PET')).toBe(true);
      expect(has(p, 'PROVIDER_PROPOSE_EXTENSION')).toBe(true);
      expect(has(p, 'CUSTOMER_REQUEST_ADD_PET')).toBe(false);
    }
  });

  it('REQUESTED / COMPLETED do NOT surface ADD_PET / EXTEND', () => {
    for (const phase of ['REQUESTED', 'COMPLETED'] as const) {
      const list = bookingAvailableActions(bookerCtx({ bookingPhase: phase }));
      expect(has(list, 'CUSTOMER_REQUEST_ADD_PET')).toBe(false);
      expect(has(list, 'CUSTOMER_REQUEST_EXTENSION')).toBe(false);
    }
  });
});

describe('every returned AvailableAction carries risk + confirmationLevel', () => {
  it('proves the catalog is the single source of confirmation authority', () => {
    const list = bookingAvailableActions(providerCtx({ bookingPhase: 'IN_PROGRESS' }));
    for (const a of list) {
      expect(a.riskLevel).toMatch(/^L[0-4]$/);
      expect(a.confirmationLevel.length).toBeGreaterThan(0);
    }
  });

  it('SUPPORT_CONTACT_OPEN is always surfaced (safety escape hatch — §66)', () => {
    for (const phase of ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'DISPUTED'] as const) {
      const list = bookingAvailableActions(bookerCtx({ bookingPhase: phase }));
      expect(has(list, 'SUPPORT_CONTACT_OPEN')).toBe(true);
    }
  });
});

describe('confirmationMatchesCatalog — catches drift', () => {
  it('L4 action with no impact signals still lands on REAUTH_AND_CONFIRM', () => {
    expect(confirmationMatchesCatalog('ACCOUNT_DELETE', {})).toBe(true);
  });

  it('unknown action → false (never claim a match for a rogue actionType)', () => {
    expect(confirmationMatchesCatalog('DOES_NOT_EXIST', {})).toBe(false);
  });
});

describe('catalogCoverage — every doctrine domain represented', () => {
  it('returns a count for each domain touched by the catalog', () => {
    const cov = catalogCoverage();
    expect(cov.BOOKING).toBeGreaterThanOrEqual(10);
    expect(cov.COMMUNICATION).toBeGreaterThanOrEqual(3);
    expect(cov.PROVIDER).toBeGreaterThanOrEqual(5);
    expect(cov.MONEY).toBeGreaterThanOrEqual(3);
    expect(cov.ADMIN).toBeGreaterThanOrEqual(3);
  });
});
