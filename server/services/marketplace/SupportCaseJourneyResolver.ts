/**
 * SupportCaseJourneyResolver — CEO NEXT-AUTO §14 refill.
 *
 * JourneyState for a support case (per §84-§87). Support cases have
 * an opener (customer, provider, or staff on someone's behalf) and
 * a support agent; either party may be the one holding progress at
 * any moment. Only the opener is allowed to CLOSE (§14 discipline);
 * the resolver reflects that in the primaryAction routing.
 */
import {
  emptyJourneyState,
  type JourneyState,
  type Obligation,
  type WaitingParty,
  type JourneyPriority,
} from '@shared/marketplace/journeyState';

export type SupportCaseStatus =
  | 'OPEN'
  | 'AWAITING_CUSTOMER'
  | 'AWAITING_STAFF'
  | 'RESOLVED_PENDING_CONFIRMATION'
  | 'CLOSED';

export type SupportCaseActorRole = 'OPENER' | 'STAFF';

export interface SupportCaseJourneySnapshot {
  caseId: string;
  status: SupportCaseStatus;
  openerUid: string;
  assignedStaffUid?: string;
  severityCode?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  unrespondedSinceMinutes?: number;
  slaBreachAt?: string;                     // ISO
}

export function resolveSupportCaseJourney(
  input: { snapshot: SupportCaseJourneySnapshot; actorUid: string; actorRole: SupportCaseActorRole },
): JourneyState {
  const s = input.snapshot;
  const entityRef = { kind: 'support_case', id: s.caseId };
  const role = input.actorRole === 'STAFF' ? 'SUPPORT' : 'CUSTOMER';
  const actor: JourneyState['actor'] = { role, uid: input.actorUid };
  const base = emptyJourneyState(entityRef, actor, s.status);
  const [waitingOn, obligations, primary, priority] = classify(s, input.actorRole);
  return {
    ...base,
    waitingOn,
    obligations,
    primaryAction: primary ? { actionType: primary, reasonCode: `PRIMARY_FOR_${s.status}` } : undefined,
    availableActions: [],
    attentionPriority: elevate(priority, s.severityCode),
    deadlines: s.slaBreachAt ? [{ reasonCode: 'SUPPORT_SLA_BREACH', dueAt: s.slaBreachAt, hardCutoff: false }] : [],
  };
}

function classify(
  s: SupportCaseJourneySnapshot,
  actor: SupportCaseActorRole,
): [WaitingParty, Obligation[], string | undefined, JourneyPriority] {
  const opener = actor === 'OPENER';
  switch (s.status) {
    case 'OPEN':
      return opener
        ? ['PETWASH', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'AWAITING_TRIAGE' }], 'VIEW_SUPPORT_CASE', 'MEDIUM']
        : ['PETWASH', [{ type: 'RESPOND_TO_MESSAGE', severity: 'REQUIRED', reasonCode: 'AWAITING_TRIAGE' }], 'RESPOND_SUPPORT_CASE', 'HIGH'];
    case 'AWAITING_STAFF':
      return opener
        ? ['PETWASH', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'AWAITING_STAFF' }], 'VIEW_SUPPORT_CASE', 'MEDIUM']
        : ['PETWASH', [{ type: 'RESPOND_TO_MESSAGE', severity: 'REQUIRED', reasonCode: 'AWAITING_STAFF' }], 'RESPOND_SUPPORT_CASE', 'HIGH'];
    case 'AWAITING_CUSTOMER':
      return opener
        ? ['CUSTOMER', [{ type: 'RESPOND_TO_MESSAGE', severity: 'REQUIRED', reasonCode: 'AWAITING_CUSTOMER' }], 'RESPOND_SUPPORT_CASE', 'HIGH']
        : ['CUSTOMER', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'AWAITING_CUSTOMER' }], 'VIEW_SUPPORT_CASE', 'INFO'];
    case 'RESOLVED_PENDING_CONFIRMATION':
      return opener
        ? ['CUSTOMER', [{ type: 'CONFIRM_ATTENDANCE', severity: 'OPTIONAL', reasonCode: 'CONFIRM_RESOLVED' }], 'CLOSE_SUPPORT_CASE', 'MEDIUM']
        : ['CUSTOMER', [{ type: 'WAIT', severity: 'INFORMATIONAL', reasonCode: 'AWAITING_CONFIRMATION' }], 'VIEW_SUPPORT_CASE', 'INFO'];
    case 'CLOSED':
      return ['NONE', [{ type: 'NONE', severity: 'INFORMATIONAL', reasonCode: 'CLOSED' }], 'VIEW_SUPPORT_CASE', 'INFO'];
    default:
      return ['NONE', [], undefined, 'INFO'];
  }
}

function elevate(priority: JourneyPriority, severity?: SupportCaseJourneySnapshot['severityCode']): JourneyPriority {
  if (severity === 'URGENT') return 'URGENT';
  if (severity === 'HIGH' && priority !== 'URGENT') return 'HIGH';
  return priority;
}
