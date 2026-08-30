/**
 * StartJobPreflightService — Program 24.
 */
import { describe, it, expect } from 'vitest';
import {
  preflightStartJob,
  type PreflightInput,
} from '../services/marketplace/StartJobPreflightService';

const base = (over: Partial<PreflightInput> = {}): PreflightInput => ({
  actorUid: 'maya',
  bookingProviderUid: 'maya',
  bookingStatus: 'CONFIRMED',
  scheduledStartAt: '2026-08-30T09:00:00Z',
  now: new Date('2026-08-30T08:55:00Z'),   // 5 min before
  paymentClear: true,
  requiresPickupHandoff: true,
  pickupHandoffVerified: true,
  requiresCareSnapshot: true,
  careSnapshotReady: true,
  ...over,
});

describe('StartJobPreflightService', () => {
  it('happy path → START_ALLOWED', () => {
    expect(preflightStartJob(base()).code).toBe('START_ALLOWED');
  });

  it('actor not provider → ACTOR_NOT_PROVIDER', () => {
    const out = preflightStartJob(base({ actorUid: 'sarah' }));
    expect(out.code).toBe('START_BLOCKED');
    if (out.code !== 'START_BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('ACTOR_NOT_PROVIDER');
  });

  it('booking already CANCELLED → BOOKING_NOT_STARTABLE', () => {
    const out = preflightStartJob(base({ bookingStatus: 'CANCELLED' }));
    expect(out.code).toBe('START_BLOCKED');
    if (out.code !== 'START_BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('BOOKING_NOT_STARTABLE');
  });

  it('60 minutes before scheduled → START_TOO_EARLY (outside default 15-min window)', () => {
    const out = preflightStartJob(base({ now: new Date('2026-08-30T08:00:00Z') }));
    expect(out.code).toBe('START_BLOCKED');
    if (out.code !== 'START_BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('START_TOO_EARLY');
  });

  it('90 minutes after scheduled → START_TOO_LATE', () => {
    const out = preflightStartJob(base({ now: new Date('2026-08-30T10:30:00Z') }));
    expect(out.code).toBe('START_BLOCKED');
    if (out.code !== 'START_BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('START_TOO_LATE');
  });

  it('payment not clear → PAYMENT_NOT_CLEAR (§12 — never start on uncertain payment)', () => {
    const out = preflightStartJob(base({ paymentClear: false }));
    expect(out.code).toBe('START_BLOCKED');
    if (out.code !== 'START_BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('PAYMENT_NOT_CLEAR');
  });

  it('pickup handoff required but not verified → PICKUP_HANDOFF_MISSING', () => {
    const out = preflightStartJob(base({ requiresPickupHandoff: true, pickupHandoffVerified: false }));
    expect(out.code).toBe('START_BLOCKED');
    if (out.code !== 'START_BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('PICKUP_HANDOFF_MISSING');
  });

  it('care snapshot required but not ready → CARE_SNAPSHOT_MISSING', () => {
    const out = preflightStartJob(base({ requiresCareSnapshot: true, careSnapshotReady: false }));
    expect(out.code).toBe('START_BLOCKED');
    if (out.code !== 'START_BLOCKED') throw new Error();
    expect(out.reasonCode).toBe('CARE_SNAPSHOT_MISSING');
  });

  it('READY_TO_START also allows start (not only CONFIRMED)', () => {
    expect(preflightStartJob(base({ bookingStatus: 'READY_TO_START' })).code).toBe('START_ALLOWED');
  });
});
