/**
 * ActionConfirmationPolicy — CEO PROGRAM 39 (No Confirmation Fatigue).
 *
 * Pure evaluator. Given the ActionCatalog slug + rough context,
 * decides which confirmation UX the client should apply BEFORE
 * invoking the Action Brain execute pipeline.
 *
 * Doctrine rules the evaluator encodes:
 *   Navigation                    → NONE
 *   Favourite / minor toggle      → INSTANT + UNDO
 *   Call provider (masked)        → INSTANT
 *   Normal chat message           → INSTANT
 *   Send booking request          → REVIEW
 *   Accept incoming booking       → REVIEW
 *   Accept revised price          → EXPLICIT
 *   Paid cancellation             → MONEY_PREVIEW
 *   Change bank / payout account  → REAUTH
 *   Delete account                → REAUTH + EXPLICIT
 *
 * The evaluator NEVER decides for actions it doesn't know about —
 * unknown slugs return `UNKNOWN` and the caller must not proceed
 * with any silent default (§72 discipline).
 */

export type ConfirmationLevel =
  /** Just do it — navigation, no side effect. */
  | 'NONE'
  /** Do it and show an Undo toast for a short window. */
  | 'INSTANT_WITH_UNDO'
  /** Do it immediately, no undo. */
  | 'INSTANT'
  /** Show a review sheet before executing. */
  | 'REVIEW'
  /** Show a review sheet AND require an explicit checkbox / re-tap. */
  | 'EXPLICIT'
  /** Show a full money preview (fees, refund, funding legs). */
  | 'MONEY_PREVIEW'
  /** Require a recent-reauth challenge before executing. */
  | 'REAUTH'
  /** Reauth AND explicit confirmation. */
  | 'REAUTH_AND_EXPLICIT'
  /** No policy encoded for this action — caller must NOT default. */
  | 'UNKNOWN';

export interface ActionContext {
  /** True if the action MOVES money out of the actor's wallet or card. */
  movesMoney?: boolean;
  /** True if the action mutates an already-CONFIRMED booking. */
  mutatesConfirmedBooking?: boolean;
  /** True if the action is on the account-security surface. */
  isAccountSecurityAction?: boolean;
}

const POLICY: Record<string, ConfirmationLevel> = {
  // Navigation
  VIEW_BOOKING:                       'NONE',
  VIEW_ORDER:                         'NONE',
  VIEW_REFUND_STATUS:                 'NONE',
  VIEW_PROVIDER:                      'NONE',
  VIEW_SUPPORT_CASE:                  'NONE',
  VIEW_APPLICATION_STATUS:            'NONE',
  VIEW_PRESTIGE_BENEFITS:             'NONE',
  VIEW_PET_PROFILE:                   'NONE',
  VIEW_PAYMENT_STATUS:                'NONE',
  VIEW_TOPUP_STATUS:                  'NONE',
  VIEW_WALLET_BALANCE:                'NONE',
  VIEW_STATION_SESSION:               'NONE',
  VIEW_RECEIPT:                       'NONE',
  VIEW_PICKUP_DETAILS:                'NONE',
  VIEW_PAYOUT:                        'NONE',
  VIEW_PAYOUT_STATUS:                 'NONE',

  // Instant + Undo
  FAVOURITE_PROVIDER:                 'INSTANT_WITH_UNDO',
  UNFAVOURITE_PROVIDER:               'INSTANT_WITH_UNDO',
  DISMISS_ATTENTION_ITEM:             'INSTANT_WITH_UNDO',
  MARK_MESSAGE_READ:                  'INSTANT_WITH_UNDO',

  // Instant
  CALL_PROVIDER_MASKED:               'INSTANT',
  CALL_OWNER_MASKED:                  'INSTANT',
  SEND_MESSAGE:                       'INSTANT',
  RESPOND_SUPPORT_CASE:               'INSTANT',
  RESPOND_TO_MESSAGE:                 'INSTANT',
  START_NEW_TOPUP:                    'INSTANT',

  // Review
  SEND_BOOKING_REQUEST:               'REVIEW',
  BOOKING_ACCEPT:                     'REVIEW',
  BOOKING_DECLINE:                    'REVIEW',
  PROVIDER_APPLICATION_SUBMIT:        'REVIEW',
  PROVIDER_APPLICATION_CONTINUE:      'REVIEW',
  PRESTIGE_JOIN:                      'REVIEW',
  UPLOAD_KYC_DOCUMENT:                'REVIEW',
  REDEEM_GIFT:                        'REVIEW',
  CLOSE_SUPPORT_CASE:                 'REVIEW',
  UPDATE_PET_PROFILE:                 'REVIEW',
  REVIEW_PET_PROFILE:                 'REVIEW',

  // Explicit (checkbox / re-tap)
  ACCEPT_REVISED_PRICE:               'EXPLICIT',
  ACCEPT_PROPOSAL:                    'EXPLICIT',
  BOOKING_MODIFICATION_ACCEPT:        'EXPLICIT',
  RATE_COMPLETED_SERVICE:             'EXPLICIT',

  // Money preview
  CUSTOMER_CANCEL_BOOKING_PAID:       'MONEY_PREVIEW',
  PROVIDER_CANCEL_CONFIRMED_BOOKING:  'MONEY_PREVIEW',
  BOOKING_MODIFICATION_PROPOSE_EXTEND: 'MONEY_PREVIEW',

  // Reauth
  UPDATE_PAYOUT_ACCOUNT:              'REAUTH',
  UPDATE_BANK_ACCOUNT:                'REAUTH',
  ENROLL_PASSKEY:                     'REAUTH',

  // Reauth + Explicit
  DELETE_ACCOUNT:                     'REAUTH_AND_EXPLICIT',
};

export function policyFor(actionType: string, ctx: ActionContext = {}): ConfirmationLevel {
  const known = POLICY[actionType];
  if (known) return known;
  // Fallback discipline (§72): if the action moves money OR mutates a
  // confirmed booking OR touches account-security, refuse a silent
  // default and demand caller escalation.
  if (ctx.movesMoney || ctx.mutatesConfirmedBooking || ctx.isAccountSecurityAction) {
    return 'UNKNOWN';
  }
  return 'UNKNOWN';
}

/** Utility: whether a decision level is user-blocking (needs interaction). */
export function isBlocking(level: ConfirmationLevel): boolean {
  return level === 'REVIEW'
    || level === 'EXPLICIT'
    || level === 'MONEY_PREVIEW'
    || level === 'REAUTH'
    || level === 'REAUTH_AND_EXPLICIT';
}
