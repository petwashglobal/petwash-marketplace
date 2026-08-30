/**
 * StartJobPreflightService — CEO PROGRAM 24 (Start Job).
 *
 * Pure evaluator. Before a provider taps "Start Job", the server
 * checks the doctrine's per-service preconditions:
 *   • correct provider (actor matches booking.providerUid),
 *   • booking eligible (status in the startable set),
 *   • time valid (now is inside the acceptable start window),
 *   • payment state OK (§12 — not PAYMENT_UNCERTAIN),
 *   • handoff verified if the service requires it,
 *   • care snapshot ready (pet notes present + shared).
 *
 * Returns START_ALLOWED or START_BLOCKED with a stable reason
 * code the client renders. The evaluator NEVER mutates state.
 */

export type StartableStatus = 'CONFIRMED' | 'READY_TO_START';

export interface PreflightInput {
  actorUid: string;
  bookingProviderUid: string;
  bookingStatus: 'REQUESTED' | 'QUOTED' | 'PROVIDER_PROPOSED_CHANGE' | 'ACCEPTED' | 'CONFIRMED' | 'READY_TO_START' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DECLINED' | 'EXPIRED';
  scheduledStartAt: string;                        // ISO
  now?: Date;
  /** Minutes before scheduledStartAt at which "start" becomes valid. */
  earlyStartWindowMinutes?: number;
  /** Minutes after scheduledStartAt after which "start" is late-refused. */
  lateStartWindowMinutes?: number;
  paymentClear: boolean;                           // false when §12 PaymentUncertaintyResolver says NOT PAID
  requiresPickupHandoff: boolean;
  pickupHandoffVerified: boolean;
  requiresCareSnapshot: boolean;
  careSnapshotReady: boolean;
}

export type PreflightOutcome =
  | { code: 'START_ALLOWED' }
  | { code: 'START_BLOCKED'; reasonCode:
      | 'ACTOR_NOT_PROVIDER'
      | 'BOOKING_NOT_STARTABLE'
      | 'START_TOO_EARLY'
      | 'START_TOO_LATE'
      | 'PAYMENT_NOT_CLEAR'
      | 'PICKUP_HANDOFF_MISSING'
      | 'CARE_SNAPSHOT_MISSING' };

const STARTABLE: ReadonlySet<PreflightInput['bookingStatus']> = new Set<PreflightInput['bookingStatus']>(['CONFIRMED', 'READY_TO_START']);

const DEFAULT_EARLY_WINDOW = 15;
const DEFAULT_LATE_WINDOW = 60;

export function preflightStartJob(input: PreflightInput): PreflightOutcome {
  if (input.actorUid !== input.bookingProviderUid) return { code: 'START_BLOCKED', reasonCode: 'ACTOR_NOT_PROVIDER' };
  if (!STARTABLE.has(input.bookingStatus)) return { code: 'START_BLOCKED', reasonCode: 'BOOKING_NOT_STARTABLE' };

  const now = input.now ?? new Date();
  const start = new Date(input.scheduledStartAt).getTime();
  if (Number.isFinite(start)) {
    const early = (input.earlyStartWindowMinutes ?? DEFAULT_EARLY_WINDOW) * 60 * 1000;
    const late  = (input.lateStartWindowMinutes  ?? DEFAULT_LATE_WINDOW)  * 60 * 1000;
    if (now.getTime() < start - early) return { code: 'START_BLOCKED', reasonCode: 'START_TOO_EARLY' };
    if (now.getTime() > start + late)  return { code: 'START_BLOCKED', reasonCode: 'START_TOO_LATE' };
  }
  if (!input.paymentClear) return { code: 'START_BLOCKED', reasonCode: 'PAYMENT_NOT_CLEAR' };
  if (input.requiresPickupHandoff && !input.pickupHandoffVerified) return { code: 'START_BLOCKED', reasonCode: 'PICKUP_HANDOFF_MISSING' };
  if (input.requiresCareSnapshot && !input.careSnapshotReady) return { code: 'START_BLOCKED', reasonCode: 'CARE_SNAPSHOT_MISSING' };
  return { code: 'START_ALLOWED' };
}
