/**
 * perUidSmsBudget — per-Firebase-UID daily SMS cap, Redis-backed.
 *
 * AUDIT-SMS-5 (#221, CEO Lane C). Existing SMS protection covers:
 *
 *   • per-PHONE daily cap + 60s cooldown (server/services/TwilioSMSService)
 *   • per-IP throttling on the SMS-triggering routes (rate limiters)
 *   • global hourly/daily kill switch (server/services/SmsAbuseDetector)
 *
 * What was missing per the audit: a per-USER cap. Nothing prevented one
 * authenticated user from firing dozens of OTP resends across a rotation
 * of phone numbers, or a compromised account from burning through the
 * global daily budget from a single logged-in seat.
 *
 * This module is the shared cap the audit demanded. Every SMS-triggering
 * surface should call `checkAndBumpUidSmsBudget` BEFORE the send. The
 * helper:
 *
 *   • keys on (uid, purpose, day) — a legit password-reset user is
 *     not penalised for having also received a normal-flow OTP.
 *   • fails CLOSED in production if Redis is unreachable — the audit's
 *     invariant "missing infra → refuse, never silently spend money"
 *     applies to SMS the same way it applies to Turnstile.
 *   • returns a rich decision so the caller can surface the retry-after
 *     to the user, not just a bare boolean.
 *
 * Purposes are open strings so a new SMS-sending flow can plug in
 * without touching this file. The convention is
 *   `verify:mobile`, `verify:2fa`, `password:reset`, `booking:remind`, ...
 * — namespaced by category so ops can slice per-flow abuse from the
 * Redis key space directly.
 */
import { redis } from '../services/redis';
import { logger } from './logger';

export interface UidSmsBudgetOptions {
  /**
   * The SMS purpose bucket — e.g. 'verify:mobile', 'password:reset',
   * '2fa:enable'. Chosen by the caller; convention above.
   */
  purpose: string;
  /** Max sends per UID per day for this purpose. Default 10. */
  dailyLimit?: number;
  /**
   * Fail behaviour when Redis is unavailable. Default true (production
   * refuses to send SMS without the budget guard).
   */
  failClosedOnOutage?: boolean;
}

export type UidSmsBudgetDecision =
  | { allowed: true; remaining: number; key: string }
  | {
      allowed: false;
      reason: 'BUDGET_EXCEEDED' | 'BUDGET_UNAVAILABLE';
      key: string;
      limit: number;
      retryAfterSeconds: number;
    };

const DEFAULT_DAILY_LIMIT = 10;
const TTL_SECONDS = 60 * 60 * 26; // ~26h — survives a UTC-day boundary

function todayUtcYyyyMmDd(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Check the UID's remaining budget for `purpose` and — if allowed —
 * atomically INCR the counter (so a concurrent second call sees the
 * updated value). The caller MUST invoke this BEFORE any SMS-provider
 * call. Do not INCR after the send — that leaves a window in which a
 * flood of concurrent sends passes the pre-check on the same stale
 * count.
 */
export async function checkAndBumpUidSmsBudget(
  uid: string,
  opts: UidSmsBudgetOptions,
): Promise<UidSmsBudgetDecision> {
  const limit = opts.dailyLimit ?? DEFAULT_DAILY_LIMIT;
  const failClosed = opts.failClosedOnOutage !== false;
  const day = todayUtcYyyyMmDd();
  const key = `sms_uid:${opts.purpose}:${day}:${uid}`;

  if (!uid) {
    // Callers must resolve the UID before invoking. A missing UID means
    // the SMS-triggering path is anonymous (which is a separate audit
    // finding) — refuse rather than paper over.
    return {
      allowed: false,
      reason: 'BUDGET_UNAVAILABLE',
      key,
      limit,
      retryAfterSeconds: 0,
    };
  }

  if (!redis.isConnected()) {
    if (failClosed && process.env.NODE_ENV === 'production') {
      logger.error('[perUidSmsBudget] Redis unavailable in production — refusing SMS', {
        purpose: opts.purpose,
      });
      return {
        allowed: false,
        reason: 'BUDGET_UNAVAILABLE',
        key,
        limit,
        retryAfterSeconds: 60,
      };
    }
    logger.warn('[perUidSmsBudget] Redis not connected — allowing (non-prod)', {
      purpose: opts.purpose,
    });
    return { allowed: true, remaining: limit - 1, key };
  }

  try {
    const next1 = await redis.incr(key);
    if (next1 === 1) {
      await redis.expire(key, TTL_SECONDS);
    }
    if (next1 > limit) {
      logger.warn('[perUidSmsBudget] UID SMS budget exceeded', {
        purpose: opts.purpose,
        uid,
        current: next1,
        limit,
      });
      // Retry-after until UTC day rollover.
      const now = new Date();
      const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const retryAfterSeconds = Math.max(60, Math.ceil((utcMidnight.getTime() - now.getTime()) / 1000));
      return {
        allowed: false,
        reason: 'BUDGET_EXCEEDED',
        key,
        limit,
        retryAfterSeconds,
      };
    }
    return { allowed: true, remaining: Math.max(0, limit - next1), key };
  } catch (err) {
    logger.error('[perUidSmsBudget] Redis error', { err, purpose: opts.purpose });
    if (failClosed && process.env.NODE_ENV === 'production') {
      return {
        allowed: false,
        reason: 'BUDGET_UNAVAILABLE',
        key,
        limit,
        retryAfterSeconds: 60,
      };
    }
    return { allowed: true, remaining: -1, key };
  }
}

/**
 * Purpose-namespace conventions. Adding a new SMS-sending flow means
 * picking a slug from here or extending it. Ops slice per-flow abuse
 * from the Redis key space using the resulting `sms_uid:${purpose}:*`
 * pattern.
 */
export const SMS_PURPOSES = {
  VERIFY_MOBILE: 'verify:mobile',
  VERIFY_MFA: 'verify:2fa',
  PASSWORD_RESET: 'password:reset',
  BOOKING_REMINDER: 'booking:remind',
  BOOKING_CONFIRM: 'booking:confirm',
  ESIGN: 'esign:otp',
  PROVIDER_PHONE: 'provider:phone',
  SITTER_SUITE: 'sitter:suite',
  TWO_FACTOR: '2fa:enable',
  ONBOARDING: 'onboarding:verify',
} as const;

export type SmsPurpose = (typeof SMS_PURPOSES)[keyof typeof SMS_PURPOSES];
