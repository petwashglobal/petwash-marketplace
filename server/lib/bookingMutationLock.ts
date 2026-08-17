/**
 * Booking-scoped serialization lock — Lane B (2026-08-17).
 *
 * Wraps a critical section (typically a confirm / refund handler) in a
 * Postgres session-level advisory lock keyed on the booking / refund /
 * session id, so two concurrent requests for the SAME row are serialized:
 * the first runs to completion, the second waits and — when it acquires
 * the lock — re-reads state and sees the row is already in the target
 * terminal state (via the caller's existing status gate).
 *
 * Why advisory locks (not a status-transition update):
 *   Several code paths call money rails (Nayax capture, WalletLedger,
 *   IsraeliDigitalReceiptService) BEFORE the status flip. A conditional
 *   `UPDATE ... WHERE status = <prev>` alone does not prevent two callers
 *   both entering the money-side work, then both writing the same terminal
 *   status. An advisory lock held for the entire handler blocks the second
 *   caller until the first has completed the money side + committed the
 *   status change.
 *
 * Why a spin-wait around `pg_try_advisory_lock`:
 *   A pure `pg_advisory_lock` would block a Drizzle connection until the
 *   holder releases — no Node-side deadline is possible. We spin at 25 ms
 *   intervals until a 5 s cap, then throw `BookingMutationLockTimeoutError`
 *   which callers surface as 503 (retryable).
 *
 * Money-code invariance: this file introduces NO change to any amount,
 * percentage, VAT calculation, commission, payout timing, or refund
 * eligibility rule. It only serializes access so the existing rules run
 * exactly once per business event. See petwash-money-booking-invariants §4.
 */

import { sql } from 'drizzle-orm';
import { db } from '../db';
import { logger } from './logger';

export class BookingMutationLockTimeoutError extends Error {
  constructor(readonly namespace: string, readonly key: string) {
    super(`Timed out waiting for booking-mutation lock: ${namespace}:${key}`);
    this.name = 'BookingMutationLockTimeoutError';
  }
}

export interface WithBookingMutationLockOptions {
  /** Wait budget for acquiring the lock. Default 5000 ms. */
  waitMs?: number;
  /** Poll interval between try-lock attempts. Default 25 ms. */
  pollMs?: number;
}

const DEFAULT_WAIT_MS = 5_000;
const DEFAULT_POLL_MS = 25;

/**
 * Derive a stable 32-bit signed integer from an arbitrary string, matching
 * TaxSequenceService.stableIntFromString so we can safely coexist with the
 * existing advisory-lock users.
 */
function stableInt32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash > 0x7fffffff ? hash - 0x100000000 : hash;
}

function lockKey(namespace: string, key: string): number {
  return stableInt32(`pw_booking_mut:${namespace}:${key}`);
}

/**
 * Run `fn` while holding a session-level advisory lock keyed on
 * (`namespace`, `key`). The lock is released in a `finally` block, even on
 * throw. Non-recoverable errors bubble up to the caller unchanged.
 *
 * Usage:
 *   await withBookingMutationLock('sitter-accept', bookingId, async () => {
 *     // re-read state, run status gate, then money side, then commit
 *   });
 *
 * `namespace` disambiguates surfaces that share a `key` shape (e.g.
 * 'sitter-accept' vs 'walk-accept' both keyed on bookingId). Use a short
 * kebab-case tag.
 */
export async function withBookingMutationLock<T>(
  namespace: string,
  key: string,
  fn: () => Promise<T>,
  opts: WithBookingMutationLockOptions = {},
): Promise<T> {
  const waitMs = Math.max(1, opts.waitMs ?? DEFAULT_WAIT_MS);
  const pollMs = Math.max(1, opts.pollMs ?? DEFAULT_POLL_MS);
  const keyInt = lockKey(namespace, key);
  const deadline = Date.now() + waitMs;

  let acquired = false;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result: any = await db.execute(
      sql`SELECT pg_try_advisory_lock(${keyInt}) AS got`,
    );
    const row = (result?.rows ?? result)[0] ?? {};
    if (row.got === true || row.got === 't' || row.got === 1) {
      acquired = true;
      break;
    }
    if (Date.now() >= deadline) break;
    await new Promise((r) => setTimeout(r, pollMs));
  }

  if (!acquired) {
    logger.warn('[BookingMutationLock] Timed out waiting for advisory lock', {
      namespace, key, waitMs,
    });
    throw new BookingMutationLockTimeoutError(namespace, key);
  }

  try {
    return await fn();
  } finally {
    try {
      await db.execute(sql`SELECT pg_advisory_unlock(${keyInt})`);
    } catch (err: any) {
      logger.warn('[BookingMutationLock] Failed to release advisory lock (will auto-release on connection close)', {
        namespace, key, error: err?.message,
      });
    }
  }
}

/** Exposed for testing: same key derivation the runtime uses. */
export function _lockKeyForTest(namespace: string, key: string): number {
  return lockKey(namespace, key);
}
