/**
 * Provider earnings — the canonical "what did I earn, what will I get,
 * when do I get it?" answer (CEO 2026-08-26 §17, §31).
 *
 * READ-ONLY. Never mutates payouts. Composes over the existing
 * booking_requests financial fields (provider_payout_cents +
 * payout_status) so no economic rule is duplicated.
 *
 * Four categories the provider must always see:
 *   expectedCents  — in-flight jobs (accepted/confirmed/in_progress) —
 *                    projected payout, NOT earned yet.
 *   pendingCents   — completed jobs whose escrow window has not
 *                    released the payout (money owed but not yet
 *                    withdrawable).
 *   availableCents — released but not yet paid_out — the provider
 *                    can request payout NOW.
 *   paidCents      — paid_out lifetime.
 *
 * A booking is in EXACTLY one bucket at a time — the composer picks
 * the highest-priority bucket in order paid → available → pending →
 * expected. Rule: never mark a booking "paid" because the service is
 * done — only when payout_status='paid_out'.
 */

export interface EarningsBookingRow {
  requestId: string;
  serviceType: string;
  amountCents: number;
  bucket: 'expected' | 'pending' | 'available' | 'paid';
  /** ISO — earliest signal for the bucket transition (service_completed_at,
      escrow_released_at, or paid_out_at as available). */
  timestamp: string | null;
}

export interface ProviderEarningsTruth {
  currency: 'ILS';
  composedAt: string;
  expectedCents: number;
  pendingCents: number;
  availableCents: number;
  paidCents: number;
  /** Newest-first, capped at 50 for the UI feed. */
  recent: EarningsBookingRow[];
}

export function emptyProviderEarningsTruth(): ProviderEarningsTruth {
  return {
    currency: 'ILS',
    composedAt: new Date(0).toISOString(),
    expectedCents: 0,
    pendingCents: 0,
    availableCents: 0,
    paidCents: 0,
    recent: [],
  };
}
