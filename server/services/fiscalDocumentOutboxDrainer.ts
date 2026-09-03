/**
 * Fiscal document outbox drainer — retries the durable rows that
 * runFiscalDocumentAndPersistOnFailure inserted (A3 / A4 / A5).
 * CEO 2026-09-02 release freeze: "…retry it until completed or
 * explicitly failed for intervention."
 *
 * Contract:
 *   • Locks one batch per tick with `FOR UPDATE SKIP LOCKED` so N pods
 *     can drain concurrently without stealing rows from each other.
 *   • Dispatches per `kind` to the ORIGINAL service call the caller
 *     tried inline, using the payload the caller stored.
 *   • On success:  status='succeeded', succeeded_at=now().
 *   • On failure:  attempts++, next_attempt_at = now() + backoff,
 *                  last_error captured. After MAX_ATTEMPTS the row
 *                  flips to status='failed_needs_review' — the ops
 *                  surface can force-retry or acknowledge.
 *   • The drainer NEVER blocks a booking; it runs on its own tick.
 *
 * Boot: call `startFiscalOutboxDrainer(pool)` once from server/index.ts
 * after Postgres is reachable. `stopFiscalOutboxDrainer()` cancels the
 * timer (used by tests + graceful shutdown).
 */

import type { Pool } from 'pg';
import { logger } from '../lib/logger';

/** Backoff schedule (seconds) — capped exponential. */
const BACKOFF_SECONDS = [30, 60, 120, 300, 600, 1200, 1800, 3600, 3600, 3600];
/** Max attempts before flipping to failed_needs_review. */
const MAX_ATTEMPTS = BACKOFF_SECONDS.length;
/** How many rows to attempt per tick. */
const BATCH_SIZE = 10;
/** Default tick interval — override via env for tests. */
const DEFAULT_TICK_MS = 60_000;

type Row = {
  id: string;
  kind: string;
  source_key: string;
  payload: any;
  attempts: number;
};

let timer: NodeJS.Timeout | null = null;
let running = false;

export interface DrainerDeps {
  /**
   * Handler registry — one per fiscal outbox `kind`. Handlers throw on
   * failure; the drainer records the error and reschedules with
   * backoff. Handlers must be idempotent by (kind, source_key).
   */
  handlers: Record<string, (payload: any) => Promise<void>>;
}

/**
 * Take up to BATCH_SIZE due rows and try each. Returns the number of
 * rows processed (success + failure both count).
 */
export async function drainOnce(pool: Pool, deps: DrainerDeps): Promise<number> {
  const claimed = await pool.query<Row>(
    `WITH due AS (
       SELECT id
         FROM fiscal_document_outbox
        WHERE status = 'pending'
          AND next_attempt_at <= now()
        ORDER BY next_attempt_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE fiscal_document_outbox r
        SET updated_at = now()
       FROM due
      WHERE r.id = due.id
      RETURNING r.id, r.kind, r.source_key, r.payload, r.attempts`,
    [BATCH_SIZE],
  );

  let processed = 0;
  for (const row of claimed.rows) {
    processed += 1;
    const handler = deps.handlers[row.kind];
    if (!handler) {
      // No handler registered — mark for review rather than loop forever.
      await pool.query(
        `UPDATE fiscal_document_outbox
            SET status = 'failed_needs_review',
                last_error = $2,
                updated_at = now()
          WHERE id = $1`,
        [row.id, `no_handler_registered:${row.kind}`],
      );
      logger.error('[FiscalOutboxDrainer] no handler for kind — marked failed_needs_review', {
        id: row.id, kind: row.kind, sourceKey: row.source_key,
      });
      continue;
    }

    try {
      await handler(row.payload);
      await pool.query(
        `UPDATE fiscal_document_outbox
            SET status = 'succeeded',
                succeeded_at = now(),
                updated_at = now(),
                last_error = NULL
          WHERE id = $1`,
        [row.id],
      );
      logger.info('[FiscalOutboxDrainer] retry succeeded', {
        id: row.id, kind: row.kind, sourceKey: row.source_key, attempts: row.attempts + 1,
      });
    } catch (err: any) {
      const nextAttempts = (row.attempts ?? 0) + 1;
      const errMsg = truncate(err?.message ?? String(err));
      if (nextAttempts >= MAX_ATTEMPTS) {
        await pool.query(
          `UPDATE fiscal_document_outbox
              SET attempts = $2,
                  last_error = $3,
                  status = 'failed_needs_review',
                  updated_at = now()
            WHERE id = $1`,
          [row.id, nextAttempts, errMsg],
        );
        logger.error('[FiscalOutboxDrainer] max attempts — flagged for review', {
          id: row.id, kind: row.kind, sourceKey: row.source_key, attempts: nextAttempts, err: errMsg,
        });
      } else {
        const backoff = BACKOFF_SECONDS[Math.min(nextAttempts, BACKOFF_SECONDS.length) - 1];
        await pool.query(
          `UPDATE fiscal_document_outbox
              SET attempts = $2,
                  last_error = $3,
                  next_attempt_at = now() + ($4::int * interval '1 second'),
                  updated_at = now()
            WHERE id = $1`,
          [row.id, nextAttempts, errMsg, backoff],
        );
        logger.warn('[FiscalOutboxDrainer] retry failed — rescheduled', {
          id: row.id, kind: row.kind, sourceKey: row.source_key, attempts: nextAttempts, backoffSec: backoff,
        });
      }
    }
  }
  return processed;
}

/** Boot-time entry point. Safe to call more than once. */
export function startFiscalOutboxDrainer(pool: Pool, deps: DrainerDeps): void {
  if (timer) return;
  const tickMs = parseInt(process.env.FISCAL_OUTBOX_TICK_MS || String(DEFAULT_TICK_MS), 10);
  timer = setInterval(async () => {
    if (running) return; // never overlap two ticks
    running = true;
    try {
      const n = await drainOnce(pool, deps);
      if (n > 0) logger.info('[FiscalOutboxDrainer] tick', { processed: n });
    } catch (err: any) {
      logger.error('[FiscalOutboxDrainer] tick failed', { err: err?.message });
    } finally {
      running = false;
    }
  }, tickMs);
  (timer as any).unref?.();
  logger.info('[FiscalOutboxDrainer] started', { tickMs });
}

export function stopFiscalOutboxDrainer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function truncate(s: string): string {
  return s.length > 1000 ? s.slice(0, 1000) + '…' : s;
}
