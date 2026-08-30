/**
 * PetKyaJourneyResolver — CEO NEXT-AUTO §14 refill.
 *
 * Pet KYA (Know Your Animal) freshness projection. The freshness
 * policy comes from the caller (§21-§22 discipline: engineers do
 * NOT invent months). Unconfigured caller → POLICY_NOT_CONFIGURED.
 */
import {
  emptyJourneyState,
  type JourneyState,
  type Obligation,
  type WaitingParty,
  type JourneyPriority,
} from '@shared/marketplace/journeyState';

export interface PetKyaSnapshot {
  petId: string;
  ownerUid: string;
  lastReviewedAt?: string;                  // ISO
  hasCoreCareNotes?: boolean;
  medicalDocExpiresAt?: string;             // ISO
}

export interface PetKyaPolicy {
  /** Review interval in months. If undefined → POLICY_NOT_CONFIGURED. */
  reviewIntervalMonths?: number;
}

export function resolvePetKyaJourney(
  input: { snapshot: PetKyaSnapshot; actorUid: string; policy: PetKyaPolicy; now?: string },
): JourneyState {
  const s = input.snapshot;
  const entityRef = { kind: 'pet', id: s.petId };
  const actor: JourneyState['actor'] = { role: 'CUSTOMER', uid: input.actorUid };
  const currentState = s.hasCoreCareNotes ? 'HAS_NOTES' : 'MISSING_NOTES';
  const base = emptyJourneyState(entityRef, actor, currentState);

  if (!input.policy.reviewIntervalMonths) {
    // §21-§22 — refuse to grade freshness under an undecided policy.
    return {
      ...base,
      waitingOn: 'PETWASH',
      obligations: [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'POLICY_NOT_CONFIGURED' }],
      primaryAction: { actionType: 'VIEW_PET_PROFILE', reasonCode: 'PRIMARY_INFO_ONLY' },
      attentionPriority: 'INFO',
      availableActions: [],
      deadlines: [],
    };
  }

  const now = new Date(input.now ?? new Date().toISOString());
  const last = s.lastReviewedAt ? new Date(s.lastReviewedAt) : undefined;
  const staleAfter = last ? new Date(last.getFullYear(), last.getMonth() + input.policy.reviewIntervalMonths, last.getDate()) : now;
  const isStale = !last || staleAfter.getTime() < now.getTime();
  const missingNotes = !s.hasCoreCareNotes;
  const [waitingOn, obligations, primary, priority] = classify(missingNotes, isStale);
  return {
    ...base,
    waitingOn,
    obligations,
    primaryAction: primary ? { actionType: primary, reasonCode: 'PRIMARY_KYA' } : undefined,
    availableActions: [],
    attentionPriority: priority,
    deadlines: s.medicalDocExpiresAt ? [{ reasonCode: 'MEDICAL_DOC_EXPIRES', dueAt: s.medicalDocExpiresAt, hardCutoff: false }] : [],
  };
}

function classify(missingNotes: boolean, isStale: boolean): [WaitingParty, Obligation[], string | undefined, JourneyPriority] {
  if (missingNotes) return ['CUSTOMER', [{ type: 'NONE', severity: 'REQUIRED', reasonCode: 'PET_NOTES_MISSING' }], 'UPDATE_PET_PROFILE', 'HIGH'];
  if (isStale) return ['CUSTOMER', [{ type: 'NONE', severity: 'OPTIONAL', reasonCode: 'PET_NOTES_STALE' }], 'REVIEW_PET_PROFILE', 'MEDIUM'];
  return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'PET_NOTES_FRESH' }], 'VIEW_PET_PROFILE', 'INFO'];
}
