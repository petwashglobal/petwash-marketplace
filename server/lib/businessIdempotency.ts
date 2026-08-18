/**
 * Business-side idempotency helper — FAIL-CLOSED semantics.
 *
 * Distinct from server/lib/eventNotificationIdempotency.ts (PR #1802),
 * which is the lifecycle-notification helper that intentionally
 * FAIL-OPENs on DB errors (rare double-notify > silent drop).
 *
 * This module is for BUSINESS create/mutate operations that must never
 * silently duplicate — provider-application submit, staff-application
 * submit, prestige join, loyalty replay, egift redeem, etc. On DB
 * error the caller MUST fail closed (HTTP 503) so the client can
 * retry safely with the same key when the DB recovers.
 *
 * Storage: same `idempotency_keys` table (`key varchar(128) PRIMARY KEY`,
 * 24-hour TTL). Atomic uniqueness comes from the primary-key
 * constraint + `INSERT ... ON CONFLICT (key) DO NOTHING RETURNING key`.
 *
 * State machine:
 *   in_progress   — the claiming worker is currently executing the op
 *   done          — a prior call finalized as success
 *   (row missing) — never seen, or explicitly released by a failure
 *
 * No lease auto-steal on the business surface: a stale 'in_progress'
 * MUST be resolved by an operator (a stuck business op could indicate
 * a partial write that a silent takeover would compound).
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from './logger';

export type BusinessClaimOutcome =
  | 'CLAIMED'      // caller owns the write; proceed
  | 'IN_FLIGHT'    // another worker is currently processing this key
  | 'DONE'         // a prior call already completed for this key
  | 'DB_ERROR';    // caller MUST fail closed (HTTP 503)

export async function claimBusinessOnce(
  key: string,
  endpoint: string,
): Promise<BusinessClaimOutcome> {
  if (!key || typeof key !== 'string') return 'DB_ERROR';
  try {
    const insertRes = await db.execute(sql`
      INSERT INTO idempotency_keys (key, endpoint, response_hash, created_at)
      VALUES (${key}, ${endpoint}, 'in_progress', NOW())
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `);
    if (insertRes.rows.length > 0) return 'CLAIMED';

    const lookup = await db.execute(sql`
      SELECT response_hash
      FROM idempotency_keys
      WHERE key = ${key}
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `);
    if (lookup.rows.length === 0) {
      // Row exists but is >24h old — do NOT auto-steal for business ops.
      // Operator can DELETE the stale row manually if needed.
      return 'IN_FLIGHT';
    }
    const state = String((lookup.rows[0] as any).response_hash ?? 'in_progress');
    if (state === 'done') return 'DONE';
    return 'IN_FLIGHT';
  } catch (err: any) {
    logger.error('[BusinessIdempotency] claim() DB error — FAIL-CLOSED', {
      key,
      endpoint,
      error: err?.message,
    });
    return 'DB_ERROR';
  }
}

export async function finalizeBusinessClaim(
  key: string,
  ok: boolean,
): Promise<void> {
  if (!key) return;
  try {
    if (ok) {
      await db.execute(sql`
        UPDATE idempotency_keys
        SET response_hash = 'done'
        WHERE key = ${key}
      `);
    } else {
      await db.execute(sql`
        DELETE FROM idempotency_keys
        WHERE key = ${key}
      `);
    }
  } catch (err: any) {
    logger.warn('[BusinessIdempotency] finalize() DB error', {
      key,
      ok,
      error: err?.message,
    });
  }
}
