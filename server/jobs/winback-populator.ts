/**
 * WINBACK POPULATOR
 *
 * Runs nightly. Scans booking_requests for pet owners who haven't booked
 * in 14 / 30 / 60 days and inserts them into winback_queue so the processor
 * can send a re-engagement notification with a loyalty credit incentive.
 *
 * Deduplication: a user is only enrolled in a tier once per lifecycle
 * (idempotent insert — skips if row already exists for that trigger where
 * status NOT IN ('converted', 'suppressed')).
 *
 * Suppression: if the user's most recent provider has is_winback_suppressed=true,
 * the row is inserted with status='suppressed' immediately (provider opted out
 * of PetWash re-engagement for their clientele).
 */

import { db } from '../db';
import { bookingRequests, winbackQueue } from '@shared/schema';
import { eq, and, not, inArray, sql, desc } from 'drizzle-orm';
import { logger } from '../lib/logger';

interface WinbackTier {
  trigger: string;
  minDays: number;
  maxDays: number;
}

const TIERS: WinbackTier[] = [
  { trigger: 'winback_14d', minDays: 14, maxDays: 21 },
  { trigger: 'winback_30d', minDays: 30, maxDays: 37 },
  { trigger: 'winback_60d', minDays: 60, maxDays: 67 },
];

export async function runWinbackPopulator(): Promise<void> {
  logger.info('[WinbackPopulator] Starting run');

  let totalInserted = 0;
  let totalSuppressed = 0;
  let totalSkipped = 0;

  for (const tier of TIERS) {
    try {
      // ── 1. Find owners whose last completed booking falls in this tier's window ─
      const dormantOwners = await db.execute<{
        owner_id: string;
        last_booking_at: Date;
        provider_id: string;
      }>(sql`
        SELECT DISTINCT ON (br.owner_id)
          br.owner_id,
          br.updated_at  AS last_booking_at,
          br.provider_id
        FROM booking_requests br
        WHERE br.status IN ('completed', 'reviewed')
          AND br.updated_at >= now() - (${tier.maxDays} || ' days')::interval
          AND br.updated_at <  now() - (${tier.minDays} || ' days')::interval
        ORDER BY br.owner_id, br.updated_at DESC
      `);

      if (!dormantOwners.rows || dormantOwners.rows.length === 0) {
        logger.info('[WinbackPopulator] No dormant owners for tier', { trigger: tier.trigger });
        continue;
      }

      logger.info('[WinbackPopulator] Candidates for tier', {
        trigger: tier.trigger,
        count: dormantOwners.rows.length,
      });

      for (const owner of dormantOwners.rows) {
        const userId   = owner.owner_id;
        const providerId = owner.provider_id;

        // ── 2. Check existing queue entry for this tier ───────────────────────
        const existing = await db.execute<{ id: number }>(sql`
          SELECT id FROM winback_queue
          WHERE user_id = ${userId}
            AND trigger  = ${tier.trigger}
            AND status NOT IN ('converted', 'suppressed')
          LIMIT 1
        `);

        if (existing.rows.length > 0) {
          totalSkipped++;
          continue;
        }

        // ── 3. Check provider suppression ────────────────────────────────────
        const suppRow = await db.execute<{ is_winback_suppressed: boolean }>(sql`
          SELECT is_winback_suppressed
          FROM provider_profiles
          WHERE user_id = ${providerId}
          LIMIT 1
        `);

        const isSuppressed = suppRow.rows[0]?.is_winback_suppressed === true;

        // ── 4. Insert queue entry ─────────────────────────────────────────────
        await db.execute(sql`
          INSERT INTO winback_queue
            (user_id, trigger, status, last_booking_at, scheduled_at)
          VALUES (
            ${userId},
            ${tier.trigger},
            ${isSuppressed ? 'suppressed' : 'pending'},
            ${owner.last_booking_at},
            now()
          )
        `);

        if (isSuppressed) {
          totalSuppressed++;
        } else {
          totalInserted++;
        }
      }
    } catch (err: any) {
      logger.error('[WinbackPopulator] Tier error', {
        trigger: tier.trigger,
        error: err.message,
      });
    }
  }

  logger.info('[WinbackPopulator] Run complete', {
    totalInserted,
    totalSuppressed,
    totalSkipped,
  });
}
