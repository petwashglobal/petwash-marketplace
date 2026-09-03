/**
 * Kill-switch and idempotency helpers — Release-blocker A1 / A2 fix
 * (CEO 2026-09-02 release freeze).
 *
 * The prior implementations returned "permitted" on any Postgres
 * failure — so a DB blip silently re-enabled every dangerous flag
 * (payouts, remittances, automation, policy_execution,
 * assistant_execution) AND turned "check idempotency" into "no record,
 * this is a new mutation". Both patterns fail OPEN under uncertainty.
 *
 * The rule for money paths: when we cannot determine safety, DENY.
 *
 *   - getKillSwitchAllowed(pool, key): throws KillSwitchUnavailableError
 *     on DB failure OR a missing row. Callers MUST catch and return a
 *     503 "operation denied" — never fall through as "permitted".
 *
 *   - checkIdempotency(pool, key, endpoint): throws
 *     IdempotencyUnavailableError on DB failure. Callers MUST treat
 *     "unknown" as "unsafe to proceed" and return 503; a money
 *     mutation under uncertainty must not become a fresh charge.
 *
 *   - recordIdempotency(pool, key, endpoint, json): throws on DB
 *     failure. If we cannot RECORD the mutation, we cannot honour a
 *     future retry either — surface the failure so the caller aborts
 *     the response.
 *
 * Extracted from server/routes/prestige-pass.ts so the fail-closed
 * contract can be unit-tested in isolation (behavioural test:
 * server/tests/prestigeKillSwitchFailClosed.behavior.test.ts).
 */

import type { Pool } from 'pg';
import { logger } from './logger';

export class KillSwitchUnavailableError extends Error {
  readonly key: string;
  constructor(key: string, cause: unknown) {
    super(`kill_switch_unavailable:${key}`);
    this.name = 'KillSwitchUnavailableError';
    this.key = key;
    (this as any).cause = cause;
  }
}

export class IdempotencyUnavailableError extends Error {
  readonly endpoint: string;
  constructor(endpoint: string, cause: unknown) {
    super(`idempotency_unavailable:${endpoint}`);
    this.name = 'IdempotencyUnavailableError';
    this.endpoint = endpoint;
    (this as any).cause = cause;
  }
}

/**
 * Returns true when the dangerous operation named by `key` is PERMITTED.
 * Throws KillSwitchUnavailableError on any DB failure — the caller must
 * treat that as "denied" and return a 503, never fall through as
 * "permitted".
 *
 * A missing row is treated as UNKNOWN (config bug or un-seeded env).
 * The safer default is to deny; the helper throws so an operator sees
 * the error rather than a silent grant.
 */
export async function getKillSwitchAllowed(
  pool: Pool,
  key: string,
): Promise<boolean> {
  try {
    const r = await pool.query(
      `SELECT enabled FROM system_kill_switches WHERE key = $1`,
      [key],
    );
    if (!r.rows.length) {
      logger.error('[KillSwitch] row missing — denying operation', { key });
      throw new KillSwitchUnavailableError(key, new Error('row_missing'));
    }
    return r.rows[0].enabled === true;
  } catch (err) {
    if (err instanceof KillSwitchUnavailableError) throw err;
    logger.error('[KillSwitch] DB read failed — denying operation', {
      key,
      err: (err as Error).message,
    });
    throw new KillSwitchUnavailableError(key, err);
  }
}

export async function checkIdempotency(
  pool: Pool,
  iKey: string,
  endpoint: string,
): Promise<{ hit: boolean; responseHash?: string }> {
  try {
    const r = await pool.query(
      `SELECT response_hash FROM idempotency_keys WHERE key = $1 AND endpoint = $2`,
      [iKey, endpoint],
    );
    if (r.rows.length) return { hit: true, responseHash: r.rows[0].response_hash };
    return { hit: false };
  } catch (err) {
    logger.error('[Idempotency] DB read failed — cannot determine retry safety', {
      endpoint,
      err: (err as Error).message,
    });
    throw new IdempotencyUnavailableError(endpoint, err);
  }
}

export async function recordIdempotency(
  pool: Pool,
  iKey: string,
  endpoint: string,
  responseJson: string,
): Promise<void> {
  const hash = Buffer.from(responseJson).toString('base64').slice(0, 128);
  try {
    await pool.query(
      `INSERT INTO idempotency_keys (key, endpoint, response_hash) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
      [iKey, endpoint, hash],
    );
  } catch (err) {
    logger.error('[Idempotency] DB write failed — cannot honour future retry', {
      endpoint,
      err: (err as Error).message,
    });
    throw new IdempotencyUnavailableError(endpoint, err);
  }
}
