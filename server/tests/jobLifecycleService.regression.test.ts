/**
 * JobLifecycleService — CEO NEXT-AUTO §7 / §9 / §10.
 */
import { describe, it, expect } from 'vitest';
import {
  startJob,
  completeJob,
  rateJob,
  type JobLifecycleSnapshot,
} from '../services/marketplace/JobLifecycleService';

function snap(over: Partial<JobLifecycleSnapshot> = {}): JobLifecycleSnapshot {
  return {
    bookingId: 'B-1',
    status: 'CONFIRMED',
    providerUid: 'maya',
    customerUid: 'sarah',
    handoffs: { PICKUP: 'VERIFIED' },
    hasCustomerRating: false,
    ...over,
  };
}

describe('startJob', () => {
  it('provider + CONFIRMED + PICKUP verified → STARTED', () => {
    expect(startJob({ actorUid: 'maya', snapshot: snap() }).code).toBe('STARTED');
  });
  it('non-provider refused', () => {
    expect(startJob({ actorUid: 'sarah', snapshot: snap() }).code).toBe('ACTOR_NOT_PROVIDER');
  });
  it('PICKUP not verified → HANDOFF_NOT_VERIFIED (§8 handshake gate)', () => {
    expect(startJob({ actorUid: 'maya', snapshot: snap({ handoffs: { PICKUP: 'PENDING' } }) }).code).toBe('HANDOFF_NOT_VERIFIED');
  });
  it('booking not startable → BOOKING_NOT_STARTABLE', () => {
    expect(startJob({ actorUid: 'maya', snapshot: snap({ status: 'REQUESTED' }) }).code).toBe('BOOKING_NOT_STARTABLE');
  });
});

describe('completeJob', () => {
  it('provider + IN_PROGRESS + RETURN verified → COMPLETED', () => {
    expect(completeJob({ actorUid: 'maya', snapshot: snap({ status: 'IN_PROGRESS', handoffs: { PICKUP: 'VERIFIED', RETURN: 'VERIFIED' } }) }).code).toBe('COMPLETED');
  });
  it('RETURN not verified → HANDOFF_NOT_VERIFIED', () => {
    expect(completeJob({ actorUid: 'maya', snapshot: snap({ status: 'IN_PROGRESS', handoffs: { PICKUP: 'VERIFIED' } }) }).code).toBe('HANDOFF_NOT_VERIFIED');
  });
  it('non-provider refused', () => {
    expect(completeJob({ actorUid: 'sarah', snapshot: snap({ status: 'IN_PROGRESS' }) }).code).toBe('ACTOR_NOT_PROVIDER');
  });
});

describe('rateJob', () => {
  it('customer rating a COMPLETED booking with 1..5 stars → RATED', () => {
    for (const stars of [1, 2, 3, 4, 5]) {
      expect(rateJob({ actorUid: 'sarah', stars, snapshot: snap({ status: 'COMPLETED' }) }).code).toBe('RATED');
    }
  });
  it('non-customer refused', () => {
    expect(rateJob({ actorUid: 'maya', stars: 5, snapshot: snap({ status: 'COMPLETED' }) }).code).toBe('ACTOR_NOT_CUSTOMER');
  });
  it('self-rating blocked when providerUid === customerUid', () => {
    expect(rateJob({ actorUid: 'nir', stars: 5, snapshot: snap({ providerUid: 'nir', customerUid: 'nir', status: 'COMPLETED' }) }).code).toBe('SELF_RATING_BLOCKED');
  });
  it('booking not rateable → BOOKING_NOT_RATEABLE', () => {
    expect(rateJob({ actorUid: 'sarah', stars: 5, snapshot: snap({ status: 'IN_PROGRESS' }) }).code).toBe('BOOKING_NOT_RATEABLE');
  });
  it('out of range → RATE_OUT_OF_RANGE', () => {
    expect(rateJob({ actorUid: 'sarah', stars: 0, snapshot: snap({ status: 'COMPLETED' }) }).code).toBe('RATE_OUT_OF_RANGE');
    expect(rateJob({ actorUid: 'sarah', stars: 6, snapshot: snap({ status: 'COMPLETED' }) }).code).toBe('RATE_OUT_OF_RANGE');
    expect(rateJob({ actorUid: 'sarah', stars: 3.5, snapshot: snap({ status: 'COMPLETED' }) }).code).toBe('RATE_OUT_OF_RANGE');
  });
  it('already rated → ALREADY_RATED (§19 idempotency)', () => {
    expect(rateJob({ actorUid: 'sarah', stars: 5, snapshot: snap({ status: 'COMPLETED', hasCustomerRating: true }) }).code).toBe('ALREADY_RATED');
  });
});
