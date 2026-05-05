/**
 * idempotency-helper.ts
 *
 * Shared helper that wraps any money-touching route handler with the
 * `walletIdempotencyKeys` replay-cache pattern established in PR-W4
 * (`/topup`) and PR-W7 (`/credits/add`, `/admin/inject`).
 *
 * Used by:
 *   • PR-W45 — escrow mutations (create/release/refund/dispute/auto-release)
 *   • PR-W46 — treasury batches (mark-paid / reconcile-sweep)
 *   • PR-W44 — gift-cards activate-wallet (replay-return original payload)
 *
 * Behaviour:
 *   1. INSERT walletIdempotencyKeys ON CONFLICT DO NOTHING.
 *   2. If insert wins → run the operation, then UPDATE the row with the
 *      response JSON for future replay-return.
 *   3. If insert loses (replay) → SELECT the existing row:
 *        - If responseJson is set, return it (replay-cache hit).
 *        - Otherwise return 409 IDEMPOTENCY_IN_FLIGHT (first request
 *          still running).
 *   4. If the operation throws, DELETE the lock so the client can retry.
 *
 * Pure-ish: the helper itself touches only `walletIdempotencyKeys`. The
 * caller's `operation` callback is responsible for its own DB writes,
 * audit events, and ledger rows.
 */

import { db } from '../db';
import { walletIdempotencyKeys } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from './logger';

/** 30 days — same as PR-W4 topup. */
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Column width on walletIdempotencyKeys.idempotency_key */
const KEY_MAX_LEN = 128;

export interface IdempotencyKeyDeriver<TBody> {
  /** Stable namespace prefix, e.g. `escrow:create`. */
  endpoint: string;
  /** Derive a per-request fingerprint from the body. Caller decides what
   *  fields are part of the fingerprint (typically: actor, target, amount). */
  fromBody: (body: TBody) => string;
}

export interface IdempotencyOptions<TBody, TResponse> {
  endpoint: string;
  bodyFingerprint: (body: TBody) => string;
  /** Header value (raw `req.headers['idempotency-key']`). */
  headerKey?: string | string[] | undefined;
  /** TTL override (default 30 days). */
  ttlMs?: number;
  /** The actual money operation. Must return JSON-serialisable. */
  operation: () => Promise<TResponse>;
  /** Body for fingerprinting. */
  body: TBody;
  /** Optional logger context (userId, traceId). */
  logContext?: Record<string, unknown>;
}

export type IdempotencyResult<TResponse> =
  | { kind: 'fresh'; response: TResponse }
  | { kind: 'replay'; response: TResponse }
  | { kind: 'in_flight'; existingStatus: string | null };

/**
 * Derive the canonical idempotency key for a request.
 *
 * Prefers the explicit `Idempotency-Key` header; falls back to
 * `endpoint:<bodyFingerprint>` so that even clients that forget the
 * header still get same-payload replay protection.
 *
 * Always returns a string ≤ 128 chars.
 */
export function deriveIdempotencyKey(opts: {
  endpoint: string;
  headerKey: string | string[] | undefined;
  bodyFingerprint: string;
}): string {
  const fromHeader =
    typeof opts.headerKey === 'string' ? opts.headerKey.trim()
    : Array.isArray(opts.headerKey) ? opts.headerKey[0]?.trim() ?? ''
    : '';
  const raw = fromHeader || opts.bodyFingerprint || '';
  const fullPrefix = `${opts.endpoint}:`;
  const maxRaw = KEY_MAX_LEN - fullPrefix.length;
  return `${fullPrefix}${raw.slice(0, Math.max(0, maxRaw))}`;
}

/**
 * Run `operation` exactly once for a given request signature.
 *
 * Returns:
 *   - { kind: 'fresh', response }   — first call; operation just ran.
 *   - { kind: 'replay', response }  — duplicate call; cached payload returned.
 *   - { kind: 'in_flight' }         — duplicate call but first is still
 *                                     running. Caller should respond 409.
 *
 * On `operation` throw: the lock is rolled back (DELETE) so the client
 * can retry. The error is re-thrown for the caller to log + 5xx.
 */
export async function runWithIdempotency<TBody, TResponse>(
  opts: IdempotencyOptions<TBody, TResponse>,
): Promise<IdempotencyResult<TResponse>> {
  const idemKey = deriveIdempotencyKey({
    endpoint: opts.endpoint,
    headerKey: opts.headerKey,
    bodyFingerprint: opts.bodyFingerprint(opts.body),
  });
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs);

  // 1. Try to claim the key (INSERT ON CONFLICT DO NOTHING).
  const inserted = await db
    .insert(walletIdempotencyKeys)
    .values({
      idempotencyKey: idemKey,
      endpoint: opts.endpoint,
      status: 'pending',
      expiresAt,
    })
    .onConflictDoNothing()
    .returning({ id: walletIdempotencyKeys.id });

  if (inserted.length === 0) {
    // 2. Replay: someone else holds the lock.
    const [existing] = await db
      .select()
      .from(walletIdempotencyKeys)
      .where(eq(walletIdempotencyKeys.idempotencyKey, idemKey))
      .limit(1);
    if (existing?.responseJson) {
      try {
        const cached = JSON.parse(existing.responseJson) as TResponse;
        logger.info('[Idempotency] replay hit — cached payload returned', {
          ...opts.logContext, idemKey, endpoint: opts.endpoint,
        });
        return { kind: 'replay', response: cached };
      } catch {
        // Cached JSON corrupt — fall through to in_flight rather than
        // returning a half-broken response.
      }
    }
    logger.warn('[Idempotency] in-flight collision', {
      ...opts.logContext, idemKey, endpoint: opts.endpoint,
      existingStatus: existing?.status ?? null,
    });
    return { kind: 'in_flight', existingStatus: existing?.status ?? null };
  }

  // 3. Fresh: we own the lock. Run the operation, then cache the response.
  let response: TResponse;
  try {
    response = await opts.operation();
  } catch (err) {
    // Roll back the lock so the client can retry without waiting for TTL.
    try {
      await db
        .delete(walletIdempotencyKeys)
        .where(eq(walletIdempotencyKeys.idempotencyKey, idemKey));
    } catch (delErr) {
      logger.warn('[Idempotency] failed to roll back lock after operation error', {
        ...opts.logContext, idemKey, error: String(delErr),
      });
    }
    throw err;
  }

  // 4. Persist the response for future replays.
  try {
    await db
      .update(walletIdempotencyKeys)
      .set({ responseJson: JSON.stringify(response), status: 'success' })
      .where(eq(walletIdempotencyKeys.idempotencyKey, idemKey));
  } catch (updateErr) {
    // Non-fatal — the response IS being sent; subsequent retries will hit
    // the in_flight branch until the 30-day expiry sweeps.
    logger.warn('[Idempotency] failed to record cached response (non-blocking)', {
      ...opts.logContext, idemKey, error: String(updateErr),
    });
  }
  return { kind: 'fresh', response };
}
