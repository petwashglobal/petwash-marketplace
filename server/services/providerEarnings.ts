/**
 * providerEarnings composer — canonical "what did I earn, what will I
 * get, when?" projection for a provider (CEO 2026-08-26 §17, §31).
 *
 * READ-ONLY. Never mutates payouts. Composes over TWO tables:
 *   1. booking_requests — the marketplace mirror row (cents live here
 *      per schema.ts:10996 "Phase 3 — source of truth"), BUT the
 *      column is nullable and native marketplace bookings never
 *      populate it (audit lane C confirmed). For a native row (no
 *      bridged legacyRef) we synthesise cents = subtotal - serviceFee
 *      so the customer's booking is not silently ₪0.
 *   2. contractor_earnings — the escrow/payout state ledger. This is
 *      where payout_status actually flips to 'released' / 'paid_out'
 *      today; booking_requests.payout_status stays 'pending' forever.
 *      LEFT JOIN LATERAL surfaces the latest state per (contractor,
 *      booking) so the composer can honestly show "available" and
 *      "paid" instead of stranding every completed booking as
 *      "pending".
 *
 * "PAID" (CEO §18) means contractor_earnings.payout_status='paid_out'
 * ONLY. Never inferred from status='completed'. The one existing
 * writer (payoutLedger.processPayout) requires an explicit
 * payoutTransactionId argument, so this bucket cannot be reached
 * without proof of a real transfer.
 *
 * super_app_payouts is intentionally NOT joined here — its
 * `booking_id` points at `bookings.id` (a different table) and its
 * `provider_id` is an integer FK, not a Firebase UID. Adding a valid
 * join requires a providers.id ↔ userId translation which is a
 * separate design step.
 *
 * Bucket precedence per booking: paid → available → pending → expected.
 * A booking is in EXACTLY one bucket at a time.
 */

import { pool } from '../db';
import { logger } from '../lib/logger';
import type {
  EarningsBookingRow,
  ProviderEarningsTruth,
} from '@shared/lib/providerEarnings';

const IN_FLIGHT_STATUSES = ['confirmed', 'in_progress', 'accepted'] as const;
const DONE_STATUSES = ['completed', 'reviewed'] as const;

interface EarningsRow {
  request_id: string;
  service_type: string;
  /** COALESCE(provider_payout_cents, subtotal - serviceFee). Never null. */
  payout_cents: number;
  status: string;
  /** booking_requests.payout_status — today stays 'pending' forever
   *  because no writer flips it (audit finding). Kept for future
   *  compatibility when the accept-dispatcher wires the payout status
   *  back to this table. */
  payout_status: string | null;
  service_completed_at: string | null;
  payout_date: string | null;
  /** contractor_earnings.payout_status when we have a matching escrow
   *  row — THIS is the flip that actually moves buckets today. */
  ce_payout_status: string | null;
  ce_paid_out_at: string | null;
  ce_released_at: string | null;
}

function bucketFor(row: EarningsRow): EarningsBookingRow['bucket'] | null {
  const status = String(row.status ?? '');
  // contractor_earnings state wins when it disagrees with the mirror
  // row — the mirror never flips off 'pending' today.
  const ceStatus = row.ce_payout_status ? String(row.ce_payout_status) : null;
  const mirrorStatus = String(row.payout_status ?? 'pending');
  const effectivePayoutStatus = ceStatus ?? mirrorStatus;
  if ((DONE_STATUSES as readonly string[]).includes(status)) {
    // CEO §18: PAID only when a real payout record proves the transfer.
    if (effectivePayoutStatus === 'paid_out') return 'paid';
    if (effectivePayoutStatus === 'released') return 'available';
    // completed but escrow not released → still in escrow (pending)
    return 'pending';
  }
  if ((IN_FLIGHT_STATUSES as readonly string[]).includes(status)) return 'expected';
  return null; // pending / cancelled / declined etc. — not in earnings buckets
}

function timestampFor(row: EarningsRow, bucket: EarningsBookingRow['bucket']): string | null {
  if (bucket === 'paid')      return row.ce_paid_out_at   ?? row.payout_date ?? row.service_completed_at;
  if (bucket === 'available') return row.ce_released_at   ?? row.service_completed_at;
  if (bucket === 'pending')   return row.service_completed_at;
  return null;
}

export async function composeProviderEarnings(providerUid: string): Promise<ProviderEarningsTruth> {
  if (!providerUid) {
    return {
      currency: 'ILS',
      composedAt: new Date().toISOString(),
      expectedCents: 0, pendingCents: 0, availableCents: 0, paidCents: 0,
      recent: [],
    };
  }

  let rows: EarningsRow[] = [];
  try {
    // The COALESCE handles the native-marketplace bug (audit lane C):
    // booking_requests.provider_payout_cents is NULL for every native
    // marketplace booking because no writer sets it. Synthesise from
    // (subtotal - serviceFee) so the money is visible until a proper
    // writer lands. Bridged rows (sitter/walk/academy) already have
    // the column populated at bridge-time.
    //
    // The LATERAL JOIN on contractor_earnings surfaces the ACTUAL
    // payout state — booking_requests.payout_status never flips off
    // 'pending' today, but contractor_earnings.payout_status does.
    // Latest row per (contractor, booking) wins.
    const q = await pool.query<EarningsRow>(
      `SELECT
         br.request_id,
         br.service_type,
         COALESCE(
           br.provider_payout_cents,
           GREATEST(0, COALESCE(br.subtotal_cents, 0) - COALESCE(br.service_fee_cents, 0))
         )::int                          AS payout_cents,
         br.status::text                 AS status,
         br.payout_status                AS payout_status,
         br.service_completed_at,
         br.payout_date,
         ce.payout_status                AS ce_payout_status,
         ce.paid_out_at                  AS ce_paid_out_at,
         ce.escrow_release_date          AS ce_released_at
       FROM booking_requests br
       LEFT JOIN LATERAL (
         SELECT payout_status, paid_out_at, escrow_release_date, updated_at
           FROM contractor_earnings ce
          WHERE ce.contractor_id = br.provider_id
            AND ce.booking_id    = br.request_id
          ORDER BY ce.updated_at DESC
          LIMIT 1
       ) ce ON TRUE
       WHERE br.provider_id = $1
         AND br.status IN ('completed','reviewed','confirmed','in_progress','accepted')
       ORDER BY COALESCE(br.service_completed_at, br.updated_at) DESC NULLS LAST
       LIMIT 500`,
      [providerUid],
    );
    rows = q.rows;
  } catch (e: any) {
    logger.warn('[ProviderEarnings] query failed — returning empty', {
      providerUid, err: e?.message,
    });
    return {
      currency: 'ILS',
      composedAt: new Date().toISOString(),
      expectedCents: 0, pendingCents: 0, availableCents: 0, paidCents: 0,
      recent: [],
    };
  }

  let expected = 0, pending = 0, available = 0, paid = 0;
  const recent: EarningsBookingRow[] = [];
  for (const r of rows) {
    const bucket = bucketFor(r);
    if (!bucket) continue;
    const amount = Number(r.payout_cents) || 0;
    if (bucket === 'expected')  expected  += amount;
    if (bucket === 'pending')   pending   += amount;
    if (bucket === 'available') available += amount;
    if (bucket === 'paid')      paid      += amount;
    if (recent.length < 50) {
      recent.push({
        requestId: r.request_id,
        serviceType: r.service_type,
        amountCents: amount,
        bucket,
        timestamp: timestampFor(r, bucket),
      });
    }
  }

  return {
    currency: 'ILS',
    composedAt: new Date().toISOString(),
    expectedCents: expected,
    pendingCents: pending,
    availableCents: available,
    paidCents: paid,
    recent,
  };
}
