/**
 * Nayax webhook inbox — DB-backed state machine.
 *
 * Replaces the earlier insert-first "row exists = dedup" pattern, which lost
 * events whose business handler threw AFTER the row was inserted. On Nayax's
 * automatic retry the middleware saw the row as claimed, returned 200 with
 * deduplicated:true, and the payment/refund/settlement event was lost forever.
 *
 * The inbox now carries an explicit status per event (see migration 0121):
 *   RECEIVED          — arrived, handler about to run
 *   PROCESSING        — handler started (fresh row → 409, stale >10min → retry)
 *   COMPLETED         — handler committed; replays short-circuit as dedup
 *   FAILED_RETRYABLE  — transient failure; a Nayax retry re-runs the handler
 *   FAILED_FINAL      — permanent failure; short-circuit to stop Nayax retries
 *
 * Handler contract:
 *   claimEvent(eventId, route)      → INSERT (RECEIVED, attempt=1) on first
 *                                     arrival; on conflict decide from status.
 *   markProcessing(eventId)         → RECEIVED → PROCESSING, bump attempt.
 *   markCompleted(eventId)          → PROCESSING/RECEIVED → COMPLETED.
 *   markFailedRetryable(eventId, c) → PROCESSING/RECEIVED → FAILED_RETRYABLE
 *                                     with a sanitized error code (no PII,
 *                                     no tokens).
 *   markFailedFinal(eventId, c)     → PROCESSING/RECEIVED → FAILED_FINAL.
 *
 * All writes MUST use the sanitized error code — never a raw error message,
 * never a stack trace, never a header or token value.
 */

import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { nayaxProcessedEventIds } from '../../shared/schema';
import { logger } from './logger';

/** How long a PROCESSING row is trusted before we treat it as a crashed handler. */
export const STALE_PROCESSING_MS = 10 * 60 * 1000;

/** Sanitizer bound for error codes stored on the inbox row. */
const MAX_ERROR_CODE_LEN = 64;

export type InboxStatus =
  | 'RECEIVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED_RETRYABLE'
  | 'FAILED_FINAL';

export interface InboxRow {
  eventId: string;
  status: InboxStatus;
  attemptCount: number;
  lastAttemptAt: Date;
  completedAt: Date | null;
  sourceRoute: string | null;
  errorCode: string | null;
}

export interface ClaimInput {
  eventId: string;
  sourceRoute?: string;
  /** Injectable clock for tests. Defaults to Date.now(). */
  now?: () => number;
}

export type ClaimDecision =
  /** First time we've seen this eventId. Handler must run. */
  | { decision: 'new'; row: InboxRow }
  /** Already fully processed once — replay is a dedup no-op. */
  | { decision: 'dedup'; row: InboxRow }
  /**
   * Previous attempt failed retryably OR left a stale PROCESSING row
   * (>STALE_PROCESSING_MS old). Handler must run again — attempt bumped.
   */
  | { decision: 'retry'; row: InboxRow; previous: InboxStatus }
  /**
   * Another delivery is currently PROCESSING this event and the row is fresh.
   * Caller should return 409 so Nayax retries later.
   */
  | { decision: 'conflict'; row: InboxRow };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeErrorCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Strip control chars, whitespace-normalise, cap length. Never store a raw
  // error message — the caller is responsible for passing a stable code, not a
  // stack, header or token.
  const cleaned = String(raw)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ERROR_CODE_LEN);
  return cleaned.length ? cleaned : null;
}

function assertEventId(eventId: string): void {
  if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
    throw new Error('eventId is required');
  }
}

function rowFromDrizzle(r: any): InboxRow {
  return {
    eventId: r.eventId,
    status: r.status as InboxStatus,
    attemptCount: r.attemptCount ?? 1,
    lastAttemptAt: r.lastAttemptAt ?? new Date(),
    completedAt: r.completedAt ?? null,
    sourceRoute: r.sourceRoute ?? null,
    errorCode: r.errorCode ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomic first-write decision. Throws on DB failure — caller must fail CLOSED
 * (503) so Nayax retries; do NOT run the business handler without an audit row.
 */
export async function claimEvent(input: ClaimInput): Promise<ClaimDecision> {
  assertEventId(input.eventId);
  const now = new Date(input.now ? input.now() : Date.now());

  // ── Attempt 1: insert as RECEIVED ────────────────────────────────────────
  const inserted = await db
    .insert(nayaxProcessedEventIds)
    .values({
      eventId: input.eventId,
      sourceRoute: input.sourceRoute ?? null,
      status: 'RECEIVED',
      attemptCount: 1,
      lastAttemptAt: now,
      processedAt: now,
    } as any)
    .onConflictDoNothing()
    .returning();

  if (inserted.length > 0) {
    return { decision: 'new', row: rowFromDrizzle(inserted[0]) };
  }

  // ── Row already exists — decide by status ────────────────────────────────
  const [existing] = await db
    .select()
    .from(nayaxProcessedEventIds)
    .where(eq(nayaxProcessedEventIds.eventId, input.eventId))
    .limit(1);

  if (!existing) {
    // Race: someone deleted the row between insert-noop and read. Try once more.
    throw new Error('claim_read_race');
  }

  const row = rowFromDrizzle(existing);

  if (row.status === 'COMPLETED' || row.status === 'FAILED_FINAL') {
    logger.info('[NayaxWebhookInbox] replay short-circuited', {
      eventId: input.eventId,
      sourceRoute: input.sourceRoute,
      status: row.status,
    });
    return { decision: 'dedup', row };
  }

  const staleCutoff = now.getTime() - STALE_PROCESSING_MS;

  if (row.status === 'PROCESSING') {
    const fresh = row.lastAttemptAt.getTime() >= staleCutoff;
    if (fresh) {
      // Another delivery is actively processing this event right now.
      return { decision: 'conflict', row };
    }
    // Stale PROCESSING → treat as crashed. Retry re-runs the handler.
  }

  if (row.status === 'RECEIVED') {
    const fresh = row.lastAttemptAt.getTime() >= staleCutoff;
    if (fresh) {
      // Another delivery inserted the row moments ago and is racing us.
      return { decision: 'conflict', row };
    }
  }

  // ── Retryable case: bump attempt, keep audit trail ───────────────────────
  const [bumped] = await db
    .update(nayaxProcessedEventIds)
    .set({
      status: 'RECEIVED' as any,
      attemptCount: sql`${nayaxProcessedEventIds.attemptCount} + 1` as any,
      lastAttemptAt: now as any,
      errorCode: null as any,
    })
    .where(eq(nayaxProcessedEventIds.eventId, input.eventId))
    .returning();

  return {
    decision: 'retry',
    row: rowFromDrizzle(bumped),
    previous: row.status,
  };
}

/**
 * Transition RECEIVED → PROCESSING. Called by the route handler AFTER claim,
 * BEFORE the business work. Refuses to move a row that isn't RECEIVED so a
 * double-transition can't happen. Throws on DB failure — caller decides.
 */
export async function markProcessing(eventId: string): Promise<void> {
  assertEventId(eventId);
  const now = new Date();
  await db
    .update(nayaxProcessedEventIds)
    .set({ status: 'PROCESSING' as any, lastAttemptAt: now as any })
    .where(and(
      eq(nayaxProcessedEventIds.eventId, eventId),
      or(
        eq(nayaxProcessedEventIds.status, 'RECEIVED'),
        eq(nayaxProcessedEventIds.status, 'FAILED_RETRYABLE'),
      ),
    ));
}

/** Handler committed — replays should short-circuit. */
export async function markCompleted(eventId: string): Promise<void> {
  assertEventId(eventId);
  const now = new Date();
  await db
    .update(nayaxProcessedEventIds)
    .set({
      status: 'COMPLETED' as any,
      completedAt: now as any,
      lastAttemptAt: now as any,
      errorCode: null as any,
    })
    .where(eq(nayaxProcessedEventIds.eventId, eventId));
}

/** Transient failure — a Nayax retry will re-run the handler. */
export async function markFailedRetryable(
  eventId: string,
  errorCode: string,
): Promise<void> {
  assertEventId(eventId);
  const code = sanitizeErrorCode(errorCode);
  await db
    .update(nayaxProcessedEventIds)
    .set({
      status: 'FAILED_RETRYABLE' as any,
      errorCode: code as any,
      lastAttemptAt: new Date() as any,
    })
    .where(eq(nayaxProcessedEventIds.eventId, eventId));
}

/** Permanent failure — short-circuit future replays to stop retry storms. */
export async function markFailedFinal(
  eventId: string,
  errorCode: string,
): Promise<void> {
  assertEventId(eventId);
  const code = sanitizeErrorCode(errorCode);
  await db
    .update(nayaxProcessedEventIds)
    .set({
      status: 'FAILED_FINAL' as any,
      errorCode: code as any,
      lastAttemptAt: new Date() as any,
    })
    .where(eq(nayaxProcessedEventIds.eventId, eventId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Backwards-compatible thin wrapper — keeps the old public name that other
// call sites in the codebase (e.g. checkout-payment route's Redis-fallback
// helper) still import. New callers must use claimEvent + the mark* API.
// ─────────────────────────────────────────────────────────────────────────────

export interface DedupCheckInput {
  eventId: string;
  sourceRoute?: string;
}

export type DedupResult =
  | { processed: 'new' }
  | { processed: 'duplicate' };

/** @deprecated use claimEvent + markCompleted for the full inbox contract. */
export async function tryClaimWebhookEvent(input: DedupCheckInput): Promise<DedupResult> {
  const result = await claimEvent(input);
  if (result.decision === 'new' || result.decision === 'retry') {
    // Legacy callers immediately do the business work and never call markCompleted.
    // Best-effort mark so replays still short-circuit — matching the old
    // observable behaviour of the previous insert-only implementation.
    await markCompleted(input.eventId).catch(() => { /* non-fatal */ });
    return { processed: 'new' };
  }
  return { processed: 'duplicate' };
}
