/**
 * MaskedPhoneCallService — CEO NEXT-AUTO §12.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateMaskedCall,
  type MaskedCallInput,
} from '../services/marketplace/MaskedPhoneCallService';

function inp(over: Partial<MaskedCallInput> = {}): MaskedCallInput {
  return {
    bookingId: 'B-1',
    actorUid: 'sarah',
    customerUid: 'sarah',
    providerUid: 'maya',
    bookingStatus: 'CONFIRMED',
    ...over,
  };
}

describe('actor guard — only parties on the booking may open the relay', () => {
  it('a third party → ACTOR_NOT_PARTY', () => {
    expect(evaluateMaskedCall(inp({ actorUid: 'nir' })).code).toBe('ACTOR_NOT_PARTY');
  });
  it('customer → CALL_AUTHORIZED on an active booking', () => {
    const r = evaluateMaskedCall(inp({ actorUid: 'sarah' }));
    expect(r.code).toBe('CALL_AUTHORIZED');
    expect(r.maskedRelayCode).toBe('BOOKING_ACTIVE_MASK');
  });
  it('provider → CALL_AUTHORIZED on an active booking', () => {
    const r = evaluateMaskedCall(inp({ actorUid: 'maya' }));
    expect(r.code).toBe('CALL_AUTHORIZED');
    expect(r.maskedRelayCode).toBe('BOOKING_ACTIVE_MASK');
  });
});

describe('active status set', () => {
  it.each(['CONFIRMED', 'READY_TO_START', 'IN_PROGRESS', 'ACCEPTED', 'QUOTED'])(
    'status %s → CALL_AUTHORIZED',
    (status) => {
      expect(evaluateMaskedCall(inp({ bookingStatus: status })).code).toBe('CALL_AUTHORIZED');
    },
  );

  it.each(['REQUESTED', 'CANCELLED', 'DECLINED', 'EXPIRED'])(
    'inactive status %s → BOOKING_NOT_ACTIVE',
    (status) => {
      expect(evaluateMaskedCall(inp({ bookingStatus: status })).code).toBe('BOOKING_NOT_ACTIVE');
    },
  );
});

describe('post-booking window driven by BusinessDecisionRegistry', () => {
  it('POST_BOOKING_MASKED_PHONE_EXPIRY undecided → POLICY_NOT_CONFIGURED', () => {
    // The registry currently has the key as UNDECIDED — the service
    // refuses rather than inventing a duration.
    const r = evaluateMaskedCall(inp({ bookingStatus: 'COMPLETED', bookingCompletedAt: '2026-08-01T00:00:00Z' }));
    expect(r.code).toBe('POLICY_NOT_CONFIGURED');
    expect(r.policyStatus).toBe('POLICY_NOT_CONFIGURED');
  });
});
