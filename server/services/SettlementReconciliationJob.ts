/**
 * SettlementReconciliationJob — Phase 10, Task #21
 *
 * Periodic backfill that catches any station booking whose settlement was
 * missed (e.g., transient DB error during the fire-and-forget hook).
 *
 * Strategy:
 *   - Runs once on startup (after a short delay)
 *   - Repeats every SETTLEMENT_RECONCILE_INTERVAL_MS (default: 1 hour)
 *   - Query: completed bookings with stationId that have no settlement row
 *   - Calls computeAndPersistSettlement per missing booking (idempotent)
 *   - Logs every backfill for auditability
 */

import { db } from '../db';
import { bookings, stationSettlements } from '@shared/schema';
import { eq, isNull, isNotNull, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { computeAndPersistSettlement } from './SettlementEngine';

const INTERVAL_MS = parseInt(process.env.SETTLEMENT_RECONCILE_INTERVAL_MS ?? '', 10) || 60 * 60 * 1000;
const BATCH_LIMIT = 100;

export async function runSettlementReconciliation(): Promise<void> {
  try {
    // Find completed bookings with a stationId that have no settlement record
    const missing = await db.execute(sql`
      SELECT b.id
      FROM bookings b
      WHERE b.status = 'completed'
        AND b.station_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM station_settlements ss WHERE ss.booking_id = b.id
        )
      LIMIT ${BATCH_LIMIT}
    `);

    const rows = missing.rows as { id: string }[];

    if (rows.length === 0) {
      logger.info('[SettlementReconcile] Clean — no missing settlements');
      return;
    }

    logger.info('[SettlementReconcile] Missing settlements found — backfilling', { count: rows.length });

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const { id } of rows) {
      try {
        const result = await computeAndPersistSettlement(id);
        if (result) {
          created++;
          logger.info('[SettlementReconcile] Backfilled settlement', { bookingId: id, settlementId: result.id });
        } else {
          skipped++;
        }
      } catch (err: any) {
        errors++;
        logger.error('[SettlementReconcile] Failed to backfill settlement', { bookingId: id, error: err.message });
      }
    }

    logger.info('[SettlementReconcile] Backfill complete', { created, skipped, errors, total: rows.length });
  } catch (err: any) {
    logger.error('[SettlementReconcile] Reconciliation job failed', { error: err.message });
  }
}

let _reconcileTimer: ReturnType<typeof setInterval> | null = null;

export function startSettlementReconciliationJob(): void {
  if (_reconcileTimer) return;

  // Initial run after 30 seconds (let server fully boot first)
  setTimeout(async () => {
    await runSettlementReconciliation();
  }, 30_000);

  // Periodic run
  _reconcileTimer = setInterval(async () => {
    await runSettlementReconciliation();
  }, INTERVAL_MS);

  logger.info('[SettlementReconcile] Job started', { intervalMs: INTERVAL_MS });
}
