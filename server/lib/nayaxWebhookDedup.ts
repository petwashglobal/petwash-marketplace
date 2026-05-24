/**
 * Nayax webhook deduplication — DB-backed, atomic, survives restart.
 *
 * Replaces the prior Redis-backed dedup which failed OPEN when Redis
 * was unavailable: a Redis hiccup could let duplicate webhooks through
 * and double-credit a wallet on Nayax's automatic retry.
 *
 * The pattern: INSERT ... ON CONFLICT (event_id) DO NOTHING
 *              RETURNING event_id.
 *
 * Atomic at the DB. Whichever Node instance wins the INSERT race owns
 * the event. Every other instance gets an empty returning() and
 * short-circuits with deduplicated:true. No lock, no race window, no
 * shared in-memory state.
 *
 * Behavior on DB failure: throws. The caller (checkIdempotency
 * middleware) returns 503 so Nayax retries — safer than silently
 * processing without dedup.
 *
 * Cleanup: a separate cron will DELETE rows older than 30 days (Nayax's
 * typical retry window). Not in this PR.
 */

import { db } from '../db';
import { nayaxProcessedEventIds } from '../../shared/schema';
import { logger } from './logger';

export interface DedupCheckInput {
  eventId: string;
  /** Optional context for forensics — which route claimed the event first. */
  sourceRoute?: string;
}

export type DedupResult =
  | { processed: 'new' }
  | { processed: 'duplicate' };

/**
 * Atomic insert-first dedup. Returns:
 *   { processed: 'new' }       — event_id was newly inserted; caller proceeds
 *   { processed: 'duplicate' } — event_id was already in the table;
 *                                 caller returns 200 OK with deduplicated:true
 *
 * Throws on DB failure — caller MUST handle and decide fail-open vs
 * fail-closed. For Nayax webhooks we fail CLOSED (503) so Nayax retries.
 */
export async function tryClaimWebhookEvent(input: DedupCheckInput): Promise<DedupResult> {
  if (!input.eventId || !input.eventId.trim()) {
    throw new Error('eventId is required');
  }

  const inserted = await db
    .insert(nayaxProcessedEventIds)
    .values({
      eventId: input.eventId,
      sourceRoute: input.sourceRoute ?? null,
    })
    .onConflictDoNothing()
    .returning({ eventId: nayaxProcessedEventIds.eventId });

  if (inserted.length === 0) {
    logger.info('[NayaxWebhookDedup] duplicate event short-circuited', {
      eventId: input.eventId,
      sourceRoute: input.sourceRoute,
    });
    return { processed: 'duplicate' };
  }

  return { processed: 'new' };
}
