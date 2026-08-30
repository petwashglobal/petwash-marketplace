/**
 * executeAction — CEO Action Brain Doctrine §5, §8, §9, §10, §39, §54, §93
 * + CEO SECURITY CORRECTION 2026-08-30 §1–§7.
 *
 * The server-side primitive that turns an ActionDefinition into an
 * ActionResult. Every domain endpoint that executes an L2+ action
 * wraps its handler in this so idempotency + stale-preview + reauth
 * + reason-code discipline are enforced UNIFORMLY.
 *
 * ────────────────────────────────────────────────────────────────
 * SECURITY: the client CANNOT declare its own security posture.
 * ────────────────────────────────────────────────────────────────
 *   • `impact` is NEVER accepted from the client (§1 correction).
 *     The route supplies an ImpactResolver that computes signals
 *     from server state.
 *   • `reauthProven` is NEVER accepted from the client (§2 correction).
 *     The executor reads `authContext.recentAuthAt` (Firebase auth_time
 *     token claim) and decides whether it satisfies the L4 gate.
 *   • `riskLevel` + `confirmationLevel` are looked up from the
 *     server-side ACTION_CATALOG — never trusted from body.
 *   • The route module surface accepts ONLY intent + previewId +
 *     idempotencyKey + command payload. See server/routes/action-execution.ts.
 *
 * The primitive stays DEPENDENCY-FREE — callers plug in stateStore +
 * ImpactResolver + AuthContext so this same code runs in-process
 * (unit tests) or against Postgres / Redis in production.
 */
import type {
  ActionPreview,
  ActionResult,
  ActionStatus,
  ConfirmationLevel,
  IdempotencyKey,
  ImpactSignals,
  ReasonCode,
} from './action';
import { resolveConfirmation } from './action';
import type { RiskLevel } from './action';

// ── Store interface ───────────────────────────────────────────────────

export interface ExecutedRecord {
  key: string;
  actorUid: string;
  actionType: string;
  result: ActionResult;
  at: string;                         // ISO
}

export interface ActionStateStore {
  /**
   * Atomic claim (§CEO §6): mark this key/actor/type as OUR execution.
   * Returns `{ claimed: true }` when the caller may proceed with the
   * handler mutation, or `{ claimed: false, prior }` when another
   * request already executed this intent (idempotency replay).
   *
   * The doctrine forbids the recall-then-mutate race — implementations
   * must use an atomic write (Postgres INSERT ... ON CONFLICT, Redis
   * SETNX, Firestore transaction). An in-memory implementation is
   * suitable ONLY for tests / local dev.
   */
  claim(
    key: string,
    actorUid: string,
    actionType: string,
    at: string,
  ): Promise<{ claimed: true } | { claimed: false; prior: ExecutedRecord }>;
  /**
   * Persist the final result under the claim previously issued. Called
   * once per successful (or FAILED-final) execution.
   */
  finalize(record: ExecutedRecord): Promise<void>;
  /** Return the fresh preview for an entity, if one is registered. */
  freshPreview?: (
    actionType: string,
    entityId: string,
  ) => Promise<ActionPreview | null>;
}

// ── Server-derived security context (CEO §2, §7) ──────────────────────

/**
 * Server-derived authentication facts. Populated from the Firebase
 * decoded token — NEVER from the request body.
 *   recentAuthAt — the token's `auth_time` claim (ISO). Present when
 *                  the user authenticated within the last hour (Firebase
 *                  default).
 *   recentReauthAt — ISO timestamp of a completed reauth challenge, if
 *                  the client just proved reauth. Present only when the
 *                  server issued + verified the challenge.
 */
export interface ServerAuthContext {
  actorUid: string;
  recentAuthAt?: string;
  recentReauthAt?: string;
}

/**
 * Reauth freshness window — an L4 action needs a reauth within this
 * window. Kept configurable at the caller site so ops can tighten it
 * for higher-risk deployments without redeploying this file.
 */
export const REAUTH_WINDOW_SECONDS_DEFAULT = 300; // 5 minutes

/** Server-side derivation of the reauthProven boolean. */
export function isReauthFresh(
  auth: ServerAuthContext,
  now: Date,
  windowSeconds: number = REAUTH_WINDOW_SECONDS_DEFAULT,
): boolean {
  const iso = auth.recentReauthAt;
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return false;
  return (now.getTime() - then) / 1000 <= windowSeconds;
}

// ── ImpactResolver (CEO §1) ───────────────────────────────────────────

/**
 * Server-side impact computation. Given the actor context + entity,
 * returns ImpactSignals. This runs on the server; the client never
 * supplies these fields. Per-action-type implementations live next to
 * the handler.
 */
export type ImpactResolver = (input: {
  actorUid: string;
  entityId: string;
}) => Promise<ImpactSignals>;

// ── Request + input contracts ────────────────────────────────────────

export interface ExecuteActionInput {
  actionType: string;
  entityId: string;
  idempotencyKey: IdempotencyKey;
  /** The preview version the user reviewed. Server refuses stale. */
  previewVersion: string;
  /**
   * Server-derived auth context (from Firebase decoded token). The
   * client does NOT get to declare it.
   */
  authContext: ServerAuthContext;
  /**
   * Catalog-declared risk + confirmation for this actionType. The
   * route reads these from the server-side ACTION_CATALOG — the
   * client cannot override.
   */
  riskLevel: RiskLevel;
  confirmationLevel: ConfirmationLevel;
  /** Server-side impact computation. Runs before the handler. */
  deriveImpact: ImpactResolver;
  /** The domain handler that performs the actual mutation. */
  handler(): Promise<
    Omit<ActionResult, 'actionId' | 'auditRef' | 'correlationId'>
  >;
  correlationId: string;
  /** Reauth window override (seconds); defaults to 5 min. */
  reauthWindowSeconds?: number;
}

export interface ExecutorClock {
  now(): Date;
}

const DEFAULT_CLOCK: ExecutorClock = { now: () => new Date() };

// ── Failure builders — canonical shape, stable reason codes ──────────

function fail(
  actionType: string,
  correlationId: string,
  code: ReasonCode,
  status: ActionStatus = 'FAILED',
): ActionResult {
  return {
    actionId: `act_${Date.now().toString(36)}_${code}`,
    actionType,
    status,
    userMessage: { code },
    nextActions: [],
    correlationId,
  };
}

// ── The executor ─────────────────────────────────────────────────────

export interface ExecuteActionResult {
  result: ActionResult;
  replayed: boolean;                  // true when returned from the idempotency store
}

export async function executeAction(
  input: ExecuteActionInput,
  store: ActionStateStore,
  clock: ExecutorClock = DEFAULT_CLOCK,
): Promise<ExecuteActionResult> {
  const { authContext, actionType, correlationId } = input;
  const actorUid = authContext.actorUid;

  // 1. Reauth gate FIRST (§CEO §2): a stale-auth caller should not
  //    even touch the idempotency store for an L4 action. If reauth
  //    is not fresh, the action is refused.
  if (input.confirmationLevel === 'REAUTH_AND_CONFIRM') {
    if (!isReauthFresh(authContext, clock.now(), input.reauthWindowSeconds)) {
      return { result: fail(actionType, correlationId, 'REAUTH_REQUIRED'), replayed: false };
    }
  }

  // 2. Atomic idempotency claim (§CEO §6). Race-safe: only one caller
  //    wins; others receive the prior canonical result.
  const at = clock.now().toISOString();
  const claim = await store.claim(input.idempotencyKey.key, actorUid, actionType, at);
  if (!claim.claimed) {
    return { result: claim.prior.result, replayed: true };
  }

  // 3. Impact + confirmation-match (§CEO §1, §5). Impact is server-
  //    computed. resolveConfirmation() must agree with the catalog's
  //    declared level; a client using a stale catalog cannot bypass a
  //    promoted confirmation.
  const impact = await input.deriveImpact({ actorUid, entityId: input.entityId });
  const derived = resolveConfirmation(input.riskLevel, impact);
  if (derived !== input.confirmationLevel) {
    const result = fail(actionType, correlationId, 'STALE_PREVIEW', 'STALE');
    await store.finalize({ key: input.idempotencyKey.key, actorUid, actionType, result, at });
    return { result, replayed: false };
  }

  // 4. Stale-preview check (§10). If the store can produce a fresh
  //    preview, compare versions.
  if (store.freshPreview && input.entityId) {
    const fresh = await store.freshPreview(actionType, input.entityId);
    if (fresh && fresh.previewVersion !== input.previewVersion) {
      const result = fail(actionType, correlationId, 'QUOTE_CHANGED', 'STALE');
      await store.finalize({ key: input.idempotencyKey.key, actorUid, actionType, result, at });
      return { result, replayed: false };
    }
  }

  // 5. Perform the mutation.
  let handlerOutcome: Awaited<ReturnType<typeof input.handler>>;
  try {
    handlerOutcome = await input.handler();
  } catch (err) {
    const result = fail(actionType, correlationId, 'UNKNOWN');
    await store.finalize({ key: input.idempotencyKey.key, actorUid, actionType, result, at });
    return { result, replayed: false };
  }

  // 6. Stamp the result — actionId, auditRef, correlationId.
  const actionId = `act_${clock.now().getTime().toString(36)}_${actionType}`;
  const result: ActionResult = {
    ...handlerOutcome,
    actionType,
    actionId,
    correlationId,
    auditRef: `aud_${actionId}`,
  };

  await store.finalize({ key: input.idempotencyKey.key, actorUid, actionType, result, at });
  return { result, replayed: false };
}

// ── In-memory store — TESTS ONLY (CEO §6 forbids production use) ─────

/**
 * ⚠️  DO NOT USE IN PRODUCTION.
 *
 * In-memory implementation of the atomic idempotency store. Exists
 * SOLELY for unit tests + local dev. State disappears on restart,
 * does not cross Cloud Run instances, does not survive deploy. Using
 * this for money / booking / material actions in production is a
 * doctrine violation (CEO §6).
 *
 * Production callers MUST supply a durable atomic implementation
 * (Postgres INSERT ... ON CONFLICT, Redis SETNX with TTL, Firestore
 * transaction). See docs/architecture/ for the required contract.
 */
export function createInMemoryTestOnlyStore(
  freshPreviews?: Map<string, ActionPreview>,
): ActionStateStore {
  const map = new Map<string, ExecutedRecord>();
  const inflight = new Set<string>();
  const keyFor = (k: string, uid: string, type: string) => `${k}::${uid}::${type}`;
  return {
    async claim(k, uid, type, at) {
      const composite = keyFor(k, uid, type);
      const prior = map.get(composite);
      if (prior) return { claimed: false, prior };
      if (inflight.has(composite)) {
        // Simulate a race — an inflight sibling holds the claim. In a
        // real store this is atomic; here we treat inflight as "some
        // other caller is executing" and wait would be unrealistic —
        // return claimed:false with a placeholder prior so the caller
        // treats it as a replay.
        return {
          claimed: false,
          prior: {
            key: k,
            actorUid: uid,
            actionType: type,
            at,
            result: {
              actionId: 'act_inflight',
              actionType: type,
              status: 'PROCESSING',
              userMessage: { code: 'IDEMPOTENCY_REPLAY' },
              nextActions: [],
              correlationId: 'inflight',
            },
          },
        };
      }
      inflight.add(composite);
      return { claimed: true };
    },
    async finalize(record) {
      const composite = keyFor(record.key, record.actorUid, record.actionType);
      map.set(composite, record);
      inflight.delete(composite);
    },
    freshPreview: freshPreviews
      ? async (actionType, entityId) => freshPreviews.get(`${actionType}::${entityId}`) ?? null
      : undefined,
  };
}

/** @deprecated Use createInMemoryTestOnlyStore. Kept as a redirect. */
export const createInMemoryStore = createInMemoryTestOnlyStore;
