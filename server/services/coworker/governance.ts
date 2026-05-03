/**
 * Coworker governance — guard rails for every AI coworker family run.
 *
 * PR-21 ADDS GOVERNANCE HOOKS. PR-22+ wires real Gemini calls through them.
 *
 * Three guards live here:
 *
 * 1. Rate limit  — bounds the cost a single admin can incur. In-memory per
 *                  Cloud Run replica. Acceptable for now because the coworker
 *                  surface is super-admin-only and traffic is tiny. If volume
 *                  grows, swap the store for Redis without changing callers.
 *
 * 2. Output      — scans Gemini-generated text for "decision verbs". Coworker
 *    safety       output is advisory only; it must NEVER read like an executed
 *                 action. If a summary contains "released $50 to provider X",
 *                 we throw — the model is hallucinating that an action was
 *                 taken. A human admin click + audit log is the only way an
 *                 action ever gets executed.
 *
 * 3. Determ.    — deterministic fallback contract. When Gemini is unavailable
 *    fallback     (quota / network / invalid JSON), each family returns a
 *                 structured CoworkerOutput with fallback:true so the UI can
 *                 show a "live data, no AI commentary" state instead of an
 *                 error. PR-21 only defines the contract; PR-22+ implements
 *                 per-family deterministic summaries.
 *
 * No new dependencies. No schema migrations. No money/hardware paths.
 */
import {
  CoworkerOutputSchema,
  type CoworkerFamily,
  type CoworkerOutput,
  notWiredOutput,
} from '../../../shared/coworker-types';
import { logger } from '../../lib/logger';

// ─── Rate limit ─────────────────────────────────────────────────────────────
//
// Simple sliding-window counter per (actorUserId, family) pair. If actorUserId
// is missing (anonymous calls should not happen — requireBrainAccess gates the
// route) we fall through to a permissive global counter so the app never
// crashes; observability will catch it.

export interface RateLimitConfig {
  /** Maximum runs allowed inside `windowMs`. */
  maxRuns: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

// Defaults are conservative — coworker is read-only and super-admin-only.
// Tune in PR-22+ once we have real traffic data from the audit log.
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRuns: 30,
  windowMs: 60_000, // 1 minute
};

interface BucketState {
  /** Timestamps of recent runs, oldest first. Trimmed on every check. */
  hits: number[];
}

const RATE_LIMIT_BUCKETS = new Map<string, BucketState>();

function rateLimitKey(actorUserId: string | undefined, family: CoworkerFamily): string {
  return `${actorUserId ?? 'anon'}:${family}`;
}

export class CoworkerRateLimitError extends Error {
  constructor(public readonly actorUserId: string | undefined, public readonly family: CoworkerFamily, public readonly retryAfterMs: number) {
    super(`Coworker rate limit exceeded for actor=${actorUserId ?? 'anon'} family=${family}; retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'CoworkerRateLimitError';
  }
}

/**
 * Throws CoworkerRateLimitError if the actor has exceeded the configured
 * window. Otherwise records the hit and returns silently.
 */
export function assertRateLimit(
  actorUserId: string | undefined,
  family: CoworkerFamily,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): void {
  const now = Date.now();
  const key = rateLimitKey(actorUserId, family);
  const bucket = RATE_LIMIT_BUCKETS.get(key) ?? { hits: [] };
  // Trim entries outside the window.
  const cutoff = now - config.windowMs;
  bucket.hits = bucket.hits.filter((t) => t > cutoff);
  if (bucket.hits.length >= config.maxRuns) {
    const oldest = bucket.hits[0];
    const retryAfterMs = oldest + config.windowMs - now;
    throw new CoworkerRateLimitError(actorUserId, family, retryAfterMs);
  }
  bucket.hits.push(now);
  RATE_LIMIT_BUCKETS.set(key, bucket);
}

/** Test / admin-tool helper: clear the rate-limit buckets. */
export function clearRateLimitState(): void {
  RATE_LIMIT_BUCKETS.clear();
}

// ─── Output safety ──────────────────────────────────────────────────────────
//
// These verbs imply an action was executed. The coworker is advisory only —
// it must never sound like it did something. If a summary or recommendation
// text contains one of these as a past-tense or imperative verb, the run is
// rejected and a fallback is returned instead.

export const PROHIBITED_DECISION_VERBS = [
  // Money movement
  'released', 'refunded', 'paid out', 'payed out', 'transferred', 'settled',
  'charged', 'debited', 'credited', 'wrote off',
  // Approval / status changes
  'approved', 'rejected', 'denied', 'banned', 'suspended', 'unbanned',
  'verified', 'unverified', 'reinstated', 'terminated',
  // Audit / compliance
  'redacted', 'deleted log', 'hid', 'concealed', 'archived',
  // Hardware
  'unlocked', 'locked', 'restarted station', 'rebooted',
] as const;

export class CoworkerUnsafeOutputError extends Error {
  constructor(public readonly matchedVerb: string, public readonly snippet: string) {
    super(
      `Coworker output rejected — contains decision verb "${matchedVerb}". ` +
        `Output is advisory only; it must not sound like an action was executed. ` +
        `Snippet: ${snippet.slice(0, 200)}`,
    );
    this.name = 'CoworkerUnsafeOutputError';
  }
}

/**
 * Scan summary, anomalies, and recommendations text for decision verbs.
 * Throws CoworkerUnsafeOutputError on first match. Case-insensitive.
 *
 * Important: this guards against Gemini hallucinations — it does NOT replace
 * the route-level human-click requirement. Even if output passes this check,
 * no action is taken without a human admin clicking in the UI.
 */
export function assertOutputSafe(output: CoworkerOutput): void {
  const haystacks: string[] = [
    output.summary ?? '',
    output.reason ?? '',
    ...output.anomalies.flatMap((a) => [a.title, a.detail ?? '']),
    ...output.recommendations.flatMap((r) => [r.title, r.rationale ?? '']),
  ];
  const blob = haystacks.join(' • ').toLowerCase();
  for (const verb of PROHIBITED_DECISION_VERBS) {
    // Word-boundary-ish match: surrounded by whitespace, punctuation, or string
    // ends. Multi-word verbs are matched as substrings (still bounded on edges).
    const needle = verb.toLowerCase();
    const idx = blob.indexOf(needle);
    if (idx < 0) continue;
    const before = idx === 0 ? ' ' : blob[idx - 1];
    const after = idx + needle.length >= blob.length ? ' ' : blob[idx + needle.length];
    const isWordBoundary = /[\s.,;:!?•\-()'"]/.test(before) && /[\s.,;:!?•\-()'"]/.test(after);
    if (isWordBoundary) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(blob.length, idx + needle.length + 40);
      throw new CoworkerUnsafeOutputError(verb, blob.slice(start, end));
    }
  }
}

// ─── Deterministic fallback ─────────────────────────────────────────────────
//
// When Gemini is unavailable, every family returns a structured CoworkerOutput
// with fallback:true so the UI shows a clean "live data, no AI commentary"
// state instead of an error.
//
// PR-21 provides only the SHAPE — a notWiredOutput-with-fallback wrapper.
// PR-22+ implements per-family deterministic summaries (e.g. "12 bookings
// failed in the last hour" derived directly from a SELECT count).

export function deterministicFallback(family: CoworkerFamily, reason: string): CoworkerOutput {
  const base = notWiredOutput(family, reason);
  const out: CoworkerOutput = {
    ...base,
    fallback: true,
  };
  // Validate the constructed output before returning. Cheap insurance.
  const parsed = CoworkerOutputSchema.safeParse(out);
  if (!parsed.success) {
    logger.error('[coworker.governance] deterministicFallback failed schema validation', {
      family,
      issues: parsed.error.issues,
    });
    throw new Error('CoworkerAgentService: deterministic fallback failed schema validation');
  }
  return parsed.data;
}
