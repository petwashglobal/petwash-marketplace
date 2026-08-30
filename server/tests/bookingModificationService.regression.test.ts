/**
 * BookingModificationService — CEO NEXT-AUTO §5 (Add Pet) + §6 (Extend).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  proposeAddPet,
  proposeExtend,
  acceptModificationProposal,
  declineModificationProposal,
  cancelModificationProposal,
  getModificationProposal,
  _resetModificationStoreForTests,
} from '../services/marketplace/BookingModificationService';

beforeEach(() => _resetModificationStoreForTests());

describe('propose', () => {
  it('customer proposes ADD_PET → PROPOSED with fresh proposalId and PENDING status', () => {
    const r = proposeAddPet({
      bookingId: 'B-42',
      proposerUid: 'sarah',
      counterpartyUid: 'maya',
      proposedBy: 'CUSTOMER',
      petIds: ['bruno'],
      proposedPriceDeltaCents: 3000,
      reasonCode: 'FORGOT_A_PET',
    });
    expect(r.code).toBe('PROPOSED');
    expect(r.proposalId).toMatch(/^mod_[0-9a-f]{16}$/);
    expect(r.proposal!.status).toBe('PENDING');
    expect(r.proposal!.kind).toBe('ADD_PET');
    expect(r.proposal!.petIds).toEqual(['bruno']);
    expect(r.proposal!.proposedPriceDeltaCents).toBe(3000);
  });

  it('provider proposes EXTEND → PROPOSED', () => {
    const r = proposeExtend({
      bookingId: 'B-1',
      proposerUid: 'maya',
      counterpartyUid: 'sarah',
      proposedBy: 'PROVIDER',
      extraNights: 1,
      extendUntilAt: '2026-09-05T20:00:00Z',
    });
    expect(r.code).toBe('PROPOSED');
    expect(r.proposal!.kind).toBe('EXTEND');
    expect(r.proposal!.extraNights).toBe(1);
  });

  it('proposer === counterparty → ILLEGAL_STATE', () => {
    const r = proposeAddPet({
      bookingId: 'B-1',
      proposerUid: 'nir',
      counterpartyUid: 'nir',
      proposedBy: 'CUSTOMER',
      petIds: ['bruno'],
    });
    expect(r.code).toBe('ILLEGAL_STATE');
  });
});

describe('respond — counterparty accepts / declines; proposer cannot', () => {
  it('counterparty accepts → ACCEPTED_BY_OTHER_PARTY + status=ACCEPTED', () => {
    const p = proposeAddPet({ bookingId: 'B-1', proposerUid: 'sarah', counterpartyUid: 'maya', proposedBy: 'CUSTOMER', petIds: ['bruno'] });
    const r = acceptModificationProposal({ proposalId: p.proposalId!, actorUid: 'maya' });
    expect(r.code).toBe('ACCEPTED_BY_OTHER_PARTY');
    expect(getModificationProposal(p.proposalId!)!.status).toBe('ACCEPTED');
  });

  it('counterparty declines → DECLINED_BY_OTHER_PARTY + status=DECLINED', () => {
    const p = proposeAddPet({ bookingId: 'B-1', proposerUid: 'sarah', counterpartyUid: 'maya', proposedBy: 'CUSTOMER', petIds: ['bruno'] });
    const r = declineModificationProposal({ proposalId: p.proposalId!, actorUid: 'maya' });
    expect(r.code).toBe('DECLINED_BY_OTHER_PARTY');
    expect(getModificationProposal(p.proposalId!)!.status).toBe('DECLINED');
  });

  it('proposer cannot accept their own proposal → PROPOSER_CANNOT_ALSO_ACCEPT (§7 discipline)', () => {
    const p = proposeAddPet({ bookingId: 'B-1', proposerUid: 'sarah', counterpartyUid: 'maya', proposedBy: 'CUSTOMER', petIds: ['bruno'] });
    const r = acceptModificationProposal({ proposalId: p.proposalId!, actorUid: 'sarah' });
    expect(r.code).toBe('PROPOSER_CANNOT_ALSO_ACCEPT');
  });

  it('a random third party → ACTOR_NOT_COUNTERPARTY', () => {
    const p = proposeAddPet({ bookingId: 'B-1', proposerUid: 'sarah', counterpartyUid: 'maya', proposedBy: 'CUSTOMER', petIds: ['bruno'] });
    const r = acceptModificationProposal({ proposalId: p.proposalId!, actorUid: 'nir' });
    expect(r.code).toBe('ACTOR_NOT_COUNTERPARTY');
  });
});

describe('cancel', () => {
  it('proposer cancels PENDING → CANCELLED_BY_PROPOSER', () => {
    const p = proposeAddPet({ bookingId: 'B-1', proposerUid: 'sarah', counterpartyUid: 'maya', proposedBy: 'CUSTOMER', petIds: ['bruno'] });
    const r = cancelModificationProposal({ proposalId: p.proposalId!, actorUid: 'sarah' });
    expect(r.code).toBe('CANCELLED_BY_PROPOSER');
    expect(getModificationProposal(p.proposalId!)!.status).toBe('CANCELLED');
  });

  it('non-proposer cannot cancel → ACTOR_NOT_COUNTERPARTY', () => {
    const p = proposeAddPet({ bookingId: 'B-1', proposerUid: 'sarah', counterpartyUid: 'maya', proposedBy: 'CUSTOMER', petIds: ['bruno'] });
    const r = cancelModificationProposal({ proposalId: p.proposalId!, actorUid: 'maya' });
    expect(r.code).toBe('ACTOR_NOT_COUNTERPARTY');
  });
});

describe('expiry / not found / repeated response', () => {
  it('expired proposal → EXPIRED', () => {
    const p = proposeAddPet({ bookingId: 'B-1', proposerUid: 'sarah', counterpartyUid: 'maya', proposedBy: 'CUSTOMER', petIds: ['bruno'], now: Date.now() - 72 * 60 * 60 * 1000 });
    const r = acceptModificationProposal({ proposalId: p.proposalId!, actorUid: 'maya' });
    expect(r.code).toBe('EXPIRED');
  });

  it('unknown proposalId → NOT_FOUND', () => {
    const r = acceptModificationProposal({ proposalId: 'mod_deadbeef', actorUid: 'maya' });
    expect(r.code).toBe('NOT_FOUND');
  });

  it('cannot respond twice — status !== PENDING → ILLEGAL_STATE', () => {
    const p = proposeAddPet({ bookingId: 'B-1', proposerUid: 'sarah', counterpartyUid: 'maya', proposedBy: 'CUSTOMER', petIds: ['bruno'] });
    acceptModificationProposal({ proposalId: p.proposalId!, actorUid: 'maya' });
    const r = declineModificationProposal({ proposalId: p.proposalId!, actorUid: 'maya' });
    expect(r.code).toBe('ILLEGAL_STATE');
  });
});
