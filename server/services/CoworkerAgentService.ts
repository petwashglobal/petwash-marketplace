/**
 * CoworkerAgentService — single entry point for every "AI coworker" family.
 *
 * PR-20 SCAFFOLD ONLY.
 *   This file defines the surface contract and wires up structural plumbing
 *   (snapshot cache shell, family registry, governance hooks). It does NOT
 *   call Gemini, does NOT issue real DB queries, and does NOT make any
 *   business decisions. Every `runFamily` call returns a notWiredOutput.
 *
 *   Real per-family implementations land in PR-21+.
 *
 * Hard rules (enforced or asserted here):
 *   - Read-only. Family implementations must use `readonlyDb` from
 *     ./coworker/readonly-db. No direct `db` imports allowed in family code.
 *   - Outputs are advisory. Nothing in here triggers payouts, refunds, bans,
 *     approvals, or money movement. A human admin click is always required
 *     downstream.
 *   - Never touches K9000 runtime, Nayax flow, wallet logic, or Tranzila.
 *   - All outputs are validated against CoworkerOutputSchema before return,
 *     so a future Gemini hallucination cannot smuggle extra fields through.
 *   - Snapshot cache TTL defaults to 60s per CEO answer; per-family override
 *     allowed via runFamily({ ttlSeconds }).
 */
import {
  CoworkerFamilySchema,
  CoworkerOutputSchema,
  notWiredOutput,
  type CoworkerActor,
  type CoworkerFamily,
  type CoworkerOutput,
} from '../../shared/coworker-types';
import { logger } from '../lib/logger';
import { logAuditEvent } from '../middleware/auditLog';
import {
  assertOutputSafe,
  assertRateLimit,
  CoworkerRateLimitError as CoworkerActorFamilyRateLimitError,
  CoworkerUnsafeOutputError,
  deterministicFallback,
  type RateLimitConfig,
} from './coworker/governance';
import {
  assertDailyTokenBudget,
  assertRequestUnderRateLimits,
  buildSnapshotCacheKey,
  CoworkerDailyBudgetExceededError,
  CoworkerRateLimitError,
  clearSnapshotCache,
  DEFAULT_SNAPSHOT_TTL_SECONDS,
  getSnapshot,
  putSnapshot,
  snapshotCacheSize,
  type FixedWindowConfig,
} from './coworker/limits';

export interface RunFamilyOptions {
  /** Override the default 60s snapshot cache TTL for this family. */
  ttlSeconds?: number;
  /** Bypass the cache and force a fresh run. Default false. */
  noCache?: boolean;
  /** Free-form scope hints a future implementation may use (e.g. station id). */
  scope?: Record<string, string | number | boolean>;
  /** Who is calling. Threaded through for rate limit + audit logging. */
  actor?: CoworkerActor;
  /** Override the default per-actor sliding rate limit (PR-21 governance). */
  rateLimit?: RateLimitConfig;
  /** Override the default per-admin fixed-window rate limit (PR-22 limits). */
  perAdminRateLimit?: FixedWindowConfig;
  /** Override the default global fixed-window rate limit (PR-22 limits). */
  globalRateLimit?: FixedWindowConfig;
  /**
   * Token reservation hint for the daily budget. PR-22 always passes 0 (no
   * Gemini wired). PR-23+ passes the caller's expected token count so the
   * daily budget check is meaningful.
   */
  expectedTokens?: number;
}

// Re-export error types so route handlers can `instanceof`-check them
// without reaching into governance / limits modules directly.
export {
  CoworkerActorFamilyRateLimitError,
  CoworkerRateLimitError,
  CoworkerDailyBudgetExceededError,
  CoworkerUnsafeOutputError,
};

const DEFAULT_TTL_SECONDS = DEFAULT_SNAPSHOT_TTL_SECONDS;

export class CoworkerAgentService {
  /**
   * Run a coworker family. PR-20 always returns wired:false.
   *
   * In PR-21+ each family will:
   *   1. Pull a bounded snapshot via readonlyDb (LIMIT clauses, time windows).
   *   2. Pass the snapshot to gemini-client.safeGenerate with a
   *      strict JSON schema and a verb filter.
   *   3. Validate the response against CoworkerOutputSchema.
   *   4. On Gemini failure / quota / invalid JSON → fall back to a
   *      deterministic "what the SQL says" summary with fallback:true.
   *   5. Audit-log the call (family, scope, fallback flag, generatedAt).
   */
  async runFamily(
    family: CoworkerFamily,
    options: RunFamilyOptions = {},
  ): Promise<CoworkerOutput> {
    // Defensive — even though TS narrows family, validate at the boundary.
    const parsedFamily = CoworkerFamilySchema.safeParse(family);
    if (!parsedFamily.success) {
      throw new Error(`CoworkerAgentService: unknown family "${family}"`);
    }
    const fam = parsedFamily.data;

    // PR-22: snapshot cache keyed on (admin id, agent id, scope hash). Cache
    // hits bypass rate limits + token budget — by definition they don't
    // consume Gemini. PR-21's per-actor sliding window also stays bypassed.
    const key = buildSnapshotCacheKey(options.actor?.actorUserId, fam, options.scope);
    if (!options.noCache) {
      const hit = getSnapshot<CoworkerOutput>(key);
      if (hit) return hit;
    }

    // PR-22: fixed-window rate limit (per-admin + global) BEFORE dispatch.
    // Throws CoworkerRateLimitError (scope: 'admin' | 'global').
    assertRequestUnderRateLimits(
      options.actor?.actorUserId,
      options.perAdminRateLimit,
      options.globalRateLimit,
    );

    // PR-22: daily token budget reservation. PR-22 passes 0 because no
    // Gemini call is wired; PR-23+ will pass the real estimate.
    assertDailyTokenBudget(options.expectedTokens ?? 0);

    // PR-21: per-(actor, family) sliding-window rate limit. Layered on top
    // of PR-22's broader limits — this one prevents a single admin from
    // spamming a single family even within their fixed-window allowance.
    assertRateLimit(options.actor?.actorUserId, fam, options.rateLimit);

    // PR-20: always not-wired. Family-specific dispatch table lives here in PR-21+.
    const output = notWiredOutput(fam);

    // Validate output against the schema. Cheap insurance against future drift.
    const validated = CoworkerOutputSchema.safeParse(output);
    if (!validated.success) {
      logger.error('[coworker] notWiredOutput failed schema validation', {
        family: fam,
        issues: validated.error.issues,
      });
      throw new Error('CoworkerAgentService: scaffold output failed validation');
    }

    // PR-21: scan output for decision verbs. notWiredOutput is empty so this
    // is a no-op today, but the hook is in the hot path for PR-22+ when
    // Gemini-generated text starts flowing through.
    try {
      assertOutputSafe(validated.data);
    } catch (err) {
      if (err instanceof CoworkerUnsafeOutputError) {
        logger.warn(`[coworker] unsafe output rejected, returning fallback`, {
          family: fam,
          matchedVerb: err.matchedVerb,
        });
        const fallback = deterministicFallback(
          fam,
          'AI output rejected by safety filter — falling back to live data only.',
        );
        await this.auditRun(fam, fallback, options);
        return fallback;
      }
      throw err;
    }

    const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    putSnapshot<CoworkerOutput>(key, validated.data, ttl);

    // PR-21: audit-log every coworker invocation. Fire-and-forget — failure
    // to log must not break the response (matches the auditLog.ts swallow-
    // and-log-error pattern). Cache hits do NOT log; only fresh runs do.
    await this.auditRun(fam, validated.data, options);

    return validated.data;
  }

  /**
   * Audit a coworker run. Best-effort — logAuditEvent already swallows DB
   * errors internally, but we wrap in try/catch to be extra defensive so a
   * future change to logAuditEvent can never break the AI response path.
   */
  private async auditRun(
    family: CoworkerFamily,
    output: CoworkerOutput,
    options: RunFamilyOptions,
  ): Promise<void> {
    try {
      await logAuditEvent({
        actorUserId: options.actor?.actorUserId,
        actorRole: options.actor?.actorRole,
        actionType: `COWORKER_RUN_${family.toUpperCase()}`,
        targetType: 'coworker_family',
        targetId: family,
        ip: options.actor?.ip,
        userAgent: options.actor?.userAgent,
        traceId: options.actor?.traceId,
        metadata: {
          wired: output.wired,
          fallback: output.fallback,
          ttlSeconds: output.ttlSeconds,
          generatedAt: output.generatedAt,
          scope: options.scope ?? null,
          // Output text deliberately NOT logged here. The Brain dashboard's
          // own audit view will surface the call; the snapshot itself is
          // re-derivable from the cache or by re-running the family.
        },
      });
    } catch (err) {
      logger.warn(`[coworker] auditRun failed (non-fatal)`, {
        family,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Test / admin-tool helper: clear the snapshot cache. */
  clearCache(): void {
    clearSnapshotCache();
  }

  /** Introspection helper for status endpoints. */
  getCacheSize(): number {
    return snapshotCacheSize();
  }
}

export const coworkerAgentService = new CoworkerAgentService();
