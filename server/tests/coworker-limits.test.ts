/**
 * Tests for PR-22 coworker runtime limits:
 *   - snapshot cache (limits.ts)
 *   - per-admin + global fixed-window rate limiter
 *   - daily token budget (UTC midnight reset)
 *   - integration with CoworkerAgentService.runFamily
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertDailyTokenBudget,
  assertRequestUnderRateLimits,
  buildSnapshotCacheKey,
  clearDailyBudgetState,
  clearRateLimitState,
  clearSnapshotCache,
  CoworkerDailyBudgetExceededError,
  CoworkerRateLimitError,
  DEFAULT_DAILY_TOKEN_BUDGET,
  DEFAULT_GLOBAL_LIMIT,
  DEFAULT_PER_ADMIN_LIMIT,
  DEFAULT_SNAPSHOT_TTL_SECONDS,
  getDailyBudgetSnapshot,
  getSnapshot,
  putSnapshot,
  recordTokenSpend,
  snapshotCacheSize,
} from '../services/coworker/limits';
import { coworkerAgentService } from '../services/CoworkerAgentService';
import { clearRateLimitState as clearGovernanceRateLimit } from '../services/coworker/governance';

// Avoid talking to the real audit-log DB during these tests. The service
// already swallows errors but stubbing keeps logs quiet.
vi.mock('../middleware/auditLog', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

function fullReset() {
  clearSnapshotCache();
  clearRateLimitState();
  clearDailyBudgetState();
  clearGovernanceRateLimit();
  coworkerAgentService.clearCache();
  delete process.env.COWORKER_DAILY_TOKEN_BUDGET;
}

describe('coworker/limits — snapshot cache', () => {
  beforeEach(fullReset);
  afterEach(fullReset);

  it('builds stable keys regardless of scope key order', () => {
    const a = buildSnapshotCacheKey('admin-1', 'fraud', { stationId: 'S1', country: 'IL' });
    const b = buildSnapshotCacheKey('admin-1', 'fraud', { country: 'IL', stationId: 'S1' });
    expect(a).toBe(b);
  });

  it('partitions by admin id, agent id, and scope', () => {
    const k1 = buildSnapshotCacheKey('admin-1', 'fraud');
    const k2 = buildSnapshotCacheKey('admin-2', 'fraud');
    const k3 = buildSnapshotCacheKey('admin-1', 'booking');
    const k4 = buildSnapshotCacheKey('admin-1', 'fraud', { stationId: 'S1' });
    expect(new Set([k1, k2, k3, k4]).size).toBe(4);
  });

  it('returns undefined for missing keys', () => {
    expect(getSnapshot('does-not-exist')).toBeUndefined();
  });

  it('stores and retrieves values within the TTL', () => {
    const key = buildSnapshotCacheKey('admin-1', 'ops');
    putSnapshot(key, { hello: 'world' }, 60);
    expect(getSnapshot(key)).toEqual({ hello: 'world' });
    expect(snapshotCacheSize()).toBe(1);
  });

  it('expires entries after their TTL elapses', () => {
    vi.useFakeTimers();
    const key = buildSnapshotCacheKey('admin-1', 'ops');
    putSnapshot(key, 'fresh', 1); // 1 second
    expect(getSnapshot(key)).toBe('fresh');
    vi.advanceTimersByTime(2_000);
    expect(getSnapshot(key)).toBeUndefined();
    vi.useRealTimers();
  });

  it('uses the default TTL when given a non-positive number', () => {
    expect(DEFAULT_SNAPSHOT_TTL_SECONDS).toBeGreaterThan(0);
    const key = buildSnapshotCacheKey('admin-1', 'ops');
    putSnapshot(key, 'x', -5);
    expect(getSnapshot(key)).toBe('x');
  });
});

describe('coworker/limits — fixed-window rate limiter', () => {
  beforeEach(fullReset);
  afterEach(fullReset);

  it('allows requests up to the per-admin max within a window', () => {
    const cfg = { max: 3, windowMs: 60_000 };
    expect(() => assertRequestUnderRateLimits('admin-1', cfg, DEFAULT_GLOBAL_LIMIT)).not.toThrow();
    expect(() => assertRequestUnderRateLimits('admin-1', cfg, DEFAULT_GLOBAL_LIMIT)).not.toThrow();
    expect(() => assertRequestUnderRateLimits('admin-1', cfg, DEFAULT_GLOBAL_LIMIT)).not.toThrow();
  });

  it('throws scope=admin when per-admin limit is exceeded', () => {
    const cfg = { max: 2, windowMs: 60_000 };
    assertRequestUnderRateLimits('admin-1', cfg, DEFAULT_GLOBAL_LIMIT);
    assertRequestUnderRateLimits('admin-1', cfg, DEFAULT_GLOBAL_LIMIT);
    let captured: CoworkerRateLimitError | undefined;
    try {
      assertRequestUnderRateLimits('admin-1', cfg, DEFAULT_GLOBAL_LIMIT);
    } catch (e) {
      captured = e as CoworkerRateLimitError;
    }
    expect(captured).toBeInstanceOf(CoworkerRateLimitError);
    expect(captured!.scope).toBe('admin');
    expect(captured!.retryAfterMs).toBeGreaterThan(0);
    expect(captured!.actorUserId).toBe('admin-1');
  });

  it('isolates admins from each other', () => {
    const cfg = { max: 1, windowMs: 60_000 };
    assertRequestUnderRateLimits('admin-1', cfg, DEFAULT_GLOBAL_LIMIT);
    expect(() => assertRequestUnderRateLimits('admin-2', cfg, DEFAULT_GLOBAL_LIMIT)).not.toThrow();
    expect(() => assertRequestUnderRateLimits('admin-1', cfg, DEFAULT_GLOBAL_LIMIT)).toThrow(CoworkerRateLimitError);
  });

  it('throws scope=global when global limit is exceeded but per-admin isn\'t', () => {
    const wideAdmin = { max: 1000, windowMs: 60_000 };
    const tightGlobal = { max: 2, windowMs: 60_000 };
    assertRequestUnderRateLimits('a1', wideAdmin, tightGlobal);
    assertRequestUnderRateLimits('a2', wideAdmin, tightGlobal);
    let captured: CoworkerRateLimitError | undefined;
    try {
      assertRequestUnderRateLimits('a3', wideAdmin, tightGlobal);
    } catch (e) {
      captured = e as CoworkerRateLimitError;
    }
    expect(captured).toBeInstanceOf(CoworkerRateLimitError);
    expect(captured!.scope).toBe('global');
  });

  it('rolls the window after windowMs elapses', () => {
    vi.useFakeTimers();
    const cfg = { max: 1, windowMs: 60_000 };
    assertRequestUnderRateLimits('admin-1', cfg, DEFAULT_GLOBAL_LIMIT);
    expect(() => assertRequestUnderRateLimits('admin-1', cfg, DEFAULT_GLOBAL_LIMIT)).toThrow(CoworkerRateLimitError);
    vi.advanceTimersByTime(60_001);
    expect(() => assertRequestUnderRateLimits('admin-1', cfg, DEFAULT_GLOBAL_LIMIT)).not.toThrow();
    vi.useRealTimers();
  });

  it('uses sane defaults exposed for callers', () => {
    expect(DEFAULT_PER_ADMIN_LIMIT.max).toBeGreaterThan(0);
    expect(DEFAULT_GLOBAL_LIMIT.max).toBeGreaterThan(DEFAULT_PER_ADMIN_LIMIT.max);
  });
});

describe('coworker/limits — daily token budget', () => {
  beforeEach(fullReset);
  afterEach(fullReset);

  it('uses default budget and warns once when env unset', () => {
    const snap = getDailyBudgetSnapshot();
    expect(snap.budget).toBe(DEFAULT_DAILY_TOKEN_BUDGET);
    expect(snap.used).toBe(0);
    // resetAt should be a parseable ISO instant
    expect(() => new Date(snap.resetAt).toISOString()).not.toThrow();
  });

  it('reads the budget from COWORKER_DAILY_TOKEN_BUDGET when valid', () => {
    process.env.COWORKER_DAILY_TOKEN_BUDGET = '5000';
    clearDailyBudgetState(); // re-read env on next call
    expect(getDailyBudgetSnapshot().budget).toBe(5000);
  });

  it('falls back to default when env is non-numeric', () => {
    process.env.COWORKER_DAILY_TOKEN_BUDGET = 'banana';
    clearDailyBudgetState();
    expect(getDailyBudgetSnapshot().budget).toBe(DEFAULT_DAILY_TOKEN_BUDGET);
  });

  it('accepts requests that fit and tracks usage', () => {
    process.env.COWORKER_DAILY_TOKEN_BUDGET = '1000';
    clearDailyBudgetState();
    assertDailyTokenBudget(400);
    assertDailyTokenBudget(300);
    expect(getDailyBudgetSnapshot().used).toBe(700);
  });

  it('throws CoworkerDailyBudgetExceededError when over budget', () => {
    process.env.COWORKER_DAILY_TOKEN_BUDGET = '500';
    clearDailyBudgetState();
    assertDailyTokenBudget(400);
    let captured: CoworkerDailyBudgetExceededError | undefined;
    try {
      assertDailyTokenBudget(200);
    } catch (e) {
      captured = e as CoworkerDailyBudgetExceededError;
    }
    expect(captured).toBeInstanceOf(CoworkerDailyBudgetExceededError);
    expect(captured!.used).toBe(400);
    expect(captured!.budget).toBe(500);
    expect(captured!.resetAt).toMatch(/T00:00:00\.000Z$/);
  });

  it('treats 0-token reservations as always allowed', () => {
    process.env.COWORKER_DAILY_TOKEN_BUDGET = '1';
    clearDailyBudgetState();
    assertDailyTokenBudget(1); // exhaust
    expect(() => assertDailyTokenBudget(0)).not.toThrow();
  });

  it('recordTokenSpend adjusts the used counter and clamps at zero', () => {
    process.env.COWORKER_DAILY_TOKEN_BUDGET = '1000';
    clearDailyBudgetState();
    assertDailyTokenBudget(100);
    recordTokenSpend(50);
    expect(getDailyBudgetSnapshot().used).toBe(150);
    recordTokenSpend(-1000);
    expect(getDailyBudgetSnapshot().used).toBe(0);
  });

  it('resets at UTC midnight rollover', () => {
    vi.useFakeTimers();
    // Pin to 23:59:00 UTC on 2026-05-04.
    vi.setSystemTime(new Date('2026-05-04T23:59:00Z'));
    process.env.COWORKER_DAILY_TOKEN_BUDGET = '100';
    clearDailyBudgetState();
    assertDailyTokenBudget(100);
    expect(() => assertDailyTokenBudget(1)).toThrow(CoworkerDailyBudgetExceededError);
    // Cross UTC midnight.
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(() => assertDailyTokenBudget(50)).not.toThrow();
    expect(getDailyBudgetSnapshot().used).toBe(50);
    vi.useRealTimers();
  });
});

describe('CoworkerAgentService — limits wiring', () => {
  beforeEach(fullReset);
  afterEach(fullReset);

  it('caches a fresh runFamily output per (admin, family, scope)', async () => {
    const out1 = await coworkerAgentService.runFamily('fraud', {
      actor: { actorUserId: 'admin-1' },
    });
    expect(out1.family).toBe('fraud');
    expect(coworkerAgentService.getCacheSize()).toBe(1);

    // Second call with same actor + scope → cache hit, no new entry.
    const out2 = await coworkerAgentService.runFamily('fraud', {
      actor: { actorUserId: 'admin-1' },
    });
    expect(out2.generatedAt).toBe(out1.generatedAt);
    expect(coworkerAgentService.getCacheSize()).toBe(1);
  });

  it('treats different admins as separate cache slots', async () => {
    await coworkerAgentService.runFamily('fraud', { actor: { actorUserId: 'admin-1' } });
    await coworkerAgentService.runFamily('fraud', { actor: { actorUserId: 'admin-2' } });
    expect(coworkerAgentService.getCacheSize()).toBe(2);
  });

  it('throws CoworkerRateLimitError (scope=admin) when per-admin fixed window is exceeded', async () => {
    // Use a tiny per-admin window so we don't trip PR-21's per-(actor,family)
    // sliding window first. noCache:true forces every call past the cache.
    const tinyAdmin = { max: 1, windowMs: 60_000 };
    await coworkerAgentService.runFamily('fraud', {
      actor: { actorUserId: 'admin-1' },
      noCache: true,
      perAdminRateLimit: tinyAdmin,
    });
    await expect(
      coworkerAgentService.runFamily('fraud', {
        actor: { actorUserId: 'admin-1' },
        noCache: true,
        perAdminRateLimit: tinyAdmin,
      }),
    ).rejects.toBeInstanceOf(CoworkerRateLimitError);
  });

  it('throws CoworkerDailyBudgetExceededError when expectedTokens push over budget', async () => {
    process.env.COWORKER_DAILY_TOKEN_BUDGET = '100';
    clearDailyBudgetState();
    await coworkerAgentService.runFamily('fraud', {
      actor: { actorUserId: 'admin-1' },
      expectedTokens: 90,
    });
    await expect(
      coworkerAgentService.runFamily('fraud', {
        actor: { actorUserId: 'admin-1' },
        noCache: true,
        expectedTokens: 50,
      }),
    ).rejects.toBeInstanceOf(CoworkerDailyBudgetExceededError);
  });

  it('cache hits bypass rate limit + budget checks', async () => {
    process.env.COWORKER_DAILY_TOKEN_BUDGET = '1';
    clearDailyBudgetState();
    // First call reserves 1 token (exhausts budget) and caches the output.
    await coworkerAgentService.runFamily('fraud', {
      actor: { actorUserId: 'admin-1' },
      expectedTokens: 1,
    });
    // Second call hits the cache and must NOT throw despite the empty budget.
    const cached = await coworkerAgentService.runFamily('fraud', {
      actor: { actorUserId: 'admin-1' },
      expectedTokens: 9999,
    });
    expect(cached.family).toBe('fraud');
  });
});
