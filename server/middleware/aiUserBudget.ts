/**
 * aiUserBudget — per-identity daily AI-request budget, Redis-backed.
 *
 * AUDIT-AI-8 (#203, CEO Lane A, 2026-09-01) — the existing AI limiters
 * (aiChatLimiter, aiChatHourlyLimiter) are IP-only and in-memory. This
 * middleware adds the missing layer the audit called out:
 *
 *   • per-user (Firebase UID) daily budget, shared across process
 *     instances via Redis so a Cloud Run rolling deploy or a scale-up
 *     event cannot reset a caller's budget by landing them on a fresh
 *     replica.
 *   • per-endpoint tag so an "expensive-generation" route can carry
 *     a stricter cap than a "cheap-completion" route without either
 *     of them cannibalising a shared bucket.
 *   • token-weighted charge on the way out: a handler can call the
 *     returned `chargeTokens(n)` closure to bill the CANDIDATE token
 *     count (or a hand-derived cost) against the same budget, so the
 *     cap constrains ₪ spend and not just request count.
 *   • fails CLOSED in production when Redis is unreachable, so a
 *     Redis outage cannot silently uncap AI cost.
 *
 * Anonymous callers (the flagship /api/ai/chat + /api/v1/chat/message
 * routes are anonymous by design) fall back to a stable per-IP key
 * with a stricter cap, so we still get *some* budgeting on those.
 *
 * Not this file's job (later slices):
 *   • the per-endpoint hourly bucket (existing IP hourly limiter
 *     stays as the defensive burst floor).
 *   • the global concurrency semaphore (own middleware, own lane).
 */
import type { Request, Response, NextFunction } from 'express';
import { redis } from '../services/redis';
import { logger } from '../lib/logger';

export interface AiUserBudgetOptions {
  /** Short slug that identifies the endpoint — appears in the Redis key and the audit log. */
  endpointTag: string;
  /** Requests-per-day cap for AUTHENTICATED callers. */
  dailyLimitAuthenticated: number;
  /** Requests-per-day cap for ANONYMOUS callers (per-IP key). Should be strictly lower. */
  dailyLimitAnonymous: number;
  /**
   * When true, a Redis outage FAILS CLOSED in production (503 instead of
   * silently allowing the request). Defaults to true. Set to false only
   * for a route where an outage should still allow traffic.
   */
  failClosedOnOutage?: boolean;
}

export interface AiUserBudgetHandle {
  /** Charge additional units against the same budget key (e.g. output tokens). */
  chargeTokens: (units: number) => Promise<void>;
  /** The Redis key this request is billed under — for correlation logs. */
  budgetKey: string;
  /** The identity kind resolved for this request. */
  identityKind: 'uid' | 'ip';
}

function todayUtcYyyyMmDd(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function callerIp(req: Request): string {
  const xff = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return xff || (req.headers['x-real-ip'] as string | undefined) || req.ip || 'unknown';
}

function resolveIdentity(req: Request): { kind: 'uid' | 'ip'; id: string } {
  const uid =
    (req as any).firebaseUser?.uid ||
    (req as any).user?.uid ||
    null;
  if (typeof uid === 'string' && uid.length > 0) {
    return { kind: 'uid', id: uid };
  }
  return { kind: 'ip', id: callerIp(req) };
}

/**
 * Express middleware factory. Also decorates the request with
 * `(req as any).aiBudget: AiUserBudgetHandle` so handlers can charge
 * output tokens after the model call:
 *
 *   await (req as any).aiBudget?.chargeTokens(candidateTokenCount);
 *
 * The initial INCR bills the request as 1 unit; the handler tops up
 * with the true cost once known. This matches the CEO's "cost-aware,
 * token-weighted" requirement without forcing every route to pre-declare
 * a maxOutputTokens up front.
 */
export function aiUserBudget(opts: AiUserBudgetOptions) {
  const failClosed = opts.failClosedOnOutage !== false;
  const TTL_SECONDS = 60 * 60 * 26; // budget expires ~26h after first hit — safe over a UTC day boundary

  return async function aiUserBudgetMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!redis.isConnected()) {
      if (failClosed && process.env.NODE_ENV === 'production') {
        logger.error('[aiUserBudget] Redis unavailable in production — failing CLOSED', {
          endpointTag: opts.endpointTag,
        });
        return res.status(503).json({
          error: 'AI_BUDGET_UNAVAILABLE',
          endpointTag: opts.endpointTag,
        });
      }
      // Dev / preview: allow through with a warning so local work is not blocked
      // by a missing REDIS_URL. Production always fails closed.
      logger.warn('[aiUserBudget] Redis not connected — allowing request (non-prod)', {
        endpointTag: opts.endpointTag,
      });
      return next();
    }

    const identity = resolveIdentity(req);
    const limit = identity.kind === 'uid' ? opts.dailyLimitAuthenticated : opts.dailyLimitAnonymous;
    const day = todayUtcYyyyMmDd();
    const budgetKey = `ai_budget:${opts.endpointTag}:${day}:${identity.kind}:${identity.id}`;

    try {
      const next1 = await redis.incr(budgetKey);
      // TTL is set on the first increment. Subsequent increments leave it alone.
      if (next1 === 1) {
        await redis.expire(budgetKey, TTL_SECONDS);
      }
      if (next1 > limit) {
        logger.warn('[aiUserBudget] Daily budget exceeded', {
          endpointTag: opts.endpointTag,
          identityKind: identity.kind,
          current: next1,
          limit,
        });
        return res.status(429).json({
          error: 'AI_DAILY_BUDGET_EXCEEDED',
          endpointTag: opts.endpointTag,
          limit,
          retryAfter: Math.ceil(Date.now() / 1000) + 6 * 60 * 60, // ~6h nominal
        });
      }

      const handle: AiUserBudgetHandle = {
        budgetKey,
        identityKind: identity.kind,
        chargeTokens: async (units: number) => {
          const u = Math.max(0, Math.floor(units));
          if (u <= 0) return;
          try {
            // Model outputs are typically 100s-1000s of tokens; scale them
            // down so a small chat turn does not spend a whole day's
            // budget of 60 requests. 500 tokens = 1 request equivalent.
            const equivalents = Math.max(1, Math.ceil(u / 500));
            for (let i = 0; i < equivalents; i++) {
              await redis.incr(budgetKey);
            }
          } catch (err) {
            logger.warn('[aiUserBudget] chargeTokens failed', { err, budgetKey });
          }
        },
      };
      (req as any).aiBudget = handle;
      return next();
    } catch (err) {
      logger.error('[aiUserBudget] Redis error', { err, endpointTag: opts.endpointTag });
      if (failClosed && process.env.NODE_ENV === 'production') {
        return res.status(503).json({
          error: 'AI_BUDGET_UNAVAILABLE',
          endpointTag: opts.endpointTag,
        });
      }
      return next();
    }
  };
}

/**
 * Convenience preset — the CEO-approved default caps.
 *
 * Rationale for the numbers:
 *   • Authenticated 200/day covers a heavy PetWash member (booking flow
 *     + calculator + concierge) with 20x headroom; anyone above that
 *     is a scripted account and deserves to be told to slow down.
 *   • Anonymous 30/day is enough for a curious guest to converse with
 *     the public Kenzo/AI chat without hitting the wall in normal use,
 *     but low enough that a botnet cannot exhaust ₪ before an operator
 *     notices.
 *   • Change either number here rather than in-line at each callsite
 *     so cap changes are one edit, one code review, one deploy.
 */
export const AI_BUDGET_DEFAULT_AUTH = 200;
export const AI_BUDGET_DEFAULT_ANON = 30;
