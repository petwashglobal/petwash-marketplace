/**
 * JourneyState — CEO DEEP-LOGIC §84-§87.
 *
 * The doctrine's canonical READ projection for an actor + entity
 * pair. This is NOT a source of truth — it is the shape the brain
 * (AvailableActions resolver, AttentionFeed composer, AI Concierge)
 * uses to explain "what is going on with this booking / order /
 * gift right now, from this actor's point of view".
 *
 * The same entity produces DIFFERENT JourneyStates for different
 * actors (§86): a booking in state PROVIDER_PROPOSED_CHANGE tells
 * the customer "review the change" and the provider "wait for
 * customer".
 *
 * Design constraints:
 *   • Every field is designed to be COMPUTED from durable state —
 *     no writes required to produce a JourneyState.
 *   • Every string that reaches the client is a stable slug the UI
 *     translates. Do NOT put localised text in JourneyState.
 *   • Money is always cents + currency + label slug; formatting
 *     stays in the presentation layer.
 *   • Deadlines are ISO strings so the client can sort and compare.
 *   • No PII leaks — actor references are safe (own uid) or masked.
 *
 * See §85 for the AI Concierge contract: the AI receives an
 * authorised JourneyState and can answer "can I cancel?" without
 * ever seeing raw tables.
 */

/** Who is looking at the entity right now. */
export type JourneyActorRole =
  | 'CUSTOMER'
  | 'PROVIDER'
  | 'SUPPORT'
  | 'ADMIN'
  | 'SYSTEM';

/** Who the entity is currently waiting on (§71). */
export type WaitingParty =
  | 'CUSTOMER'
  | 'PROVIDER'
  | 'PETWASH'
  | 'PAYMENT_PROVIDER'
  | 'ADMIN'
  | 'SYSTEM'
  | 'NONE';

/**
 * Obligation type (§69). What the actor owes on this entity — not
 * "what button is enabled" but "what does the actor OWE" so the
 * brain can rank attention by consequence.
 */
export type ObligationType =
  | 'PAY'
  | 'ACCEPT_QUOTE'
  | 'REVIEW_PROPOSED_CHANGE'
  | 'ISSUE_HANDOFF_CODE'
  | 'VERIFY_HANDOFF_CODE'
  | 'RATE_COMPLETED_SERVICE'
  | 'UPLOAD_KYC_DOCUMENT'
  | 'RESPOND_TO_PROVIDER_REQUEST'
  | 'RESPOND_TO_MESSAGE'
  | 'CONFIRM_ATTENDANCE'
  | 'WAIT'
  | 'NONE';

/** Whether the obligation is REQUIRED (deadline-bearing) or OPTIONAL. */
export type ObligationSeverity = 'REQUIRED' | 'OPTIONAL' | 'INFORMATIONAL';

export interface Obligation {
  type: ObligationType;
  severity: ObligationSeverity;
  reasonCode: string;                       // stable slug the UI translates
  dueAt?: string;                            // ISO
  expiresAt?: string;                        // ISO
}

/**
 * Blocker (§72). Something the actor CANNOT do right now, and why.
 * Used so the UI can say "Update availability before accepting"
 * instead of showing a mysterious disabled button.
 */
export interface Blocker {
  action: string;                           // ActionCatalog slug
  reasonCode: string;                       // stable slug
  requirement?: {
    type: string;                           // e.g. 'UPDATE_AVAILABILITY'
    entityRef?: { kind: string; id: string };
  };
}

/**
 * Deadline (§70). A UI-orderable time-bound obligation.
 */
export interface Deadline {
  reasonCode: string;
  dueAt: string;                            // ISO
  hardCutoff: boolean;                       // true if missing it cancels/loses
}

/**
 * Money state (§43, §69). Never a raw number without label.
 */
export interface MoneyState {
  amountCents: number;
  currency: 'ILS';
  labelCode: string;                        // e.g. 'AMOUNT_DUE' | 'AMOUNT_YOU_WILL_RECEIVE'
  paymentStatusCode?: string;               // stable slug the UI translates
}

export type CommunicationStatusCode =
  | 'OPEN'
  | 'READ_ONLY'
  | 'ARCHIVED'
  | 'NO_THREAD_YET';

export interface CommunicationState {
  status: CommunicationStatusCode;
  unreadCount: number;
  threadRef?: { kind: string; id: string };
}

export type DocumentStatusCode =
  | 'READY'
  | 'PENDING'
  | 'REDACTED'
  | 'EXPIRED'
  | 'NONE';

export interface DocumentState {
  status: DocumentStatusCode;
  documentRefs: Array<{ kind: string; id: string }>;
}

/**
 * The action the brain thinks the actor should take next. Always a
 * catalog slug the client resolves — never a rendered string.
 */
export interface RecommendedAction {
  actionType: string;                       // ActionCatalog slug
  reasonCode: string;                       // why the brain chose it
}

/**
 * Available action shape (§82-§83). Enabled → OK. Disabled → carries
 * the blocker so the UI can explain WHY.
 */
export interface AvailableAction {
  actionType: string;
  enabled: boolean;
  reasonCode?: string;
  blocker?: Blocker;
}

/**
 * Attention priority (§74) — what class of nudge this entity is at.
 * URGENT beats HIGH beats MEDIUM beats INFO. Marketing NEVER outranks
 * a REQUIRED obligation (§75); the brain surfaces this so the client
 * can enforce that discipline.
 */
export type JourneyPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'INFO' | 'NONE';

/**
 * The main JourneyState DTO.
 */
export interface JourneyState {
  entityRef: { kind: string; id: string };

  actor: {
    role: JourneyActorRole;
    uid?: string;                           // omitted when actor is SYSTEM
  };

  currentStateCode: string;                 // stable slug the UI translates
  currentStateLabelCode?: string;           // optional short slug

  waitingOn: WaitingParty;
  obligations: Obligation[];
  blockers: Blocker[];
  availableActions: AvailableAction[];
  primaryAction?: RecommendedAction;

  deadlines: Deadline[];
  money?: MoneyState;
  communication?: CommunicationState;
  documents?: DocumentState;

  attentionPriority: JourneyPriority;

  lastMeaningfulEventAt?: string;           // ISO
  nextExpectedEventCode?: string;
}

// ── Constructors + guards ─────────────────────────────────────────

/**
 * An empty JourneyState — used as the safe default when a resolver
 * cannot yet compute the full shape. Callers should NEVER pretend
 * to know `waitingOn` or `primaryAction` if the resolver returns
 * empty; the doctrine's §72 discipline is "when in doubt, block".
 */
export function emptyJourneyState(
  entityRef: JourneyState['entityRef'],
  actor: JourneyState['actor'],
  currentStateCode: string,
): JourneyState {
  return {
    entityRef,
    actor,
    currentStateCode,
    waitingOn: 'NONE',
    obligations: [],
    blockers: [],
    availableActions: [],
    deadlines: [],
    attentionPriority: 'NONE',
  };
}

/** §75 — marketing/attention must never outrank a REQUIRED obligation. */
export function hasRequiredObligation(js: JourneyState): boolean {
  return js.obligations.some((o) => o.severity === 'REQUIRED');
}
