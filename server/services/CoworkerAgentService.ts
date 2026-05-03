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
  type CoworkerFamily,
  type CoworkerOutput,
} from '../../shared/coworker-types';
import { logger } from '../lib/logger';

export interface RunFamilyOptions {
  /** Override the default 60s snapshot cache TTL for this family. */
  ttlSeconds?: number;
  /** Bypass the cache and force a fresh run. Default false. */
  noCache?: boolean;
  /** Free-form scope hints a future implementation may use (e.g. station id). */
  scope?: Record<string, string | number | boolean>;
}

interface CacheEntry {
  expiresAt: number;
  output: CoworkerOutput;
}

const SNAPSHOT_CACHE = new Map<string, CacheEntry>();
const DEFAULT_TTL_SECONDS = 60;

function cacheKey(family: CoworkerFamily, scope?: RunFamilyOptions['scope']): string {
  if (!scope) return family;
  const stable = Object.keys(scope)
    .sort()
    .map((k) => `${k}=${String(scope[k])}`)
    .join('&');
  return `${family}?${stable}`;
}

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

    const key = cacheKey(parsedFamily.data, options.scope);
    if (!options.noCache) {
      const hit = SNAPSHOT_CACHE.get(key);
      if (hit && hit.expiresAt > Date.now()) return hit.output;
    }

    // PR-20: always not-wired. Family-specific dispatch table lives here in PR-21+.
    const output = notWiredOutput(parsedFamily.data);

    // Validate output against the schema. Cheap insurance against future drift.
    const validated = CoworkerOutputSchema.safeParse(output);
    if (!validated.success) {
      logger.error('[coworker] notWiredOutput failed schema validation', {
        family: parsedFamily.data,
        issues: validated.error.issues,
      });
      throw new Error('CoworkerAgentService: scaffold output failed validation');
    }

    const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    SNAPSHOT_CACHE.set(key, {
      expiresAt: Date.now() + ttl * 1000,
      output: validated.data,
    });
    return validated.data;
  }

  /** Test / admin-tool helper: clear the snapshot cache. */
  clearCache(): void {
    SNAPSHOT_CACHE.clear();
  }

  /** Introspection helper for status endpoints. */
  getCacheSize(): number {
    return SNAPSHOT_CACHE.size;
  }
}

export const coworkerAgentService = new CoworkerAgentService();
