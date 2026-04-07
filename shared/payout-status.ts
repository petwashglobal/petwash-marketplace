/**
 * Canonical Payout Status Vocabulary
 *
 * Single source of truth for all booking payout states across:
 *   bookings.payout_status
 *   booking_requests.payout_status
 *   sitter_bookings.payout_status
 *   walk_bookings.payout_status
 *   trainer_bookings.payout_status
 *   super_app_payouts.status
 *
 * Import from here everywhere — never hard-code these strings inline.
 * This prevents "completed", "released", "paid" or any other alias from
 * drifting back into booking payout code.
 *
 * Contractor-ledger tables (provider_payout_entries.status,
 * contractor_earnings.payoutStatus) have their own vocabulary
 * (earned / held / paid / clawed_back / in_escrow / released) and
 * must NOT be mixed with these booking payout states.
 */

// ── Booking payout status enum ────────────────────────────────────────────────

/** Money has not yet been released from escrow. Initial state. */
export const PAYOUT_PENDING          = 'pending'           as const;

/** Escrow released; bank transfer queued but not confirmed. */
export const PAYOUT_PENDING_TRANSFER = 'pending_transfer'  as const;

/** Bank transfer confirmed. Provider has been paid. */
export const PAYOUT_PAID_OUT         = 'paid_out'          as const;

/** Transfer failed. Needs ops/finance review. */
export const PAYOUT_FAILED           = 'failed'            as const;

/** Union type for all valid booking payout states. */
export type BookingPayoutStatus =
  | typeof PAYOUT_PENDING
  | typeof PAYOUT_PENDING_TRANSFER
  | typeof PAYOUT_PAID_OUT
  | typeof PAYOUT_FAILED;

/** Ordered array for iteration and validation. */
export const BOOKING_PAYOUT_STATUSES: readonly BookingPayoutStatus[] = [
  PAYOUT_PENDING,
  PAYOUT_PENDING_TRANSFER,
  PAYOUT_PAID_OUT,
  PAYOUT_FAILED,
] as const;

/** Type-guard: returns true if `s` is a canonical booking payout status. */
export function isBookingPayoutStatus(s: unknown): s is BookingPayoutStatus {
  return BOOKING_PAYOUT_STATUSES.includes(s as BookingPayoutStatus);
}

// ── Provider-facing display labels (UI copy) ─────────────────────────────────

export const PAYOUT_STATUS_LABELS: Record<BookingPayoutStatus, string> = {
  [PAYOUT_PENDING]:           'Pending',
  [PAYOUT_PENDING_TRANSFER]:  'Transfer Pending',
  [PAYOUT_PAID_OUT]:          'Paid Out',
  [PAYOUT_FAILED]:            'Failed',
};

// Hebrew labels for provider-facing UI
export const PAYOUT_STATUS_LABELS_HE: Record<BookingPayoutStatus, string> = {
  [PAYOUT_PENDING]:           'ממתין לתשלום',
  [PAYOUT_PENDING_TRANSFER]:  'בהעברה',
  [PAYOUT_PAID_OUT]:          'שולם',
  [PAYOUT_FAILED]:            'תשלום נכשל',
};

// ── Badge style config for UI components ─────────────────────────────────────

export interface PayoutStatusStyle {
  label:     string;
  labelHe:   string;
  bg:        string;
  text:      string;
  border:    string;
  /** Tailwind dot-color for compact inline badges */
  dotColor:  string;
}

export const PAYOUT_STATUS_STYLES: Record<BookingPayoutStatus, PayoutStatusStyle> = {
  [PAYOUT_PENDING]: {
    label:    'Pending',
    labelHe:  'ממתין לתשלום',
    bg:       'bg-yellow-50',
    text:     'text-yellow-700',
    border:   'border-yellow-200',
    dotColor: 'bg-yellow-400',
  },
  [PAYOUT_PENDING_TRANSFER]: {
    label:    'Transfer Pending',
    labelHe:  'בהעברה',
    bg:       'bg-blue-50',
    text:     'text-blue-700',
    border:   'border-blue-200',
    dotColor: 'bg-blue-400',
  },
  [PAYOUT_PAID_OUT]: {
    label:    'Paid Out',
    labelHe:  'שולם',
    bg:       'bg-green-50',
    text:     'text-green-700',
    border:   'border-green-200',
    dotColor: 'bg-green-400',
  },
  [PAYOUT_FAILED]: {
    label:    'Failed',
    labelHe:  'תשלום נכשל',
    bg:       'bg-red-50',
    text:     'text-red-700',
    border:   'border-red-200',
    dotColor: 'bg-red-400',
  },
};

// ── Communication wording rules (used by notification + SMS helpers) ──────────
//
// blocked / pending_transfer  →  "queued" / "awaiting transfer" / "transfer pending"
// paid_out                    →  "transferred" / "paid out" / "money sent"
// failed                      →  "failed" / "needs review" / "support reviewing"
//
// Never say "transferred to your account" unless the code path is PAYOUT_PAID_OUT.
