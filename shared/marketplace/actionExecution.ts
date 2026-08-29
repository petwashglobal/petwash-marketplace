/**
 * executeAction — CEO Action Brain Doctrine §5, §8, §9, §10, §39, §54.
 *
 * The server-side primitive that turns an ActionDefinition into an
 * ActionResult. It enforces:
 *
 *   • Idempotency (§8): repeated executes with the same key return the
 *     original result.
 *   • Stale-preview handling (§10): if the preview's version drifted,
 *     return STALE with the fresh preview attached.
 *   • Confirmation-level match: L4 / REAUTH_AND_CONFIRM refuses to
 *     execute without proof of recent auth.
 *   • Money-truth (§54): server-computed money effect flows into the
 *     result — the caller does not fabricate the total.
 *   • Reason codes (§93): failures always carry a stable slug.
 *
 * The primitive is DEPENDENCY-FREE — callers plug in a stateStore
 * (records executed keys + preview versions) so this same code can
 * run in-process (unit tests) or against Postgres / Redis in
 * production.
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
  /** Return prior execution for (key, actorUid, actionType), or null. */
  recall(
    key: string,
    actorUid: string,
    actionType: string,
  ): Promise<ExecutedRecord | null>;
  /** Persist the executed record. Callers dedupe by (key, actorUid, actionType). */
  remember(record: ExecutedRecord): Promise<void>;
  /**
   * Return the fresh preview for an entity, if the caller supplied a
   * stale one. Optional — routes that don't need stale-preview
   * handling can return null.
   */
  freshPreview?: (
    actionType: string,
    entityId: string,
  ) => Promise<ActionPreview | null>;
}

// ── Request + input contracts ────────────────────────────────────────

export interface ExecuteActionInput {
  actorUid: string;
  actionType: string;
  entityId: string;
  idempotencyKey: IdempotencyKey;
  /** The preview the user reviewed. Server recomputes stale-check against it. */
  previewVersion: string;
  /** Runtime impact — used to verify confirmation policy matches (§5). */
  impact: ImpactSignals;
  /** The declared risk of this action from the catalog. */
  riskLevel: RiskLevel;
  /** Declared confirmation level from the catalog (§4). */
  confirmationLevel: ConfirmationLevel;
  /** Whether the caller proved recent auth (for L4 / REAUTH). */
  reauthProven: boolean;
  /**
   * The domain handler that performs the actual mutation. Called ONLY
   * when the pre-flight checks pass. Must return a partial ActionResult
   * — the executor stamps actionId + auditRef + correlationId.
   */
  handler(): Promise<
    Omit<ActionResult, 'actionId' | 'auditRef' | 'correlationId'>
  >;
  correlationId: string;
  /** For stale-preview checks — omit to disable. */
  entityForFreshPreview?: string;
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
  const { actorUid, actionType, correlationId } = input;

  // 1. Idempotency (§8). Same key + actor + type replays the original.
  const priorRaw = await store.recall(input.idempotencyKey.key, actorUid, actionType);
  if (priorRaw) {
    return { result: priorRaw.result, replayed: true };
  }

  // 2. Confirmation policy match (§5). The catalog's declared level
  //    must match what resolveConfirmation() derives from the risk +
  //    runtime impact — otherwise a client using a stale catalog
  //    would bypass a promoted confirmation.
  const derived = resolveConfirmation(input.riskLevel, input.impact);
  if (derived !== input.confirmationLevel) {
    return {
      result: fail(actionType, correlationId, 'STALE_PREVIEW', 'STALE'),
      replayed: false,
    };
  }

  // 3. Re-auth gate for L4 / REAUTH_AND_CONFIRM (§62).
  if (input.confirmationLevel === 'REAUTH_AND_CONFIRM' && !input.reauthProven) {
    return { result: fail(actionType, correlationId, 'REAUTH_REQUIRED'), replayed: false };
  }

  // 4. Stale-preview check (§10). If the store can produce a fresh
  //    preview, compare versions.
  if (store.freshPreview && input.entityForFreshPreview) {
    const fresh = await store.freshPreview(actionType, input.entityForFreshPreview);
    if (fresh && fresh.previewVersion !== input.previewVersion) {
      const stale = fail(actionType, correlationId, 'QUOTE_CHANGED', 'STALE');
      return { result: stale, replayed: false };
    }
  }

  // 5. Perform the mutation.
  let handlerOutcome: Awaited<ReturnType<typeof input.handler>>;
  try {
    handlerOutcome = await input.handler();
  } catch (err) {
    return { result: fail(actionType, correlationId, 'UNKNOWN'), replayed: false };
  }

  // 6. Stamp the result — actionId, auditRef, correlationId.
  const at = clock.now().toISOString();
  const actionId = `act_${clock.now().getTime().toString(36)}_${actionType}`;
  const result: ActionResult = {
    ...handlerOutcome,
    actionType,
    actionId,
    correlationId,
    auditRef: `aud_${actionId}`,
  };

  // 7. Persist for idempotency replay.
  await store.remember({
    key: input.idempotencyKey.key,
    actorUid,
    actionType,
    result,
    at,
  });

  return { result, replayed: false };
}

// ── In-memory store — for tests + local dev ──────────────────────────

export function createInMemoryStore(
  freshPreviews?: Map<string, ActionPreview>,
): ActionStateStore {
  const map = new Map<string, ExecutedRecord>();
  const keyFor = (k: string, uid: string, type: string) => `${k}::${uid}::${type}`;
  return {
    async recall(k, uid, type) {
      return map.get(keyFor(k, uid, type)) ?? null;
    },
    async remember(rec) {
      map.set(keyFor(rec.key, rec.actorUid, rec.actionType), rec);
    },
    freshPreview: freshPreviews
      ? async (actionType, entityId) => freshPreviews.get(`${actionType}::${entityId}`) ?? null
      : undefined,
  };
}
