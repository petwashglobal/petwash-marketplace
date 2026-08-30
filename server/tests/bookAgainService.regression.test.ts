/**
 * BookAgainService — CEO NEXT-AUTO §4.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateBookAgain,
  type BookAgainInput,
  type PriorBookingSnapshot,
} from '../services/marketplace/BookAgainService';

function prior(over: Partial<PriorBookingSnapshot> = {}): PriorBookingSnapshot {
  return {
    bookingId: 'B-1',
    customerUid: 'sarah',
    providerUid: 'maya',
    status: 'COMPLETED',
    serviceType: 'PET_SITTING',
    petIds: ['bruno', 'milo'],
    originalScheduleStart: '2026-08-01T10:00:00Z',
    originalScheduleEnd: '2026-08-01T12:00:00Z',
    location: { kind: 'PROVIDER_HOME' },
    originalCareNotes: 'gentle handling',
    originalPriceCents: 22000,
    ...over,
  };
}

function inp(over: Partial<BookAgainInput> = {}): BookAgainInput {
  return {
    actorUid: 'sarah',
    prior: prior(),
    providerStillActive: true,
    now: '2026-08-30T00:00:00Z',
    ...over,
  };
}

describe('eligibility gates', () => {
  it('actor must be the original customer', () => {
    expect(evaluateBookAgain(inp({ actorUid: 'nir' })).code).toBe('ACTOR_NOT_CUSTOMER');
  });

  it('self-booking blocked (customerUid === providerUid)', () => {
    expect(evaluateBookAgain(inp({ prior: prior({ customerUid: 'nir', providerUid: 'nir' }), actorUid: 'nir' })).code).toBe('SELF_BOOKING_BLOCKED');
  });

  it('prior booking must be COMPLETED', () => {
    expect(evaluateBookAgain(inp({ prior: prior({ status: 'CANCELLED' }) })).code).toBe('NOT_ELIGIBLE');
    expect(evaluateBookAgain(inp({ prior: prior({ status: 'IN_PROGRESS' }) })).code).toBe('NOT_ELIGIBLE');
  });

  it('provider must still be active', () => {
    expect(evaluateBookAgain(inp({ providerStillActive: false })).code).toBe('PROVIDER_NO_LONGER_AVAILABLE');
  });
});

describe('prefill shape', () => {
  it('carries provider, service, pets, location, care notes, price hint, origin id', () => {
    const r = evaluateBookAgain(inp());
    expect(r.code).toBe('PREFILL_READY');
    expect(r.prefill!.providerUid).toBe('maya');
    expect(r.prefill!.serviceType).toBe('PET_SITTING');
    expect(r.prefill!.petIds).toEqual(['bruno', 'milo']);
    expect(r.prefill!.location).toEqual({ kind: 'PROVIDER_HOME' });
    expect(r.prefill!.careNotes).toBe('gentle handling');
    expect(r.prefill!.hintPriceCents).toBe(22000);
    expect(r.prefill!.originBookingId).toBe('B-1');
  });

  it('suggested time is +N days from the original (default 7)', () => {
    const r = evaluateBookAgain(inp({
      prior: prior({ originalScheduleStart: '2026-08-25T10:00:00Z', originalScheduleEnd: '2026-08-25T12:00:00Z' }),
      now: '2026-08-25T00:00:00Z',
    }));
    expect(r.prefill!.suggestedStart).toBe('2026-09-01T10:00:00.000Z');
    expect(r.prefill!.suggestedEnd).toBe('2026-09-01T12:00:00.000Z');
  });

  it('advances by full weeks if +N days already lands in the past', () => {
    const r = evaluateBookAgain(inp({
      prior: prior({ originalScheduleStart: '2026-01-01T10:00:00Z', originalScheduleEnd: '2026-01-01T12:00:00Z' }),
      now: '2026-08-30T00:00:00Z',
    }));
    // Should advance in 7-day increments until suggestedStart > now.
    const suggested = new Date(r.prefill!.suggestedStart).getTime();
    const now = new Date('2026-08-30T00:00:00Z').getTime();
    expect(suggested).toBeGreaterThan(now);
  });
});
