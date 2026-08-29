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
 * contact information (integrity doctrine §6). Callers check this before
 * transitioning PROPOSED → CONFIRMED and before revealing masked contact.
 */
export function bothPartiesAcknowledged(mg: MeetAndGreet): boolean {
  const uids = new Set(mg.acknowledgements.map((a) => a.actorUid));
  return uids.has(mg.customerUid) && uids.has(mg.providerUid);
}

/**
 * Business rule: after COMPLETED, the Book Again fast path opens on both
 * sides (integrity doctrine §35). Making the legitimate conversion easier
 * than bypass is the whole point.
 */
export function fastRebookAllowed(mg: MeetAndGreet): boolean {
  return mg.status === 'COMPLETED';
}
