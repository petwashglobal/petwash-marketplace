/**
 * SupportCaseService — CEO NEXT-AUTO §13 (Incident/Support).
 *
 * Pure evaluator for the support-ticket lifecycle. A support case is
 * a first-class Inbox item (§27 — support has its own domain, never
 * folded into MESSAGES). Cases carry participant evidence per party,
 * so an admin marking a case resolved never speaks for the customer.
 *
 * State machine:
 *   OPEN            — customer / provider opened.
 *   ADMIN_ASSIGNED  — support owner claimed it.
 *   PENDING_ACTOR   — waiting on customer / provider.
 *   RESOLVED        — support marked resolved.
 *   CLOSED          — customer confirmed close, or 14-day auto-close.
 *
 * Legal transitions:
 *   OPEN            → ADMIN_ASSIGNED, RESOLVED (auto by policy)
 *   ADMIN_ASSIGNED  → PENDING_ACTOR, RESOLVED
 *   PENDING_ACTOR   → ADMIN_ASSIGNED, RESOLVED
 *   RESOLVED        → CLOSED, ADMIN_ASSIGNED (reopen)
 *   CLOSED          — terminal
 */
import crypto from 'crypto';

export type SupportCaseStatus =
  | 'OPEN'
  | 'ADMIN_ASSIGNED'
  | 'PENDING_ACTOR'
  | 'RESOLVED'
  | 'CLOSED';

export type SupportCaseKind =
  | 'BOOKING_INCIDENT'
  | 'PAYMENT_ISSUE'
  | 'ACCOUNT_QUESTION'
  | 'MODERATION_APPEAL'
  | 'OTHER';

export interface SupportCase {
  caseId: string;
  openedBy: string;                // uid
  openedByRole: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  kind: SupportCaseKind;
  subjectCode: string;             // stable slug
  entityRef?: { kind: string; id: string };
  supportOwnerUid?: string;        // present once assigned
  waitingOnRole?: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  status: SupportCaseStatus;
  openedAt: number;
  updatedAt: number;
  closedAt?: number;
}

const TRANSITIONS: Record<SupportCaseStatus, SupportCaseStatus[]> = {
  OPEN:            ['ADMIN_ASSIGNED', 'RESOLVED'],
  ADMIN_ASSIGNED:  ['PENDING_ACTOR', 'RESOLVED'],
  PENDING_ACTOR:   ['ADMIN_ASSIGNED', 'RESOLVED'],
  RESOLVED:        ['CLOSED', 'ADMIN_ASSIGNED'],
  CLOSED:          [],
};

export function canTransition(from: SupportCaseStatus, to: SupportCaseStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type SupportOutcomeCode =
  | 'OPENED'
  | 'ASSIGNED'
  | 'AWAITING_ACTOR'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'ILLEGAL_TRANSITION'
  | 'ACTOR_NOT_PARTICIPANT'
  | 'ACTOR_NOT_ADMIN'
  | 'ACTOR_NOT_OPENER';

export interface OpenCaseInput {
  openedBy: string;
  openedByRole: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  kind: SupportCaseKind;
  subjectCode: string;
  entityRef?: { kind: string; id: string };
  now?: number;
}

export interface AssignInput {
  supportCase: SupportCase;
  actorUid: string;
  supportOwnerUid: string;
  now?: number;
}

export interface AwaitActorInput {
  supportCase: SupportCase;
  actorUid: string;
  waitingOnRole: 'CUSTOMER' | 'PROVIDER';
  now?: number;
}

export interface ResolveInput {
  supportCase: SupportCase;
  actorUid: string;
  now?: number;
}

export interface CloseInput {
  supportCase: SupportCase;
  actorUid: string;
  now?: number;
}

export interface SupportOutcome {
  code: SupportOutcomeCode;
  supportCase?: SupportCase;
}

function nowMs(now?: number): number { return now ?? Date.now(); }

function isParticipant(sc: SupportCase, uid: string): boolean {
  return uid === sc.openedBy || uid === sc.supportOwnerUid;
}

export function openSupportCase(input: OpenCaseInput): SupportOutcome {
  const t = nowMs(input.now);
  const sc: SupportCase = {
    caseId: `case_${crypto.randomBytes(6).toString('hex')}`,
    openedBy: input.openedBy,
    openedByRole: input.openedByRole,
    kind: input.kind,
    subjectCode: input.subjectCode,
    entityRef: input.entityRef,
    status: 'OPEN',
    openedAt: t,
    updatedAt: t,
  };
  return { code: 'OPENED', supportCase: sc };
}

export function assignSupportCase(input: AssignInput): SupportOutcome {
  // Only an admin can assign a case (self-assign or route to another
  // support owner). Customers and providers cannot.
  if (input.actorUid !== input.supportOwnerUid) return { code: 'ACTOR_NOT_ADMIN' };
  if (!canTransition(input.supportCase.status, 'ADMIN_ASSIGNED')) return { code: 'ILLEGAL_TRANSITION' };
  const next: SupportCase = {
    ...input.supportCase,
    status: 'ADMIN_ASSIGNED',
    supportOwnerUid: input.supportOwnerUid,
    updatedAt: nowMs(input.now),
  };
  return { code: 'ASSIGNED', supportCase: next };
}

export function awaitActor(input: AwaitActorInput): SupportOutcome {
  // Only the support owner can push a case back to PENDING_ACTOR.
  if (input.actorUid !== input.supportCase.supportOwnerUid) return { code: 'ACTOR_NOT_ADMIN' };
  if (!canTransition(input.supportCase.status, 'PENDING_ACTOR')) return { code: 'ILLEGAL_TRANSITION' };
  const next: SupportCase = {
    ...input.supportCase,
    status: 'PENDING_ACTOR',
    waitingOnRole: input.waitingOnRole,
    updatedAt: nowMs(input.now),
  };
  return { code: 'AWAITING_ACTOR', supportCase: next };
}

export function resolveSupportCase(input: ResolveInput): SupportOutcome {
  // Support owner OR opener can resolve. If the opener resolves, we
  // still record a supportOwnerUid if one is set (they may have
  // handled the case).
  if (!isParticipant(input.supportCase, input.actorUid)) return { code: 'ACTOR_NOT_PARTICIPANT' };
  if (!canTransition(input.supportCase.status, 'RESOLVED')) return { code: 'ILLEGAL_TRANSITION' };
  const next: SupportCase = {
    ...input.supportCase,
    status: 'RESOLVED',
    waitingOnRole: undefined,
    updatedAt: nowMs(input.now),
  };
  return { code: 'RESOLVED', supportCase: next };
}

export function closeSupportCase(input: CloseInput): SupportOutcome {
  // Only the opener may CLOSE (accepts the resolution). Admin cannot
  // close on behalf of the opener — that would defeat §14 per-party
  // evidence discipline applied to support closure.
  if (input.actorUid !== input.supportCase.openedBy) return { code: 'ACTOR_NOT_OPENER' };
  if (!canTransition(input.supportCase.status, 'CLOSED')) return { code: 'ILLEGAL_TRANSITION' };
  const t = nowMs(input.now);
  const next: SupportCase = {
    ...input.supportCase,
    status: 'CLOSED',
    closedAt: t,
    updatedAt: t,
  };
  return { code: 'CLOSED', supportCase: next };
}
