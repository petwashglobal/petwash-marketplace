/**
 * Database WRITE-readiness probe (2026-09-07).
 *
 * On 2026-09-06, 12:09–12:14 UTC, production accepted reads and refused every
 * write. `/api/health` ran `SELECT 1`, which a read-only database passes, so
 * database health reported green for the entire window while the fiscal outbox
 * drainer, async job worker, job dispatcher and Cortina sweep were all failing.
 * The 5xx alert fired correctly — alerting was not the gap. The gap was that
 * nothing distinguished "unreachable" from "reachable but not writable".
 *
 * This module reports those as SEPARATE facts:
 *
 *   dbReachable       a connection can be checked out of the pool
 *   dbReadable        a trivial SELECT succeeds
 *   dbWritable        a committed UPDATE against the ops probe table succeeds
 *   dbWriteErrorCode  the raw PostgreSQL SQLSTATE, surfaced not swallowed
 *   dbWriteErrorKind  that SQLSTATE classified into an operator-facing label
 *   dbWriteLatencyMs  how long the write took
 *
 * DESIGN RULES
 *   • Writes go ONLY to ops_db_write_probe (migration 0147) — a singleton
 *     control-plane row holding no business data. Never point this at a
 *     customer, booking, payment or fiscal table.
 *   • Never throws. A probe that can crash the health endpoint is worse than
 *     no probe. Every failure becomes a structured result.
 *   • LIVENESS MUST NOT DEPEND ON THIS. If Cloud Run restarts containers when
 *     writes fail, a read-only database becomes a restart storm on top of an
 *     outage. Callers use this for READINESS and alerting only.
 *   • Results are cached briefly so health polling does not turn into a write
 *     per request.
 */

import { pool, db, isDatabaseAvailable } from '../db';
import { sql } from 'drizzle-orm';

/** How the write failed, in terms an operator can act on. */
export type DbWriteErrorKind =
  | 'READ_ONLY'          // the database refuses writes but is otherwise healthy
  | 'CONNECTION'         // cannot reach / cannot get a connection
  | 'PERMISSION'         // authenticated, but not allowed to write
  | 'MISSING_PROBE_TABLE'// migration 0147 has not been applied
  | 'TIMEOUT'
  | 'UNKNOWN'
  | 'NOT_CONFIGURED';    // no DATABASE_URL at all

export interface DbWriteReadiness {
  dbReachable: boolean;
  dbReadable: boolean;
  dbWritable: boolean;
  dbWriteErrorCode: string | null;
  dbWriteErrorKind: DbWriteErrorKind | null;
  dbWriteErrorMessage: string | null;
  dbWriteLatencyMs: number | null;
  checkedAt: string;
}

/**
 * PostgreSQL SQLSTATEs this probe interprets.
 *
 * 25006 read_only_sql_transaction is THE code behind "cannot execute UPDATE in
 * a read-only transaction" — the exact 2026-09-06 failure. It is the one code
 * that must never be flattened into a generic 500, because it means the
 * database is alive and answering while silently refusing all work.
 */
export const SQLSTATE_READ_ONLY_TRANSACTION = '25006';

const READ_ONLY_CODES = new Set([
  SQLSTATE_READ_ONLY_TRANSACTION, // read_only_sql_transaction
  '25P02',                        // in_failed_sql_transaction
]);
const CONNECTION_CODES = new Set([
  '08000', '08003', '08006', '08001', '08004', // connection exception family
  '57P01', '57P02', '57P03',                   // admin shutdown / crash / cannot connect now
  '53300',                                     // too_many_connections
]);
const PERMISSION_CODES = new Set([
  '42501', // insufficient_privilege
  '28000', '28P01', // invalid_authorization / invalid_password
]);
const MISSING_TABLE_CODES = new Set([
  '42P01', // undefined_table — migration 0147 not applied
]);

/**
 * Classify a driver error into an operator-facing kind. Pure and exported so it
 * is unit-testable with no database — the 2026-09-06 shapes are pinned in
 * server/tests/dbWriteReadiness.regression.test.ts.
 *
 * SQLSTATE is authoritative when present. The message fallback exists because
 * a pooled/serverless driver can wrap the original error and lose `code`, and
 * a read-only database misreported as UNKNOWN is exactly the failure this
 * module was built to end.
 */
export function classifyWriteError(err: unknown): {
  code: string | null;
  kind: DbWriteErrorKind;
  message: string;
} {
  const e = err as { code?: unknown; message?: unknown; name?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : null;
  const message = typeof e?.message === 'string' ? e.message : String(err ?? 'unknown error');

  if (code) {
    if (READ_ONLY_CODES.has(code)) return { code, kind: 'READ_ONLY', message };
    if (CONNECTION_CODES.has(code)) return { code, kind: 'CONNECTION', message };
    if (PERMISSION_CODES.has(code)) return { code, kind: 'PERMISSION', message };
    if (MISSING_TABLE_CODES.has(code)) return { code, kind: 'MISSING_PROBE_TABLE', message };
  }

  const lower = message.toLowerCase();
  if (lower.includes('read-only') || lower.includes('read only')) {
    return { code, kind: 'READ_ONLY', message };
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return { code, kind: 'TIMEOUT', message };
  }
  if (lower.includes('econnrefused') || lower.includes('connection terminated')
      || lower.includes('connection closed')) {
    return { code, kind: 'CONNECTION', message };
  }
  if (lower.includes('does not exist') && lower.includes('ops_db_write_probe')) {
    return { code, kind: 'MISSING_PROBE_TABLE', message };
  }
  return { code, kind: 'UNKNOWN', message };
}

function notConfigured(): DbWriteReadiness {
  return {
    dbReachable: false,
    dbReadable: false,
    dbWritable: false,
    dbWriteErrorCode: null,
    dbWriteErrorKind: 'NOT_CONFIGURED',
    dbWriteErrorMessage: 'DATABASE_URL not configured',
    dbWriteLatencyMs: null,
    checkedAt: new Date().toISOString(),
  };
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Run the probe once, uncached. Never throws. */
export async function runDbWriteProbe(opts: { timeoutMs?: number } = {}): Promise<DbWriteReadiness> {
  const timeoutMs = opts.timeoutMs ?? 4000;
  if (!isDatabaseAvailable) return notConfigured();

  const out: DbWriteReadiness = {
    dbReachable: false,
    dbReadable: false,
    dbWritable: false,
    dbWriteErrorCode: null,
    dbWriteErrorKind: null,
    dbWriteErrorMessage: null,
    dbWriteLatencyMs: null,
    checkedAt: new Date().toISOString(),
  };

  // 1. Reachable — can we get a connection at all?
  try {
    const client = await withTimeout(pool.connect(), timeoutMs, 'db connect');
    client.release();
    out.dbReachable = true;
  } catch (err) {
    const c = classifyWriteError(err);
    out.dbWriteErrorCode = c.code;
    out.dbWriteErrorKind = c.kind === 'UNKNOWN' ? 'CONNECTION' : c.kind;
    out.dbWriteErrorMessage = c.message;
    return out; // unreachable → readable/writable stay false, which is the truth
  }

  // 2. Readable — the check that used to stand in for "healthy" on its own.
  try {
    await withTimeout(db.execute(sql`SELECT 1`), timeoutMs, 'db read');
    out.dbReadable = true;
  } catch (err) {
    const c = classifyWriteError(err);
    out.dbWriteErrorCode = c.code;
    out.dbWriteErrorKind = c.kind;
    out.dbWriteErrorMessage = c.message;
    return out;
  }

  // 3. Writable — a committed UPDATE of the singleton ops row. This is the
  //    fact `SELECT 1` could never establish.
  const revision = process.env.K_REVISION || null;
  const t0 = Date.now();
  try {
    await withTimeout(
      db.execute(sql`
        UPDATE ops_db_write_probe
           SET last_probe_at = now(),
               probe_count   = probe_count + 1,
               last_revision = ${revision}
         WHERE id = 1
      `),
      timeoutMs,
      'db write',
    );
    out.dbWritable = true;
    out.dbWriteLatencyMs = Date.now() - t0;
  } catch (err) {
    const c = classifyWriteError(err);
    out.dbWritable = false;
    out.dbWriteLatencyMs = Date.now() - t0;
    out.dbWriteErrorCode = c.code;
    out.dbWriteErrorKind = c.kind;
    out.dbWriteErrorMessage = c.message;
  }

  return out;
}

// ── Short-TTL cache ───────────────────────────────────────────────────────────
// Health endpoints get polled; without this the probe would be one committed
// write per request. The TTL is short enough that a read-only event is caught
// within seconds, long enough that polling costs nothing.
const PROBE_TTL_MS = 15_000;
let cached: { at: number; value: DbWriteReadiness } | null = null;
let inflight: Promise<DbWriteReadiness> | null = null;

/**
 * Cached probe. `force: true` bypasses the cache — use it for the deploy
 * readiness gate, where a stale "writable" would promote a broken revision.
 */
export async function getDbWriteReadiness(
  opts: { force?: boolean; timeoutMs?: number } = {},
): Promise<DbWriteReadiness> {
  if (!opts.force && cached && Date.now() - cached.at < PROBE_TTL_MS) {
    return cached.value;
  }
  // Collapse concurrent callers onto one probe so a burst of health checks
  // cannot multiply into a burst of writes.
  if (!opts.force && inflight) return inflight;

  const run = runDbWriteProbe({ timeoutMs: opts.timeoutMs }).then((value) => {
    cached = { at: Date.now(), value };
    inflight = null;
    return value;
  }).catch((err) => {
    // runDbWriteProbe is written never to throw; this is belt-and-braces so a
    // health endpoint can never 500 because of its own probe.
    inflight = null;
    const c = classifyWriteError(err);
    const value: DbWriteReadiness = {
      dbReachable: false, dbReadable: false, dbWritable: false,
      dbWriteErrorCode: c.code, dbWriteErrorKind: c.kind,
      dbWriteErrorMessage: c.message, dbWriteLatencyMs: null,
      checkedAt: new Date().toISOString(),
    };
    cached = { at: Date.now(), value };
    return value;
  });

  if (!opts.force) inflight = run;
  return run;
}

/** Test seam — drops the cached result. */
export function __resetDbWriteReadinessCache(): void {
  cached = null;
  inflight = null;
}
