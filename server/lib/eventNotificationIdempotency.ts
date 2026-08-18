/**
 * Canonical lifecycle-notification idempotency helper.
 *
 * ONE reusable module used by every event-bus notification handler that
 * needs "send this exactly once per event". Replaces the three
 * inline SELECT-then-INSERT helpers in NotificationEventHandlers.ts
 * that CEO review flagged as racey and as permanent-suppression risks.
 *
 * Storage: the existing `idempotency_keys` table (Phase 4.5D — see
 * shared/schema.ts). `key` is the primary key, so
 * `INSERT ... ON CONFLICT (key) DO NOTHING RETURNING key` is atomic
 * against concurrent workers: exactly one INSERT succeeds and returns
 * a row; the others return no row.
 *
 * Lifecycle:
 *
 *   1. claim(key)
 *      - INSERT with response_hash='pending' ON CONFLICT DO NOTHING
 *      - Row inserted → returns 'CLAIMED'         (this worker sends)
 *      - Row exists with 'sent'                    → returns 'ALREADY_SENT'
 *      - Row exists with 'pending' + fresh lease   → returns 'IN_FLIGHT'
 *      - Row exists with 'pending' + stale lease   → tries to STEAL
 *        (atomic UPDATE only if the stale timestamp is still present),
 *        so at most one worker takes ownership. Returns 'CLAIMED' on
 *        success, 'IN_FLIGHT' if another worker stole the lease first.
 *
 *   2. finalize(key, ok)
 *      - ok=true  → UPDATE response_hash='sent' (permanent, TTL still applies)
 *      - ok=false → DELETE the row so a redelivered event can re-claim
 *
 *   3. TTL: `created_at > NOW() - INTERVAL '24 hours'` gates every
 *      lookup so a persisted 'sent' marker naturally ages out after
 *      24h and does not lock the key forever.
 *
 * Fail policy:
 *   - claim() on DB error → returns 'DB_ERROR'; the caller decides
 *     whether to proceed. Lifecycle notification handlers use
 *     fail-open (a rare double-notify beats silently dropping the
 *     notice). Money-side callers MUST NOT reuse this fail-open —
 *     use requireStrictIdempotency middleware / a money-scoped helper.
 *   - finalize() on DB error → logs and swallows; the lease timeout
 *     eventually resolves.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from './logger';

export type ClaimOutcome =
  | 'CLAIMED'         // proceed to send
  | 'ALREADY_SENT'    // skip; a prior send finalized as success
  | 'IN_FLIGHT'       // skip; another worker holds an unexpired pending lease
  | 'DB_ERROR';       // caller decides fail-open vs fail-closed

const DEFAULT_LEASE_MS = 10 * 60 * 1000; // 10 min — how long a 'pending' row is trusted

export interface ClaimOptions {
  /** How long a `pending` claim is considered live before another worker may steal it. */
  leaseMs?: number;
}

/**
 * Attempt to claim exclusive ownership of an event notification.
 * The returned outcome tells the caller what to do — see ClaimOutcome.
 */
export async function claimEventNotification(
  key: string,
  opts: ClaimOptions = {},
): Promise<ClaimOutcome> {
  if (!key || typeof key !== 'string') return 'DB_ERROR';
  const leaseMs = Math.max(1000, opts.leaseMs ?? DEFAULT_LEASE_MS);

  try {
    // Step 1 — atomic first-claim attempt. If nobody has ever claimed
    // this key, this inserts the pending row and returns it.
    const insertRes = await db.execute(sql`
      INSERT INTO idempotency_keys (key, endpoint, response_hash, created_at)
      VALUES (${key}, ${'event-notification'}, 'pending', NOW())
      ON CONFLICT (key) DO NOTHING
      RETURNING key, created_at
    `);
    if (insertRes.rows.length > 0) {
      return 'CLAIMED';
    }

    // Step 2 — a row already exists. Inspect state + lease.
    const lookup = await db.execute(sql`
      SELECT response_hash, created_at
      FROM idempotency_keys
      WHERE key = ${key}
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `);
    if (lookup.rows.length === 0) {
      // Row exists but is >24h old — it is invisible via the TTL guard.
      // Steal by re-inserting fresh state (still atomic — ON CONFLICT UPDATE
      // gated on the stale timestamp).
      const stolen = await db.execute(sql`
        UPDATE idempotency_keys
        SET response_hash = 'pending', created_at = NOW()
        WHERE key = ${key}
          AND created_at <= NOW() - INTERVAL '24 hours'
        RETURNING key
      `);
      return stolen.rows.length > 0 ? 'CLAIMED' : 'IN_FLIGHT';
    }

    const row = lookup.rows[0] as { response_hash: string | null; created_at: string };
    const state = String(row.response_hash ?? 'pending');
    if (state === 'sent') {
      return 'ALREADY_SENT';
    }

    // state === 'pending' (or unknown). If the lease has expired, try to
    // steal it atomically — the WHERE clause guarantees only one caller
    // wins the race.
    const createdAtMs = new Date(row.created_at).getTime();
    const ageMs = Date.now() - createdAtMs;
    if (ageMs > leaseMs) {
      const stolen = await db.execute(sql`
        UPDATE idempotency_keys
        SET created_at = NOW()
        WHERE key = ${key}
          AND response_hash = 'pending'
          AND created_at = ${new Date(createdAtMs).toISOString()}::timestamptz
        RETURNING key
      `);
      return stolen.rows.length > 0 ? 'CLAIMED' : 'IN_FLIGHT';
    }

    return 'IN_FLIGHT';
  } catch (err: any) {
    logger.warn('[EventNotificationIdempotency] claim() DB error', {
      key,
      error: err?.message,
    });
    return 'DB_ERROR';
  }
}

/**
 * Finalize a previously-claimed notification.
 *   ok = true  → the send succeeded; the marker persists (until TTL) so
 *                a redelivered event skips.
 *   ok = false → the send failed; DELETE the marker so the next
 *                redelivery may re-claim and try again. This is what
 *                prevents a transient SendGrid/push failure from
 *                permanently suppressing a lifecycle notice.
 */
export async function finalizeEventNotification(
  key: string,
  ok: boolean,
): Promise<void> {
  if (!key) return;
  try {
    if (ok) {
      await db.execute(sql`
        UPDATE idempotency_keys
        SET response_hash = 'sent'
        WHERE key = ${key}
      `);
    } else {
      await db.execute(sql`
        DELETE FROM idempotency_keys
        WHERE key = ${key}
      `);
    }
  } catch (err: any) {
    // Non-fatal — a stale 'pending' row will be reclaimable via lease
    // expiry, a stale 'sent' row will age out via TTL.
    logger.warn('[EventNotificationIdempotency] finalize() DB error', {
      key,
      ok,
      error: err?.message,
    });
  }
}

/**
 * Convenience combinator: claim, run the sender, finalize based on the
 * sender's result. Returns true if this worker actually dispatched.
 *
 * `sender` MUST return { success: boolean } (mirrors
 * NotificationService.sendNotification's contract). If the sender
 * throws, the claim is released so the next redelivery may retry.
 */
export async function dispatchOnce(
  key: string,
  sender: () => Promise<{ success: boolean }>,
  opts: ClaimOptions = {},
): Promise<{ dispatched: boolean; outcome: ClaimOutcome; sendOk?: boolean }> {
  const outcome = await claimEventNotification(key, opts);
  if (outcome !== 'CLAIMED') {
    return { dispatched: false, outcome };
  }
  try {
    const result = await sender();
    await finalizeEventNotification(key, !!result?.success);
    return { dispatched: true, outcome, sendOk: !!result?.success };
  } catch (err) {
    await finalizeEventNotification(key, false);
    throw err;
  }
}
