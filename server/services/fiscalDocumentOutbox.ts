/**
 * Fiscal document outbox — release-blocker A3 / A4 / A5
 * (CEO 2026-09-02 release freeze).
 *
 * Before this module, three fiscal / booking-state writes lived
 * inside non-blocking `.catch()` blocks on the booking-completion
 * path. Any transient failure silently dropped the work:
 *
 *   • server/routes/sitter-suite.ts:1605-1607 — VAT ledger write.
 *   • server/routes/academy.ts:830-832        — Israeli digital receipt.
 *   • server/routes/walk-my-pet.ts:829        — legacy-bridge advancer.
 *
 * The rule the CEO wrote: "A legal receipt is not 'best effort'.
 * Persist durable fiscal-document work and retry it until completed
 * or explicitly failed for intervention."
 *
 * This module offers a two-part guarantee to callers:
 *
 *   1. INLINE-FIRST — the caller supplies a `runNow` function; we
 *      execute it, and if it succeeds, we do NOT write to the
 *      outbox at all (steady-state stays clean).
 *
 *   2. DURABLE ON FAILURE — if `runNow` throws, we insert a row in
 *      `fiscal_document_outbox` keyed by (kind, sourceKey). Duplicate
 *      enqueue for the same key is a no-op (ON CONFLICT DO NOTHING).
 *      If the outbox insert ALSO fails, we throw
 *      FiscalOutboxUnavailableError — the caller MUST return a
 *      5xx so the transaction is not silently absorbed.
 *
 * The drainer worker that later processes pending rows lives in a
 * separate module. Even without it, having the row is what closes
 * the release-blocker gap: ops can see stuck fiscal work rather
 * than have it disappear.
 */

import type { Pool } from 'pg';
import { logger } from '../lib/logger';

export type FiscalOutboxKind =
  | 'vat_ledger'
  | 'digital_receipt'
  | 'academy_receipt'
  | 'walk_legacy_bridge';

export class FiscalOutboxUnavailableError extends Error {
  readonly kind: FiscalOutboxKind;
  readonly sourceKey: string;
  constructor(kind: FiscalOutboxKind, sourceKey: string, cause: unknown) {
    super(`fiscal_outbox_unavailable:${kind}:${sourceKey}`);
    this.name = 'FiscalOutboxUnavailableError';
    this.kind = kind;
    this.sourceKey = sourceKey;
    (this as any).cause = cause;
  }
}

export interface RunAndPersistArgs<T> {
  pool: Pool;
  kind: FiscalOutboxKind;
  /**
   * Idempotency key. For a VAT ledger write of booking X the key is
   * `booking:X`. Two calls with the same (kind, sourceKey) are safe.
   */
  sourceKey: string;
  /** Args the retry worker will need to re-run this later. */
  payload: Record<string, unknown>;
  /** Inline attempt. If this resolves, the outbox row is NOT written. */
  runNow: () => Promise<T>;
}

export interface RunAndPersistResult<T> {
  /** True when the inline attempt succeeded. */
  ranInline: boolean;
  /** True when the outbox row was written for later retry. */
  enqueued: boolean;
  /** Present only when the inline attempt succeeded. */
  result?: T;
  /** Present only when the inline attempt failed. */
  inlineError?: string;
}

/**
 * Try `runNow` inline; if it throws, persist a durable outbox row so
 * a drainer can retry it. If BOTH fail, throws
 * FiscalOutboxUnavailableError so the caller cannot silently swallow
 * the failure — the correct response is a 5xx that lets the client
 * retry the whole completion (which is idempotent by booking id).
 */
export async function runFiscalDocumentAndPersistOnFailure<T>(
  args: RunAndPersistArgs<T>,
): Promise<RunAndPersistResult<T>> {
  const { pool, kind, sourceKey, payload, runNow } = args;

  // Inline attempt first — the common case is success and no outbox row.
  try {
    const result = await runNow();
    return { ranInline: true, enqueued: false, result };
  } catch (inlineErr) {
    const inlineMsg =
      inlineErr instanceof Error ? inlineErr.message : String(inlineErr);
    logger.warn('[FiscalOutbox] inline attempt failed — enqueuing durable row', {
      kind,
      sourceKey,
      error: inlineMsg,
    });

    // Durable enqueue — this is the release-blocker guarantee.
    try {
      await pool.query(
        `INSERT INTO fiscal_document_outbox
           (kind, source_key, payload, status, attempts, last_error, next_attempt_at)
         VALUES ($1, $2, $3::jsonb, 'pending', 0, $4, now())
         ON CONFLICT (kind, source_key) DO NOTHING`,
        [kind, sourceKey, JSON.stringify(payload), truncate(inlineMsg)],
      );
      return { ranInline: false, enqueued: true, inlineError: inlineMsg };
    } catch (outboxErr) {
      logger.error(
        '[FiscalOutbox] durable enqueue FAILED — caller must return 5xx',
        {
          kind,
          sourceKey,
          inlineError: inlineMsg,
          outboxError: outboxErr instanceof Error ? outboxErr.message : String(outboxErr),
        },
      );
      throw new FiscalOutboxUnavailableError(kind, sourceKey, outboxErr);
    }
  }
}

/** Trim to fit a reasonable column width — Postgres will still store larger, but we don't need volumes of trace. */
function truncate(s: string): string {
  return s.length > 1000 ? s.slice(0, 1000) + '…' : s;
}
