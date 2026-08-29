/**
 * POST /api/actions/:actionType/execute — CEO Action Brain Doctrine
 * §5, §8, §9, §10, §39, §54, §93.
 *
 * The server surface that consumes shared/marketplace/actionExecution.ts.
 * Clients POST the intent with { entityId, previewVersion, idempotencyKey,
 * impact, reauthProven }, and the router:
 *
 *   1. Looks up the catalog entry for :actionType.
 *   2. Finds the domain handler registered for that type.
 *   3. Wraps handler in executeAction() so idempotency + stale-preview +
 *      reauth + reason-code discipline are enforced UNIFORMLY across
 *      every action.
 *
 * The router is pure of DB deps — handlers and the ActionStateStore are
 * injected at build time. Same pattern as available-actions.ts.
 */
import { Router } from 'express';
import type { Response } from 'express';
import {
  executeAction,
  type ActionStateStore,
} from '../../shared/marketplace/actionExecution';
import type {
  ActionResult,
  ImpactSignals,
} from '../../shared/marketplace/action';
import { getCatalogEntry } from '../../shared/marketplace/actionCatalog';

/**
 * A domain handler is registered per actionType. It receives the actor
 * context + the request body's entityId + arbitrary command payload,
 * performs the mutation, and returns a partial ActionResult (the
 * executor stamps actionId + auditRef + correlationId).
 */
export type ActionHandler = (input: {
  actorUid: string;
  entityId: string;
  command: unknown;
}) => Promise<
  Omit<ActionResult, 'actionId' | 'auditRef' | 'correlationId'>
>;

export interface ActionExecutionRouterOptions {
  store: ActionStateStore;
  /** actionType → handler map. Missing entry → 501 UNKNOWN_ACTION. */
  handlers: Map<string, ActionHandler>;
  /**
   * Optional correlationId provider — defaults to a per-request uuid-ish.
   * Callers that carry an inbound X-Correlation-Id header should pass
   * their own extractor.
   */
  correlationIdFor?: (req: unknown) => string;
}

function defaultCorrelationId(): string {
  return `corr_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

interface ExecuteBody {
  entityId?: string;
  previewVersion?: string;
  idempotencyKey?: { key: string; scope: 'per-intent' };
  impact?: ImpactSignals;
  reauthProven?: boolean;
  command?: unknown;
}

function badRequest(res: Response, code: string, msg: string): void {
  res.status(400).json({ ok: false, error: msg, reasonCode: code });
}

export function buildActionExecutionRouter(
  opts: ActionExecutionRouterOptions,
): Router {
  const router = Router();
  const correlationIdFor = opts.correlationIdFor ?? defaultCorrelationId;

  router.post('/:actionType/execute', async (req, res, next) => {
    try {
      const actorUid = (req as any).firebaseUser?.uid;
      if (!actorUid) {
        res.status(401).json({ ok: false, error: 'Auth required', reasonCode: 'REAUTH_REQUIRED' });
        return;
      }

      const actionType = req.params.actionType;
      const entry = getCatalogEntry(actionType);
      if (!entry) {
        res.status(404).json({ ok: false, error: 'unknown action', reasonCode: 'UNKNOWN' });
        return;
      }

      const body = (req.body ?? {}) as ExecuteBody;
      if (!body.entityId) return badRequest(res, 'UNKNOWN', 'entityId required');
      if (!body.previewVersion) return badRequest(res, 'STALE_PREVIEW', 'previewVersion required');
      if (!body.idempotencyKey?.key) return badRequest(res, 'IDEMPOTENCY_REPLAY', 'idempotencyKey required');

      const handler = opts.handlers.get(actionType);
      if (!handler) {
        res.status(501).json({ ok: false, error: 'no handler registered', reasonCode: 'UNKNOWN' });
        return;
      }

      const { result } = await executeAction(
        {
          actorUid,
          actionType,
          entityId: body.entityId,
          idempotencyKey: body.idempotencyKey,
          previewVersion: body.previewVersion,
          impact: body.impact ?? {},
          riskLevel: entry.riskLevel,
          confirmationLevel: entry.confirmationLevel,
          reauthProven: body.reauthProven === true,
          correlationId: correlationIdFor(req),
          handler: () => handler({ actorUid, entityId: body.entityId!, command: body.command }),
          entityForFreshPreview: body.entityId,
        },
        opts.store,
      );

      // Status is always 200 — the ActionResult.status carries the
      // outcome. Client renders based on `result.status` +
      // `result.userMessage.code`, never HTTP status alone.
      res.json({ ok: true, result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
