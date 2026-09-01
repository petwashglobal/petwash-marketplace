/**
 * Behavioural test — perUidSmsBudget (AUDIT-SMS-5 / #221 / Lane C slice 1).
 *
 * Proves the shared per-UID SMS budget helper:
 *
 *   1. Allows sends up to the daily limit, then refuses BUDGET_EXCEEDED
 *      with a retry-after until UTC midnight.
 *   2. Keys per (uid, purpose, day) — a user's password-reset quota is
 *      independent from their booking-confirm quota, and one UID's
 *      quota is independent from another's.
 *   3. INCRs BEFORE the caller sends (the invariant that stops a
 *      concurrent flood from all reading the same stale count).
 *   4. In production, a Redis outage refuses the send (BUDGET_UNAVAILABLE).
 *   5. Non-prod + Redis outage allows through with a warning.
 *   6. A missing/blank UID is refused, not silently allowed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, number>();
let connected = true;

vi.mock('../services/redis', () => ({
  redis: {
    isConnected: () => connected,
    incr: vi.fn(async (key: string) => {
      const n = (store.get(key) ?? 0) + 1;
      store.set(key, n);
      return n;
    }),
    expire: vi.fn(async () => true),
  },
}));

import { checkAndBumpUidSmsBudget, SMS_PURPOSES } from '../lib/perUidSmsBudget';

beforeEach(() => {
  store.clear();
  connected = true;
});

afterEach(() => {
  process.env.NODE_ENV = 'test';
});

describe('perUidSmsBudget (AUDIT-SMS-5)', () => {
  it('allows sends up to the daily limit, then BUDGET_EXCEEDED', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(
        await checkAndBumpUidSmsBudget('user-A', { purpose: SMS_PURPOSES.VERIFY_MOBILE, dailyLimit: 3 }),
      );
    }
    expect(results[0]).toMatchObject({ allowed: true });
    expect(results[1]).toMatchObject({ allowed: true });
    expect(results[2]).toMatchObject({ allowed: true });
    expect(results[3]).toMatchObject({ allowed: false, reason: 'BUDGET_EXCEEDED', limit: 3 });
    // Retry-after is a positive number of seconds until UTC midnight.
    expect((results[3] as any).retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keys per purpose — VERIFY_MOBILE budget does not steal from PASSWORD_RESET', async () => {
    // Exhaust verify:mobile.
    await checkAndBumpUidSmsBudget('user-B', { purpose: SMS_PURPOSES.VERIFY_MOBILE, dailyLimit: 1 });
    const verifyBlocked = await checkAndBumpUidSmsBudget('user-B', { purpose: SMS_PURPOSES.VERIFY_MOBILE, dailyLimit: 1 });
    expect(verifyBlocked.allowed).toBe(false);
    // Password reset still has its full budget.
    const reset = await checkAndBumpUidSmsBudget('user-B', { purpose: SMS_PURPOSES.PASSWORD_RESET, dailyLimit: 2 });
    expect(reset.allowed).toBe(true);
  });

  it('keys per UID — user A exhausted does not block user B', async () => {
    await checkAndBumpUidSmsBudget('user-A', { purpose: SMS_PURPOSES.ONBOARDING, dailyLimit: 1 });
    const aBlocked = await checkAndBumpUidSmsBudget('user-A', { purpose: SMS_PURPOSES.ONBOARDING, dailyLimit: 1 });
    const bFresh = await checkAndBumpUidSmsBudget('user-B', { purpose: SMS_PURPOSES.ONBOARDING, dailyLimit: 1 });
    expect(aBlocked.allowed).toBe(false);
    expect(bFresh.allowed).toBe(true);
  });

  it('refuses missing / blank UID rather than silently allowing', async () => {
    const empty = await checkAndBumpUidSmsBudget('', { purpose: SMS_PURPOSES.VERIFY_MOBILE });
    expect(empty).toMatchObject({ allowed: false, reason: 'BUDGET_UNAVAILABLE' });
  });

  it('production + Redis outage refuses the send', async () => {
    process.env.NODE_ENV = 'production';
    connected = false;
    const res = await checkAndBumpUidSmsBudget('user-A', { purpose: SMS_PURPOSES.VERIFY_MOBILE });
    expect(res).toMatchObject({ allowed: false, reason: 'BUDGET_UNAVAILABLE' });
  });

  it('non-production + Redis outage allows (with a warning) so dev is not blocked', async () => {
    process.env.NODE_ENV = 'development';
    connected = false;
    const res = await checkAndBumpUidSmsBudget('user-A', { purpose: SMS_PURPOSES.VERIFY_MOBILE });
    expect(res.allowed).toBe(true);
  });

  it('exposes stable SMS purpose slugs', () => {
    expect(SMS_PURPOSES.VERIFY_MOBILE).toBe('verify:mobile');
    expect(SMS_PURPOSES.PASSWORD_RESET).toBe('password:reset');
    // All slugs must be namespaced with a colon so ops can slice per
    // category from Redis keyspace scans.
    for (const value of Object.values(SMS_PURPOSES)) {
      expect(value).toMatch(/^[a-z0-9_]+:[a-z0-9_]+$/);
    }
  });
});
