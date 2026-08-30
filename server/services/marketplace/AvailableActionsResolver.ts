/**
 * AvailableActionsResolver — CEO Action Brain Doctrine §40, §41, §42.
 *
 * Given an entity (booking / thread / order …), an authenticated actor,
 * and a workspace context, return the list of AvailableAction the
 * client should render. Availability is CONTEXTUAL — the same
 * actionType surfaces or hides based on state + participant + risk.
 *
 * The client does not guess. It calls e.g.
 *   GET /api/bookings/:id/actions
 * and renders whatever this resolver returned.
 *
 * All pure — no I/O. Callers provide the state they already looked up.
 */
import type {
  AvailableAction,
  ImpactSignals,
} from '../../../shared/marketplace/action';
import { resolveConfirmation } from '../../../shared/marketplace/action';
import {
  ACTION_CATALOG,
  getCatalogEntry,
} from '../../../shared/marketplace/actionCatalog';

// ── Booking availability ──────────────────────────────────────────────

export type BookingPhase =
  | 'DRAFT'
  | 'REQUESTED'
  | 'QUOTED'
  | 'ACCEPTED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export type PaymentPhase =
  | 'NOT_REQUIRED'
  | 'UNPAID'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'PARTIAL_REFUND'
  | 'REFUNDED'
  | 'FAILED';

export type BookingParticipant = 'BOOKER' | 'PROVIDER' | 'STAFF';

export interface BookingActionContext {
  participant: BookingParticipant;
  bookingPhase: BookingPhase;
  paymentPhase: PaymentPhase;
  hasExistingReview?: boolean;
  proposedChangePending?: boolean;
}

/**
 * Build a single AvailableAction from the catalog entry + runtime
 * enable/reason. Keeps risk + confirmation stamping in ONE place.
 */
function build(
  actionType: string,
  enabled: boolean,
  extras: Partial<AvailableAction> = {},
): AvailableAction | null {
  const entry = getCatalogEntry(actionType);
  if (!entry) return null;
  return {
    type: entry.actionType,
    enabled,
    riskLevel: entry.riskLevel,
    confirmationLevel: entry.confirmationLevel,
    ...extras,
  };
}

/**
 * The doctrine's booking availability matrix — one place, matches the
 * chatActions.ts availability rules (booking-scoped subset). Anything
 * that would surface in chat also surfaces here.
 */
export function bookingAvailableActions(ctx: BookingActionContext): AvailableAction[] {
  const results: AvailableAction[] = [];
  const isBooker = ctx.participant === 'BOOKER';
  const isProvider = ctx.participant === 'PROVIDER';

  // ACCEPT_BOOKING — provider only, only REQUESTED/QUOTED (§14.4 of catalog).
  if (isProvider) {
    const acceptEnabled =
      (ctx.bookingPhase === 'REQUESTED' || ctx.bookingPhase === 'QUOTED');
    if (acceptEnabled) {
      const a = build('BOOKING_ACCEPT', true, { requiresPreview: true });
      if (a) results.push(a);
    }
  }

  // DECLINE — provider only, same window.
  if (isProvider) {
    if (ctx.bookingPhase === 'REQUESTED' || ctx.bookingPhase === 'QUOTED') {
      const a = build('BOOKING_DECLINE', true);
      if (a) results.push(a);
    }
  }

  // PROPOSE CHANGE — provider only, CONFIRMED / IN_PROGRESS (or before
  // customer has accepted a quote).
  if (
    isProvider &&
    !ctx.proposedChangePending &&
    (ctx.bookingPhase === 'REQUESTED' ||
      ctx.bookingPhase === 'QUOTED' ||
      ctx.bookingPhase === 'CONFIRMED' ||
      ctx.bookingPhase === 'IN_PROGRESS')
  ) {
    const a = build('BOOKING_PROPOSE_CHANGE', true, { requiresPreview: true });
    if (a) results.push(a);
  }

  // ACCEPT PROPOSED CHANGE — booker only, when there is a pending change.
  if (isBooker && ctx.proposedChangePending) {
    const a = build('BOOKING_ACCEPT_PROPOSED_CHANGE', true, { requiresPreview: true });
    if (a) results.push(a);
  }

  // ADD PET — actor-specific split (§CEO §9). Customer REQUESTS,
  // provider PROPOSES (from on-site discovery). The OTHER party
  // accepts/declines the resulting proposal — neither side ever
  // mutates the booking party directly.
  if (ctx.bookingPhase === 'CONFIRMED' || ctx.bookingPhase === 'IN_PROGRESS') {
    if (isBooker) {
      const req = build('CUSTOMER_REQUEST_ADD_PET', true, { requiresPreview: true });
      if (req) results.push(req);
    }
    if (isProvider) {
      const prop = build('PROVIDER_PROPOSE_ADD_PET', true, { requiresPreview: true });
      if (prop) results.push(prop);
    }
  }

  // EXTEND — actor-specific split (§CEO §10). Same pattern.
  if (ctx.bookingPhase === 'CONFIRMED' || ctx.bookingPhase === 'IN_PROGRESS') {
    if (isBooker) {
      const req = build('CUSTOMER_REQUEST_EXTENSION', true, { requiresPreview: true });
      if (req) results.push(req);
    }
    if (isProvider) {
      const prop = build('PROVIDER_PROPOSE_EXTENSION', true, { requiresPreview: true });
      if (prop) results.push(prop);
    }
  }

  // CANCEL — actor-specific intent (§CEO §8). Consequences differ per
  // actor; the doctrine forbids one boolean handling both.
  const cancelable =
    ctx.bookingPhase === 'REQUESTED' ||
    ctx.bookingPhase === 'QUOTED' ||
    ctx.bookingPhase === 'ACCEPTED' ||
    ctx.bookingPhase === 'CONFIRMED' ||
    ctx.bookingPhase === 'IN_PROGRESS';
  if (cancelable) {
    if (isBooker) {
      const paid =
        ctx.paymentPhase === 'AUTHORIZED' ||
        ctx.paymentPhase === 'PAID' ||
        ctx.paymentPhase === 'PARTIAL_REFUND';
      const cancelType = paid ? 'CUSTOMER_CANCEL_BOOKING_PAID' : 'CUSTOMER_CANCEL_BOOKING_UNPAID';
      const c = build(cancelType, true, { requiresPreview: paid });
      if (c) results.push(c);
    }
    if (isProvider) {
      const c = build('PROVIDER_CANCEL_BOOKING', true, { requiresPreview: true });
      if (c) results.push(c);
    }
  }

  // START JOB — provider only, only CONFIRMED (not ACCEPTED — payment
  // must have completed).
  if (isProvider && ctx.bookingPhase === 'CONFIRMED') {
    const s = build('BOOKING_START_JOB', true);
    if (s) results.push(s);
  }

  // COMPLETE JOB — provider only, IN_PROGRESS.
  if (isProvider && ctx.bookingPhase === 'IN_PROGRESS') {
    const c = build('BOOKING_COMPLETE_JOB', true, { requiresPreview: true });
    if (c) results.push(c);
  }

  // HANDOFF / RETURN — verified-code handshake (§CEO §11).
  // Provider ISSUES the handoff code; owner VERIFIES with it.
  // At return, owner ISSUES the return code; provider VERIFIES.
  // No boolean "I got the dog" click.
  if (ctx.bookingPhase === 'CONFIRMED' || ctx.bookingPhase === 'IN_PROGRESS') {
    if (isProvider) {
      const h = build('HANDOFF_ISSUE_CODE', true, { requiresPreview: true });
      if (h) results.push(h);
    }
    if (isBooker) {
      const h = build('HANDOFF_VERIFY_CODE', true, { requiresPreview: true });
      if (h) results.push(h);
    }
  }
  if (ctx.bookingPhase === 'IN_PROGRESS') {
    if (isBooker) {
      const r = build('RETURN_ISSUE_CODE', true, { requiresPreview: true });
      if (r) results.push(r);
    }
    if (isProvider) {
      const r = build('RETURN_VERIFY_CODE', true, { requiresPreview: true });
      if (r) results.push(r);
    }
  }

  // REVIEW — booker only, COMPLETED, no existing review.
  if (isBooker && ctx.bookingPhase === 'COMPLETED' && !ctx.hasExistingReview) {
    const r = build('BOOKING_REVIEW_SUBMIT', true);
    if (r) results.push(r);
  }

  // Support + call always available where policy allows.
  const support = build('SUPPORT_CONTACT_OPEN', true);
  if (support) results.push(support);

  return results;
}

/**
 * Sanity-check contract: for a given actionType, verify the runtime
 * ImpactSignals resolve to the confirmation level the catalog declared.
 * A drift here means either the catalog is wrong OR the caller passed
 * wrong impact signals.
 *
 * Used by pre-commit hooks / staging checks to catch a rogue REAUTH
 * downgrade before it ships.
 */
export function confirmationMatchesCatalog(
  actionType: string,
  impact: ImpactSignals,
): boolean {
  const entry = getCatalogEntry(actionType);
  if (!entry) return false;
  const resolved = resolveConfirmation(entry.riskLevel, impact);
  return resolved === entry.confirmationLevel;
}

/** Number of catalog entries per domain — used by dashboards / health checks. */
export function catalogCoverage(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of ACTION_CATALOG) {
    out[e.domain] = (out[e.domain] || 0) + 1;
  }
  return out;
}

// ── Meet & Greet availability (integrity doctrine §4) ─────────────────

export type MeetGreetPhase = 'PROPOSED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type MeetGreetParticipant = 'CUSTOMER' | 'PROVIDER' | 'STAFF';

export interface MeetGreetActionContext {
  participant: MeetGreetParticipant;
  phase: MeetGreetPhase;
  bothPartiesAcknowledged: boolean;
}

export function meetGreetAvailableActions(ctx: MeetGreetActionContext): AvailableAction[] {
  const list: AvailableAction[] = [];
  const isProvider = ctx.participant === 'PROVIDER';
  const isCustomer = ctx.participant === 'CUSTOMER';

  // ACCEPT — provider only, PROPOSED only, AND both parties must have
  // acknowledged the "keep on PetWash" wording first (integrity §6).
  if (isProvider && ctx.phase === 'PROPOSED' && ctx.bothPartiesAcknowledged) {
    const a = build('MEET_GREET_ACCEPT', true, { requiresPreview: true });
    if (a) list.push(a);
  }

  // If proposed but acknowledgements missing, surface the ACK action so
  // both parties can complete the gate without leaving the surface.
  if (ctx.phase === 'PROPOSED' && !ctx.bothPartiesAcknowledged) {
    const ack = build('MEET_GREET_ACKNOWLEDGE', true, { requiresPreview: true });
    if (ack) list.push(ack);
  }

  // Suggest a different time — provider only, PROPOSED (the counter-proposal
  // path). Not surfaced after CONFIRMED (use booking reschedule instead).
  if (isProvider && ctx.phase === 'PROPOSED') {
    const s = build('MEET_GREET_SUGGEST_TIME', true, { requiresPreview: true });
    if (s) list.push(s);
  }

  // Decline — either party, PROPOSED.
  if (ctx.phase === 'PROPOSED') {
    const d = build('MEET_GREET_DECLINE', true);
    if (d) list.push(d);
  }

  // Complete — either party, CONFIRMED.
  if (ctx.phase === 'CONFIRMED') {
    const c = build('MEET_GREET_COMPLETE', true);
    if (c) list.push(c);
  }

  // Book — CUSTOMER only, COMPLETED (fast rebook after Meet & Greet).
  if (isCustomer && ctx.phase === 'COMPLETED') {
    const b = build('BOOKING_REQUEST_SUBMIT', true, { requiresPreview: true });
    if (b) list.push(b);
  }

  // Support / report — always available while thread exists.
  const s = build('SUPPORT_CONTACT_OPEN', true);
  if (s) list.push(s);

  return list;
}

// ── Prestige availability (integrity §14) ─────────────────────────────

export type PrestigeStatus = 'NONE' | 'ACTIVE' | 'CANCELLED';

export interface PrestigeActionContext {
  status: PrestigeStatus;
  hasVerifiedEmail: boolean;
  hasVerifiedMobile: boolean;
}

export function prestigeAvailableActions(ctx: PrestigeActionContext): AvailableAction[] {
  const list: AvailableAction[] = [];

  // JOIN — signed-in customer, not-active, base contact verified.
  // The reason code surfaces WHY when disabled so the UI can explain.
  if (ctx.status !== 'ACTIVE') {
    const enabled = ctx.hasVerifiedEmail && ctx.hasVerifiedMobile;
    const j = build('PRESTIGE_JOIN', enabled, {
      requiresPreview: true,
      reasonCode: enabled ? undefined : 'CONSENT_REQUIRED',
    });
    if (j) list.push(j);
  }

  // Prestige cancel is POLICY_NOT_CONFIGURED (CEO §19, §20). Do NOT
  // surface an invented cancel action until points/tier/wallet/marketing
  // consequences are approved. See businessDecisionRegistry.

  return list;
}

// ── Provider Application availability (business doctrine §17.7) ───────

export type ProviderApplicationPhase =
  | 'NOT_STARTED'
  | 'DRAFT'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface ProviderApplicationActionContext {
  participant: 'APPLICANT' | 'STAFF';
  phase: ProviderApplicationPhase;
  hasAcceptedActiveAgreement: boolean;
  missingChecklistItems: number;
}

export function providerApplicationAvailableActions(
  ctx: ProviderApplicationActionContext,
): AvailableAction[] {
  const list: AvailableAction[] = [];
  const isApplicant = ctx.participant === 'APPLICANT';

  // Save draft — any pre-submit phase.
  if (isApplicant && (ctx.phase === 'DRAFT' || ctx.phase === 'NOT_STARTED' || ctx.phase === 'CHANGES_REQUESTED')) {
    const s = build('PROVIDER_APPLICATION_SAVE_DRAFT', true);
    if (s) list.push(s);
  }

  // Add / remove services — pre-submit.
  if (isApplicant && (ctx.phase === 'DRAFT' || ctx.phase === 'READY_TO_SUBMIT')) {
    const add = build('PROVIDER_APPLICATION_ADD_SERVICE', true, { requiresPreview: true });
    if (add) list.push(add);
    const rm = build('PROVIDER_APPLICATION_REMOVE_SERVICE', true);
    if (rm) list.push(rm);
  }

  // Upload ID — always allowed pre-submit + on CHANGES_REQUESTED (reviewer asked for a fix).
  if (isApplicant && ['DRAFT', 'READY_TO_SUBMIT', 'CHANGES_REQUESTED'].includes(ctx.phase)) {
    const u = build('PROVIDER_APPLICATION_UPLOAD_ID', true, { requiresPreview: true });
    if (u) list.push(u);
  }

  // Accept agreement — before Submit, applicant must accept the ACTIVE version.
  if (isApplicant && !ctx.hasAcceptedActiveAgreement && ctx.phase !== 'APPROVED') {
    const ag = build('PROVIDER_AGREEMENT_ACCEPT', true, { requiresPreview: true });
    if (ag) list.push(ag);
  }

  // Submit — READY_TO_SUBMIT, no missing items, agreement accepted.
  if (isApplicant && ctx.phase === 'READY_TO_SUBMIT') {
    const canSubmit = ctx.hasAcceptedActiveAgreement && ctx.missingChecklistItems === 0;
    const s = build('PROVIDER_APPLICATION_SUBMIT', canSubmit, {
      requiresPreview: true,
      reasonCode: canSubmit
        ? undefined
        : ctx.hasAcceptedActiveAgreement
          ? 'CONSENT_REQUIRED'
          : 'AGREEMENT_REACCEPTANCE_REQUIRED',
    });
    if (s) list.push(s);
  }

  // Withdraw — any post-submit non-terminal phase.
  if (isApplicant && ['SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED'].includes(ctx.phase)) {
    const w = build('PROVIDER_APPLICATION_WITHDRAW', true, { requiresPreview: true });
    if (w) list.push(w);
  }

  // Support always.
  const sup = build('SUPPORT_CONTACT_OPEN', true);
  if (sup) list.push(sup);

  return list;
}
