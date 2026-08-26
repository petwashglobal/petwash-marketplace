/**
 * providerEarnings composer — canonical "what did I earn, what will I
 * get, when?" projection for a provider (CEO 2026-08-26 §17, §31).
 *
 * READ-ONLY. Never mutates payouts. Reads booking_requests only —
 * provider_payout_cents is already the source of truth for the money
 * side (schema.ts:10996 "Phase 3 — source of truth for provider
 * earnings"), so this composer does NOT re-derive fees or commission.
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
  payout_cents: number;
  status: string;
  payout_status: string | null;
  service_completed_at: string | null;
  payout_date: string | null;
}

function bucketFor(row: EarningsRow): EarningsBookingRow['bucket'] | null {
  const status = String(row.status ?? '');
  const payout = String(row.payout_status ?? 'pending');
  if ((DONE_STATUSES as readonly string[]).includes(status)) {
    if (payout === 'paid_out') return 'paid';
    if (payout === 'released') return 'available';
    // completed but not released → still in escrow
    return 'pending';
  }
  if ((IN_FLIGHT_STATUSES as readonly string[]).includes(status)) return 'expected';
  return null; // pending / cancelled / declined etc. — not in earnings buckets
}

function timestampFor(row: EarningsRow, bucket: EarningsBookingRow['bucket']): string | null {
  if (bucket === 'paid') return row.payout_date ?? row.service_completed_at;
  if (bucket === 'available' || bucket === 'pending') return row.service_completed_at;
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
    const q = await pool.query<EarningsRow>(
      `SELECT
         request_id,
         service_type,
         COALESCE(provider_payout_cents, 0)::int AS payout_cents,
         status::text                    AS status,
         payout_status                   AS payout_status,
         service_completed_at,
         payout_date
       FROM booking_requests
       WHERE provider_id = $1
         AND (
           status IN ('completed','reviewed','confirmed','in_progress','accepted')
         )
       ORDER BY COALESCE(service_completed_at, updated_at) DESC NULLS LAST
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
