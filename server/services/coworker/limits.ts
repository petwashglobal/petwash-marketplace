/**
 * Coworker runtime limits — snapshot cache, global rate limit, daily token budget.
 *
 * PR-22 ADDS RUNTIME LIMITS. PR-23+ wires real Gemini calls so this budget
 * starts being decremented with real token counts. Today the hooks exist but
 * the only caller is CoworkerAgentService.runFamily, which spends 0 tokens.
 *
 * What lives here:
 *
 * 1. Snapshot cache  — keyed on (adminUserId, family, scopeHash), small
 *                      Map<string, {value, expiresAt}>. TTL configurable per
 *                      put (default 60s). NO Redis. Acceptable per replica
 *                      because coworker traffic is super-admin-only.
 *
 * 2. Rate limiter    — fixed-window counter (NOT sliding) across two scopes:
 *                      a) per-admin: default 30 req / 60s
 *                      b) global:    default 200 req / 60s
 *                      Throws CoworkerRateLimitError with retryAfterMs and
 *                      the scope that was exceeded.
 *
 * 3. Daily budget    — read once from env COWORKER_DAILY_TOKEN_BUDGET (int).
 *                      If unset, default to 100_000 and log ONE warning at
 *                      startup. Counter resets at UTC midnight. Throws
 *                      CoworkerDailyBudgetExceededError on overrun.
 *
 * Constraints honoured by this file:
 *   - No new dependencies.
 *   - No schema migrations.
 *   - No money / hardware / auth touched.
 *   - Per-replica in-memory only. If volume grows beyond a few admins, swap
 *     for Redis without changing public function signatures (TODO: PR-2x).
 */
import { logger } from '../../lib/logger';

// ─── Snapshot cache ─────────────────────────────────────────────────────────

export interface SnapshotEntry<V> {
  value: V;
  expiresAt: number;
}

/** Default snapshot TTL in seconds. Matches the 60s default in the runFamily contract. */
export const DEFAULT_SNAPSHOT_TTL_SECONDS = 60;

const SNAPSHOT_CACHE = new Map<string, SnapshotEntry<unknown>>();

/**
 * Build a stable cache key from (admin id, agent id, scope object).
 * Scope keys are sorted so {a:1,b:2} and {b:2,a:1} share a cache slot.
 *
 * Exported for tests + for callers that want to compute the key without
 * actually touching the cache.
 */
export function buildSnapshotCacheKey(
  adminUserId: string | undefined,
  agentId: string,
  scope?: Record<string, string | number | boolean> | undefined,
): string {
  const adminPart = adminUserId ?? 'anon';
  if (!scope) return `${adminPart}|${agentId}|-`;
  const stable = Object.keys(scope)
    .sort()
    .map((k) => `${k}=${String(scope[k])}`)
    .join('&');
  return `${adminPart}|${agentId}|${stable}`;
}

/**
 * Get a fresh entry from the cache, or undefined if missing / expired.
 * Expired entries are NOT eagerly evicted here — putSnapshot overwrites them
 * and clearSnapshotCache wipes everything. Acceptable because the key space
 * is tiny (admins x families x scopes).
 */
export function getSnapshot<V>(key: string): V | undefined {
  const hit = SNAPSHOT_CACHE.get(key) as SnapshotEntry<V> | undefined;
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) return undefined;
  return hit.value;
}

/** Store a value in the snapshot cache with the given TTL (seconds). */
export function putSnapshot<V>(
  key: string,
  value: V,
  ttlSeconds: number = DEFAULT_SNAPSHOT_TTL_SECONDS,
): void {
  const safeTtl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_SNAPSHOT_TTL_SECONDS;
  SNAPSHOT_CACHE.set(key, {
    value,
    expiresAt: Date.now() + safeTtl * 1000,
  });
}

/** Test / admin-tool helper: clear the snapshot cache. */
export function clearSnapshotCache(): void {
  SNAPSHOT_CACHE.clear();
}

/** Introspection helper for status endpoints / tests. */
export function snapshotCacheSize(): number {
  return SNAPSHOT_CACHE.size;
}

// ─── Rate limiter (per-admin AND global) ────────────────────────────────────

export interface FixedWindowConfig {
  /** Max requests inside the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export const DEFAULT_PER_ADMIN_LIMIT: FixedWindowConfig = {
  max: 30,
  windowMs: 60_000,
};

export const DEFAULT_GLOBAL_LIMIT: FixedWindowConfig = {
  max: 200,
  windowMs: 60_000,
};

interface WindowState {
  count: number;
  windowStartMs: number;
}

const PER_ADMIN_BUCKETS = new Map<string, WindowState>();
const GLOBAL_BUCKET: WindowState = { count: 0, windowStartMs: Date.now() };

export type RateLimitScope = 'admin' | 'global';

export class CoworkerRateLimitError extends Error {
  constructor(
    public readonly scope: RateLimitScope,
    public readonly retryAfterMs: number,
    public readonly actorUserId?: string,
  ) {
    super(
      `Coworker rate limit exceeded (scope=${scope}${actorUserId ? `, actor=${actorUserId}` : ''}); ` +
        `retry after ${Math.ceil(retryAfterMs / 1000)}s`,
    );
    this.name = 'CoworkerRateLimitError';
  }
}

/**
 * Tick a fixed-window counter. Returns retryAfterMs > 0 when over budget,
 * or 0 when the increment was accepted. Pure helper — no error throwing,
 * so callers can compose multiple scopes.
 */
function tickWindow(state: WindowState, config: FixedWindowConfig, now: number): number {
  const elapsed = now - state.windowStartMs;
  if (elapsed >= config.windowMs) {
    state.windowStartMs = now;
    state.count = 0;
  }
  if (state.count >= config.max) {
    return state.windowStartMs + config.windowMs - now;
  }
  state.count += 1;
  return 0;
}

/**
 * Check + increment both the per-admin and the global rate limit.
 *
 * Throws CoworkerRateLimitError with `scope` set to whichever budget was
 * exhausted first. The per-admin budget is checked first so a single noisy
 * admin gets a precise error before tipping over the shared budget.
 *
 * Both increments are committed before this returns, matching fixed-window
 * semantics. If the per-admin check throws, the global counter is NOT
 * incremented (no double accounting).
 */
export function assertRequestUnderRateLimits(
  actorUserId: string | undefined,
  perAdmin: FixedWindowConfig = DEFAULT_PER_ADMIN_LIMIT,
  global: FixedWindowConfig = DEFAULT_GLOBAL_LIMIT,
): void {
  const now = Date.now();
  const adminKey = actorUserId ?? 'anon';
  const adminBucket = PER_ADMIN_BUCKETS.get(adminKey) ?? { count: 0, windowStartMs: now };

  const adminRetry = tickWindow(adminBucket, perAdmin, now);
  PER_ADMIN_BUCKETS.set(adminKey, adminBucket);
  if (adminRetry > 0) {
    throw new CoworkerRateLimitError('admin', adminRetry, actorUserId);
  }

  const globalRetry = tickWindow(GLOBAL_BUCKET, global, now);
  if (globalRetry > 0) {
    // We already counted this request against the admin bucket. That's the
    // correct accounting: per-admin is "what this admin tried to do", which
    // includes this request; the failure is that the shared pool is full.
    throw new CoworkerRateLimitError('global', globalRetry, actorUserId);
  }
}

/** Test helper: clear all rate limit state (admin + global). */
export function clearRateLimitState(): void {
  PER_ADMIN_BUCKETS.clear();
  GLOBAL_BUCKET.count = 0;
  GLOBAL_BUCKET.windowStartMs = Date.now();
}

// ─── Daily token budget ─────────────────────────────────────────────────────

export const DEFAULT_DAILY_TOKEN_BUDGET = 100_000;

export class CoworkerDailyBudgetExceededError extends Error {
  constructor(
    public readonly used: number,
    public readonly budget: number,
    public readonly resetAt: string,
  ) {
    super(
      `Coworker daily token budget exhausted (used=${used}, budget=${budget}); ` +
        `resets at ${resetAt}`,
    );
    this.name = 'CoworkerDailyBudgetExceededError';
  }
}

interface DailyBudgetState {
  /** Tokens consumed today (since last UTC midnight reset). */
  used: number;
  /** UTC date string (YYYY-MM-DD) for which `used` accumulated. */
  utcDateKey: string;
  /** Resolved budget (env or default). Resolved lazily on first use. */
  budget: number | null;
  /** Whether we've already logged the env-default warning. */
  warnedDefault: boolean;
}

const DAILY_BUDGET_STATE: DailyBudgetState = {
  used: 0,
  utcDateKey: utcDateKeyFor(Date.now()),
  budget: null,
  warnedDefault: false,
};

function utcDateKeyFor(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

/**
 * Compute the next UTC-midnight ISO timestamp after `now`. Used in error
 * messages so the UI can render "resets at 2026-05-05T00:00:00Z".
 */
function nextUtcMidnightIso(now: number): string {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

/**
 * Resolve the daily budget from env on first use. If unset / non-numeric /
 * negative, fall back to DEFAULT_DAILY_TOKEN_BUDGET and log ONE warning so
 * Cloud Run logs surface the misconfiguration without spamming.
 */
function resolveBudget(): number {
  if (DAILY_BUDGET_STATE.budget !== null) return DAILY_BUDGET_STATE.budget;
  const raw = process.env.COWORKER_DAILY_TOKEN_BUDGET;
  const parsed = raw !== undefined ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    DAILY_BUDGET_STATE.budget = parsed;
  } else {
    DAILY_BUDGET_STATE.budget = DEFAULT_DAILY_TOKEN_BUDGET;
    if (!DAILY_BUDGET_STATE.warnedDefault) {
      DAILY_BUDGET_STATE.warnedDefault = true;
      logger.warn(
        `[coworker.limits] COWORKER_DAILY_TOKEN_BUDGET unset or invalid; ` +
          `defaulting to ${DEFAULT_DAILY_TOKEN_BUDGET}. Set the env var to silence this.`,
      );
    }
  }
  return DAILY_BUDGET_STATE.budget;
}

function rolloverIfNewDay(now: number): void {
  const today = utcDateKeyFor(now);
  if (today !== DAILY_BUDGET_STATE.utcDateKey) {
    DAILY_BUDGET_STATE.utcDateKey = today;
    DAILY_BUDGET_STATE.used = 0;
  }
}

/**
 * Reserve token capacity BEFORE making an upstream call. Returns silently
 * when the request fits inside today's remaining budget; throws otherwise.
 *
 * `expectedTokens` should be the Gemini caller's best estimate (input +
 * expected output). After the actual call, callers should adjust with
 * recordTokenSpend(actual - expected) if available — this is opportunistic;
 * the reservation alone enforces the cap.
 *
 * PR-22 wires the reservation hook but no real Gemini call exists yet, so
 * the reservation amount is currently 0 from runFamily.
 */
export function assertDailyTokenBudget(expectedTokens: number): void {
  const now = Date.now();
  rolloverIfNewDay(now);
  const budget = resolveBudget();
  const requested = Number.isFinite(expectedTokens) && expectedTokens > 0 ? Math.ceil(expectedTokens) : 0;
  if (DAILY_BUDGET_STATE.used + requested > budget) {
    throw new CoworkerDailyBudgetExceededError(
      DAILY_BUDGET_STATE.used,
      budget,
      nextUtcMidnightIso(now),
    );
  }
  DAILY_BUDGET_STATE.used += requested;
}

/**
 * Adjust the daily counter after the upstream call returned an actual
 * token count. Pass the DELTA from the reservation (positive = used more
 * than expected, negative = used less). Negative deltas clamp at 0.
 *
 * Crossing today's budget via a positive delta does NOT throw — the call
 * already happened. Subsequent assertDailyTokenBudget calls will throw.
 */
export function recordTokenSpend(deltaTokens: number): void {
  const now = Date.now();
  rolloverIfNewDay(now);
  if (!Number.isFinite(deltaTokens)) return;
  DAILY_BUDGET_STATE.used = Math.max(0, DAILY_BUDGET_STATE.used + Math.ceil(deltaTokens));
}

export interface DailyBudgetSnapshot {
  used: number;
  budget: number;
  utcDateKey: string;
  resetAt: string;
}

/** Read-only snapshot of the daily counter — for /status endpoints + tests. */
export function getDailyBudgetSnapshot(): DailyBudgetSnapshot {
  const now = Date.now();
  rolloverIfNewDay(now);
  return {
    used: DAILY_BUDGET_STATE.used,
    budget: resolveBudget(),
    utcDateKey: DAILY_BUDGET_STATE.utcDateKey,
    resetAt: nextUtcMidnightIso(now),
  };
}

/** Test helper: reset the daily token counter + re-resolve env on next call. */
export function clearDailyBudgetState(): void {
  DAILY_BUDGET_STATE.used = 0;
  DAILY_BUDGET_STATE.utcDateKey = utcDateKeyFor(Date.now());
  DAILY_BUDGET_STATE.budget = null;
  DAILY_BUDGET_STATE.warnedDefault = false;
}
