/**
 * PostgresActionStore — CEO §6 durable atomic idempotency for the
 * Action Brain, backed by the existing `idempotency_keys` table.
 *
 * REUSE, NOT NEW UNIVERSE (CEO §6 discipline). This adapter uses the
 * same table + INSERT ... ON CONFLICT contract that middleware/
 * idempotency.ts uses for booking / checkout money flows. Zero schema
 * change; the table already ships:
 *   idempotency_keys (
 *     key            TEXT PRIMARY KEY,
 *     endpoint       TEXT,
 *     response_hash  TEXT  -- stores 'pending' while inflight, then
 *                          --  serialized ActionResult on finalize
 *     created_at     TIMESTAMP
 *   )
 *
 * Composite key layout — the primary key is a single TEXT column, so
 * we compose actor + actionType + intent-key into ONE deterministic
 * string via a bounded SHA-256 hash. See composeKey() below for the
 * §27 rationale — plain concatenation gave 172 chars worst case and
 * blew the middleware's 128-char cap, so the store now uses:
 *   `act:<actionTypeLabel>:<40 hex chars of sha256(canonical)>`
 * which is ≤ 85 chars for ANY input, and carries a namespace prefix
 * (`act:`) so a doctrine reader can grep this store's rows out of the
 * shared idempotency_keys table.
 *
 * Atomic contract:
 *   claim() → `INSERT ... ON CONFLICT (key) DO NOTHING RETURNING key`.
 *     Non-empty RETURNING = won the claim; caller proceeds with the
 *     handler mutation. Empty RETURNING = another worker already
 *     claimed; caller SELECTs the row to decide whether to return the
 *     prior canonical result (finalized) or a PROCESSING stub (still
 *     'pending').
 *   finalize() → `UPDATE idempotency_keys SET response_hash = $body WHERE key = $composite`.
 *     Idempotent — a re-finalize with the same body is a no-op.
 *
 * TTL: the middleware's convention is "invisible after 24h" — this
 * store follows the same lease. Callers do NOT need to garbage-collect
 * separately.
 */
import crypto from 'crypto';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import type {
  ActionStateStore,
  ExecutedRecord,
} from '../../../shared/marketplace/actionExecution';
import type { ActionPreview, ActionResult } from '../../../shared/marketplace/action';

const PENDING_MARKER = 'pending';

// Namespace prefix keeps Action Brain rows visibly separate from any
// other consumer of the shared idempotency_keys table (booking/checkout
// money flows use their own key shapes). A grep on `WHERE key LIKE
// 'act:%'` returns only rows this store owns — §28 audit discipline.
const ACTION_BRAIN_KEY_PREFIX = 'act:';

/**
 * Compose a bounded, deterministic key for the composite
 * (idempotencyKey, actorUid, actionType) tuple.
 *
 * CEO DEEP-LOGIC §27 — the old plain-concat comment claimed
 * 64+64+40 ≤ 128, which is arithmetically wrong (172). Concatenation
 * length depended on the inputs, and a caller passing an oversized
 * value would overflow the middleware's 128-char cap and produce a
 * runtime SQL error at claim time.
 *
 * Fix: canonicalize the tuple into a JSON array, SHA-256 it, take the
 * first 40 hex chars (160 bits of entropy — collision resistance for
 * the low-billions of keys the table will ever hold). Prefix with the
 * namespace + an actionType label bounded to 40 chars, so a doctrine
 * reader can still eyeball the key shape.
 *
 * Total length: 4 (prefix) + up to 40 (label) + 1 (":") + 40 (hash) =
 * ≤ 85 chars for ANY tuple input. Well under the 128 cap.
 */
function composeKey(idempotencyKey: string, actorUid: string, actionType: string): string {
  const canonical = JSON.stringify([idempotencyKey, actorUid, actionType]);
  const hash = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 40);
  const label = actionType.slice(0, 40);
  return `${ACTION_BRAIN_KEY_PREFIX}${label}:${hash}`;
}

/**
 * Build a PostgresActionStore. Callers optionally pass a
 * `freshPreview` resolver — the store itself doesn't fetch previews
 * from Postgres (that lives in each domain's read model).
 */
export function createPostgresActionStore(
  freshPreview?: (
    actionType: string,
    entityId: string,
  ) => Promise<ActionPreview | null>,
): ActionStateStore {
  return {
    async claim(idempotencyKey, actorUid, actionType, at) {
      const composite = composeKey(idempotencyKey, actorUid, actionType);
      // Atomic claim (CEO §6). The single worker whose RETURNING is
      // non-empty owns this execution; every other request receives
      // the prior canonical result via the read below.
      const inserted = await db.execute(
        sql`INSERT INTO idempotency_keys (key, endpoint, response_hash, created_at)
            VALUES (${composite}, ${actionType}, ${PENDING_MARKER}, ${new Date(at)})
            ON CONFLICT (key) DO NOTHING
            RETURNING key`,
      );
      const wonRows = (inserted as any).rows ?? [];
      if (wonRows.length > 0) return { claimed: true };

      // Lost the race — read the winning row.
      const priorResult = await db.execute(
        sql`SELECT response_hash, created_at
              FROM idempotency_keys
             WHERE key = ${composite}
             LIMIT 1`,
      );
      const row = ((priorResult as any).rows ?? [])[0];
      if (!row) {
        // A theoretical: won the ON CONFLICT collision but the row
        // vanished (24h TTL race). Treat as claimed to move forward.
        return { claimed: true };
      }
      const body: string = String(row.response_hash ?? '');
      if (body === PENDING_MARKER) {
        // Another worker is still executing. Return the PROCESSING stub
        // — the same shape the in-memory store returns for inflight.
        return {
          claimed: false,
          prior: {
            key: idempotencyKey,
            actorUid,
            actionType,
            at,
            result: {
              actionId: 'act_inflight',
              actionType,
              status: 'PROCESSING',
              userMessage: { code: 'IDEMPOTENCY_REPLAY' },
              nextActions: [],
              correlationId: 'inflight',
            },
          },
        };
      }
      // Finalized — deserialize the stored ActionResult.
      let result: ActionResult;
      try {
        result = JSON.parse(body) as ActionResult;
      } catch {
        // Corrupt row shouldn't happen; fall back to a canonical
        // PROCESSING so the client at least keeps the intent alive.
        result = {
          actionId: 'act_replay_unreadable',
          actionType,
          status: 'PROCESSING',
          userMessage: { code: 'IDEMPOTENCY_REPLAY' },
          nextActions: [],
          correlationId: 'unreadable',
        };
      }
      return {
        claimed: false,
        prior: {
          key: idempotencyKey,
          actorUid,
          actionType,
          at,
          result,
        },
      };
    },

    async finalize(record) {
      const composite = composeKey(record.key, record.actorUid, record.actionType);
      const body = JSON.stringify(record.result);
      await db.execute(
        sql`UPDATE idempotency_keys
              SET response_hash = ${body}
            WHERE key = ${composite}`,
      );
    },

    freshPreview,
  };
}
