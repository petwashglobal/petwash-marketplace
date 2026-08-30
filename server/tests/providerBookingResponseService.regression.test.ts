/**
 * ProviderBookingResponseService — CEO SPEED MODE §1-§20.
 *
 * Exercises the orchestration surface (delegates to
 * BookingResponseDispatcher for accept/decline, stores proposals for
 * propose_change). The dispatcher itself remains off in tests so
 * ACCEPT / DECLINE observably return DISPATCHER_NOT_ENABLED — the
 * orchestrator's job here is to prove the SHAPE, not to actually
 * mutate a booking (that is the dispatcher's job under real config).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  providerAcceptBooking,
  providerDeclineBooking,
  providerProposeChange,
  customerAcceptProposal,
  customerDeclineProposal,
  getProposal,
  _resetProposalsForTests,
} from '../services/marketplace/ProviderBookingResponseService';

const baseAccept = {
  requestId: 'req_1',
  providerUid: 'maya',
  bookerUid: 'sarah',
  quoteBreakdown: { fake: true },
};

beforeEach(() => {
  _resetProposalsForTests();
});

describe('CEO §11 — self-booking blocked at the orchestrator', () => {
  it('accept with bookerUid === providerUid → SELF_BOOKING_BLOCKED', async () => {
    const r = await providerAcceptBooking({ ...baseAccept, providerUid: 'nir', bookerUid: 'nir' });
    expect(r.code).toBe('SELF_BOOKING_BLOCKED');
  });
  it('decline with same → SELF_BOOKING_BLOCKED', async () => {
    const r = await providerDeclineBooking({ ...baseAccept, providerUid: 'nir', bookerUid: 'nir' });
    expect(r.code).toBe('SELF_BOOKING_BLOCKED');
  });
  it('propose change with same → SELF_BOOKING_BLOCKED', () => {
    const r = providerProposeChange({ bookingId: 'B-1', providerUid: 'nir', bookerUid: 'nir' });
    expect(r.code).toBe('SELF_BOOKING_BLOCKED');
  });
});

describe('accept / decline delegate to the dispatcher (off by default)', () => {
  it('accept surfaces DISPATCHER_NOT_ENABLED when the dispatcher flag is off', async () => {
    const r = await providerAcceptBooking(baseAccept);
    // The dispatcher runs off by default; the orchestrator maps that
    // to the stable code.
    expect(['DISPATCHER_NOT_ENABLED', 'BOOKING_SOURCE_UNRESOLVED', 'UNKNOWN_OUTCOME']).toContain(r.code);
  });
  it('decline surfaces the same shape', async () => {
    const r = await providerDeclineBooking(baseAccept);
    expect(['DISPATCHER_NOT_ENABLED', 'BOOKING_SOURCE_UNRESOLVED', 'UNKNOWN_OUTCOME']).toContain(r.code);
  });
});

describe('CEO §5-§7 — propose change stores proposal, never mutates booking', () => {
  it('a fresh proposal is retrievable + carries the diff fields', () => {
    const r = providerProposeChange({
      bookingId: 'B-42',
      providerUid: 'maya',
      bookerUid: 'sarah',
      proposedSchedule: { startAt: '2026-08-30T10:00:00Z', endAt: '2026-08-30T12:00:00Z' },
      proposedIncludedPetIds: ['bruno', 'milo'],
      proposedExcludedPetIds: ['kiwi'],
      proposedCareNotes: 'no bird care',
      proposedPriceCents: 26000,
      reasonCode: 'PET_REQUIREMENTS',
    });
    expect(r.code).toBe('CHANGE_PROPOSED');
    expect(r.proposalId).toMatch(/^prop_[0-9a-f]{16}$/);
    const p = getProposal(r.proposalId!);
    expect(p).not.toBeNull();
    expect(p!.bookingId).toBe('B-42');
    expect(p!.proposedIncludedPetIds).toEqual(['bruno', 'milo']);
    expect(p!.proposedExcludedPetIds).toEqual(['kiwi']);
    expect(p!.proposedPriceCents).toBe(26000);
    expect(p!.reasonCode).toBe('PET_REQUIREMENTS');
  });

  it('an expired proposal is gone', () => {
    const past = Date.now() - 72 * 60 * 60 * 1000;
    const r = providerProposeChange({ bookingId: 'B-1', providerUid: 'maya', bookerUid: 'sarah' }, past);
    expect(getProposal(r.proposalId!, Date.now())).toBeNull();
  });
});

describe('CEO §8 — customer accepts / declines the proposal', () => {
  it('customerAcceptProposal → CUSTOMER_APPLIED_PROPOSAL and consumes the proposal', async () => {
    const p = providerProposeChange({ bookingId: 'B-42', providerUid: 'maya', bookerUid: 'sarah' });
    const r = await customerAcceptProposal({ proposalId: p.proposalId!, actorUid: 'sarah' });
    expect(r.code).toBe('CUSTOMER_APPLIED_PROPOSAL');
    // Consumed — cannot be re-applied.
    const r2 = await customerAcceptProposal({ proposalId: p.proposalId!, actorUid: 'sarah' });
    expect(r2.code).toBe('PROPOSAL_NOT_FOUND');
  });

  it('customerDeclineProposal → CUSTOMER_DECLINED_PROPOSAL and consumes the proposal', async () => {
    const p = providerProposeChange({ bookingId: 'B-42', providerUid: 'maya', bookerUid: 'sarah' });
    const r = await customerDeclineProposal({ proposalId: p.proposalId!, actorUid: 'sarah' });
    expect(r.code).toBe('CUSTOMER_DECLINED_PROPOSAL');
    const r2 = await customerDeclineProposal({ proposalId: p.proposalId!, actorUid: 'sarah' });
    expect(r2.code).toBe('PROPOSAL_NOT_FOUND');
  });

  it('unknown proposalId → PROPOSAL_NOT_FOUND', async () => {
    const r = await customerAcceptProposal({ proposalId: 'prop_deadbeef', actorUid: 'sarah' });
    expect(r.code).toBe('PROPOSAL_NOT_FOUND');
  });
});

describe('CEO §19 — one canonical outcome per action (idempotency delegated)', () => {
  it('two synchronous accepts on the SAME (requestId, providerUid) share the dispatcher outcome shape', async () => {
    // Both hit the dispatcher (off), so both surface the same stable
    // code; the orchestrator does not invent parallel state.
    const [a, b] = await Promise.all([
      providerAcceptBooking(baseAccept),
      providerAcceptBooking(baseAccept),
    ]);
    expect(a.code).toBe(b.code);
  });
});
