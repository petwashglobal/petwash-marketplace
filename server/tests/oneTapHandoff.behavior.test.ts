/**
 * one-tap handoff — behavioural invariants (#216 / AUDIT-LOG-13).
 *
 * BEHAVIOURAL, not source-pin — this test drives the real
 * createHandoff / consumeHandoff runtime with a mocked Redis backend,
 * so the actual round-trip contract is exercised end-to-end rather
 * than inferred from a grep. Paired with the existing source-scan
 * pins in oneTapCustomTokenExposure.regression.test.ts and
 * bearerTokenInHtmlOrUrl.regression.test.ts (which prove the token
 * never leaks into HTML/URLs).
 *
 * Contract locked in here:
 *
 *   1. Round-trip: createHandoff returns a code; consumeHandoff with
 *      that code returns the exact envelope stored.
 *
 *   2. One-shot: a second consume of the same code returns null.
 *      (GETDEL semantic — the read and delete are atomic.)
 *
 *   3. Unknown code: null (never leaks the difference from consumed).
 *
 *   4. Short/malformed code: null without touching Redis.
 *
 *   5. Corrupted envelope in Redis (missing customToken / uid): null.
 *
 *   6. Redis outage: consumeHandoff returns null (same generic answer
 *      as unknown/consumed — an attacker cannot distinguish).
 *
 *   7. Redis outage on write: createHandoff throws so an admin
 *      generating a link is not handed out a code that will never
 *      exchange.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory Redis stand-in — keyed by string, value is the raw JSON blob
// that consumeHandoff will JSON.parse. Behaviour mirrors the real service.
type Row = { value: string; expiresAt: number };
const store = new Map<string, Row>();
let simulateOutage = false;

function now(): number { return Date.now(); }

vi.mock('../services/redis', () => ({
  redis: {
    async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
      if (simulateOutage) return false;
      const serialized = JSON.stringify(value);
      const expiresAt = ttlSeconds ? now() + ttlSeconds * 1000 : Number.MAX_SAFE_INTEGER;
      store.set(key, { value: serialized, expiresAt });
      return true;
    },
    async getDel(key: string): Promise<string | null> {
      if (simulateOutage) return null;
      const row = store.get(key);
      if (!row) return null;
      store.delete(key);
      if (row.expiresAt <= now()) return null;
      return row.value;
    },
    // Everything else is unused by oneTapHandoff, but stub to shape.
    async get() { return null; },
    async setNx() { return true; },
    async del() { return true; },
    async getRaw() { return null; },
    async setRaw() { return true; },
    async incr() { return 0; },
    async expire() { return true; },
    async ttl() { return -2; },
    async invalidatePattern() { return true; },
    isConnected() { return !simulateOutage; },
    getStatus() { return { enabled: !simulateOutage, connected: !simulateOutage }; },
    async disconnect() { /* noop */ },
  },
}));

import {
  createHandoff,
  consumeHandoff,
  DEFAULT_HANDOFF_TTL_SEC,
} from '../security/oneTapHandoff';

beforeEach(() => {
  store.clear();
  simulateOutage = false;
});

describe('#216 one-tap handoff — round-trip', () => {
  it('mints a 32-byte hex code and stores an envelope keyed by it', async () => {
    const code = await createHandoff({
      customToken: 'ctok_test_abc123',
      uid: 'uid_test_user_1',
    });
    // 32 random bytes → 64 hex chars.
    expect(code).toMatch(/^[0-9a-f]{64}$/);
    // Store should carry exactly one entry under the prefix + code.
    const keys = Array.from(store.keys());
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe(`one-tap-handoff:${code}`);
  });

  it('consumeHandoff returns the same envelope that was minted', async () => {
    const code = await createHandoff({
      customToken: 'ctok_roundtrip_XYZ',
      uid: 'uid_roundtrip_9',
    });
    const env = await consumeHandoff(code);
    expect(env).not.toBeNull();
    expect(env?.customToken).toBe('ctok_roundtrip_XYZ');
    expect(env?.uid).toBe('uid_roundtrip_9');
    // issuedAt is ISO-8601, parseable back to a real Date within the last minute.
    expect(env?.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    const age = Date.now() - new Date(env!.issuedAt).getTime();
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(5_000);
  });
});

describe('#216 one-tap handoff — one-shot semantic', () => {
  it('a second consume of the same code returns null (GETDEL atomic)', async () => {
    const code = await createHandoff({
      customToken: 'ctok_oneshot',
      uid: 'uid_oneshot',
    });
    const first = await consumeHandoff(code);
    expect(first?.customToken).toBe('ctok_oneshot');
    const second = await consumeHandoff(code);
    expect(second).toBeNull();
  });

  it('unknown code returns null — never leaks the difference from consumed', async () => {
    const code = await createHandoff({
      customToken: 'ctok_a',
      uid: 'uid_a',
    });
    // Try a fresh, never-seen code of the correct shape.
    const fake = 'f'.repeat(64);
    const r = await consumeHandoff(fake);
    expect(r).toBeNull();
    // The real one still works — the fake read did NOT clear it.
    const good = await consumeHandoff(code);
    expect(good?.customToken).toBe('ctok_a');
  });
});

describe('#216 one-tap handoff — defensive input validation', () => {
  it('rejects empty / non-string / short codes without touching Redis', async () => {
    // Seed something so we can prove the store is untouched even on rejection.
    await createHandoff({ customToken: 'ctok_guard', uid: 'uid_guard' });
    const before = Array.from(store.keys());

    expect(await consumeHandoff('')).toBeNull();
    expect(await consumeHandoff(undefined as unknown as string)).toBeNull();
    expect(await consumeHandoff('abc')).toBeNull();
    // 31 hex chars — one short of the 32-byte requirement.
    expect(await consumeHandoff('0'.repeat(31))).toBeNull();

    const after = Array.from(store.keys());
    expect(after).toEqual(before);
  });

  it('corrupted envelope (missing customToken) → null even when Redis returns a row', async () => {
    // Manually plant a broken value under a well-shaped key.
    const bogusCode = '0'.repeat(64);
    store.set(`one-tap-handoff:${bogusCode}`, {
      value: JSON.stringify({ uid: 'x', issuedAt: new Date().toISOString() }),
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
    const r = await consumeHandoff(bogusCode);
    expect(r).toBeNull();
  });

  it('non-JSON envelope in Redis → null without throwing', async () => {
    const junkCode = '1'.repeat(64);
    store.set(`one-tap-handoff:${junkCode}`, {
      value: 'not-json-at-all',
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
    const r = await consumeHandoff(junkCode);
    expect(r).toBeNull();
  });
});

describe('#216 one-tap handoff — Redis-outage failure semantics', () => {
  it('createHandoff THROWS when the Redis write fails — never hands out a dead code', async () => {
    simulateOutage = true;
    await expect(
      createHandoff({ customToken: 'ctok_out', uid: 'uid_out' }),
    ).rejects.toThrow(/unavailable/i);
  });

  it('consumeHandoff returns null on Redis outage (same as unknown/consumed)', async () => {
    // Mint before outage, then flip the outage flag so consume sees a dead Redis.
    const code = await createHandoff({
      customToken: 'ctok_will_be_lost',
      uid: 'uid_will_be_lost',
    });
    simulateOutage = true;
    const r = await consumeHandoff(code);
    expect(r).toBeNull();
    // Attacker cannot distinguish outage from consumed — this contract
    // is enforced by returning the same null in every negative case above.
  });
});

describe('#216 one-tap handoff — TTL contract (default 60s)', () => {
  it('exported DEFAULT_HANDOFF_TTL_SEC is short enough to make a leaked code worthless quickly', () => {
    expect(DEFAULT_HANDOFF_TTL_SEC).toBeLessThanOrEqual(120);
    expect(DEFAULT_HANDOFF_TTL_SEC).toBeGreaterThanOrEqual(30);
  });
});
