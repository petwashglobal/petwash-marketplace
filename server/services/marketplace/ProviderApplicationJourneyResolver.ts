/**
 * ProviderApplicationJourneyResolver — CEO NEXT-AUTO §14 refill.
 *
 * JourneyState for a provider KYC / application. Provider view only.
 * Missing documents surface as REQUIRED obligations with the exact
 * missing slug so the UI can render the doctrine's smart blockers
 * (§72 "Finish availability before accepting" pattern).
 */
import {
  emptyJourneyState,
  type JourneyState,
  type Obligation,
  type Blocker,
  type WaitingParty,
  type JourneyPriority,
} from '@shared/marketplace/journeyState';

export type ProviderApplicationStatus =
  | 'DRAFT'
  | 'AWAITING_DOCUMENTS'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';

export type MissingDocumentCode =
  | 'ID'
  | 'BANK_ACCOUNT'
  | 'INSURANCE'
  | 'VET_CERTIFICATE'
  | 'BACKGROUND_CHECK'
  | 'TAX_STATUS';

export interface ProviderApplicationJourneySnapshot {
  applicationId: string;
  status: ProviderApplicationStatus;
  providerUid: string;
  missingDocuments: MissingDocumentCode[];
  reviewNotesCode?: string;
  insuranceExpiresAt?: string;
}

export function resolveProviderApplicationJourney(
  input: { snapshot: ProviderApplicationJourneySnapshot; actorUid: string },
): JourneyState {
  const s = input.snapshot;
  const entityRef = { kind: 'provider_application', id: s.applicationId };
  const actor: JourneyState['actor'] = { role: 'PROVIDER', uid: input.actorUid };
  const base = emptyJourneyState(entityRef, actor, s.status);
  const [waitingOn, obligations, blockers, primary, priority] = classify(s);
  return {
    ...base,
    waitingOn,
    obligations,
    blockers,
    primaryAction: primary ? { actionType: primary, reasonCode: `PRIMARY_FOR_${s.status}` } : undefined,
    availableActions: [],
    attentionPriority: priority,
    deadlines: s.insuranceExpiresAt ? [{ reasonCode: 'INSURANCE_EXPIRES', dueAt: s.insuranceExpiresAt, hardCutoff: true }] : [],
  };
}

function classify(s: ProviderApplicationJourneySnapshot): [WaitingParty, Obligation[], Blocker[], string | undefined, JourneyPriority] {
  const missingObligations: Obligation[] = s.missingDocuments.map((code) => ({
    type: 'UPLOAD_KYC_DOCUMENT', severity: 'REQUIRED', reasonCode: `MISSING_${code}`,
  }));
  const missingBlockers: Blocker[] = s.missingDocuments.map((code) => ({
    action: 'PROVIDER_APPLICATION_SUBMIT',
    reasonCode: `MISSING_${code}`,
    requirement: { type: 'UPLOAD_KYC_DOCUMENT', entityRef: { kind: 'document', id: code } },
  }));

  switch (s.status) {
    case 'DRAFT':
      return ['PROVIDER', missingObligations.length ? missingObligations : [{ type: 'NONE', severity: 'REQUIRED', reasonCode: 'DRAFT' }], missingBlockers, 'PROVIDER_APPLICATION_CONTINUE', 'HIGH'];
    case 'AWAITING_DOCUMENTS':
      return ['PROVIDER', missingObligations, missingBlockers, 'UPLOAD_KYC_DOCUMENT', 'URGENT'];
    case 'IN_REVIEW':
      return ['PETWASH', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'IN_REVIEW' }], [], 'VIEW_APPLICATION_STATUS', 'MEDIUM'];
    case 'CHANGES_REQUESTED':
      return ['PROVIDER', [{ type: 'UPLOAD_KYC_DOCUMENT', severity: 'REQUIRED', reasonCode: s.reviewNotesCode ?? 'CHANGES_REQUESTED' }], missingBlockers, 'PROVIDER_APPLICATION_CONTINUE', 'HIGH'];
    case 'APPROVED':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'APPROVED' }], [], 'VIEW_PROVIDER_DASHBOARD', 'INFO'];
    case 'REJECTED':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'REJECTED' }], [], 'CONTACT_SUPPORT', 'HIGH'];
    case 'SUSPENDED':
      return ['PETWASH', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'SUSPENDED' }], [], 'CONTACT_SUPPORT', 'URGENT'];
    default:
      return ['NONE', [], [], undefined, 'INFO'];
  }
}
