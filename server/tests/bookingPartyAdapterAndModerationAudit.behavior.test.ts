/**
 * BookingPartyAdapter + moderation audit helpers — behavior pins
 * (business doctrine §5.1, §7, §18.2 / integrity doctrine §6.12, §7.1).
 */
import { describe, it, expect } from 'vitest';
import {
  toBookingParty,
  isEmptyParty,
} from '../services/marketplace/BookingPartyAdapter';
import {
  shouldRetainBody,
  integritySignalFor,
} from '../../shared/marketplace/moderationAudit';

// A mock species lookup keyed off deterministic pet ids for tests.
const lookup = (id: string) => {
  if (id === '1') return 'dog' as const;
  if (id === '2') return 'cat' as const;
  if (id === '3') return 'bird' as const;
  return undefined;
};

describe('BookingPartyAdapter — legacy scalar petId', () => {
  it('scalar petId=1 projects to 1-pet party (dog)', () => {
    const party = toBookingParty({ petId: 1 }, lookup);
    expect(party.pets).toHaveLength(1);
    expect(party.pets[0]).toEqual({ petId: '1', species: 'dog' });
  });

  it('scalar petId=null projects to empty party', () => {
    const party = toBookingParty({ petId: null }, lookup);
    expect(party.pets).toHaveLength(0);
    expect(isEmptyParty(party)).toBe(true);
  });

  it('scalar petId="" projects to empty party (falsy sentinel)', () => {
    const party = toBookingParty({ petId: '' }, lookup);
    expect(party.pets).toHaveLength(0);
  });
});

describe('BookingPartyAdapter — legacy petIds array', () => {
  it('petIds=[1,2,3] projects to a 3-pet party (dog, cat, bird)', () => {
    const party = toBookingParty({ petIds: [1, 2, 3] }, lookup);
    expect(party.pets).toEqual([
      { petId: '1', species: 'dog' },
      { petId: '2', species: 'cat' },
      { petId: '3', species: 'bird' },
    ]);
  });

  it('petIds with mixed types normalise to string ids', () => {
    const party = toBookingParty({ petIds: [1, '2'] }, lookup);
    expect(party.pets.map((p) => p.petId)).toEqual(['1', '2']);
  });

  it('unknown pet id falls back to species=other — never silently dropped', () => {
    // Doctrine §5.3: never silent-drop. Surfacing "other" lets the caller
    // decide (reject / ask for species / etc.).
    const party = toBookingParty({ petIds: [1, 99] }, lookup);
    expect(party.pets).toHaveLength(2);
    expect(party.pets.find((p) => p.petId === '99')!.species).toBe('other');
  });
});

describe('BookingPartyAdapter — enriched pets projection', () => {
  it('preloaded species wins over the lookup', () => {
    const party = toBookingParty(
      { pets: [{ petId: 1, species: 'rabbit' }] }, // lookup would say 'dog'
      lookup,
    );
    expect(party.pets[0]).toEqual({ petId: '1', species: 'rabbit' });
  });

  it('preloaded pets without species use the lookup', () => {
    const party = toBookingParty({ pets: [{ petId: 2 }] }, lookup);
    expect(party.pets[0]).toEqual({ petId: '2', species: 'cat' });
  });
});

describe('moderation audit retention (integrity §6.12)', () => {
  it('BLOCK_AND_REVIEW retains the body for evidence', () => {
    expect(shouldRetainBody('BLOCK_AND_REVIEW')).toBe(true);
  });

  it('SAFETY_ESCALATION retains the body for evidence', () => {
    expect(shouldRetainBody('SAFETY_ESCALATION')).toBe(true);
  });

  it('BLOCK does NOT retain the body (privacy default)', () => {
    // A blocked off-platform message is a violation, not a safety event —
    // storing every blocked draft long-term is a privacy defect.
    expect(shouldRetainBody('BLOCK')).toBe(false);
  });

  it('WARN_BEFORE_SEND does not retain the body', () => {
    expect(shouldRetainBody('WARN_BEFORE_SEND')).toBe(false);
  });

  it('ALLOW does not retain the body', () => {
    expect(shouldRetainBody('ALLOW')).toBe(false);
  });
});

describe('integrity-signal mapping (integrity §7.1)', () => {
  it('OFF_PLATFORM_BOOKING → DIRECT_SOLICITATION', () => {
    expect(integritySignalFor('OFF_PLATFORM_BOOKING')).toBe('DIRECT_SOLICITATION');
  });

  it('OFF_PLATFORM_PAYMENT → PAYMENT_DETAIL_ATTEMPT', () => {
    expect(integritySignalFor('OFF_PLATFORM_PAYMENT')).toBe('PAYMENT_DETAIL_ATTEMPT');
  });

  it('CONTACT_EXCHANGE → CONTACT_EXCHANGE_ATTEMPT', () => {
    expect(integritySignalFor('CONTACT_EXCHANGE')).toBe('CONTACT_EXCHANGE_ATTEMPT');
  });

  it('EXTERNAL_MESSAGING_APP → OFF_PLATFORM_MESSAGE_ATTEMPT', () => {
    expect(integritySignalFor('EXTERNAL_MESSAGING_APP')).toBe('OFF_PLATFORM_MESSAGE_ATTEMPT');
  });

  it('safety categories (THREAT / HATE / SEXUAL) yield NO integrity signal', () => {
    // Those are safety events, tracked separately — not marketplace-
    // integrity patterns.
    expect(integritySignalFor('THREAT')).toBeNull();
    expect(integritySignalFor('SEXUAL_SOLICITATION')).toBeNull();
    expect(integritySignalFor('HATE_OR_SLUR')).toBeNull();
  });

  it('undefined category yields no integrity signal', () => {
    expect(integritySignalFor(undefined)).toBeNull();
  });
});
