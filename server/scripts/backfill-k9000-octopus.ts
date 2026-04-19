/**
 * BACKFILL: Zero K9000 phantom provider_share rows in octopus_bookings
 *           Delete phantom PROVIDER_EARNING rows in octopus_ledger
 *
 * Problem: Historical K9000 bookings in octopus_bookings were created with
 * non-zero provider_share and platform_fee values because the booking creation
 * code treated K9000 the same as marketplace bookings. K9000 is a direct-revenue
 * machine — there is no external provider. All revenue stays with PetWash.
 *
 * Fix:
 *   1. octopus_bookings WHERE platform = 'K9000': set platform_fee = 0, provider_share = 0
 *   2. octopus_ledger WHERE platform = 'K9000' AND type = 'PROVIDER_EARNING': delete
 *
 * Usage (run once post-deploy):
 *   npx tsx server/scripts/backfill-k9000-octopus.ts
 *   npx tsx server/scripts/backfill-k9000-octopus.ts --dry-run   (counts only)
 *
 * Safe to re-run — idempotent.
 */

import { pool } from '../db';
import { logger } from '../lib/logger';

const DRY_RUN = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  console.log(`[Backfill K9000] Starting${DRY_RUN ? ' (DRY RUN)' : ''}…`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── STEP 1: Inspect octopus_bookings ────────────────────────────────────
    const countResult = await client.query<{ count: string; phantom_fee_sum: string; phantom_share_sum: string }>(
      `SELECT
         COUNT(*) AS count,
         COALESCE(SUM(platform_fee), 0)   AS phantom_fee_sum,
         COALESCE(SUM(provider_share), 0) AS phantom_share_sum
       FROM octopus_bookings
       WHERE platform = 'K9000'
         AND (platform_fee > 0 OR provider_share > 0)`
    );
    const { count, phantom_fee_sum, phantom_share_sum } = countResult.rows[0];

    console.log(`[Backfill K9000] octopus_bookings: ${count} rows with phantom provider_share or platform_fee`);
    console.log(`  phantom platform_fee  sum: ₪${(parseInt(phantom_fee_sum, 10) / 100).toFixed(2)}`);
    console.log(`  phantom provider_share sum: ₪${(parseInt(phantom_share_sum, 10) / 100).toFixed(2)}`);

    // ── STEP 2: Inspect octopus_ledger ──────────────────────────────────────
    const ledgerCount = await client.query<{ count: string; phantom_amount_sum: string }>(
      `SELECT
         COUNT(*) AS count,
         COALESCE(SUM(amount), 0) AS phantom_amount_sum
       FROM octopus_ledger
       WHERE platform = 'K9000'
         AND type = 'PROVIDER_EARNING'`
    );
    const { count: lCount, phantom_amount_sum } = ledgerCount.rows[0];

    console.log(`[Backfill K9000] octopus_ledger: ${lCount} phantom PROVIDER_EARNING rows`);
    console.log(`  phantom PROVIDER_EARNING sum: ₪${(parseInt(phantom_amount_sum, 10) / 100).toFixed(2)}`);

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log('\n[Backfill K9000] DRY RUN — no changes written. Re-run without --dry-run to apply.\n');
      return;
    }

    // ── STEP 3: Apply octopus_bookings fix ──────────────────────────────────
    const bookingsUpdate = await client.query(
      `UPDATE octopus_bookings
       SET
         platform_fee   = 0,
         provider_share = 0,
         updated_at     = NOW()
       WHERE platform = 'K9000'
         AND (platform_fee > 0 OR provider_share > 0)
       RETURNING id`
    );
    console.log(`[Backfill K9000] Updated ${bookingsUpdate.rowCount} rows in octopus_bookings`);

    // ── STEP 4: Delete phantom PROVIDER_EARNING ledger rows ──────────────────
    const ledgerDelete = await client.query(
      `DELETE FROM octopus_ledger
       WHERE platform = 'K9000'
         AND type = 'PROVIDER_EARNING'
       RETURNING id`
    );
    console.log(`[Backfill K9000] Deleted ${ledgerDelete.rowCount} rows from octopus_ledger`);

    await client.query('COMMIT');

    console.log('\n════════════════════════════════════════');
    console.log('[Backfill K9000] COMPLETE');
    console.log(`  octopus_bookings rows patched:  ${bookingsUpdate.rowCount}`);
    console.log(`  octopus_ledger rows deleted:    ${ledgerDelete.rowCount}`);
    console.log(`  phantom platform_fee cleared:   ₪${(parseInt(phantom_fee_sum, 10) / 100).toFixed(2)}`);
    console.log(`  phantom provider_share cleared: ₪${(parseInt(phantom_share_sum, 10) / 100).toFixed(2)}`);
    console.log('════════════════════════════════════════\n');
    console.log('✅ K9000 direct-revenue backfill complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main().catch(err => {
  console.error('[Backfill K9000] FATAL:', err);
  process.exit(1);
});
