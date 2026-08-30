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

/**
 * Legacy pending marker written by the initial FLY MODE II landing.
 * Rows carrying this exact string are still recognised on read — but
 * every NEW write goes through `buildPendingEnvelope()` (below) so
 * lease metadata travels with the row.
 */
const PENDING_MARKER = 'pending';

/**
 * CEO DEEP-LOGIC §41-§42 lease semantics.
 *
 * Prior behaviour: a claim wrote the literal string 'pending' and had
 * no way to notice that the owning process crashed. Subsequent
 * callers saw PROCESSING forever (until the shared 24h TTL cleaned up
 * the row), and there was no distinct signal to trigger domain
 * reconciliation.
 *
 * New behaviour: the response_hash payload for a pending claim is a
 * JSON envelope carrying `executionId` + `leaseUntil`. Reads
 * recognise the envelope, and an EXPIRED lease surfaces as its own
 * outcome so the caller can consult the domain (§42) before deciding
 * whether the mutation actually happened.
 */
const PENDING_ENVELOPE_MARKER = 'pending_v2';
const DEFAULT_LEASE_MS = 5 * 60 * 1000; // 5 minutes — CEO §32 leaves the concrete value to callers; 5m is safe for the current handler set.

interface PendingEnvelope {
  marker: typeof PENDING_ENVELOPE_MARKER;
  executionId: string;
  leaseUntil: number; // epoch ms
}

function buildPendingEnvelope(now: number, leaseMs: number = DEFAULT_LEASE_MS): PendingEnvelope {
  return {
    marker: PENDING_ENVELOPE_MARKER,
    executionId: crypto.randomBytes(8).toString('hex'),
    leaseUntil: now + leaseMs,
  };
}

function parsePendingEnvelope(body: string): PendingEnvelope | null {
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && parsed.marker === PENDING_ENVELOPE_MARKER && typeof parsed.executionId === 'string' && typeof parsed.leaseUntil === 'number') {
      return parsed as PendingEnvelope;
    }
    return null;
  } catch {
    return null;
  }
}

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
      const now = new Date(at).getTime();
      // CEO DEEP-LOGIC §41 — pending envelope carries executionId +
      // leaseUntil. Legacy 'pending' rows are still recognised on
      // read for backward compatibility.
      const envelope = buildPendingEnvelope(now);
      const envelopeJson = JSON.stringify(envelope);
      const inserted = await db.execute(
        sql`INSERT INTO idempotency_keys (key, endpoint, response_hash, created_at)
            VALUES (${composite}, ${actionType}, ${envelopeJson}, ${new Date(at)})
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
      const pending = parsePendingEnvelope(body);
      if (pending || body === PENDING_MARKER) {
        // §42 — an EXPIRED lease surfaces distinctly. The caller
        // knows the domain and must reconcile before deciding whether
        // to reclaim; the store cannot safely re-run the handler on
        // its own.
        const leaseExpired = !!pending && pending.leaseUntil < now;
        const code = leaseExpired
          ? 'LEASE_EXPIRED_RECONCILE_REQUIRED'
          : 'IDEMPOTENCY_REPLAY';
        return {
          claimed: false,
          prior: {
            key: idempotencyKey,
            actorUid,
            actionType,
            at,
            result: {
              actionId: leaseExpired ? 'act_lease_expired' : 'act_inflight',
              actionType,
              // The doctrine's ActionStatus set does not yet carry a
              // dedicated UNKNOWN_OUTCOME slot; PROCESSING with the
              // LEASE_EXPIRED_RECONCILE_REQUIRED reasonCode is the
              // stable signal until the shared shape adds one.
              status: 'PROCESSING',
              userMessage: { code },
              nextActions: [],
              correlationId: pending?.executionId ?? 'inflight',
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
