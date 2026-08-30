/**
 * CalendarConflictReleaseEvaluator — CEO doctrine (calendar release).
 *
 * Pure evaluator. When a booking status flips to CANCELLED /
 * DECLINED / EXPIRED / REJECTED_PROPOSAL, the provider's calendar
 * slot MUST be released so a competing booking can take it. This
 * service computes which slot(s) to release for a specific
 * transition — the caller then uses ProviderAvailabilityService to
 * reflect the freed window.
 *
 * The evaluator NEVER mutates the calendar. It only decides what
 * to release.
 */

export type ReleaseTrigger =
  | 'CUSTOMER_CANCELLED'
  | 'PROVIDER_CANCELLED'
  | 'CUSTOMER_DECLINED_QUOTE'
  | 'PROVIDER_DECLINED_REQUEST'
  | 'PROPOSAL_EXPIRED'
  | 'BOOKING_EXPIRED';

export interface ReleaseInput {
  trigger: ReleaseTrigger;
  bookingId: string;
  startAt: string;                          // ISO
  endAt: string;                            // ISO
  /** If true, the provider chose to keep the slot blocked (e.g. after a mid-service cancellation). */
  keepBlocked?: boolean;
  /**
   * When the trigger is a proposal expiry, the caller should pass
   * the proposed slot (which may differ from the original booking
   * window).
   */
  proposedStartAt?: string;
  proposedEndAt?: string;
}

export interface ReleaseOutcome {
  releaseSlot: boolean;
  slotStartAt?: string;
  slotEndAt?: string;
  reasonCode: string;
}

const RELEASING_TRIGGERS: ReadonlySet<ReleaseTrigger> = new Set<ReleaseTrigger>([
  'CUSTOMER_CANCELLED',
  'PROVIDER_CANCELLED',
  'CUSTOMER_DECLINED_QUOTE',
  'PROVIDER_DECLINED_REQUEST',
  'BOOKING_EXPIRED',
]);

export function evaluateCalendarRelease(input: ReleaseInput): ReleaseOutcome {
  if (input.keepBlocked) {
    return { releaseSlot: false, reasonCode: 'PROVIDER_KEEPS_SLOT_BLOCKED' };
  }
  if (input.trigger === 'PROPOSAL_EXPIRED') {
    return {
      releaseSlot: true,
      slotStartAt: input.proposedStartAt,
      slotEndAt: input.proposedEndAt,
      reasonCode: 'PROPOSAL_EXPIRED_RELEASE',
    };
  }
  if (RELEASING_TRIGGERS.has(input.trigger)) {
    return {
      releaseSlot: true,
      slotStartAt: input.startAt,
      slotEndAt: input.endAt,
      reasonCode: `${input.trigger}_RELEASE`,
    };
  }
  return { releaseSlot: false, reasonCode: 'NO_RELEASE_TRIGGER' };
}
