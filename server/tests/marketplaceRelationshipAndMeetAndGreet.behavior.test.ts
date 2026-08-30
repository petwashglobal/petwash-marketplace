/**
 * MarketplaceRelationship + MeetAndGreet — behavior pins
 * (integrity doctrine §4, §7.3, §9.3, §36, §37).
 */
import { describe, it, expect } from 'vitest';
import {
  computeRelationshipStatus,
  canFastRebook,
  type MarketplaceRelationship,
} from '../../shared/marketplace/relationship';
import {
  canTransition,
  bothPartiesAcknowledged,
  acknowledgementEvidence,
  acknowledgementRequiredForNewCommercial,
  fastRebookAllowed,
  type MeetAndGreet,
} from '../../shared/marketplace/meetAndGreet';

// ---------- MarketplaceRelationship ----------

describe('MarketplaceRelationship — status transitions', () => {
  it('ACTIVE when there is a live booking, regardless of last-activity age', () => {
    expect(computeRelationshipStatus(1, 5000)).toBe('ACTIVE');
  });

  it('ACTIVE within 60 days of last activity even with no live booking', () => {
    expect(computeRelationshipStatus(0, 30)).toBe('ACTIVE');
  });

  it('DORMANT between 60 days and 1 year without activity', () => {
    expect(computeRelationshipStatus(0, 90)).toBe('DORMANT');
    expect(computeRelationshipStatus(0, 300)).toBe('DORMANT');
  });

  it('CLOSED past 365 days without activity', () => {
    expect(computeRelationshipStatus(0, 400)).toBe('CLOSED');
  });
});

describe('MarketplaceRelationship — fast-rebook guard (integrity §9)', () => {
  const base: MarketplaceRelationship = {
    relationshipId: 'r1',
    customerUid: 'sarah',
    providerUid: 'maya',
    introducedAt: '2026-08-01T00:00:00Z',
    source: 'SEARCH',
    status: 'ACTIVE',
  };

  it('ACTIVE → fast rebook allowed', () => {
    expect(canFastRebook({ ...base, status: 'ACTIVE' })).toBe(true);
  });

  it('DORMANT → fast rebook still allowed', () => {
    expect(canFastRebook({ ...base, status: 'DORMANT' })).toBe(true);
  });

  it('CLOSED → fast rebook denied; customer re-enters the funnel', () => {
    expect(canFastRebook({ ...base, status: 'CLOSED' })).toBe(false);
  });
});

// ---------- MeetAndGreet ----------

describe('MeetAndGreet — state machine (integrity §4)', () => {
  it('PROPOSED → CONFIRMED allowed', () => {
    expect(canTransition('PROPOSED', 'CONFIRMED')).toBe(true);
  });

  it('PROPOSED → CANCELLED allowed', () => {
    expect(canTransition('PROPOSED', 'CANCELLED')).toBe(true);
  });

  it('CONFIRMED → COMPLETED allowed', () => {
    expect(canTransition('CONFIRMED', 'COMPLETED')).toBe(true);
  });

  it('CONFIRMED → CANCELLED allowed', () => {
    expect(canTransition('CONFIRMED', 'CANCELLED')).toBe(true);
  });

  it('COMPLETED is terminal — nothing after it', () => {
    expect(canTransition('COMPLETED', 'CONFIRMED')).toBe(false);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('CANCELLED is terminal — nothing after it', () => {
    expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
    expect(canTransition('CANCELLED', 'COMPLETED')).toBe(false);
  });

  it('PROPOSED cannot skip straight to COMPLETED (must go through CONFIRMED)', () => {
    expect(canTransition('PROPOSED', 'COMPLETED')).toBe(false);
  });
});

describe('MeetAndGreet — dual-acknowledgement gate (integrity §6)', () => {
  const meet = (acks: MeetAndGreet['acknowledgements']): MeetAndGreet => ({
    meetId: 'mg1',
    customerUid: 'sarah',
    providerUid: 'maya',
    serviceType: 'PET_SITTING',
    petIds: ['bruno'],
    scheduledAt: '2026-09-05T10:00:00Z',
    location: { kind: 'CUSTOMER_HOME' },
    status: 'PROPOSED',
    acknowledgements: acks,
    createdAt: '2026-08-29T00:00:00Z',
    updatedAt: '2026-08-29T00:00:00Z',
  });

  it('no acknowledgements → both parties NOT acknowledged', () => {
    expect(bothPartiesAcknowledged(meet([]))).toBe(false);
  });

  it('only customer acknowledged → still NOT both', () => {
    expect(
      bothPartiesAcknowledged(
        meet([{ actorUid: 'sarah', acknowledgedAt: 'x', wordingVersion: 'mpe-2026-08-29' }]),
      ),
    ).toBe(false);
  });

  it('only provider acknowledged → still NOT both', () => {
    expect(
      bothPartiesAcknowledged(
        meet([{ actorUid: 'maya', acknowledgedAt: 'x', wordingVersion: 'mpe-2026-08-29' }]),
      ),
    ).toBe(false);
  });

  it('both acknowledged → gate opens', () => {
    expect(
      bothPartiesAcknowledged(
        meet([
          { actorUid: 'sarah', acknowledgedAt: 'x', wordingVersion: 'mpe-2026-08-29' },
          { actorUid: 'maya', acknowledgedAt: 'y', wordingVersion: 'mpe-2026-08-29' },
        ]),
      ),
    ).toBe(true);
  });

  it('duplicate acks from the same UID still count as one', () => {
    expect(
      bothPartiesAcknowledged(
        meet([
          { actorUid: 'sarah', acknowledgedAt: 'x', wordingVersion: 'mpe-2026-08-29' },
          { actorUid: 'sarah', acknowledgedAt: 'x2', wordingVersion: 'mpe-2026-08-29' },
        ]),
      ),
    ).toBe(false);
  });
});

describe('MeetAndGreet — per-party acknowledgement evidence (CEO §14)', () => {
  const meet = (acks: MeetAndGreet['acknowledgements']): MeetAndGreet => ({
    meetId: 'mg1',
    customerUid: 'sarah',
    providerUid: 'maya',
    serviceType: 'PET_SITTING',
    petIds: ['bruno'],
    scheduledAt: '2026-09-05T10:00:00Z',
    location: { kind: 'CUSTOMER_HOME' },
    status: 'PROPOSED',
    acknowledgements: acks,
    createdAt: '',
    updatedAt: '',
  });

  it('acknowledgementEvidence returns per-party records — never a boolean', () => {
    const e = acknowledgementEvidence(
      meet([
        { actorUid: 'sarah', acknowledgedAt: 'a', wordingVersion: 'v1' },
      ]),
    );
    expect(e.customer?.actorUid).toBe('sarah');
    expect(e.provider).toBeNull();
  });

  it('acknowledgementRequiredForNewCommercial mirrors the gate (§15 — gates COMMERCIAL, not safety)', () => {
    // Missing acknowledgements → commercial actions gated.
    expect(acknowledgementRequiredForNewCommercial(meet([]))).toBe(true);
    // Both acknowledged → gate opens.
    expect(
      acknowledgementRequiredForNewCommercial(
        meet([
          { actorUid: 'sarah', acknowledgedAt: 'a', wordingVersion: 'v1' },
          { actorUid: 'maya', acknowledgedAt: 'b', wordingVersion: 'v1' },
        ]),
      ),
    ).toBe(false);
  });
});

describe('MeetAndGreet — fast rebook after COMPLETED (integrity §35)', () => {
  const meet = (status: MeetAndGreet['status']): MeetAndGreet => ({
    meetId: 'mg1',
    customerUid: 'sarah',
    providerUid: 'maya',
    serviceType: 'PET_SITTING',
    petIds: ['bruno'],
    scheduledAt: '2026-09-05T10:00:00Z',
    location: { kind: 'CUSTOMER_HOME' },
    status,
    acknowledgements: [],
    createdAt: '',
    updatedAt: '',
  });

  it('COMPLETED → fast rebook allowed', () => {
    expect(fastRebookAllowed(meet('COMPLETED'))).toBe(true);
  });

  it('CONFIRMED-but-not-yet-completed → no fast rebook (event hasn\'t happened)', () => {
    expect(fastRebookAllowed(meet('CONFIRMED'))).toBe(false);
  });

  it('CANCELLED → no fast rebook', () => {
    expect(fastRebookAllowed(meet('CANCELLED'))).toBe(false);
  });
});
