/**
 * POST /api/actions/:actionType/execute — CEO Action Brain Doctrine
 * §5, §8, §10, §39, §41, §93 + SECURITY CORRECTION 2026-08-30 §1–§7.
 *
 * ────────────────────────────────────────────────────────────────
 * SECURITY: THE CLIENT DOES NOT DECLARE ITS OWN SECURITY.
 * ────────────────────────────────────────────────────────────────
 * Client body accepts ONLY:
 *   entityId, previewVersion, idempotencyKey, command?
 *
 * Client body MUST NOT and CANNOT set:
 *   impact           — server-derived per action-type via ImpactResolver
 *   reauthProven     — server-derived from Firebase auth_time / recentReauthAt
 *   riskLevel        — looked up from server-side ACTION_CATALOG
 *   confirmationLevel — looked up from server-side ACTION_CATALOG
 *
 * Feature flag (CEO §7):
 *   The MUTATION endpoint is disabled unless `ACTION_BRAIN_MUTATIONS_ENABLED=1`.
 *   Half-real command bus is worse than none — the endpoint answers 503
 *   until (a) server-derived risk, (b) durable atomic idempotency,
 *   (c) real handlers, (d) full authorization, (e) stale-state protection
 *   are all in place per action-type.
 */
import { Router } from 'express';
import type { Response } from 'express';
import {
  executeAction,
  type ActionStateStore,
  type ImpactResolver,
  type ServerAuthContext,
} from '../../shared/marketplace/actionExecution';
import type { ActionResult } from '../../shared/marketplace/action';
import { getCatalogEntry } from '../../shared/marketplace/actionCatalog';

/** A domain handler registered per actionType. */
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
   * actionType → server-side impact resolver. Missing entry → 501
   * (the action has no server-side impact model registered — safer
   * to refuse than to guess).
   */
  impactResolvers: Map<string, ImpactResolver>;
  /**
   * Feature flag — the whole mutation surface is off unless this
   * returns true. Default: reads `process.env.ACTION_BRAIN_MUTATIONS_ENABLED`.
   */
  isMutationEnabled?: () => boolean;
  /** Optional correlation-id override — defaults to per-request uuid-ish. */
  correlationIdFor?: (req: unknown) => string;
  /**
   * Server-derived auth context builder. Reads the decoded Firebase
   * token (already attached by middleware) and returns the security
   * facts the executor consults. Client body NEVER contributes.
   */
  authContextFor: (req: any) => ServerAuthContext | null;
  /** Reauth window override (seconds). Kept per-deployment. */
  reauthWindowSeconds?: number;
}

function defaultCorrelationId(): string {
  return `corr_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/**
 * Body shape — deliberately NARROW. Any additional field the client
 * tries to send is IGNORED. The security-critical fields the old
 * contract accepted (impact, reauthProven, riskLevel, confirmationLevel)
 * are NOT read here — the server computes them.
 */
interface ExecuteBody {
  entityId?: string;
  previewVersion?: string;
  idempotencyKey?: { key: string; scope: 'per-intent' };
  command?: unknown;
}

function badRequest(res: Response, code: string, msg: string): void {
  res.status(400).json({ ok: false, error: msg, reasonCode: code });
}

function defaultMutationsEnabled(): boolean {
  return process.env.ACTION_BRAIN_MUTATIONS_ENABLED === '1';
}

export function buildActionExecutionRouter(
  opts: ActionExecutionRouterOptions,
): Router {
  const router = Router();
  const correlationIdFor = opts.correlationIdFor ?? defaultCorrelationId;
  const isEnabled = opts.isMutationEnabled ?? defaultMutationsEnabled;

  router.post('/:actionType/execute', async (req, res, next) => {
    try {
      // (0) Feature flag first — until every risk fact is server-derived
      //     and idempotency is durable, don't expose the surface.
      if (!isEnabled()) {
        res.status(503).json({
          ok: false,
          error: 'Action Brain mutations are disabled in this environment.',
          reasonCode: 'UNKNOWN',
        });
        return;
      }

      // (1) Server-derived auth context. Never trust body.
      const authContext = opts.authContextFor(req);
      if (!authContext || !authContext.actorUid) {
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
      const impactResolver = opts.impactResolvers.get(actionType);
      if (!handler || !impactResolver) {
        res.status(501).json({
          ok: false,
          error: 'action has no server-side implementation registered',
          reasonCode: 'UNKNOWN',
        });
        return;
      }

      const { result } = await executeAction(
        {
          actionType,
          entityId: body.entityId,
          idempotencyKey: body.idempotencyKey,
          previewVersion: body.previewVersion,
          authContext,
          // Server-side catalog values — never trusted from body.
          riskLevel: entry.riskLevel,
          confirmationLevel: entry.confirmationLevel,
          deriveImpact: impactResolver,
          reauthWindowSeconds: opts.reauthWindowSeconds,
          correlationId: correlationIdFor(req),
          handler: () => handler({
            actorUid: authContext.actorUid,
            entityId: body.entityId!,
            command: body.command,
          }),
        },
        opts.store,
      );

      // Status stays 200 — result.status carries the outcome (§39).
      res.json({ ok: true, result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
