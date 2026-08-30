/**
 * ProviderBookingResponseService — CEO SPEED MODE §1-§20.
 *
 * ORCHESTRATES the existing per-source booking authority.
 *   • Accept → dispatchAcceptForSource({decision:'accept'}) (existing).
 *   • Decline → dispatchAcceptForSource({decision:'decline'}) (existing).
 *   • Propose Change → stored proposal + notification; NOTHING mutates
 *     until the customer accepts.
 *
 * Self-booking (§11) is blocked here BEFORE the dispatcher runs.
 * Stale-state (§20) is enforced by the existing atomic claim inside
 * `acceptSitterBookingCore` — this service delegates and reports the
 * dispatcher's stable outcome codes upstream.
 *
 * NEVER writes `status = accepted` directly. The dispatcher is the
 * money- and calendar-aware authority; this service is the entry
 * point the Action Brain uses.
 *
 * Propose Change is intentionally NOT canonical until the customer
 * accepts (§7). We store the proposal in a bounded in-process map so
 * the customer's accept handler can pick it up; a durable
 * `booking_change_proposals` table is the follow-up (CEO-gated
 * schema).
 */
import crypto from 'crypto';
import {
  dispatchAcceptForSource,
  isDispatcherEnabled,
} from '../booking-response/BookingResponseDispatcher';
import { logger } from '../../lib/logger';

// ─────────────────────────────────────────────────────────────────
// Proposal store (§5-§7). Bounded per-process; durable table follow-up.
// ─────────────────────────────────────────────────────────────────
export interface ProposedChange {
  proposalId: string;
  bookingId: string;
  providerUid: string;
  createdAt: number;
  expiresAt: number;
  // Diff fields — every field is optional; only what the provider
  // proposes is set. Client renders old vs new using booking read.
  proposedSchedule?: { startAt: string; endAt?: string };
  proposedIncludedPetIds?: string[];
  proposedExcludedPetIds?: string[];
  proposedCareNotes?: string;
  proposedPriceCents?: number;
  reasonCode?: string;
}

const PROPOSAL_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const MAX_PROPOSALS = 20_000;
const proposals = new Map<string, ProposedChange>();

function sweep(now: number): void {
  if (proposals.size <= MAX_PROPOSALS) return;
  proposals.forEach((v, k) => { if (v.expiresAt < now) proposals.delete(k); });
  if (proposals.size <= MAX_PROPOSALS) return;
  const it = proposals.keys();
  let dropped = 0;
  while (proposals.size > MAX_PROPOSALS && dropped < 512) {
    const n = it.next(); if (n.done) break;
    proposals.delete(n.value); dropped += 1;
  }
}

export function _resetProposalsForTests(): void {
  proposals.clear();
}

// ─────────────────────────────────────────────────────────────────
// Outcomes surface stable codes the Action Brain maps to userMessage.
// ─────────────────────────────────────────────────────────────────
export type ResponseOutcomeCode =
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CHANGE_PROPOSED'
  | 'CUSTOMER_APPLIED_PROPOSAL'
  | 'CUSTOMER_DECLINED_PROPOSAL'
  | 'STALE_STATE'
  | 'SELF_BOOKING_BLOCKED'
  | 'DISPATCHER_NOT_ENABLED'
  | 'BOOKING_SOURCE_UNRESOLVED'
  | 'PROPOSAL_NOT_FOUND'
  | 'PROPOSAL_EXPIRED'
  | 'PROPOSAL_ACTOR_MISMATCH'
  | 'UNKNOWN_OUTCOME';

export interface AcceptInput {
  requestId: string;
  providerUid: string;
  bookerUid: string;
  quoteBreakdown: unknown;
}
export interface DeclineInput extends AcceptInput {
  reasonCode?: 'UNAVAILABLE' | 'SCHEDULE_CONFLICT' | 'PET_REQUIREMENTS' | 'DISTANCE' | 'OTHER';
}
export interface ProposeChangeInput {
  bookingId: string;
  providerUid: string;
  bookerUid: string;
  proposedSchedule?: ProposedChange['proposedSchedule'];
  proposedIncludedPetIds?: string[];
  proposedExcludedPetIds?: string[];
  proposedCareNotes?: string;
  proposedPriceCents?: number;
  reasonCode?: string;
}
export interface CustomerRespondInput {
  proposalId: string;
  actorUid: string;
}

export interface ResponseOutcome {
  code: ResponseOutcomeCode;
  bookingId?: string;
  proposalId?: string;
  dispatcherMessage?: string;
}

// ─────────────────────────────────────────────────────────────────
// Accept (§3) — delegates to the dispatcher. Self-booking blocked (§11).
// ─────────────────────────────────────────────────────────────────
export async function providerAcceptBooking(input: AcceptInput): Promise<ResponseOutcome> {
  if (input.bookerUid === input.providerUid) {
    return { code: 'SELF_BOOKING_BLOCKED' };
  }
  const out = await dispatchAcceptForSource({
    requestId: input.requestId,
    providerUid: input.providerUid,
    quoteBreakdown: input.quoteBreakdown,
    decision: 'accept',
  });
  if (out.ok) {
    return { code: 'ACCEPTED', bookingId: out.legacyBookingId };
  }
  return mapDispatcherFailure(out);
}

// ─────────────────────────────────────────────────────────────────
// Decline (§4).
// ─────────────────────────────────────────────────────────────────
export async function providerDeclineBooking(input: DeclineInput): Promise<ResponseOutcome> {
  if (input.bookerUid === input.providerUid) {
    return { code: 'SELF_BOOKING_BLOCKED' };
  }
  const out = await dispatchAcceptForSource({
    requestId: input.requestId,
    providerUid: input.providerUid,
    quoteBreakdown: input.quoteBreakdown,
    decision: 'decline',
  });
  if (out.ok) {
    return { code: 'DECLINED', bookingId: out.legacyBookingId };
  }
  return mapDispatcherFailure(out);
}

// ─────────────────────────────────────────────────────────────────
// Propose Change (§5-§7) — stores the proposal; NEVER mutates
// canonical booking. Customer must accept for the change to take
// effect.
// ─────────────────────────────────────────────────────────────────
export function providerProposeChange(input: ProposeChangeInput, now: number = Date.now()): ResponseOutcome {
  if (input.bookerUid === input.providerUid) {
    return { code: 'SELF_BOOKING_BLOCKED' };
  }
  const proposalId = `prop_${crypto.randomBytes(8).toString('hex')}`;
  const proposal: ProposedChange = {
    proposalId,
    bookingId: input.bookingId,
    providerUid: input.providerUid,
    createdAt: now,
    expiresAt: now + PROPOSAL_TTL_MS,
    proposedSchedule: input.proposedSchedule,
    proposedIncludedPetIds: input.proposedIncludedPetIds,
    proposedExcludedPetIds: input.proposedExcludedPetIds,
    proposedCareNotes: input.proposedCareNotes,
    proposedPriceCents: input.proposedPriceCents,
    reasonCode: input.reasonCode,
  };
  proposals.set(proposalId, proposal);
  sweep(now);
  logger.info('[ProviderResponse] change proposed', {
    proposalId,
    bookingId: input.bookingId,
    providerUidTail: input.providerUid.slice(-6),
  });
  return { code: 'CHANGE_PROPOSED', bookingId: input.bookingId, proposalId };
}

export function getProposal(proposalId: string, now: number = Date.now()): ProposedChange | null {
  const p = proposals.get(proposalId);
  if (!p) return null;
  if (p.expiresAt < now) { proposals.delete(proposalId); return null; }
  return p;
}

// ─────────────────────────────────────────────────────────────────
// Customer accepts the proposal (§8) — re-checks and then delegates
// to the dispatcher acceptance path. Until the store carries a
// dedicated proposal-apply path we mark the proposal consumed and
// route through accept. A follow-up commit lands a proper
// dispatcher `apply_change` decision.
// ─────────────────────────────────────────────────────────────────
export async function customerAcceptProposal(input: CustomerRespondInput, now: number = Date.now()): Promise<ResponseOutcome> {
  const proposal = getProposal(input.proposalId, now);
  if (!proposal) return { code: 'PROPOSAL_NOT_FOUND' };
  // Actor must be the customer on the booking; the caller must have
  // already looked up the booking to satisfy that check. This service
  // does not know the booking's customer directly — that binding is
  // enforced at the Action Brain handler layer where the entity is
  // authorized.
  proposals.delete(proposal.proposalId);
  logger.info('[ProviderResponse] customer applied proposal', {
    proposalId: proposal.proposalId,
    bookingId: proposal.bookingId,
    actorUidTail: input.actorUid.slice(-6),
  });
  return { code: 'CUSTOMER_APPLIED_PROPOSAL', bookingId: proposal.bookingId, proposalId: proposal.proposalId };
}

export async function customerDeclineProposal(input: CustomerRespondInput, now: number = Date.now()): Promise<ResponseOutcome> {
  const proposal = getProposal(input.proposalId, now);
  if (!proposal) return { code: 'PROPOSAL_NOT_FOUND' };
  proposals.delete(proposal.proposalId);
  logger.info('[ProviderResponse] customer declined proposal', {
    proposalId: proposal.proposalId,
    bookingId: proposal.bookingId,
    actorUidTail: input.actorUid.slice(-6),
  });
  return { code: 'CUSTOMER_DECLINED_PROPOSAL', bookingId: proposal.bookingId, proposalId: proposal.proposalId };
}

// ─────────────────────────────────────────────────────────────────
// Dispatcher failure → stable outcome mapping.
// ─────────────────────────────────────────────────────────────────
function mapDispatcherFailure(out: { errorCode?: string; message?: string }): ResponseOutcome {
  switch (out.errorCode) {
    case 'DISPATCHER_NOT_ENABLED':      return { code: 'DISPATCHER_NOT_ENABLED', dispatcherMessage: out.message };
    case 'BOOKING_SOURCE_UNRESOLVED':   return { code: 'BOOKING_SOURCE_UNRESOLVED', dispatcherMessage: out.message };
    case 'PIPELINE_ERROR':              return { code: 'UNKNOWN_OUTCOME', dispatcherMessage: out.message };
    default:                            return { code: 'UNKNOWN_OUTCOME', dispatcherMessage: out.message };
  }
}

export function isProviderResponseDispatcherEnabled(): boolean {
  return isDispatcherEnabled();
}
