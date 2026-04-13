// shared/payout-status.ts
// Canonical source of truth for payout status vocabulary.
// Wave 2 tasks (ProviderPayoutService sync, client UI) both import from here.

// ─── Status constants ─────────────────────────────────────────────────────────

/** Payment is awaiting processing — no money has moved. */
export const PAYOUT_PENDING = 'pending' as const;

/** Payment is queued for bank transfer — escrow released, transfer in flight. */
export const PAYOUT_PENDING_TRANSFER = 'pending_transfer' as const;

/** Payment successfully transferred to provider's bank account. */
export const PAYOUT_PAID_OUT = 'paid_out' as const;

/** Payment failed — provider must contact support. */
export const PAYOUT_FAILED = 'failed' as const;

// ─── TypeScript type ──────────────────────────────────────────────────────────

export type BookingPayoutStatus =
  | typeof PAYOUT_PENDING
  | typeof PAYOUT_PENDING_TRANSFER
  | typeof PAYOUT_PAID_OUT
  | typeof PAYOUT_FAILED;

const ALL_PAYOUT_STATUSES: readonly BookingPayoutStatus[] = [
  PAYOUT_PENDING,
  PAYOUT_PENDING_TRANSFER,
  PAYOUT_PAID_OUT,
  PAYOUT_FAILED,
] as const;

/** Runtime type guard — use to validate DB/API values before casting. */
export function isBookingPayoutStatus(value: unknown): value is BookingPayoutStatus {
  return typeof value === 'string' && (ALL_PAYOUT_STATUSES as readonly string[]).includes(value);
}

// ─── UI display helpers ───────────────────────────────────────────────────────

/** Human-readable English labels for each status. */
export const PAYOUT_STATUS_LABELS: Record<BookingPayoutStatus, string> = {
  [PAYOUT_PENDING]:          'Pending',
  [PAYOUT_PENDING_TRANSFER]: 'Transfer in progress',
  [PAYOUT_PAID_OUT]:         'Paid out',
  [PAYOUT_FAILED]:           'Failed',
};

/** Human-readable Hebrew labels for each status. */
export const PAYOUT_STATUS_LABELS_HE: Record<BookingPayoutStatus, string> = {
  [PAYOUT_PENDING]:          'ממתין לתשלום',
  [PAYOUT_PENDING_TRANSFER]: 'העברה בדרך',
  [PAYOUT_PAID_OUT]:         'שולם',
  [PAYOUT_FAILED]:           'נכשל',
};

/** Tailwind CSS badge style tokens for each status. */
export const PAYOUT_STATUS_STYLES: Record<BookingPayoutStatus, string> = {
  [PAYOUT_PENDING]:          'bg-yellow-100 text-yellow-800',
  [PAYOUT_PENDING_TRANSFER]: 'bg-blue-100 text-blue-800',
  [PAYOUT_PAID_OUT]:         'bg-green-100 text-green-800',
  [PAYOUT_FAILED]:           'bg-red-100 text-red-800',
};
