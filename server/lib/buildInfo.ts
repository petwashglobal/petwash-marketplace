/**
 * buildInfo.ts
 *
 * Pure helper that surfaces PUBLIC deploy identifiers via /health so
 * an operator (or the CEO from any device, no GCP auth required) can
 * confirm the production build matches the latest merge.
 *
 * CEO operational hygiene rule (PR-HEALTH-BUILD-SHA, item G):
 *   "CI green ≠ deployed. Being able to open /health and instantly
 *    see git SHA + service revision is enterprise-grade DevOps."
 *
 * ABSOLUTE INVARIANTS
 *   • Reads ONLY public, non-secret deploy identifiers:
 *       Cloud Run auto-set:  K_SERVICE, K_REVISION, K_CONFIGURATION
 *       CI-set:              GIT_SHA / COMMIT_SHA / GITHUB_SHA
 *                            BUILD_TIME / BUILD_TIMESTAMP
 *       Runtime:             NODE_ENV
 *   • NEVER reads anything that could be a secret value
 *     (no API keys, tokens, JSONs, credentials).
 *   • NEVER throws — returns nulls for any missing field. The /health
 *     endpoint must keep returning a 200 even when env is empty.
 *   • Stable shape — every key always present (null if unknown), so
 *     a downstream monitor can rely on the structure.
 *
 * Issue #153 PR-HEALTH-BUILD-SHA. Pure observability layer.
 */

export interface BuildInfo {
  /** NODE_ENV (production / staging / development / unknown) */
  env: string;
  /** Cloud Run service name (K_SERVICE) — null if not on Cloud Run */
  service: string | null;
  /** Cloud Run revision (K_REVISION) — Cloud Run auto-sets this on every
   *  revision; presence + value confirms which revision is serving. */
  revision: string | null;
  /** Cloud Run configuration name (K_CONFIGURATION) */
  configuration: string | null;
  /** Git commit SHA injected by CI at build time. First non-empty of:
   *  GIT_SHA, COMMIT_SHA, GITHUB_SHA. Null if none set. */
  gitSha: string | null;
  /** Optional build timestamp injected by CI. First of:
   *  BUILD_TIME, BUILD_TIMESTAMP. Null if neither. */
  buildTime: string | null;
}

/** Return the first non-empty string env value among `names`, or null. */
function firstEnvOf(names: readonly string[]): string | null {
  for (const name of names) {
    const v = process.env[name];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

/**
 * Build the immutable presence-only deploy identifier card.
 * Pure function. Never throws. Reads ONLY the safe set above.
 */
export function getBuildInfo(): BuildInfo {
  return {
    env:           process.env.NODE_ENV || 'unknown',
    service:       firstEnvOf(['K_SERVICE']),
    revision:      firstEnvOf(['K_REVISION']),
    configuration: firstEnvOf(['K_CONFIGURATION']),
    gitSha:        firstEnvOf(['GIT_SHA', 'COMMIT_SHA', 'GITHUB_SHA']),
    buildTime:     firstEnvOf(['BUILD_TIME', 'BUILD_TIMESTAMP']),
  };
}
