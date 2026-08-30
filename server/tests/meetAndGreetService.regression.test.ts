/**
 * MeetAndGreetService — CEO NEXT-AUTO §3.
 *
 * Pure evaluator behavior pins for the M&G lifecycle. Storage adapter
 * is a follow-up; these pins exercise the state machine directly.
 */
import { describe, it, expect } from 'vitest';
import {
  proposeMeetGreet,
  confirmMeetGreet,
  acknowledgeMeetGreet,
  cancelMeetGreet,
  type ProposeInput,
} from '../services/marketplace/MeetAndGreetService';
import { bothPartiesAcknowledged } from '@shared/marketplace/meetAndGreet';

const base: ProposeInput = {
  bookingId: 'B-1',
  customerUid: 'sarah',
  providerUid: 'maya',
  serviceType: 'PET_SITTING' as any,
  petIds: ['bruno', 'milo'],
  scheduledAt: '2026-09-01T15:00:00Z',
  location: { kind: 'PROVIDER_HOME' },
  now: '2026-08-30T00:00:00Z',
};

describe('propose', () => {
  it('happy path → PROPOSED with a fresh meetId + PROPOSED status', () => {
    const r = proposeMeetGreet(base);
    expect(r.code).toBe('PROPOSED');
    expect(r.mg!.status).toBe('PROPOSED');
    expect(r.mg!.meetId).toMatch(/^mg_[0-9a-f]{12}$/);
    expect(r.mg!.customerUid).toBe('sarah');
    expect(r.mg!.providerUid).toBe('maya');
    expect(r.mg!.petIds).toEqual(['bruno', 'milo']);
  });

  it('self-M&G blocked — customerUid === providerUid → SELF_MEET_GREET_BLOCKED', () => {
    const r = proposeMeetGreet({ ...base, customerUid: 'nir', providerUid: 'nir' });
    expect(r.code).toBe('SELF_MEET_GREET_BLOCKED');
  });
});

describe('confirm', () => {
  it('participant confirms PROPOSED → CONFIRMED', () => {
    const p = proposeMeetGreet(base).mg!;
    const r = confirmMeetGreet({ mg: p, actorUid: 'sarah' });
    expect(r.code).toBe('CONFIRMED');
    expect(r.mg!.status).toBe('CONFIRMED');
  });

  it('non-participant refused → ACTOR_NOT_PARTICIPANT', () => {
    const p = proposeMeetGreet(base).mg!;
    const r = confirmMeetGreet({ mg: p, actorUid: 'unknown' });
    expect(r.code).toBe('ACTOR_NOT_PARTICIPANT');
  });

  it('confirming a CANCELLED M&G → ILLEGAL_STATUS_TRANSITION', () => {
    const p = proposeMeetGreet(base).mg!;
    const cancelled = cancelMeetGreet({ mg: p, actorUid: 'sarah' }).mg!;
    const r = confirmMeetGreet({ mg: cancelled, actorUid: 'sarah' });
    expect(r.code).toBe('ILLEGAL_STATUS_TRANSITION');
  });
});

describe('acknowledge — per-party evidence, not a boolean (§14)', () => {
  it('one party acknowledgement → ACKNOWLEDGED', () => {
    const p = proposeMeetGreet(base).mg!;
    const c = confirmMeetGreet({ mg: p, actorUid: 'sarah' }).mg!;
    const r = acknowledgeMeetGreet({ mg: c, actorUid: 'sarah', wordingVersion: 'v1' });
    expect(r.code).toBe('ACKNOWLEDGED');
    expect(bothPartiesAcknowledged(r.mg!)).toBe(false);
  });

  it('BOTH parties acknowledged → BOTH_ACKNOWLEDGED (each ack lives on its own actorUid)', () => {
    const p = proposeMeetGreet(base).mg!;
    const c = confirmMeetGreet({ mg: p, actorUid: 'sarah' }).mg!;
    const r1 = acknowledgeMeetGreet({ mg: c, actorUid: 'sarah', wordingVersion: 'v1' }).mg!;
    const r2 = acknowledgeMeetGreet({ mg: r1, actorUid: 'maya', wordingVersion: 'v1' });
    expect(r2.code).toBe('BOTH_ACKNOWLEDGED');
    expect(bothPartiesAcknowledged(r2.mg!)).toBe(true);
  });

  it('same party cannot acknowledge twice — ALREADY_ACKNOWLEDGED', () => {
    const p = proposeMeetGreet(base).mg!;
    const c = confirmMeetGreet({ mg: p, actorUid: 'sarah' }).mg!;
    const a1 = acknowledgeMeetGreet({ mg: c, actorUid: 'sarah', wordingVersion: 'v1' }).mg!;
    const a2 = acknowledgeMeetGreet({ mg: a1, actorUid: 'sarah', wordingVersion: 'v1' });
    expect(a2.code).toBe('ALREADY_ACKNOWLEDGED');
  });

  it('non-participant cannot acknowledge → ACTOR_NOT_PARTICIPANT', () => {
    const p = proposeMeetGreet(base).mg!;
    const r = acknowledgeMeetGreet({ mg: p, actorUid: 'unknown', wordingVersion: 'v1' });
    expect(r.code).toBe('ACTOR_NOT_PARTICIPANT');
  });
});

describe('cancel', () => {
  it('participant cancels PROPOSED → CANCELLED', () => {
    const p = proposeMeetGreet(base).mg!;
    const r = cancelMeetGreet({ mg: p, actorUid: 'sarah' });
    expect(r.code).toBe('CANCELLED');
    expect(r.mg!.status).toBe('CANCELLED');
  });

  it('cancelling a COMPLETED M&G → ILLEGAL_STATUS_TRANSITION', () => {
    const p = proposeMeetGreet(base).mg!;
    // Simulate completed by hand — the transition table forbids it.
    const completed = { ...p, status: 'COMPLETED' as const };
    const r = cancelMeetGreet({ mg: completed, actorUid: 'sarah' });
    expect(r.code).toBe('ILLEGAL_STATUS_TRANSITION');
  });
});
