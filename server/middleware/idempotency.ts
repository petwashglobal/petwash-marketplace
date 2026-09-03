/**
 * Booking / checkout / POST idempotency middleware — ATOMIC CLAIM.
 *
 * P0-141 CEO fix. The previous SELECT-existing → conditional INSERT
 * pattern was NOT atomic: two concurrent requests with the same
 * `Idempotency-Key` header could both SELECT nothing, both INSERT
 * (ON CONFLICT DO NOTHING), and both call next() — so a strict
 * checkout could double-charge on the exact race the header was
 * designed to prevent.
 *
 * The atomic authority is now:
 *
 *   INSERT INTO idempotency_keys (key, endpoint, response_hash, created_at)
 *   VALUES (${key}, ${endpoint}, 'pending', NOW())
 *   ON CONFLICT (key) DO NOTHING
 *   RETURNING key
 *
 * — the ONE worker whose RETURNING is non-empty owns the claim; all
 * others were beaten by Postgres and MUST NOT call next().
 *
 * State handling for losing workers:
 *
 *   COMPLETE   — the prior claim's response_hash is anything other
 *                than 'pending' (updated by the finalize hook on
 *                res.json/res.end). Return the existing duplicate
 *                message per the pre-existing contract.
 *
 *   PENDING    — the prior claim's response_hash is still 'pending'
 *                AND the row is fresh (age < PENDING_LEASE_MS,
 *                default 5 min). Return 409 IN_PROGRESS so the
 *                client backs off and retries with the SAME key.
 *
 *   STALE      — the prior claim's response_hash is 'pending' AND
 *                the row is older than PENDING_LEASE_MS. Try to
 *                atomically steal via
 *                  UPDATE ... SET created_at = NOW()
 *                  WHERE key = ? AND response_hash = 'pending' AND created_at = ?
 *                  RETURNING key
 *                The UPDATE's exact-timestamp predicate ensures at
 *                most one worker wins the steal.
 *
 * Failure policies:
 *
 *   requireIdempotency (non-money)  — FAIL-OPEN on DB error.
 *                                     next() to keep the app up.
 *   requireStrictIdempotency (money) — FAIL-CLOSED on DB error.
 *                                     Return 503 IDEMPOTENCY_UNAVAILABLE.
 *
 * Storage schema unchanged: existing `idempotency_keys` (see
 * shared/schema.ts §4.5D). No migration required.
 */

import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from './requestIdAndLogs';
import { SystemEventService } from '../services/SystemEventService';

// A row is invisible after 24h (existing repo convention).
const TTL_INTERVAL = "24 hours";
// A 'pending' row older than this is considered a crashed worker —
// another request may steal the claim.
const PENDING_LEASE_MS = parseInt(
  process.env.IDEMPOTENCY_PENDING_LEASE_MS || String(5 * 60 * 1000), // 5 minutes
  10,
);

const PENDING_MARKER = 'pending';

function validateKey(res: Response, key: string | undefined): key is string {
  if (!key) {
    res.status(400).json({
      error: 'MISSING_IDEMPOTENCY_KEY',
      message:
        'Please include an Idempotency-Key header (UUID) to prevent duplicate submissions.',
    });
    return false;
  }
  if (key.length > 128 || !/^[a-zA-Z0-9\-_]+$/.test(key)) {
    res.status(400).json({
      error: 'INVALID_IDEMPOTENCY_KEY',
      message: 'Idempotency-Key must be 1–128 alphanumeric characters.',
    });
    return false;
  }
  return true;
}

/**
 * Atomically insert a new claim OR find out why we can't.
 * Returns:
 *   { state: 'CLAIMED' }
 *   { state: 'COMPLETE', response_hash, created_at }
 *   { state: 'PENDING',  created_at }
 *   { state: 'DB_ERROR', error }
 */
async function attemptClaim(
  key: string,
  endpoint: string,
): Promise<
  | { state: 'CLAIMED' }
  | { state: 'COMPLETE'; response_hash: string; created_at: string }
  | { state: 'PENDING'; created_at: string }
  | { state: 'DB_ERROR'; error: string }
> {
  try {
    const insertRes = await db.execute(sql`
      INSERT INTO idempotency_keys (key, endpoint, response_hash, created_at)
      VALUES (${key}, ${endpoint}, ${PENDING_MARKER}, NOW())
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `);
    if (insertRes.rows.length > 0) return { state: 'CLAIMED' };

    // Someone else already inserted the key. Inspect state within the TTL.
    const lookup = await db.execute(sql`
      SELECT response_hash, created_at
      FROM idempotency_keys
      WHERE key = ${key}
        AND created_at > NOW() - INTERVAL '${sql.raw(TTL_INTERVAL)}'
      LIMIT 1
    `);

    if (lookup.rows.length === 0) {
      // Row exists but is >TTL old. Try to atomically steal by
      // re-initialising it (still gated by the stale timestamp).
      const stolen = await db.execute(sql`
        UPDATE idempotency_keys
        SET response_hash = ${PENDING_MARKER}, created_at = NOW(), endpoint = ${endpoint}
        WHERE key = ${key}
          AND created_at <= NOW() - INTERVAL '${sql.raw(TTL_INTERVAL)}'
        RETURNING key
      `);
      if (stolen.rows.length > 0) return { state: 'CLAIMED' };
      // Another request stole it first — treat as PENDING.
      return { state: 'PENDING', created_at: new Date().toISOString() };
    }

    const row = lookup.rows[0] as { response_hash: string | null; created_at: string };
    const state = String(row.response_hash ?? PENDING_MARKER);
    if (state !== PENDING_MARKER) {
      return { state: 'COMPLETE', response_hash: state, created_at: row.created_at };
    }

    // PENDING. Check the lease.
    const createdAtMs = new Date(row.created_at).getTime();
    const ageMs = Date.now() - createdAtMs;
    if (ageMs > PENDING_LEASE_MS) {
      // Try to steal — exact-timestamp predicate ensures single winner.
      const stolen = await db.execute(sql`
        UPDATE idempotency_keys
        SET created_at = NOW(), endpoint = ${endpoint}
        WHERE key = ${key}
          AND response_hash = ${PENDING_MARKER}
          AND created_at = ${new Date(createdAtMs).toISOString()}::timestamptz
        RETURNING key
      `);
      if (stolen.rows.length > 0) return { state: 'CLAIMED' };
      // Another request stole first — still PENDING for us.
      return { state: 'PENDING', created_at: row.created_at };
    }

    return { state: 'PENDING', created_at: row.created_at };
  } catch (err: any) {
    return { state: 'DB_ERROR', error: err?.message || String(err) };
  }
}

/**
 * Install the finalize hook that stamps the row with the final HTTP
 * status ONCE the response is emitted. Uses res.on('finish') so
 * res.send / res.end / res.status().end() paths are also captured
 * (the previous wrapper only fired on res.json).
 */
function installFinalizeHook(key: string, res: Response) {
  let finalized = false;
  const finalize = () => {
    if (finalized) return;
    finalized = true;
    const marker = JSON.stringify({ status: res.statusCode }).slice(0, 255);
    // Release-blocker B7 (CEO 2026-09-02): on finalize-UPDATE failure the
    // row would previously stay `pending` and block real retries with 409
    // for the full PENDING_LEASE_MS window (5 min default). Recover by
    // DELETing the row so a retry can CLAIM fresh immediately, and log
    // ERROR so ops sees the failure instead of it being silently swallowed.
    db.execute(sql`
      UPDATE idempotency_keys
      SET response_hash = ${marker}
      WHERE key = ${key}
    `).catch((err) => {
      logger.error('[Idempotency] finalize UPDATE failed — releasing lease', {
        key,
        status: res.statusCode,
        err: err?.message || String(err),
      });
      db.execute(sql`DELETE FROM idempotency_keys WHERE key = ${key}`)
        .catch((delErr) => {
          logger.error('[Idempotency] lease-release DELETE ALSO failed — retries will wait for PENDING_LEASE_MS steal', {
            key,
            err: delErr?.message || String(delErr),
          });
        });
    });
  };
  res.on('finish', finalize);
  res.on('close', finalize);
}

function returnCompletedDuplicate(
  res: Response,
  key: string,
  endpoint: string,
  createdAt: string,
  variant: 'strict' | 'lax',
) {
  SystemEventService.doubleSubmitBlocked(
    variant === 'strict' ? 'strict_idempotency' : 'idempotency_middleware',
    key,
    endpoint,
  );
  logger.info(`[Idempotency${variant === 'strict' ? ':strict' : ''}] Duplicate request blocked`, {
    key,
    endpoint,
  });
  return res.status(200).json({
    idempotent: true,
    message:
      variant === 'strict'
        ? 'This request was already processed. No duplicate charge was made.'
        : 'This request was already processed. Your booking was not duplicated.',
    originalProcessedAt: createdAt,
  });
}

function returnInProgress(res: Response, key: string, endpoint: string) {
  logger.info('[Idempotency] Duplicate request currently in progress', { key, endpoint });
  return res.status(409).json({
    error: 'IDEMPOTENT_REQUEST_IN_PROGRESS',
    message:
      'A prior request with this Idempotency-Key is still being processed. Retry with the same key after a short delay.',
  });
}

// ── Public middlewares ─────────────────────────────────────────────────────

/**
 * Non-money idempotency guard. Missing key → 400. DB error → FAIL-OPEN
 * (next()) so the app remains available.
 */
export function requireIdempotency(req: Request, res: Response, next: NextFunction) {
  const key = (req.headers['idempotency-key'] as string | undefined)?.trim();
  if (!validateKey(res, key)) return;
  const endpoint = `${req.method}:${req.path}`;

  (async () => {
    const outcome = await attemptClaim(key, endpoint);
    if (outcome.state === 'CLAIMED') {
      installFinalizeHook(key, res);
      return next();
    }
    if (outcome.state === 'COMPLETE') {
      return returnCompletedDuplicate(res, key, endpoint, outcome.created_at, 'lax');
    }
    if (outcome.state === 'PENDING') {
      return returnInProgress(res, key, endpoint);
    }
    // DB_ERROR — FAIL-OPEN (non-money contract).
    logger.error('[Idempotency] DB claim failed, passing through (FAIL-OPEN)', {
      error: outcome.error,
      key,
      endpoint,
    });
    return next();
  })().catch((err) => {
    logger.error('[Idempotency] unexpected middleware error', { error: err?.message, key });
    return next();
  });
}

/**
 * Money-path idempotency guard. Missing key → 400. DB error →
 * FAIL-CLOSED (503) so the client retries with the same key when the
 * DB recovers instead of double-charging.
 */
export function requireStrictIdempotency(req: Request, res: Response, next: NextFunction) {
  const key = (req.headers['idempotency-key'] as string | undefined)?.trim();
  if (!validateKey(res, key)) return;
  const endpoint = `${req.method}:${req.path}`;

  (async () => {
    const outcome = await attemptClaim(key, endpoint);
    if (outcome.state === 'CLAIMED') {
      installFinalizeHook(key, res);
      return next();
    }
    if (outcome.state === 'COMPLETE') {
      return returnCompletedDuplicate(res, key, endpoint, outcome.created_at, 'strict');
    }
    if (outcome.state === 'PENDING') {
      // Strict: same contract as non-strict — return in-progress. A
      // charging endpoint must NEVER run twice.
      return returnInProgress(res, key, endpoint);
    }
    // DB_ERROR — FAIL-CLOSED.
    logger.error(
      '[Idempotency:strict] DB claim failed — refusing request to prevent duplicate charge',
      { error: outcome.error, key, endpoint },
    );
    return res.status(503).json({
      error: 'IDEMPOTENCY_UNAVAILABLE',
      message:
        'Payment service temporarily unavailable. Please retry with the same Idempotency-Key.',
    });
  })().catch((err) => {
    logger.error(
      '[Idempotency:strict] unexpected middleware error — failing closed',
      { error: err?.message, key },
    );
    return res.status(503).json({
      error: 'IDEMPOTENCY_UNAVAILABLE',
      message:
        'Payment service temporarily unavailable. Please retry with the same Idempotency-Key.',
    });
  });
}

/**
 * Soft idempotency: logs duplicates but doesn't block. No behaviour
 * change from the previous version.
 */
export function softIdempotency(req: Request, res: Response, next: NextFunction) {
  const key = (req.headers['idempotency-key'] as string | undefined)?.trim();
  if (!key) return next();

  (async () => {
    try {
      const rows = await db.execute(sql`
        SELECT created_at FROM idempotency_keys
        WHERE key = ${key} AND created_at > NOW() - INTERVAL '${sql.raw(TTL_INTERVAL)}'
        LIMIT 1
      `);
      if (rows.rows.length > 0) {
        logger.warn('[Idempotency:soft] Duplicate request detected (not blocked)', {
          key,
          endpoint: `${req.method}:${req.path}`,
        });
      }
    } catch {}
    next();
  })();
}
