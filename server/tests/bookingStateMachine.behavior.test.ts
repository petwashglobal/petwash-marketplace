/**
 * Booking state machines — behavior pins
 * (CEO Business Doctrine §7, §8, §72; audit §7 "chat cannot change status").
 *
 * Locks the four separate state axes and the ONE allowed cross-axis
 * derivation (payment-settled → CONFIRMED promotion). Every other
 * cross-axis inference is a defect.
 */
import { describe, it, expect } from 'vitest';
import {
  canTransitionBookingStatus,
  canTransitionPaymentStatus,
  canTransitionPayoutStatus,
  canTransitionFiscalStatus,
  isTerminalBookingStatus,
  isPaymentSettled,
  canPromoteToConfirmed,
  canAccruePayoutOnComplete,
  nextBookingStatuses,
} from '../../shared/marketplace/bookingStateMachine';

describe('BookingStatus — canonical progression (§8.1)', () => {
  it('DRAFT → REQUESTED allowed', () => {
    expect(canTransitionBookingStatus('DRAFT', 'REQUESTED')).toBe(true);
  });

  it('REQUESTED → ACCEPTED allowed (provider skips a re-quote)', () => {
    expect(canTransitionBookingStatus('REQUESTED', 'ACCEPTED')).toBe(true);
  });

  it('REQUESTED → QUOTED allowed (provider proposed a revised price)', () => {
    expect(canTransitionBookingStatus('REQUESTED', 'QUOTED')).toBe(true);
  });

  it('QUOTED → ACCEPTED allowed (customer accepted the new quote)', () => {
    expect(canTransitionBookingStatus('QUOTED', 'ACCEPTED')).toBe(true);
  });

  it('ACCEPTED → CONFIRMED allowed (payment settled — enforced by canPromoteToConfirmed)', () => {
    expect(canTransitionBookingStatus('ACCEPTED', 'CONFIRMED')).toBe(true);
  });

  it('CONFIRMED → IN_PROGRESS → COMPLETED', () => {
    expect(canTransitionBookingStatus('CONFIRMED', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionBookingStatus('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });
});

describe('BookingStatus — cancel + dispute branches (§8.1)', () => {
  it('cancellation allowed from every active phase', () => {
    for (const from of ['DRAFT', 'REQUESTED', 'QUOTED', 'ACCEPTED', 'CONFIRMED', 'IN_PROGRESS'] as const) {
      expect(canTransitionBookingStatus(from, 'CANCELLED')).toBe(true);
    }
  });

  it('COMPLETED can open a dispute — cancellation is not a legal path after COMPLETED', () => {
    expect(canTransitionBookingStatus('COMPLETED', 'DISPUTED')).toBe(true);
    expect(canTransitionBookingStatus('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('DISPUTED can resolve back to COMPLETED or CANCELLED', () => {
    expect(canTransitionBookingStatus('DISPUTED', 'COMPLETED')).toBe(true);
    expect(canTransitionBookingStatus('DISPUTED', 'CANCELLED')).toBe(true);
  });

  it('CANCELLED is terminal — no transition out', () => {
    for (const to of ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] as const) {
      expect(canTransitionBookingStatus('CANCELLED', to)).toBe(false);
    }
    expect(isTerminalBookingStatus('CANCELLED')).toBe(true);
  });

  it('client cannot skip straight to COMPLETED (must invoke COMPLETE_JOB flow)', () => {
    expect(canTransitionBookingStatus('CONFIRMED', 'COMPLETED')).toBe(false);
    expect(canTransitionBookingStatus('ACCEPTED', 'COMPLETED')).toBe(false);
  });
});

describe('PaymentStatus (§8.2)', () => {
  it('UNPAID → PENDING → AUTHORIZED → PAID', () => {
    expect(canTransitionPaymentStatus('UNPAID', 'PENDING')).toBe(true);
    expect(canTransitionPaymentStatus('PENDING', 'AUTHORIZED')).toBe(true);
    expect(canTransitionPaymentStatus('AUTHORIZED', 'PAID')).toBe(true);
  });

  it('PAID → PARTIAL_REFUND → REFUNDED', () => {
    expect(canTransitionPaymentStatus('PAID', 'PARTIAL_REFUND')).toBe(true);
    expect(canTransitionPaymentStatus('PARTIAL_REFUND', 'REFUNDED')).toBe(true);
  });

  it('REFUNDED is terminal', () => {
    for (const to of ['PAID', 'AUTHORIZED', 'PENDING'] as const) {
      expect(canTransitionPaymentStatus('REFUNDED', to)).toBe(false);
    }
  });

  it('FAILED can retry back to UNPAID / PENDING', () => {
    expect(canTransitionPaymentStatus('FAILED', 'UNPAID')).toBe(true);
    expect(canTransitionPaymentStatus('FAILED', 'PENDING')).toBe(true);
  });

  it('isPaymentSettled: PAID + AUTHORIZED only', () => {
    expect(isPaymentSettled('PAID')).toBe(true);
    expect(isPaymentSettled('AUTHORIZED')).toBe(true);
    expect(isPaymentSettled('PENDING')).toBe(false);
    expect(isPaymentSettled('REFUNDED')).toBe(false);
    expect(isPaymentSettled('FAILED')).toBe(false);
    expect(isPaymentSettled('NOT_REQUIRED')).toBe(false);
  });
});

describe('PayoutStatus (§8.3)', () => {
  it('NOT_ELIGIBLE → ACCRUED after completion', () => {
    expect(canTransitionPayoutStatus('NOT_ELIGIBLE', 'ACCRUED')).toBe(true);
  });

  it('ACCRUED can go HELD (risk freeze) or SCHEDULED', () => {
    expect(canTransitionPayoutStatus('ACCRUED', 'HELD')).toBe(true);
    expect(canTransitionPayoutStatus('ACCRUED', 'SCHEDULED')).toBe(true);
  });

  it('HELD → ACCRUED (resolved) or SCHEDULED', () => {
    expect(canTransitionPayoutStatus('HELD', 'ACCRUED')).toBe(true);
    expect(canTransitionPayoutStatus('HELD', 'SCHEDULED')).toBe(true);
  });

  it('SCHEDULED → PAID (terminal)', () => {
    expect(canTransitionPayoutStatus('SCHEDULED', 'PAID')).toBe(true);
    expect(canTransitionPayoutStatus('PAID', 'SCHEDULED')).toBe(false);
  });
});

describe('FiscalStatus (§8.4)', () => {
  it('PENDING → ISSUED → CREDIT_PENDING → CREDIT_ISSUED (refund path)', () => {
    expect(canTransitionFiscalStatus('PENDING', 'ISSUED')).toBe(true);
    expect(canTransitionFiscalStatus('ISSUED', 'CREDIT_PENDING')).toBe(true);
    expect(canTransitionFiscalStatus('CREDIT_PENDING', 'CREDIT_ISSUED')).toBe(true);
  });

  it('FAILED can retry back to PENDING', () => {
    expect(canTransitionFiscalStatus('FAILED', 'PENDING')).toBe(true);
  });

  it('CREDIT_ISSUED is terminal', () => {
    expect(canTransitionFiscalStatus('CREDIT_ISSUED', 'ISSUED')).toBe(false);
    expect(canTransitionFiscalStatus('CREDIT_ISSUED', 'PENDING')).toBe(false);
  });
});

describe('cross-axis discipline (§8, §18): NEVER infer', () => {
  it('canPromoteToConfirmed: only when ACCEPTED + payment settled', () => {
    expect(canPromoteToConfirmed('ACCEPTED', 'PAID')).toBe(true);
    expect(canPromoteToConfirmed('ACCEPTED', 'AUTHORIZED')).toBe(true);
    expect(canPromoteToConfirmed('ACCEPTED', 'PENDING')).toBe(false);
    expect(canPromoteToConfirmed('ACCEPTED', 'UNPAID')).toBe(false);
    expect(canPromoteToConfirmed('CONFIRMED', 'PAID')).toBe(false); // already confirmed
    expect(canPromoteToConfirmed('QUOTED', 'PAID')).toBe(false);    // must ACCEPT first
  });

  it('canAccruePayoutOnComplete: booking COMPLETED + payment settled', () => {
    expect(canAccruePayoutOnComplete('COMPLETED', 'PAID')).toBe(true);
    expect(canAccruePayoutOnComplete('COMPLETED', 'AUTHORIZED')).toBe(true);
    expect(canAccruePayoutOnComplete('COMPLETED', 'REFUNDED')).toBe(false); // refunded → no accrual
    expect(canAccruePayoutOnComplete('IN_PROGRESS', 'PAID')).toBe(false);   // not yet completed
  });
});

describe('nextBookingStatuses (used by AvailableActionsResolver)', () => {
  it('CONFIRMED returns [IN_PROGRESS, CANCELLED, DISPUTED]', () => {
    expect(nextBookingStatuses('CONFIRMED').sort()).toEqual(['CANCELLED', 'DISPUTED', 'IN_PROGRESS']);
  });

  it('CANCELLED returns []', () => {
    expect(nextBookingStatuses('CANCELLED')).toEqual([]);
  });
});
