/**
 * Reads dist/public/build-config.json — non-secret metadata the client build
 * wrote ABOUT itself.
 *
 * WHY THE SERVER CANNOT JUST READ AN ENV VAR.
 *
 * /api/health/bot-check used to compute the client half as
 * `!!process.env.VITE_TURNSTILE_SITE_KEY`. That is a FRONTEND BUILD variable:
 * Vite inlines it into the bundle at compile time, and it has no reason to
 * exist in the Cloud Run runtime at all. So the old check was wrong in both
 * directions —
 *
 *   correct deployment, no runtime var  -> reported the site key ABSENT
 *   var set on Cloud Run after a build  -> reported PRESENT while the bundle
 *                                          had no key and the browser could
 *                                          never mint a token
 *
 * The only honest source is the artifact the browser actually downloads, so
 * the build writes its own verdict and the server reports it.
 *
 * Never throws — health must keep returning 200. Cached after the first read
 * because the artifact is immutable for the life of the process.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ClientBuildConfig {
  /** True when the built bundle carries a usable Turnstile site key. */
  turnstileConfigured: boolean;
  /** False when this build contains no Turnstile widget code at all. */
  turnstileWidgetPresent: boolean;
  /** ISO timestamp the build wrote, or null. */
  builtAt: string | null;
  /** Null when no build-config.json was found — UNKNOWN, not "false". */
  found: boolean;
}

const UNKNOWN: ClientBuildConfig = {
  turnstileConfigured: false,
  turnstileWidgetPresent: false,
  builtAt: null,
  found: false,
};

let cached: ClientBuildConfig | null = null;

/** Candidate locations, covering both the container layout and a local run. */
function candidatePaths(): string[] {
  const fromEnv = process.env.CLIENT_BUILD_CONFIG_PATH;
  return [
    ...(fromEnv ? [fromEnv] : []),
    join(process.cwd(), 'dist', 'public', 'build-config.json'),
    join(process.cwd(), 'public', 'build-config.json'),
  ];
}

export function getClientBuildConfig(forceReload = false): ClientBuildConfig {
  if (cached && !forceReload) return cached;
  for (const p of candidatePaths()) {
    try {
      if (!existsSync(p)) continue;
      const parsed = JSON.parse(readFileSync(p, 'utf8'));
      cached = {
        turnstileConfigured: parsed?.turnstileConfigured === true,
        turnstileWidgetPresent: parsed?.turnstileWidgetPresent === true,
        builtAt: typeof parsed?.builtAt === 'string' ? parsed.builtAt : null,
        found: true,
      };
      return cached;
    } catch {
      // A malformed or unreadable file is UNKNOWN, never a silent "configured".
    }
  }
  cached = UNKNOWN;
  return cached;
}

/** Test seam. */
export function __resetClientBuildConfigCache(): void {
  cached = null;
}
