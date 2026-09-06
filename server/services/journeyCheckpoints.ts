/**
 * Lane C · Journey Brain Phase 2 (post-release 2026-09-03).
 *
 * JourneyCheckpoint service. Small durable-state layer over the
 * `journey_checkpoints` table added by migration 0144.
 *
 * Safety model (CEO):
 *   • This layer holds an OPAQUE JSON blob of the wizard's in-flight
 *     state. It does NOT interpret payment status, ledger balances,
 *     entitlements, or any financial truth. The RESUMING wizard is
 *     the sole arbiter of what to do with the blob.
 *   • On resume, ALL money / state / permission gates re-run from
 *     canonical sources. A checkpoint is a UX resume hint, not an
 *     authority.
 *   • UNIQUE (user_uid, domain) so a save does not accumulate every
 *     abandoned attempt.
 *   • Refuses expired rows (`expires_at <= now()`) — they're treated
 *     as absent so a stale draft can't magically reappear months
 *     later and re-charge a card, re-notify a provider, etc.
 *
 * The runtime callers (walk wizard, sitter wizard, marketplace book,
 * shop checkout, egift, provider apply) live in their own routes and
 * import this service.
 */

import type { Pool } from 'pg';
import { logger } from '../lib/logger';

export type JourneyDomain =
  | 'walk_book'
  | 'sitter_book'
  | 'marketplace_book'
  | 'academy_book'
  | 'shop_checkout'
  | 'egift'
  | 'provider_apply';

export interface JourneyCheckpointRow {
  id: string;
  userUid: string;
  domain: JourneyDomain;
  payload: unknown;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_TTL_HOURS = 72;

function ttlToTimestamp(ttlHours?: number): Date {
  const hours =
    typeof ttlHours === 'number' && ttlHours > 0 ? ttlHours : DEFAULT_TTL_HOURS;
  const t = new Date();
  t.setTime(t.getTime() + hours * 3600 * 1000);
  return t;
}

/**
 * UPSERT one checkpoint. Same `(user_uid, domain)` replaces the
 * existing row (bumps `updated_at`); does not stack.
 */
export async function saveCheckpoint(
  pool: Pool,
  args: {
    userUid: string;
    domain: JourneyDomain;
    payload: unknown;
    ttlHours?: number;
  },
): Promise<void> {
  const expiresAt = ttlToTimestamp(args.ttlHours);
  try {
    await pool.query(
      `INSERT INTO journey_checkpoints
         (user_uid, domain, payload, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, now(), now())
       ON CONFLICT (user_uid, domain) DO UPDATE
         SET payload = EXCLUDED.payload,
             expires_at = EXCLUDED.expires_at,
             updated_at = now()`,
      [args.userUid, args.domain, JSON.stringify(args.payload ?? {}), expiresAt],
    );
  } catch (err: any) {
    // Fail-soft: a broken checkpoint save must NEVER take down the
    // wizard's happy path. Log and move on — the user just won't see
    // "resume where you left off" next time.
    logger.warn('[JourneyCheckpoint] save failed', {
      userUid: args.userUid,
      domain: args.domain,
      error: err?.message,
    });
  }
}

/**
 * Read the ONE active checkpoint for (user, domain), or null if
 * absent / expired. The resuming wizard is responsible for re-
 * validating every gate against canonical truth before acting.
 */
export async function getActiveCheckpoint(
  pool: Pool,
  args: { userUid: string; domain: JourneyDomain },
): Promise<JourneyCheckpointRow | null> {
  try {
    const r = await pool.query(
      `SELECT id, user_uid, domain, payload, expires_at, created_at, updated_at
         FROM journey_checkpoints
        WHERE user_uid = $1
          AND domain = $2
          AND expires_at > now()
        LIMIT 1`,
      [args.userUid, args.domain],
    );
    if (r.rowCount === 0) return null;
    const row = r.rows[0];
    return {
      id: row.id,
      userUid: row.user_uid,
      domain: row.domain as JourneyDomain,
      payload: row.payload,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (err: any) {
    logger.warn('[JourneyCheckpoint] read failed', {
      userUid: args.userUid,
      domain: args.domain,
      error: err?.message,
    });
    return null;
  }
}

/** List every active checkpoint for a user (attention-feed use). */
export async function listActiveCheckpoints(
  pool: Pool,
  args: { userUid: string },
): Promise<JourneyCheckpointRow[]> {
  try {
    const r = await pool.query(
      `SELECT id, user_uid, domain, payload, expires_at, created_at, updated_at
         FROM journey_checkpoints
        WHERE user_uid = $1
          AND expires_at > now()
        ORDER BY updated_at DESC`,
      [args.userUid],
    );
    return r.rows.map((row: any) => ({
      id: row.id,
      userUid: row.user_uid,
      domain: row.domain as JourneyDomain,
      payload: row.payload,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  } catch (err: any) {
    logger.warn('[JourneyCheckpoint] list failed', {
      userUid: args.userUid,
      error: err?.message,
    });
    return [];
  }
}

/**
 * Clear the checkpoint for (user, domain). Called by the wizard AFTER
 * the flow succeeds or the user explicitly abandons.
 */
export async function clearCheckpoint(
  pool: Pool,
  args: { userUid: string; domain: JourneyDomain },
): Promise<void> {
  try {
    await pool.query(
      `DELETE FROM journey_checkpoints
        WHERE user_uid = $1 AND domain = $2`,
      [args.userUid, args.domain],
    );
  } catch (err: any) {
    logger.warn('[JourneyCheckpoint] clear failed', {
      userUid: args.userUid,
      domain: args.domain,
      error: err?.message,
    });
  }
}

/**
 * Sweep expired rows. Called by the periodic maintenance tick so
 * expired-but-not-yet-deleted rows do not accumulate forever.
 */
export async function pruneExpiredCheckpoints(pool: Pool): Promise<number> {
  try {
    const r = await pool.query(
      `DELETE FROM journey_checkpoints
        WHERE expires_at <= now()`,
    );
    return r.rowCount ?? 0;
  } catch (err: any) {
    logger.warn('[JourneyCheckpoint] prune failed', { error: err?.message });
    return 0;
  }
}
