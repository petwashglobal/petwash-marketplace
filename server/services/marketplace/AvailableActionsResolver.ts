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

  // ADD PET / EXTEND — either party, during CONFIRMED or IN_PROGRESS
  // (structured change per doctrine §32–§34, both catalogued as REVIEW_SCREEN).
  if (ctx.bookingPhase === 'CONFIRMED' || ctx.bookingPhase === 'IN_PROGRESS') {
    const addPet = build('BOOKING_ADD_PET', true, { requiresPreview: true });
    if (addPet) results.push(addPet);
    const extend = build('BOOKING_EXTEND', true, { requiresPreview: true });
    if (extend) results.push(extend);
  }

  // CANCEL — either party, active phases only. UNPAID vs PAID variants
  // differ in the catalog by risk + confirmation.
  const cancelable =
    ctx.bookingPhase === 'REQUESTED' ||
    ctx.bookingPhase === 'QUOTED' ||
    ctx.bookingPhase === 'ACCEPTED' ||
    ctx.bookingPhase === 'CONFIRMED' ||
    ctx.bookingPhase === 'IN_PROGRESS';
  if (cancelable) {
    const paid =
      ctx.paymentPhase === 'AUTHORIZED' ||
      ctx.paymentPhase === 'PAID' ||
      ctx.paymentPhase === 'PARTIAL_REFUND';
    const cancelType = paid ? 'BOOKING_CANCEL_PAID' : 'BOOKING_CANCEL_UNPAID';
    const c = build(cancelType, true, { requiresPreview: paid });
    if (c) results.push(c);
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

  // HANDOFF / RETURN — either party during the appropriate window.
  if (ctx.bookingPhase === 'CONFIRMED' || ctx.bookingPhase === 'IN_PROGRESS') {
    const h = build('BOOKING_PET_HANDOFF', true, { requiresPreview: true });
    if (h) results.push(h);
  }
  if (ctx.bookingPhase === 'IN_PROGRESS') {
    const r = build('BOOKING_PET_RETURN', true, { requiresPreview: true });
    if (r) results.push(r);
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
