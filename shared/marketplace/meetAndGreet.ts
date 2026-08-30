/**
 * Meet & Greet — CEO Integrity Doctrine §4, §5, §6, §35.
 *
 * A PetWash EVENT, not a lead export. Statuses:
 *   PROPOSED    — customer requested; provider hasn't accepted.
 *   CONFIRMED   — provider accepted; the actual meeting is scheduled.
 *   COMPLETED   — the meeting happened.
 *   CANCELLED   — either side cancelled before completion.
 *
 * Before the event both sides acknowledge counsel-approved wording:
 *   "This introduction was made through PetWash. Future bookings with this
 *    provider / customer must remain on PetWash."
 * The acknowledgement is recorded on the event so it survives a later
 * dispute.
 */
import type { ServiceType } from './actors';

export type MeetAndGreetStatus = 'PROPOSED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface MeetAndGreetAcknowledgement {
  actorUid: string;
  acknowledgedAt: string; // ISO
  wordingVersion: string; // counsel-approved policy version pin
}

export interface MeetAndGreet {
  meetId: string;
  customerUid: string;
  providerUid: string;
  serviceType: ServiceType;
  petIds: string[];
  prospectiveBookingId?: string;
  scheduledAt: string;    // ISO — when the M&G is supposed to happen
  location: {
    kind: 'PROVIDER_HOME' | 'CUSTOMER_HOME' | 'REMOTE';
    address?: string;
  };
  status: MeetAndGreetStatus;
  acknowledgements: MeetAndGreetAcknowledgement[];
  createdAt: string;
  updatedAt: string;
}

/**
 * State-machine transitions. The server calls `canTransition(from, to)`
 * before applying an update — refusing an illegal move.
 */
const TRANSITIONS: Record<MeetAndGreetStatus, MeetAndGreetStatus[]> = {
  PROPOSED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // terminal
  CANCELLED: [], // terminal
};

export function canTransition(from: MeetAndGreetStatus, to: MeetAndGreetStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Business rule: BOTH sides must acknowledge the counsel-approved wording
 * before the provider is allowed to accept a M&G that reveals any masked
 * contact information (integrity doctrine §6 + CEO §14 correction).
 *
 * §14 discipline: acknowledgement is per-party EVIDENCE — a boolean
 * "both acknowledged" is forbidden because one side would be able to
 * set the flag on the other's behalf. This helper derives the truth
 * from the append-only acknowledgement records.
 *
 * The record for one party MUST carry that party's actorUid + the
 * policyVersion they saw. A record where actorUid is the other party
 * cannot count as evidence for the first — that's an impersonation
 * gap the boolean model created.
 */
export function bothPartiesAcknowledged(mg: MeetAndGreet): boolean {
  const uids = new Set(mg.acknowledgements.map((a) => a.actorUid));
  return uids.has(mg.customerUid) && uids.has(mg.providerUid);
}

/**
 * Return the per-party acknowledgement evidence, if any. Useful for
 * the M&G surface to render "waiting for provider to acknowledge" vs
 * "waiting for you to acknowledge" — never a shared boolean.
 */
export function acknowledgementEvidence(
  mg: MeetAndGreet,
): {
  customer: MeetAndGreetAcknowledgement | null;
  provider: MeetAndGreetAcknowledgement | null;
} {
  const customer = mg.acknowledgements.find((a) => a.actorUid === mg.customerUid) ?? null;
  const provider = mg.acknowledgements.find((a) => a.actorUid === mg.providerUid) ?? null;
  return { customer, provider };
}

/**
 * §15 discipline: acknowledgement gating a NEW commercial arrangement
 * is fine. Acknowledgement gating SAFETY communication / active-booking
 * chat / incident report / emergency contact is FORBIDDEN.
 *
 * Callers use `acknowledgementRequiredForNewCommercial(mg)` to decide
 * whether the accept path opens; safety paths never consult this.
 */
export function acknowledgementRequiredForNewCommercial(mg: MeetAndGreet): boolean {
  return !bothPartiesAcknowledged(mg);
}

/**
 * Business rule: after COMPLETED, the Book Again fast path opens on both
 * sides (integrity doctrine §35). Making the legitimate conversion easier
 * than bypass is the whole point.
 */
export function fastRebookAllowed(mg: MeetAndGreet): boolean {
  return mg.status === 'COMPLETED';
}
