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
 * we compose actor + actionType + intent-key into one string:
 *   `<idempotencyKey>::<actorUid>::<actionType>`
 * That composition is bounded (key ≤ 64, uid ≤ 64, actionType ≤ 40)
 * so it fits under the existing 128-char cap the middleware enforces.
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
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import type {
  ActionStateStore,
  ExecutedRecord,
} from '../../../shared/marketplace/actionExecution';
import type { ActionPreview, ActionResult } from '../../../shared/marketplace/action';

const PENDING_MARKER = 'pending';

function composeKey(idempotencyKey: string, actorUid: string, actionType: string): string {
  return `${idempotencyKey}::${actorUid}::${actionType}`;
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
