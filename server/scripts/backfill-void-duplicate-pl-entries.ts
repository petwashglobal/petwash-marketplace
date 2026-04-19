/**
 * BACKFILL: Void duplicate profit_loss_ledger entries (Stage 1 cleanup)
 *
 * Problem: Before the Stage 1 fix, VATCalculatorService.recordTransaction() was called
 * at BOTH provider acceptance AND service completion for sitter-suite and walk-my-pet.
 * This means each completed booking has two profit_loss_ledger entries with status='completed',
 * both counted by getPlatformPL(), doubling revenue, VAT, and commission figures.
 *
 * Fix: For every bookingId that has ≥ 2 'completed' entries on the same platform,
 * keep the entry that has metadata.completedAt (the authoritative completion entry)
 * and set the other(s) to status='voided' with a voidReason.
 *
 * Usage (run once post-deploy):
 *   npx tsx server/scripts/backfill-void-duplicate-pl-entries.ts
 *
 * Safe to re-run — idempotent (already-voided docs are skipped).
 */

import * as admin from 'firebase-admin';
import { logger } from '../lib/logger';

// ── Firebase init ────────────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp();
}
const firestore = admin.firestore();

const AFFECTED_PLATFORMS = ['sitter-suite', 'walk-my-pet'];
const DRY_RUN = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  console.log(`[Backfill] Starting profit_loss_ledger duplicate void${DRY_RUN ? ' (DRY RUN)' : ''}…`);

  let inspected = 0;
  let bookingsWithDuplicates = 0;
  let voided = 0;
  let skipped = 0;

  for (const platform of AFFECTED_PLATFORMS) {
    console.log(`\n[Backfill] Processing platform: ${platform}`);

    // Fetch all completed entries for this platform
    const snapshot = await firestore
      .collection('profit_loss_ledger')
      .where('platform', '==', platform)
      .where('status', '==', 'completed')
      .get();

    inspected += snapshot.size;
    console.log(`[Backfill] Found ${snapshot.size} completed entries for ${platform}`);

    // Group by bookingId
    const byBookingId: Record<string, admin.firestore.QueryDocumentSnapshot[]> = {};
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const key = data.bookingId as string | undefined;
      if (!key) continue; // skip entries without bookingId (shouldn't exist)
      if (!byBookingId[key]) byBookingId[key] = [];
      byBookingId[key].push(doc);
    }

    let platformDuplicateBookings = 0;
    let platformVoided = 0;

    for (const [bookingId, entries] of Object.entries(byBookingId)) {
      if (entries.length < 2) continue; // single entry — correct state, skip

      platformDuplicateBookings++;

      // The authoritative entry has metadata.completedAt set (written at service completion).
      // The duplicate entry is the acceptance-time entry (no completedAt in metadata).
      const authoritative = entries.find(e => {
        const meta = e.data().metadata;
        return meta && typeof meta === 'object' && meta.completedAt;
      });

      if (!authoritative) {
        // Cannot determine which is authoritative — log and skip
        console.warn(`[Backfill] WARN: bookingId=${bookingId} has ${entries.length} completed entries but none has metadata.completedAt — skipping`);
        skipped++;
        continue;
      }

      const duplicates = entries.filter(e => e.id !== authoritative.id);

      for (const dup of duplicates) {
        const dupData = dup.data();
        if (dupData.status === 'voided') {
          // Already voided by a previous run
          continue;
        }

        console.log(`[Backfill] bookingId=${bookingId}: voiding duplicate entry ${dup.id} (platform=${platform}, gross=₪${dupData.grossCollectedILS})`);

        if (!DRY_RUN) {
          await dup.ref.update({
            status: 'voided',
            voidReason: 'duplicate_acceptance_entry_replaced_by_authoritative_completion_entry',
            voidedAt: admin.firestore.FieldValue.serverTimestamp(),
            voidedByScript: 'backfill-void-duplicate-pl-entries',
            authoritativeEntryId: authoritative.id,
          });
        }

        platformVoided++;
        voided++;
      }
    }

    bookingsWithDuplicates += platformDuplicateBookings;
    console.log(`[Backfill] ${platform}: ${platformDuplicateBookings} bookings had duplicates, ${platformVoided} entries voided`);
  }

  console.log('\n════════════════════════════════════════');
  console.log('[Backfill] COMPLETE');
  console.log(`  Inspected:               ${inspected} entries`);
  console.log(`  Bookings with duplicates: ${bookingsWithDuplicates}`);
  console.log(`  Entries voided:           ${voided}`);
  console.log(`  Skipped (ambiguous):      ${skipped}`);
  if (DRY_RUN) console.log('  ⚠️  DRY RUN — no changes written');
  console.log('════════════════════════════════════════\n');

  if (voided === 0 && !DRY_RUN) {
    console.log('✅ No duplicate entries found — ledger is already clean.');
  } else if (!DRY_RUN) {
    console.log(`✅ Voided ${voided} duplicate entries. Run getPlatformPL() to verify before/after numbers.`);
  }
}

main().catch(err => {
  console.error('[Backfill] FATAL:', err);
  process.exit(1);
});
