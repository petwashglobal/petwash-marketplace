/**
 * BookingModificationService — CEO NEXT-AUTO §5 (Add Pet) + §6 (Extend).
 *
 * Two symmetric two-sided modification patterns:
 *
 *   ADD PET:
 *     customer requests → provider accepts/declines.
 *     provider proposes → customer accepts/declines.
 *   EXTEND BOOKING:
 *     customer requests → provider accepts/declines.
 *     provider proposes → customer accepts/declines.
 *
 * Neither party can silently mutate the booking (§7 discipline).
 * Every modification lives as a distinct proposal record; the other
 * side accepts (mutates booking through domain authority) or declines
 * (proposal closed, no change).
 *
 * Storage: bounded per-process Map (durable schema is CEO-gated
 * follow-up).
 */
import crypto from 'crypto';

export type ModificationKind = 'ADD_PET' | 'EXTEND';
export type ModificationSource = 'CUSTOMER' | 'PROVIDER';

export type ModificationOutcomeCode =
  | 'PROPOSED'
  | 'CANCELLED_BY_PROPOSER'
  | 'ACCEPTED_BY_OTHER_PARTY'
  | 'DECLINED_BY_OTHER_PARTY'
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'ACTOR_NOT_COUNTERPARTY'
  | 'PROPOSER_CANNOT_ALSO_ACCEPT'
  | 'ILLEGAL_STATE';

export interface BookingModificationProposal {
  proposalId: string;
  bookingId: string;
  kind: ModificationKind;
  proposedBy: ModificationSource;
  proposerUid: string;
  counterpartyUid: string;
  createdAt: number;
  expiresAt: number;
  // ADD_PET fields
  petIds?: string[];
  // EXTEND fields
  extendUntilAt?: string;         // ISO
  extraNights?: number;
  // Shared
  proposedPriceDeltaCents?: number;
  proposedCareNotes?: string;
  reasonCode?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';
}

const TTL_MS = 48 * 60 * 60 * 1000;
const MAX = 20_000;
const store = new Map<string, BookingModificationProposal>();

function sweep(now: number): void {
  if (store.size <= MAX) return;
  store.forEach((v, k) => { if (v.expiresAt < now) store.delete(k); });
  if (store.size <= MAX) return;
  const it = store.keys();
  let dropped = 0;
  while (store.size > MAX && dropped < 512) {
    const n = it.next(); if (n.done) break;
    store.delete(n.value); dropped += 1;
  }
}

export function _resetModificationStoreForTests(): void { store.clear(); }

export interface ProposeAddPetInput {
  bookingId: string;
  proposerUid: string;
  counterpartyUid: string;
  proposedBy: ModificationSource;
  petIds: string[];
  proposedPriceDeltaCents?: number;
  proposedCareNotes?: string;
  reasonCode?: string;
  now?: number;
}

export interface ProposeExtendInput {
  bookingId: string;
  proposerUid: string;
  counterpartyUid: string;
  proposedBy: ModificationSource;
  extendUntilAt?: string;
  extraNights?: number;
  proposedPriceDeltaCents?: number;
  reasonCode?: string;
  now?: number;
}

export interface RespondInput {
  proposalId: string;
  actorUid: string;
  now?: number;
}

export interface ModificationOutcome {
  code: ModificationOutcomeCode;
  proposalId?: string;
  proposal?: BookingModificationProposal;
}

function nowMs(now?: number): number { return now ?? Date.now(); }

function newProposal(base: Omit<BookingModificationProposal, 'proposalId' | 'createdAt' | 'expiresAt' | 'status'>, now: number): BookingModificationProposal {
  return {
    ...base,
    proposalId: `mod_${crypto.randomBytes(8).toString('hex')}`,
    createdAt: now,
    expiresAt: now + TTL_MS,
    status: 'PENDING',
  };
}

export function proposeAddPet(input: ProposeAddPetInput): ModificationOutcome {
  if (input.proposerUid === input.counterpartyUid) return { code: 'ILLEGAL_STATE' };
  const now = nowMs(input.now);
  const p = newProposal({
    bookingId: input.bookingId,
    kind: 'ADD_PET',
    proposedBy: input.proposedBy,
    proposerUid: input.proposerUid,
    counterpartyUid: input.counterpartyUid,
    petIds: input.petIds,
    proposedPriceDeltaCents: input.proposedPriceDeltaCents,
    proposedCareNotes: input.proposedCareNotes,
    reasonCode: input.reasonCode,
  }, now);
  store.set(p.proposalId, p);
  sweep(now);
  return { code: 'PROPOSED', proposalId: p.proposalId, proposal: p };
}

export function proposeExtend(input: ProposeExtendInput): ModificationOutcome {
  if (input.proposerUid === input.counterpartyUid) return { code: 'ILLEGAL_STATE' };
  const now = nowMs(input.now);
  const p = newProposal({
    bookingId: input.bookingId,
    kind: 'EXTEND',
    proposedBy: input.proposedBy,
    proposerUid: input.proposerUid,
    counterpartyUid: input.counterpartyUid,
    extendUntilAt: input.extendUntilAt,
    extraNights: input.extraNights,
    proposedPriceDeltaCents: input.proposedPriceDeltaCents,
    reasonCode: input.reasonCode,
  }, now);
  store.set(p.proposalId, p);
  sweep(now);
  return { code: 'PROPOSED', proposalId: p.proposalId, proposal: p };
}

export function getModificationProposal(proposalId: string, now?: number): BookingModificationProposal | null {
  const n = nowMs(now);
  const p = store.get(proposalId);
  if (!p) return null;
  if (p.expiresAt < n && p.status === 'PENDING') { store.delete(proposalId); return null; }
  return p;
}

function respond(input: RespondInput, decision: 'ACCEPTED' | 'DECLINED'): ModificationOutcome {
  const n = nowMs(input.now);
  const p = store.get(input.proposalId);
  if (!p) return { code: 'NOT_FOUND' };
  if (p.status !== 'PENDING') return { code: 'ILLEGAL_STATE' };
  if (p.expiresAt < n) {
    p.status = 'EXPIRED';
    return { code: 'EXPIRED' };
  }
  if (input.actorUid === p.proposerUid) {
    return { code: 'PROPOSER_CANNOT_ALSO_ACCEPT' };
  }
  if (input.actorUid !== p.counterpartyUid) {
    return { code: 'ACTOR_NOT_COUNTERPARTY' };
  }
  p.status = decision;
  return {
    code: decision === 'ACCEPTED' ? 'ACCEPTED_BY_OTHER_PARTY' : 'DECLINED_BY_OTHER_PARTY',
    proposalId: p.proposalId,
    proposal: p,
  };
}

export function acceptModificationProposal(input: RespondInput): ModificationOutcome {
  return respond(input, 'ACCEPTED');
}
export function declineModificationProposal(input: RespondInput): ModificationOutcome {
  return respond(input, 'DECLINED');
}

export function cancelModificationProposal(input: RespondInput): ModificationOutcome {
  const n = nowMs(input.now);
  const p = store.get(input.proposalId);
  if (!p) return { code: 'NOT_FOUND' };
  if (p.status !== 'PENDING') return { code: 'ILLEGAL_STATE' };
  if (p.expiresAt < n) { p.status = 'EXPIRED'; return { code: 'EXPIRED' }; }
  if (input.actorUid !== p.proposerUid) return { code: 'ACTOR_NOT_COUNTERPARTY' };
  p.status = 'CANCELLED';
  return { code: 'CANCELLED_BY_PROPOSER', proposalId: p.proposalId, proposal: p };
}
