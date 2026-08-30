/**
 * MeetAndGreetService — CEO NEXT-AUTO §3.
 *
 * ORCHESTRATES the Meet & Greet lifecycle at the Action Brain layer.
 * The shared shape lives in shared/marketplace/meetAndGreet.ts; this
 * service exposes the intent verbs the client actually triggers:
 *
 *   PROVIDER_PROPOSE_MEET_GREET   — provider offers an M&G session.
 *   CUSTOMER_CONFIRM_MEET_GREET   — customer confirms the proposed
 *                                    slot, transitioning PROPOSED →
 *                                    CONFIRMED.
 *   ACKNOWLEDGE_MEET_GREET        — either party appends their
 *                                    acknowledgement evidence AFTER
 *                                    the session (§14 discipline;
 *                                    per-party record, not a boolean).
 *   CANCEL_MEET_GREET             — either party cancels a proposed
 *                                    or confirmed M&G before it starts.
 *
 * The service is a pure evaluator; the caller persists the mutated
 * MeetAndGreet record. Storage adapter follows in the durable
 * schema follow-up.
 */
import crypto from 'crypto';
import {
  canTransition,
  bothPartiesAcknowledged,
  type MeetAndGreet,
  type MeetAndGreetAcknowledgement,
} from '@shared/marketplace/meetAndGreet';

export type MeetGreetOutcomeCode =
  | 'PROPOSED'
  | 'CONFIRMED'
  | 'ACKNOWLEDGED'
  | 'BOTH_ACKNOWLEDGED'
  | 'CANCELLED'
  | 'NOT_FOUND'
  | 'ACTOR_NOT_PARTICIPANT'
  | 'ILLEGAL_STATUS_TRANSITION'
  | 'ALREADY_ACKNOWLEDGED'
  | 'SELF_MEET_GREET_BLOCKED';

export interface ProposeInput {
  bookingId?: string;
  customerUid: string;
  providerUid: string;
  serviceType: MeetAndGreet['serviceType'];
  petIds: string[];
  scheduledAt: string;    // ISO
  location: MeetAndGreet['location'];
  now?: string;           // ISO — for tests
}

export interface ConfirmInput {
  mg: MeetAndGreet;
  actorUid: string;
  now?: string;
}

export interface AcknowledgeInput {
  mg: MeetAndGreet;
  actorUid: string;
  wordingVersion: string;
  now?: string;
}

export interface CancelInput {
  mg: MeetAndGreet;
  actorUid: string;
  reasonCode?: 'CHANGED_MIND' | 'SCHEDULE_CONFLICT' | 'PET_REQUIREMENTS' | 'OTHER';
  now?: string;
}

export interface MeetGreetOutcome {
  code: MeetGreetOutcomeCode;
  mg?: MeetAndGreet;
}

function isParticipant(mg: MeetAndGreet, uid: string): boolean {
  return uid === mg.customerUid || uid === mg.providerUid;
}

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

export function proposeMeetGreet(input: ProposeInput): MeetGreetOutcome {
  if (input.customerUid === input.providerUid) {
    return { code: 'SELF_MEET_GREET_BLOCKED' };
  }
  const created = nowIso(input.now);
  const mg: MeetAndGreet = {
    meetId: `mg_${crypto.randomBytes(6).toString('hex')}`,
    customerUid: input.customerUid,
    providerUid: input.providerUid,
    serviceType: input.serviceType,
    petIds: input.petIds,
    prospectiveBookingId: input.bookingId,
    scheduledAt: input.scheduledAt,
    location: input.location,
    status: 'PROPOSED',
    acknowledgements: [],
    createdAt: created,
    updatedAt: created,
  };
  return { code: 'PROPOSED', mg };
}

export function confirmMeetGreet(input: ConfirmInput): MeetGreetOutcome {
  if (!isParticipant(input.mg, input.actorUid)) return { code: 'ACTOR_NOT_PARTICIPANT' };
  if (!canTransition(input.mg.status, 'CONFIRMED')) return { code: 'ILLEGAL_STATUS_TRANSITION' };
  const next: MeetAndGreet = { ...input.mg, status: 'CONFIRMED', updatedAt: nowIso(input.now) };
  return { code: 'CONFIRMED', mg: next };
}

export function acknowledgeMeetGreet(input: AcknowledgeInput): MeetGreetOutcome {
  if (!isParticipant(input.mg, input.actorUid)) return { code: 'ACTOR_NOT_PARTICIPANT' };
  const already = input.mg.acknowledgements.some((a) => a.actorUid === input.actorUid);
  if (already) return { code: 'ALREADY_ACKNOWLEDGED', mg: input.mg };
  const ack: MeetAndGreetAcknowledgement = {
    actorUid: input.actorUid,
    acknowledgedAt: nowIso(input.now),
    wordingVersion: input.wordingVersion,
  };
  const next: MeetAndGreet = {
    ...input.mg,
    acknowledgements: [...input.mg.acknowledgements, ack],
    updatedAt: nowIso(input.now),
  };
  const code = bothPartiesAcknowledged(next) ? 'BOTH_ACKNOWLEDGED' : 'ACKNOWLEDGED';
  return { code, mg: next };
}

export function cancelMeetGreet(input: CancelInput): MeetGreetOutcome {
  if (!isParticipant(input.mg, input.actorUid)) return { code: 'ACTOR_NOT_PARTICIPANT' };
  if (!canTransition(input.mg.status, 'CANCELLED')) return { code: 'ILLEGAL_STATUS_TRANSITION' };
  const next: MeetAndGreet = { ...input.mg, status: 'CANCELLED', updatedAt: nowIso(input.now) };
  return { code: 'CANCELLED', mg: next };
}
