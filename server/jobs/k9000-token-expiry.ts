/**
 * K9000 wash token expiry sweeper
 *
 * Closes the pending → expired transition for k9000_wash_tokens.
 *
 * Without this job, a token whose TTL has elapsed stays in "pending" state
 * inside the DB even though the HMAC check rejects it at scan time.
 * This sweeper makes the DB state truthful: any token that was never scanned
 * before its TTL is explicitly marked "expired", satisfying the requirement
 * that all four token states (pending / consumed / expired / failed_compensated)
 * are actively maintained in the database.
 *
 * Design choices:
 *   - Single bulk UPDATE per cycle — no row-by-row loop, minimal DB load.
 *   - 60-second interval: tokens have a 45-second TTL so this sweeper
 *     will mark them expired within at most ~105 seconds of generation.
 *     That is well within the audit window and has no impact on live flows
 *     because the HMAC expiry check is the live gate (this is audit-only).
 *   - startImmediately: runs one sweep on boot so any tokens that survived
 *     a process restart with pending status are cleaned up quickly.
 *   - Errors are non-fatal: the sweep is audit/observability only; the
 *     HMAC TTL and DB consumed/replay checks are the real enforcement gates.
 */

import { db } from '../db';
import { k9000WashTokens } from '@shared/schema';
import { and, eq, lt } from 'drizzle-orm';
import { logger } from '../lib/logger';

const SWEEP_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Mark all pending k9000_wash_tokens whose expires_at has passed as expired.
 * Returns the number of rows updated.
 */
export async function sweepExpiredWashTokens(): Promise<number> {
  const now = new Date();
  const result = await db
    .update(k9000WashTokens)
    .set({ status: 'expired' })
    .where(
      and(
        eq(k9000WashTokens.status, 'pending'),
        lt(k9000WashTokens.expiresAt, now),
      ),
    )
    .returning({ nonce: k9000WashTokens.nonce });

  const count = result.length;
  if (count > 0) {
    logger.info('[K9000TokenExpiry] Marked expired wash tokens', { count, sweptAt: now.toISOString() });
  }
  return count;
}

/**
 * Start the background sweeper.
 * Called once on server boot alongside other background jobs.
 */
export function startK9000TokenExpirySweeper(): void {
  logger.info('[K9000TokenExpiry] Sweeper started — marking pending→expired every 60 s');

  // Sweep once immediately so tokens that survived a process restart are cleaned up
  sweepExpiredWashTokens().catch((err: Error) => {
    logger.warn('[K9000TokenExpiry] Initial sweep failed (non-fatal)', { error: err.message });
  });

  setInterval(async () => {
    try {
      await sweepExpiredWashTokens();
    } catch (err: any) {
      logger.warn('[K9000TokenExpiry] Sweep cycle failed (non-fatal)', { error: err?.message });
    }
  }, SWEEP_INTERVAL_MS);
}
