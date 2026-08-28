/**
 * JobPassport allowed-action projection — CEO 2026-08-27 §23, §70.
 *
 * The server owns the allowed-action list. The client does NOT
 * maintain a parallel status → button map. At each state, ONE primary
 * action is enabled (Uber's "THIS is your task" pattern) and the rest
 * are either disabled placeholders (WAIT_FOR_*) or secondary
 * (message / view_details).
 *
 * Pure function of (platform, bookingState, fulfillmentState,
 * moneyState, viewer). No DB reads. No side effects. Deterministic —
 * safe to call from tests.
 */

import type {
  ActionCode,
  AllowedAction,
  BookingState,
  FulfillmentState,
  MoneyState,
  VerificationMethod,
} from '@shared/lib/jobPassport/JobPassport';
import type { ActorIdentity } from '@shared/lib/jobPassport/actorRegistry';
import type { PlatformCode } from '@shared/lib/jobPassport/platformRegistry';

export interface AllowedActionsInput {
  platform: PlatformCode;
  bookingState: BookingState;
  fulfillmentState: FulfillmentState;
  moneyState: MoneyState;
  viewer: ActorIdentity;
  isOwner: boolean;
  isFulfiller: boolean;
}

/** Compose the allowed-action list for one viewer of one job. */
export function composeAllowedActions(input: AllowedActionsInput): AllowedAction[] {
  const { viewer, isOwner, isFulfiller } = input;

  // Admin sees a full inspection view — no operational actions. Admin
  // actions live in the admin transaction explorer (§64), not on the
  // customer / provider passport.
  if (viewer.kind === 'PETWASH_STAFF' && !isOwner && !isFulfiller) {
    return [detailsAction()];
  }

  // Customer view.
  if (isOwner) return customerActions(input);
  // Provider / fulfiller view.
  if (isFulfiller) return fulfillerActions(input);
  // Unknown viewer — should never reach here (composer returns null
  // for non-participants) but return safe empty list defensively.
  return [];
}

// ─── Customer ────────────────────────────────────────────────────────

function customerActions(input: AllowedActionsInput): AllowedAction[] {
  const { bookingState, fulfillmentState, moneyState } = input;

  // Payment first — a customer with an outstanding balance sees PAY
  // as the only primary action.
  if (moneyState === 'PAYMENT_REQUIRED') {
    return [
      pay(),
      cancel(),
      messageAction(),
      detailsAction(),
    ];
  }
  if (moneyState === 'PAYMENT_PENDING') {
    return [
      wait('WAIT_FOR_PAYMENT', 'Payment confirming'),
      messageAction(),
      detailsAction(),
    ];
  }

  // From REQUESTED → CONFIRMED (waiting on provider).
  if (bookingState === 'REQUESTED') {
    return [
      wait('WAIT_FOR_PROVIDER', 'Waiting for provider'),
      cancel(),
      messageAction(),
      detailsAction(),
    ];
  }

  // CONFIRMED + waiting to start.
  if (bookingState === 'CONFIRMED' && fulfillmentState === 'NOT_STARTED') {
    return [
      messageAction(),
      detailsAction(),
    ];
  }

  // Service running — customer tracks.
  if (fulfillmentState === 'IN_PROGRESS') {
    return [
      track(input),
      messageAction(),
      detailsAction(),
    ];
  }

  // Provider marked complete — customer confirms.
  if (fulfillmentState === 'PROVIDER_COMPLETED') {
    return [
      confirmCompletion(),
      messageAction(),
      detailsAction(),
    ];
  }

  // Customer confirmed / booking completed — review.
  if (fulfillmentState === 'CUSTOMER_CONFIRMED' || bookingState === 'COMPLETED') {
    return [
      review(),
      detailsAction(),
    ];
  }

  // Cancelled — no primary action.
  if (bookingState === 'CANCELLED') {
    return [detailsAction()];
  }

  return [detailsAction()];
}

// ─── Fulfiller (provider / merchant / machine-supervisor) ────────────

function fulfillerActions(input: AllowedActionsInput): AllowedAction[] {
  const { bookingState, fulfillmentState, moneyState, platform } = input;

  // Request stage — provider decides.
  if (bookingState === 'REQUESTED') {
    return [
      respond(),
      messageAction(),
      detailsAction(),
    ];
  }

  // Payment must land before start where the platform requires it.
  // §53 cross-check: even if the DB says confirmed, if the money
  // authority says payment pending we surface WAIT_FOR_PAYMENT.
  if (moneyState === 'PAYMENT_PENDING' || moneyState === 'PAYMENT_REQUIRED') {
    return [
      wait('WAIT_FOR_PAYMENT', 'Waiting for customer payment'),
      messageAction(),
      detailsAction(),
    ];
  }

  // Ready to start.
  if (bookingState === 'CONFIRMED' && fulfillmentState === 'NOT_STARTED') {
    return [
      startService(platform),
      messageAction(),
      detailsAction(),
    ];
  }

  // In progress — provider finishes.
  if (fulfillmentState === 'IN_PROGRESS') {
    return [
      finishService(),
      messageAction(),
      detailsAction(),
    ];
  }

  // Provider marked complete → waiting on customer confirmation.
  if (fulfillmentState === 'PROVIDER_COMPLETED') {
    return [
      wait('WAIT_FOR_CUSTOMER', 'Waiting for customer confirmation'),
      messageAction(),
      detailsAction(),
    ];
  }

  // Terminal states.
  if (fulfillmentState === 'CUSTOMER_CONFIRMED' || bookingState === 'COMPLETED') {
    return [detailsAction()];
  }
  if (bookingState === 'CANCELLED') {
    return [detailsAction()];
  }

  return [detailsAction()];
}

// ─── Action builders ─────────────────────────────────────────────────

function pay(): AllowedAction {
  return {
    code: 'PAY',
    enabled: true,
    requiresVerification: false,
    label: 'Pay to confirm',
  };
}
function cancel(): AllowedAction {
  return {
    code: 'CANCEL',
    enabled: true,
    requiresVerification: false,
    label: 'Cancel',
  };
}
function messageAction(): AllowedAction {
  return {
    code: 'MESSAGE',
    enabled: true,
    requiresVerification: false,
    label: 'Message',
  };
}
function detailsAction(): AllowedAction {
  return {
    code: 'VIEW_DETAILS',
    enabled: true,
    requiresVerification: false,
    label: 'Details',
  };
}
function track(input: AllowedActionsInput): AllowedAction {
  return {
    code: 'TRACK',
    enabled: input.platform === 'WALK_MY_PET' || input.platform === 'PETTREK',
    requiresVerification: false,
    label: 'Track',
  };
}
function confirmCompletion(): AllowedAction {
  return {
    code: 'CONFIRM_COMPLETION',
    enabled: true,
    requiresVerification: true,
    verificationMethod: 'CUSTOMER_CONFIRMATION',
    label: 'Confirm completion',
  };
}
function review(): AllowedAction {
  return {
    code: 'REVIEW',
    enabled: true,
    requiresVerification: false,
    label: 'Leave a review',
  };
}
function respond(): AllowedAction {
  return {
    code: 'RESPOND',
    enabled: true,
    requiresVerification: false,
    label: 'Accept or decline',
  };
}
function startService(platform: PlatformCode): AllowedAction {
  // Verification method depends on the platform's completionProof —
  // the composer picks a reasonable default; verification-policy
  // registry (§45) will refine per action later.
  const method: VerificationMethod =
    platform === 'WALK_MY_PET' || platform === 'PETTREK' ? 'PIN' : 'SERVER_STATE';
  return {
    code: 'START_SERVICE',
    enabled: true,
    requiresVerification: method !== 'SERVER_STATE',
    verificationMethod: method,
    label: 'Slide to start',
  };
}
function finishService(): AllowedAction {
  return {
    code: 'FINISH_SERVICE',
    enabled: true,
    requiresVerification: true,
    verificationMethod: 'SERVER_STATE',
    label: 'Slide to finish',
  };
}
function wait(code: Extract<ActionCode, 'WAIT_FOR_PAYMENT' | 'WAIT_FOR_PROVIDER' | 'WAIT_FOR_CUSTOMER'>, hint: string): AllowedAction {
  return {
    code,
    enabled: false,
    requiresVerification: false,
    label: hint,
    hint,
  };
}
