/**
 * Coworker deterministic fallback (PR-23).
 *
 * When a coworker run is blocked by governance, rate limits, daily token
 * budget, or (future) Gemini unavailability, we MUST NOT throw a 500 at the
 * admin UI. Instead we return a small, machine-readable JSON object with a
 * loud `degraded: true` flag so callers can render a graceful "live data, no
 * AI commentary" state.
 *
 * Design notes
 * ────────────
 *   - This module owns the WIRE SHAPE only. Nothing here calls Gemini, talks
 *     to a database, or touches money / hardware paths. It is a pure
 *     synchronous helper used by route handlers and the agent service.
 *   - The shape is intentionally narrower than `CoworkerOutput`. Callers that
 *     want a full coworker output can wrap this; the fallback shape is the
 *     stable contract that downstream tools (audit log, ops dashboards) rely
 *     on regardless of which family is running.
 *   - Reason codes are a closed enum. Adding one is a deliberate PR.
 *   - `coerceErrorToFallback` recognises sibling error classes by NAME
 *     (string match) rather than `instanceof`. This keeps the module
 *     decoupled from PR-22 (limits.ts) and PR-21 (governance.ts) so it
 *     compiles in any branch ordering and never imports work that may not
 *     yet be merged. The cost is a tiny string compare; the benefit is zero
 *     load-order coupling.
 *
 * No new dependencies. No schema migrations. No UI. No Gemini.
 */

import type { CoworkerFamily } from '../../../shared/coworker-types';

// ─── Reason codes (closed enum) ─────────────────────────────────────────────
export const COWORKER_FALLBACK_REASONS = [
  'rate_limit',          // sliding-window per-actor cap (PR-21 governance)
  'budget',              // daily token budget exhausted (PR-22 limits)
  'governance',          // unsafe output / policy guard tripped
  'gemini_unavailable',  // upstream AI down / quota / invalid JSON (future)
  'unknown',             // catch-all for anything we don't recognise
] as const;

export type CoworkerFallbackReason = (typeof COWORKER_FALLBACK_REASONS)[number];

// ─── Wire shape ─────────────────────────────────────────────────────────────
//
// Stable JSON contract. Field order in `buildFallback` is preserved so that
// `JSON.stringify(buildFallback(...))` produces a deterministic snapshot —
// the snapshot test pins this.
export interface CoworkerFallbackResponse {
  /** Always true. Lets clients branch on a single field. */
  degraded: true;
  /** Closed-enum reason. UI can map this to a localized banner. */
  reason: CoworkerFallbackReason;
  /** Family that was being run, when known. Optional — generic call sites may not have one. */
  family?: CoworkerFamily;
  /** Empty by design: a degraded run produces no Gemini findings. */
  findings: readonly never[];
  /** Short human-readable explanation. Stable per reason for snapshot tests. */
  summary: string;
  /** ISO-8601 instant the fallback was minted. */
  timestamp: string;
}

// ─── Stable per-reason summaries ────────────────────────────────────────────
//
// Kept short and operational. The UI may override these for localisation; the
// server-side text is what lands in audit logs.
const SUMMARIES: Record<CoworkerFallbackReason, string> = {
  rate_limit:
    'Coworker rate limit reached for this actor. Showing live data only; AI commentary suppressed.',
  budget:
    'Daily AI token budget exhausted. Showing live data only; AI commentary will resume tomorrow.',
  governance:
    'AI output blocked by governance guard. Showing live data only; no advisory text generated.',
  gemini_unavailable:
    'AI service is temporarily unavailable. Showing live data only; retry shortly.',
  unknown:
    'Coworker run could not produce AI commentary. Showing live data only.',
};

// ─── Build helper ───────────────────────────────────────────────────────────
export interface BuildFallbackOptions {
  family?: CoworkerFamily;
  /** Override the default summary text. Most callers should not. */
  summary?: string;
  /** Override the timestamp (test ergonomics). Default: new Date().toISOString(). */
  timestamp?: string;
}

/**
 * Construct a CoworkerFallbackResponse. Pure, synchronous, allocation only.
 * Field-order is fixed for stable JSON snapshots.
 */
export function buildFallback(
  reason: CoworkerFallbackReason,
  opts: BuildFallbackOptions = {},
): CoworkerFallbackResponse {
  const out: CoworkerFallbackResponse = {
    degraded: true,
    reason,
    // family is conditionally added below to preserve "absent" vs "undefined"
    findings: Object.freeze([]) as readonly never[],
    summary: opts.summary ?? SUMMARIES[reason],
    timestamp: opts.timestamp ?? new Date().toISOString(),
  };
  if (opts.family !== undefined) {
    // Insert in the documented position by reconstructing; cheap and keeps
    // JSON.stringify output stable.
    return {
      degraded: true,
      reason,
      family: opts.family,
      findings: out.findings,
      summary: out.summary,
      timestamp: out.timestamp,
    };
  }
  return out;
}

// ─── Type guard ─────────────────────────────────────────────────────────────
/**
 * Returns true when `value` is a structurally valid CoworkerFallbackResponse.
 * Conservative: rejects partial objects, wrong reason codes, missing
 * timestamp, and non-empty findings.
 */
export function isFallbackResponse(value: unknown): value is CoworkerFallbackResponse {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.degraded !== true) return false;
  if (typeof v.reason !== 'string') return false;
  if (!(COWORKER_FALLBACK_REASONS as readonly string[]).includes(v.reason)) return false;
  if (typeof v.summary !== 'string') return false;
  if (typeof v.timestamp !== 'string' || v.timestamp.length === 0) return false;
  if (!Array.isArray(v.findings)) return false;
  // PR-23 contract: findings must be empty in a fallback response. A non-empty
  // findings array means the caller mistook a real run for a fallback.
  if ((v.findings as unknown[]).length !== 0) return false;
  if (v.family !== undefined && typeof v.family !== 'string') return false;
  return true;
}

// ─── Error → reason mapping ─────────────────────────────────────────────────
//
// We match by `error.name` and `error.constructor.name` so this stays
// decoupled from sibling PRs that may or may not be present in the current
// branch. The mapping is a simple lookup table — easy to extend.
const ERROR_NAME_TO_REASON: Record<string, CoworkerFallbackReason> = {
  CoworkerRateLimitError: 'rate_limit',
  CoworkerDailyBudgetExceededError: 'budget',
  CoworkerBudgetExceededError: 'budget',
  CoworkerUnsafeOutputError: 'governance',
  CoworkerGovernanceError: 'governance',
  CoworkerReadonlyViolationError: 'governance',
  CoworkerGeminiUnavailableError: 'gemini_unavailable',
  GeminiUnavailableError: 'gemini_unavailable',
};

function reasonForError(err: unknown): CoworkerFallbackReason {
  if (err === null || err === undefined) return 'unknown';
  if (typeof err !== 'object') return 'unknown';
  const e = err as { name?: unknown; constructor?: { name?: unknown } };
  const directName = typeof e.name === 'string' ? e.name : undefined;
  if (directName && ERROR_NAME_TO_REASON[directName]) {
    return ERROR_NAME_TO_REASON[directName];
  }
  const ctorName =
    e.constructor && typeof e.constructor.name === 'string' ? e.constructor.name : undefined;
  if (ctorName && ERROR_NAME_TO_REASON[ctorName]) {
    return ERROR_NAME_TO_REASON[ctorName];
  }
  return 'unknown';
}

/**
 * Map any thrown value to a CoworkerFallbackResponse. Never throws; always
 * returns a valid object. Use this in catch blocks at the route boundary
 * when fallback mode is opt-in.
 */
export function coerceErrorToFallback(
  err: unknown,
  opts: BuildFallbackOptions = {},
): CoworkerFallbackResponse {
  return buildFallback(reasonForError(err), opts);
}
