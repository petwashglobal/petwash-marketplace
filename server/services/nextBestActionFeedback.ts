/**
 * NextBestActionFeedback — Journey Brain Phase 6 (post-release
 * 2026-09-04). Durable telemetry for user reactions to the
 * NextBestActionCard: acted, dismissed, "not interested", "fewer
 * offers like this". A later change will wire recordings into the
 * composer so it can suppress an action_key that got a negative
 * verdict in the last cooldown window.
 *
 * Scope of THIS module:
 *
 *   • Closed enum for verdicts (compile-time literal — no typos).
 *   • Action-key derivation from the AttentionItem / ResumeAction
 *     shapes the composer already emits.
 *   • Insert row (recordFeedback) — validates verdict + action key,
 *     returns the row id.
 *   • List recent verdicts by uid (recentFeedback) — used by the
 *     composer follow-up to suppress "not_interested" for a window.
 *
 * OUT of scope here:
 *
 *   • Composer wiring (follow-up PR — this ship is pure telemetry).
 *   • Retention pruner cron (follow-up PR).
 *   • Any payment-truth persistence — the action_key is a stable
 *     identity, NEVER a chargeId / paidAt / refundId reference.
 */
import type { Pool } from 'pg';
import { logger } from '../lib/logger';

/** Closed set — the client + server both know these verdicts. */
export type FeedbackVerdict =
  | 'act'
  | 'dismiss'
  | 'not_interested'
  | 'fewer_like_this';

const VERDICTS: readonly FeedbackVerdict[] = Object.freeze([
  'act',
  'dismiss',
  'not_interested',
  'fewer_like_this',
]);

export function isValidVerdict(v: unknown): v is FeedbackVerdict {
  return typeof v === 'string' && (VERDICTS as readonly string[]).includes(v);
}

/**
 * Stable action key from an AttentionItem or ResumeAction. The
 * composer emits these two shapes on the wire.
 *
 *   AttentionItem  → `attn:<id>`
 *   ResumeAction   → `resume:<domain>`
 *
 * Kept intentionally opaque — the key is a suppression handle, not
 * a business reference. NEVER include a payment-truth id.
 */
export function deriveActionKey(action: {
  kind?: string;
  id?: string;
  domain?: string;
}): string | null {
  if (!action || typeof action !== 'object') return null;
  if (action.kind === 'resume' && typeof action.domain === 'string' && action.domain) {
    return `resume:${action.domain}`;
  }
  if (typeof action.id === 'string' && action.id) {
    return `attn:${action.id}`;
  }
  return null;
}

/** A feedback row as stored — internal to this service. */
export interface FeedbackRow {
  id: string;
  userUid: string;
  actionKey: string;
  verdict: FeedbackVerdict;
  createdAt: Date;
}

const MAX_ACTION_KEY_LEN = 200;

/**
 * Insert a feedback row. Returns the row id on success, throws on
 * invalid input. Callers wrap in the endpoint's try/catch so a
 * failure surfaces as a 400 / 500 to the client, not a raw pg error.
 */
export async function recordFeedback(
  pool: Pool,
  args: { userUid: string; actionKey: string; verdict: FeedbackVerdict },
): Promise<{ id: string }> {
  if (!args.userUid) throw new Error('MISSING_USER_UID');
  if (!args.actionKey || typeof args.actionKey !== 'string') {
    throw new Error('MISSING_ACTION_KEY');
  }
  if (args.actionKey.length > MAX_ACTION_KEY_LEN) {
    throw new Error('ACTION_KEY_TOO_LONG');
  }
  if (!isValidVerdict(args.verdict)) {
    throw new Error('INVALID_VERDICT');
  }
  const row = await pool.query<{ id: string }>(
    `
    INSERT INTO next_best_action_feedback (user_uid, action_key, verdict)
    VALUES ($1, $2, $3)
    RETURNING id
    `,
    [args.userUid, args.actionKey, args.verdict],
  );
  const id = row.rows[0]?.id;
  if (!id) throw new Error('INSERT_FAILED');
  return { id };
}

/**
 * List recent verdicts for a user within the given lookback window.
 * The composer follow-up reads this to suppress an action_key that
 * a user recently dismissed with "not_interested".
 *
 * Fails-CLOSED: on any error returns []. The composer already
 * fails-CLOSED to an empty projection so a broken feedback read
 * cannot break home.
 */
export async function recentFeedback(
  pool: Pool,
  args: { userUid: string; lookbackDays?: number; verdicts?: readonly FeedbackVerdict[] },
): Promise<FeedbackRow[]> {
  if (!args.userUid) return [];
  const lookbackDays = Math.max(1, Math.min(90, args.lookbackDays ?? 30));
  const verdictFilter = (args.verdicts ?? VERDICTS).filter(isValidVerdict);
  if (verdictFilter.length === 0) return [];
  try {
    const res = await pool.query(
      `
      SELECT id, user_uid, action_key, verdict, created_at
        FROM next_best_action_feedback
       WHERE user_uid = $1
         AND created_at > now() - ($2::int * interval '1 day')
         AND verdict = ANY($3::text[])
       ORDER BY created_at DESC
       LIMIT 200
      `,
      [args.userUid, lookbackDays, verdictFilter],
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      userUid: r.user_uid,
      actionKey: r.action_key,
      verdict: r.verdict as FeedbackVerdict,
      createdAt: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
    }));
  } catch (err) {
    logger.warn('[NextBestActionFeedback] recentFeedback failed', {
      userUid: args.userUid,
      err: (err as Error)?.message,
    });
    return [];
  }
}

/**
 * Retention pruner — physically delete rows older than the retention
 * window. Returns the number of rows deleted (0 on any error). Called
 * from the hourly cron in server/cron/next-best-action-feedback-prune.ts.
 *
 * Retention: 90 days by default. A row older than that is no longer
 * useful for the 7-day suppression cooldown, and the analytics job
 * has already aggregated older rows into its rollup table.
 *
 * Fail-soft: any pg error is logged and the returned count is 0,
 * so the cron never crashes and never bubbles a partial delete
 * error back to caller.
 */
export async function pruneOldFeedback(
  pool: Pool,
  args?: { olderThanDays?: number },
): Promise<number> {
  const olderThanDays = Math.max(1, Math.min(3650, args?.olderThanDays ?? 90));
  try {
    const res = await pool.query(
      `
      DELETE FROM next_best_action_feedback
       WHERE created_at < now() - ($1::int * interval '1 day')
      `,
      [olderThanDays],
    );
    // pg's DELETE returns rowCount even without RETURNING.
    return typeof res.rowCount === 'number' ? res.rowCount : 0;
  } catch (err) {
    logger.warn('[NextBestActionFeedback] pruneOldFeedback failed', {
      err: (err as Error)?.message,
    });
    return 0;
  }
}
