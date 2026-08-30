/**
 * CompleteJobPolicy — CEO PROGRAM 27 (Service-Specific Completion).
 *
 * Pure evaluator. Doctrine: "Do not one-size-fits-all completion."
 * Each service kind has a different minimum-signal set that MUST
 * be present before the job can be marked COMPLETED.
 */

export type ServiceKind = 'WALK' | 'SITTING' | 'DAYCARE' | 'TRANSPORT' | 'TRAINING' | 'GROOMING';

export interface CompletionSignals {
  handoffReturnVerified?: boolean;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  petReturnedAcknowledged?: boolean;
  pickupAcknowledged?: boolean;
  dropoffAcknowledged?: boolean;
  trackedRoute?: boolean;
  careTasksCompleted?: boolean;
  now?: Date;
}

export type CompletionOutcome =
  | { code: 'COMPLETE_ALLOWED' }
  | { code: 'BLOCKED'; missingSignals: string[] };

function required(name: string, cond: boolean, missing: string[]): void {
  if (!cond) missing.push(name);
}

/**
 * Per-service completion rules. This never marks the job complete —
 * it returns the verdict the caller uses to enable / disable the
 * COMPLETE_JOB action.
 */
export function canComplete(kind: ServiceKind, signals: CompletionSignals): CompletionOutcome {
  const missing: string[] = [];
  switch (kind) {
    case 'WALK':
      required('SESSION_START', !!signals.sessionStartedAt, missing);
      required('SESSION_END', !!signals.sessionEndedAt, missing);
      required('PET_RETURNED', !!signals.petReturnedAcknowledged, missing);
      // trackedRoute is OPTIONAL — GPS can drop (§ Program 25); don't
      // require it. The evaluator carries the doctrine's discipline
      // that GPS-lost does NOT block completion.
      break;
    case 'SITTING':
      required('CARE_TASKS', !!signals.careTasksCompleted, missing);
      required('HANDOFF_RETURN_VERIFIED', !!signals.handoffReturnVerified, missing);
      break;
    case 'DAYCARE':
      required('PICKUP', !!signals.pickupAcknowledged, missing);
      break;
    case 'TRANSPORT':
      required('PICKUP', !!signals.pickupAcknowledged, missing);
      required('DROPOFF', !!signals.dropoffAcknowledged, missing);
      break;
    case 'TRAINING':
      required('SESSION_START', !!signals.sessionStartedAt, missing);
      required('SESSION_END', !!signals.sessionEndedAt, missing);
      required('CARE_TASKS', !!signals.careTasksCompleted, missing);
      break;
    case 'GROOMING':
      required('SESSION_END', !!signals.sessionEndedAt, missing);
      required('PET_RETURNED', !!signals.petReturnedAcknowledged, missing);
      break;
    default:
      missing.push('UNKNOWN_SERVICE_KIND');
  }
  return missing.length === 0 ? { code: 'COMPLETE_ALLOWED' } : { code: 'BLOCKED', missingSignals: missing };
}
