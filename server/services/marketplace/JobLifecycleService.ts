/**
 * JobLifecycleService — CEO NEXT-AUTO §7 + §9 + §10.
 *
 * Pure evaluators for the three job-lifecycle transitions the
 * marketplace exposes as Action Brain verbs:
 *
 *   START_JOB    — provider marks the job started AFTER the
 *                  PICKUP handoff is VERIFIED (§8). Refuses if
 *                  handoff is missing.
 *   COMPLETE_JOB — provider marks the job complete AFTER the
 *                  RETURN handoff is VERIFIED. Refuses otherwise.
 *   RATE_JOB     — customer rates the completed service. Both
 *                  parties can rate but each side rates the OTHER
 *                  side; a provider cannot rate itself.
 *
 * The service is agnostic of the domain persistence layer — it
 * evaluates preconditions from a supplied snapshot and returns a
 * stable outcome. The caller (Action Brain handler / HTTP route)
 * applies the outcome via the domain authority.
 */
import type { HandoffPhase } from './HandoffService';

export type JobLifecycleOutcomeCode =
  | 'STARTED'
  | 'COMPLETED'
  | 'RATED'
  | 'ACTOR_NOT_PROVIDER'
  | 'ACTOR_NOT_CUSTOMER'
  | 'BOOKING_NOT_STARTABLE'
  | 'BOOKING_NOT_COMPLETABLE'
  | 'BOOKING_NOT_RATEABLE'
  | 'HANDOFF_NOT_VERIFIED'
  | 'SELF_RATING_BLOCKED'
  | 'RATE_OUT_OF_RANGE'
  | 'ALREADY_RATED';

export interface JobLifecycleSnapshot {
  bookingId: string;
  status: string;
  providerUid: string;
  customerUid: string;
  handoffs: Partial<Record<HandoffPhase, 'PENDING' | 'VERIFIED' | 'EXPIRED'>>;
  hasCustomerRating: boolean;
}

export interface StartJobInput {
  actorUid: string;
  snapshot: JobLifecycleSnapshot;
}

export interface CompleteJobInput {
  actorUid: string;
  snapshot: JobLifecycleSnapshot;
}

export interface RateJobInput {
  actorUid: string;
  snapshot: JobLifecycleSnapshot;
  stars: number;                        // 1..5
  reviewCode?: string;                  // stable feedback slug (e.g. 'ON_TIME')
}

export interface JobLifecycleOutcome {
  code: JobLifecycleOutcomeCode;
}

const STARTABLE = new Set<string>(['CONFIRMED', 'READY_TO_START']);
const COMPLETABLE = new Set<string>(['IN_PROGRESS']);
const RATEABLE = new Set<string>(['COMPLETED']);

export function startJob(input: StartJobInput): JobLifecycleOutcome {
  const s = input.snapshot;
  if (input.actorUid !== s.providerUid) return { code: 'ACTOR_NOT_PROVIDER' };
  if (!STARTABLE.has(s.status)) return { code: 'BOOKING_NOT_STARTABLE' };
  if (s.handoffs.PICKUP !== 'VERIFIED') return { code: 'HANDOFF_NOT_VERIFIED' };
  return { code: 'STARTED' };
}

export function completeJob(input: CompleteJobInput): JobLifecycleOutcome {
  const s = input.snapshot;
  if (input.actorUid !== s.providerUid) return { code: 'ACTOR_NOT_PROVIDER' };
  if (!COMPLETABLE.has(s.status)) return { code: 'BOOKING_NOT_COMPLETABLE' };
  if (s.handoffs.RETURN !== 'VERIFIED') return { code: 'HANDOFF_NOT_VERIFIED' };
  return { code: 'COMPLETED' };
}

export function rateJob(input: RateJobInput): JobLifecycleOutcome {
  const s = input.snapshot;
  if (input.actorUid !== s.customerUid) return { code: 'ACTOR_NOT_CUSTOMER' };
  if (s.customerUid === s.providerUid) return { code: 'SELF_RATING_BLOCKED' };
  if (!RATEABLE.has(s.status)) return { code: 'BOOKING_NOT_RATEABLE' };
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) return { code: 'RATE_OUT_OF_RANGE' };
  if (s.hasCustomerRating) return { code: 'ALREADY_RATED' };
  return { code: 'RATED' };
}
