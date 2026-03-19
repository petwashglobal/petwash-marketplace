/**
 * Phase 3 Backfill: bookings → booking_requests
 *
 * Maps rows from the old `bookings` table into `booking_requests` where no
 * matching row already exists (matched by booking_number = request_id).
 *
 * Safety:
 *   - Skips any booking whose booking_number already has a matching request_id in booking_requests
 *   - Marks migrated rows with _migrated_from = 'bookings' in status_history
 *   - Does NOT delete or modify old bookings rows — bookings remains read-only
 *   - Idempotent: safe to run multiple times
 *
 * Run:
 *   npx tsx scripts/migrate-bookings-to-requests.ts [--dry-run]
 *
 * Rollback:
 *   DELETE FROM booking_requests WHERE status_history::text LIKE '%migrated_from_bookings%';
 */

import { pool } from '../server/db';
import { nanoid } from 'nanoid';

const DRY_RUN = process.argv.includes('--dry-run');

// Status mapping: old bookings.status → booking_requests status enum
const STATUS_MAP: Record<string, string> = {
  inquiry:                   'pending',
  pending:                   'pending',
  confirmed:                 'confirmed',
  owner_confirmed:           'confirmed',
  provider_confirmed:        'confirmed',
  in_progress:               'in_progress',
  started:                   'in_progress',
  provider_completion_review:'completed',
  completed:                 'completed',
  cancelled:                 'cancelled',
  dispute:                   'disputed',
  new_request:               'pending',
};

// Valid booking_request_status enum values
const VALID_STATUSES = new Set([
  'pending','accepted','declined','meet_greet_scheduled','meet_greet_completed',
  'payment_pending','confirmed','in_progress','completed','reviewed','cancelled','disputed',
]);

function mapStatus(old: string): string {
  const mapped = STATUS_MAP[old] ?? 'pending';
  return VALID_STATUSES.has(mapped) ? mapped : 'pending';
}

async function run() {
  console.log(`\n=== Phase 3 Backfill: bookings → booking_requests ${DRY_RUN ? '[DRY RUN]' : ''} ===\n`);

  // 1. Fetch all old bookings with their provider UID mapping
  const { rows: oldBookings } = await pool.query(`
    SELECT
      b.id,
      b.booking_number,
      b.user_id        AS owner_id,
      p.user_id        AS provider_uid,
      b.service_type,
      b.start_time,
      b.end_time,
      b.status,
      b.subtotal,
      b.platform_fee,
      b.provider_payout,
      b.total,
      b.currency,
      b.payout_status,
      b.payout_date,
      b.special_requests,
      b.cancellation_reason,
      b.confirmed_at,
      b.started_at,
      b.completed_at,
      b.cancelled_at,
      b.created_at
    FROM bookings b
    LEFT JOIN providers p ON p.id::text = b.provider_id
    ORDER BY b.created_at ASC
  `);

  console.log(`Found ${oldBookings.length} old bookings to evaluate.`);

  // 2. Fetch existing request_ids so we can skip already-migrated rows
  const { rows: existingRefs } = await pool.query(
    `SELECT request_id FROM booking_requests`,
  );
  const existingRequestIds = new Set(existingRefs.map((r: any) => r.request_id));
  console.log(`Already have ${existingRequestIds.size} rows in booking_requests.`);

  let inserted = 0;
  let skippedAlreadyExists = 0;
  let skippedNoProvider = 0;
  const errors: string[] = [];

  for (const b of oldBookings) {
    // Use booking_number as the stable public reference ID
    const requestId = b.booking_number || `BK-${b.id}`;

    if (existingRequestIds.has(requestId)) {
      skippedAlreadyExists++;
      continue;
    }

    if (!b.provider_uid) {
      // Old bookings with no provider_id link can't be migrated cleanly
      console.warn(`  SKIP no provider UID: booking ${b.booking_number} (id=${b.id})`);
      skippedNoProvider++;
      continue;
    }

    // Convert ILS decimals → cents
    const subtotalCents    = Math.round((parseFloat(b.subtotal    ?? '0')) * 100);
    const serviceFeeCents  = Math.round((parseFloat(b.platform_fee ?? '0')) * 100);
    const payoutCents      = Math.round((parseFloat(b.provider_payout ?? '0')) * 100);
    const totalCents       = Math.round((parseFloat(b.total       ?? '0')) * 100);

    const newStatus = mapStatus(b.status);
    const statusHistory = JSON.stringify([{
      status: newStatus,
      timestamp: b.created_at ?? new Date().toISOString(),
      note: `migrated_from_bookings id=${b.id} original_status=${b.status}`,
    }]);

    if (DRY_RUN) {
      console.log(`  [DRY] Would insert: requestId=${requestId}, provider=${b.provider_uid}, status=${newStatus}, subtotal=${subtotalCents}¢`);
      inserted++;
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO booking_requests (
          request_id, owner_id, provider_id, provider_type,
          service_type, start_date, end_date,
          subtotal_cents, service_fee_percent, service_fee_cents,
          provider_payout_cents, total_cents, currency,
          payout_status, payout_date,
          special_requirements, cancellation_reason,
          status, status_history,
          payment_held_at, service_started_at, service_completed_at, cancelled_at,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, 15, $9,
          $10, $11, $12,
          $13, $14,
          $15, $16,
          $17, $18::jsonb,
          $19, $20, $21, $22,
          $23, NOW()
        )
        ON CONFLICT (request_id) DO NOTHING`,
        [
          requestId,                          // $1  request_id
          b.owner_id   ?? 'unknown-owner',    // $2  owner_id
          b.provider_uid,                     // $3  provider_id (Firebase UID)
          'sitter',                           // $4  provider_type default
          b.service_type ?? 'pet_sitting',    // $5  service_type
          b.start_time,                       // $6  start_date
          b.end_time,                         // $7  end_date
          subtotalCents,                      // $8  subtotal_cents
          serviceFeeCents,                    // $9  service_fee_cents
          payoutCents,                        // $10 provider_payout_cents
          totalCents,                         // $11 total_cents
          b.currency ?? 'ILS',                // $12 currency
          b.payout_status ?? 'pending',       // $13 payout_status
          b.payout_date,                      // $14 payout_date
          b.special_requests,                 // $15 special_requirements
          b.cancellation_reason,              // $16 cancellation_reason
          newStatus,                          // $17 status
          statusHistory,                      // $18 status_history
          b.confirmed_at,                     // $19 payment_held_at
          b.started_at,                       // $20 service_started_at
          b.completed_at,                     // $21 service_completed_at
          b.cancelled_at,                     // $22 cancelled_at
          b.created_at ?? new Date(),         // $23 created_at
        ],
      );
      console.log(`  ✓ Migrated: ${requestId} → status=${newStatus}, payout=₪${(payoutCents/100).toFixed(2)}`);
      inserted++;
    } catch (err: any) {
      console.error(`  ✗ Error migrating ${requestId}:`, err.message);
      errors.push(`${requestId}: ${err.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Inserted:              ${inserted}`);
  console.log(`  Skipped (exists):      ${skippedAlreadyExists}`);
  console.log(`  Skipped (no provider): ${skippedNoProvider}`);
  console.log(`  Errors:                ${errors.length}`);
  if (errors.length > 0) {
    console.log('  Error details:', errors);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes written to database.');
  } else {
    // Verify final counts
    const { rows: [afterCount] } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM booking_requests`,
    );
    console.log(`\n  booking_requests total rows after backfill: ${afterCount.n}`);
  }

  await pool.end();
  console.log('\nDone.\n');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
