/**
 * ONE PROOF, ONE USE — the property the step-up side already had and the
 * authentication side did not.
 *
 * The email proof was minted once per matched code (the OTP challenge is
 * consumed on verify), but the TOKEN was a bearer credential that validated as
 * many times as it was presented, for its whole 5-minute TTL. A leaked or
 * intercepted proof minted more than one session inside that window.
 *
 * The phone proof had a guard, but the guard's STORE was a per-process `Map`.
 * On Cloud Run that is not an answer at all: the replay lands on the other
 * instance, which has never heard of the nonce, and mints a second session.
 *
 * These pin both, through the one shared store, and pin the two properties
 * that are easy to get wrong: the RACE (not just the sequential case), and
 * fail-CLOSED when the store cannot be reached.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Fake store ──────────────────────────────────────────────────────────────
// Models Redis honestly, which is what makes the race test mean something:
//
//   * setNx YIELDS to the event loop before touching the map, so two callers
//     genuinely interleave rather than running to completion one at a time.
//   * the check-and-write after the yield is a single synchronous step, which
//     is what `SET key val NX EX ttl` gives you.
//
// A `get`-then-`set` implementation in the code under test would interleave
// across that yield and let BOTH callers through — so the race test fails if
// anyone ever replaces the atomic command with a read-modify-write.
const store = new Map<string, { value: string; ttl: number }>();
let storeUp = true;
let setNxCalls: Array<{ key: string; ttl: number }> = [];
// Every NON-atomic op the code could reach for instead. These work correctly —
// the point is not that they break, it is that using them reopens the race
// even though each individual call is fine.
let nonAtomicCalls = 0;

const yieldToLoop = () => new Promise((r) => setImmediate(r));

vi.mock('../services/redis', () => ({
  redis: {
    isConnected: () => storeUp,
    async setNx(key: string, value: unknown, ttlSeconds: number) {
      await yieldToLoop(); // real interleaving point
      if (!storeUp) return false;
      setNxCalls.push({ key, ttl: ttlSeconds });
      if (store.has(key)) return false;
      store.set(key, { value: String(value), ttl: ttlSeconds });
      return true;
    },
    async getRaw(key: string) {
      await yieldToLoop();
      nonAtomicCalls++;
      return storeUp ? (store.get(key)?.value ?? null) : null;
    },
    async setRaw(key: string, value: string, ttlSeconds: number) {
      await yieldToLoop();
      nonAtomicCalls++;
      if (!storeUp) return false;
      setNxCalls.push({ key, ttl: ttlSeconds });
      store.set(key, { value, ttl: ttlSeconds });
      return true;
    },
    get: async (key: string) => { nonAtomicCalls++; return store.get(key)?.value ?? null; },
    set: async (key: string, value: unknown, ttlSeconds: number) => {
      nonAtomicCalls++; store.set(key, { value: String(value), ttl: ttlSeconds }); return true;
    },
  },
}));

process.env.COOKIE_SECRET = 'test-cookie-secret-oneshot-0123456789abcdef';
process.env.JWT_SECRET = 'test-jwt-secret-oneshot-0123456789abcdef';

const { mintEmailVerifiedToken, validateEmailVerifiedToken, redeemEmailVerifiedToken } =
  await import('../lib/emailVerifiedToken');
const { consumeOneShotProof } = await import('../lib/oneShotProof');
// Hoisted: TwilioSMSService pulls in the twilio SDK and the abuse detector, and
// paying that import cost inside a test blows the default 5s timeout.
const { twilioSMSService } = await import('../services/TwilioSMSService');
const { issueStepUpProof, decodeStepUpProof, consumeStepUpProof } = await (async () => {
  process.env.STEP_UP_HMAC_SECRET = 'b'.repeat(48);
  return import('../services/StepUpService');
})();

const TOKEN_TTL_SECONDS = 5 * 60;

beforeEach(() => {
  store.clear();
  setNxCalls = [];
  nonAtomicCalls = 0;
  storeUp = true;
});

describe('email proof — single use', () => {
  it('the FIRST redemption succeeds', async () => {
    const token = mintEmailVerifiedToken('user@example.com', 'login');
    const r = await redeemEmailVerifiedToken(token, ['login']);
    expect(r.valid).toBe(true);
    expect(r.email).toBe('user@example.com');
  });

  it('the SECOND redemption of the same token is refused', async () => {
    const token = mintEmailVerifiedToken('user@example.com', 'login');
    expect((await redeemEmailVerifiedToken(token, ['login'])).valid).toBe(true);

    const replay = await redeemEmailVerifiedToken(token, ['login']);
    expect(replay.valid).toBe(false);
    // The whole point: a replay must not masquerade as a timeout.
    expect(replay.reason).toBe('already_used');
    expect(replay.email).toBeUndefined();
  });

  /**
   * THE RACE. Two requests arrive with the same intercepted token at the same
   * moment. Sequential single-use is easy; this is the case that actually
   * mints two sessions if the burn is not atomic.
   */
  it('two CONCURRENT redemptions: exactly one wins', async () => {
    const token = mintEmailVerifiedToken('racer@example.com', 'login');

    const [a, b] = await Promise.all([
      redeemEmailVerifiedToken(token, ['login']),
      redeemEmailVerifiedToken(token, ['login']),
    ]);

    const winners = [a, b].filter((r) => r.valid);
    const losers = [a, b].filter((r) => !r.valid);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].reason).toBe('already_used');
  });

  it('ten concurrent redemptions still yield exactly one winner', async () => {
    const token = mintEmailVerifiedToken('crowd@example.com', 'signup');
    const results = await Promise.all(
      Array.from({ length: 10 }, () => redeemEmailVerifiedToken(token, ['signup'])),
    );
    expect(results.filter((r) => r.valid)).toHaveLength(1);
    expect(results.filter((r) => r.reason === 'already_used')).toHaveLength(9);
  });

  it('burns through ONE atomic command — never read-then-write', async () => {
    const token = mintEmailVerifiedToken('atomic@example.com', 'login');
    await redeemEmailVerifiedToken(token, ['login']);
    expect(setNxCalls).toHaveLength(1);
    // A get/set pair reads correctly in isolation and still reopens the race
    // the SETNX exists to close, so the shape is pinned, not just the outcome.
    expect(nonAtomicCalls).toBe(0);
  });

  it('two DIFFERENT tokens for the same address both redeem', async () => {
    // The nonce is what is burnt, not the address — a fresh code must work
    // even when an earlier proof for the same person was just spent.
    const a = mintEmailVerifiedToken('user@example.com', 'login');
    const b = mintEmailVerifiedToken('user@example.com', 'login');
    expect((await redeemEmailVerifiedToken(a, ['login'])).valid).toBe(true);
    expect((await redeemEmailVerifiedToken(b, ['login'])).valid).toBe(true);
  });
});

describe('email proof — consumption happens at USE, not at inspection', () => {
  it('validateEmailVerifiedToken never spends the proof', async () => {
    const token = mintEmailVerifiedToken('user@example.com', 'login');

    // Inspect as often as you like...
    expect(validateEmailVerifiedToken(token, ['login']).valid).toBe(true);
    expect(validateEmailVerifiedToken(token, ['login']).valid).toBe(true);
    expect(setNxCalls).toHaveLength(0);

    // ...the proof is still spendable exactly once afterwards.
    expect((await redeemEmailVerifiedToken(token, ['login'])).valid).toBe(true);
    expect((await redeemEmailVerifiedToken(token, ['login'])).reason).toBe('already_used');
  });

  it('a proof refused BEFORE the burn is not spent by the attempt', async () => {
    // Wrong purpose never reaches the store, so the customer's real proof is
    // still usable at the consumer it was actually minted for.
    const token = mintEmailVerifiedToken('user@example.com', 'signup');
    expect((await redeemEmailVerifiedToken(token, ['login'])).reason).toBe('purpose_mismatch');
    expect(setNxCalls).toHaveLength(0);
    expect((await redeemEmailVerifiedToken(token, ['signup'])).valid).toBe(true);
  });
});

describe('email proof — fail CLOSED', () => {
  it('refuses when the one-shot store is unreachable', async () => {
    const token = mintEmailVerifiedToken('user@example.com', 'login');
    storeUp = false;

    const r = await redeemEmailVerifiedToken(token, ['login']);
    expect(r.valid).toBe(false);
    // NOT waved through, and NOT blamed on the customer's code.
    expect(r.reason).toBe('store_unavailable');
    expect(r.email).toBeUndefined();
  });

  it('an outage does not silently become a replay verdict', async () => {
    // Distinguishable reasons are the whole ask: support has to be able to
    // tell "someone replayed this" from "our store was down".
    const token = mintEmailVerifiedToken('user@example.com', 'login');
    storeUp = false;
    const outage = await redeemEmailVerifiedToken(token, ['login']);

    storeUp = true;
    const first = await redeemEmailVerifiedToken(token, ['login']);
    const replay = await redeemEmailVerifiedToken(token, ['login']);

    expect(outage.reason).toBe('store_unavailable');
    expect(first.valid).toBe(true); // the outage did not spend it
    expect(replay.reason).toBe('already_used');
    expect(outage.reason).not.toBe(replay.reason);
  });
});

describe('email proof — reason codes stay distinct', () => {
  it('already_used is not expired and not bad_signature', async () => {
    const crypto = await import('node:crypto');

    const live = mintEmailVerifiedToken('user@example.com', 'login');
    await redeemEmailVerifiedToken(live, ['login']);
    const spent = await redeemEmailVerifiedToken(live, ['login']);

    const nonce = 'abcd1234';
    const issuedAt = Date.now() - 6 * 60 * 1000;
    const payload = `old@example.com:login:${nonce}:${issuedAt}`;
    const hmac = crypto.createHmac('sha256', process.env.COOKIE_SECRET!).update(payload).digest('hex');
    const old = Buffer.from(`${payload}:${hmac}`, 'utf8').toString('base64url');
    const timedOut = await redeemEmailVerifiedToken(old, ['login']);

    const forged = Buffer.from(
      `attacker@evil.com:login:deadbeef:${Date.now()}:${'f'.repeat(64)}`,
      'utf8',
    ).toString('base64url');
    const tampered = await redeemEmailVerifiedToken(forged, ['login']);

    expect(spent.reason).toBe('already_used');
    expect(timedOut.reason).toBe('expired');
    expect(tampered.reason).toBe('bad_signature');
    expect(new Set([spent.reason, timedOut.reason, tampered.reason]).size).toBe(3);
  });

  it('an expired proof is not sent to the store at all', async () => {
    const crypto = await import('node:crypto');
    const issuedAt = Date.now() - 6 * 60 * 1000;
    const payload = `old@example.com:login:abcd1234:${issuedAt}`;
    const hmac = crypto.createHmac('sha256', process.env.COOKIE_SECRET!).update(payload).digest('hex');
    const old = Buffer.from(`${payload}:${hmac}`, 'utf8').toString('base64url');

    await redeemEmailVerifiedToken(old, ['login']);
    expect(setNxCalls).toHaveLength(0);
  });
});

describe('the spent marker outlives the proof it guards', () => {
  /**
   * If the marker expires before the token does, the nonce becomes replayable
   * in the gap — the guard would quietly stop guarding near the end of the
   * window. It must cover the proof's remaining life plus slack for clock skew
   * between instances, since "remaining life" is computed on whichever
   * instance is asking.
   */
  it('marker TTL >= the proof TTL', async () => {
    const token = mintEmailVerifiedToken('user@example.com', 'login');
    await redeemEmailVerifiedToken(token, ['login']);
    expect(setNxCalls).toHaveLength(1);
    expect(setNxCalls[0].ttl).toBeGreaterThanOrEqual(TOKEN_TTL_SECONDS);
  });

  it('the key is namespaced and carries no address', async () => {
    const token = mintEmailVerifiedToken('someone@example.com', 'login');
    await redeemEmailVerifiedToken(token, ['login']);
    expect(setNxCalls[0].key).toMatch(/^oneshot:emailproof:/);
    // A Redis key is the wrong home for PII.
    expect(setNxCalls[0].key).not.toContain('someone@example.com');
  });
});

describe('shared primitive — one implementation for every proof family', () => {
  it('separate scopes do not collide on the same id', async () => {
    const id = 'shared-nonce-value';
    expect((await consumeOneShotProof({ scope: 'emailproof', id, ttlSeconds: 300 })).ok).toBe(true);
    expect((await consumeOneShotProof({ scope: 'smsproof', id, ttlSeconds: 300 })).ok).toBe(true);
    expect((await consumeOneShotProof({ scope: 'stepup', id, ttlSeconds: 300 })).ok).toBe(true);
    // ...and each is one-shot within its own scope.
    const again = await consumeOneShotProof({ scope: 'emailproof', id, ttlSeconds: 300 });
    expect(again.ok).toBe(false);
    expect(again.ok === false && again.reason).toBe('already_used');
  });

  it('refuses a proof with no id — "cannot check" is not "fine"', async () => {
    const r = await consumeOneShotProof({ scope: 'emailproof', id: '', ttlSeconds: 300 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe('no_id');
  });

  it('refuses an already-expired lifetime without touching the store', async () => {
    const r = await consumeOneShotProof({ scope: 'emailproof', id: 'x', ttlSeconds: 0 });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe('expired');
    expect(setNxCalls).toHaveLength(0);
  });

  it('StepUpService burns through the SAME store (no second dialect)', async () => {
    const binding = { operation: 'payout.execute', targetId: 'po_1', amountMinor: 100 };
    const issued = issueStepUpProof('uid_x', 'payout_action', 300, binding)!;
    const proof = decodeStepUpProof('uid_x', 'payout_action', issued.token, binding)!;

    expect(await consumeStepUpProof(proof)).toBe(true);
    expect(await consumeStepUpProof(proof)).toBe(false); // replay, unchanged contract
    expect(setNxCalls.some((c) => c.key.startsWith('oneshot:stepup:'))).toBe(true);
  });
});

describe('phone proof — the same replay property, the same fix', () => {
  /**
   * The sms-verified JWT already had a single-use guard at the two
   * session-minting routes. It was backed by a per-process Map, so it did not
   * hold across Cloud Run instances: the guard read as closed while the actual
   * deployment left it open.
   */
  it('a phone nonce burns once, and the replay is refused', async () => {
    const nonce = 'phone-nonce-1';
    expect((await twilioSMSService.consumeVerificationNonce(nonce)).ok).toBe(true);
    const replay = await twilioSMSService.consumeVerificationNonce(nonce);
    expect(replay.ok).toBe(false);
    expect(replay.ok === false && replay.reason).toBe('already_used');
  });

  it('two CONCURRENT phone redemptions: exactly one wins', async () => {
    const nonce = 'phone-nonce-race';
    const results = await Promise.all([
      twilioSMSService.consumeVerificationNonce(nonce),
      twilioSMSService.consumeVerificationNonce(nonce),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('the phone burn is SHARED, not per-process (the actual bug)', async () => {
    await twilioSMSService.consumeVerificationNonce('phone-nonce-shared');
    // Recorded in the store every instance reads, not in module-local state.
    expect(store.has('oneshot:smsproof:phone-nonce-shared')).toBe(true);
  });

  it('a nonce-less token is refused, not waved through', async () => {
    const r = await twilioSMSService.consumeVerificationNonce('');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe('no_id');
  });

  it('fails CLOSED when the store is unreachable', async () => {
    storeUp = false;
    const r = await twilioSMSService.consumeVerificationNonce('phone-nonce-outage');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe('store_unavailable');
  });
});

describe('source pin — every consumer REDEEMS, none merely validates', () => {
  /**
   * `validateEmailVerifiedToken` is the burn-free inspector. It has to stay
   * exported (it is the honest "is this genuine?" question, and the
   * purpose-binding suite exercises it directly), which means it is one
   * autocomplete away from being called at a point of USE — where it would
   * silently restore exactly the replay this PR closes, with no test failing.
   *
   * So pin the route file: a proof-bearing auth route must redeem.
   */
  it('publicAuthRoutes never calls the non-burning validator', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../routes/publicAuthRoutes.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/validateEmailVerifiedToken\s*\(/);
    // Both consumers — verify-signup-email and email-session — redeem.
    expect(src.match(/await\s+redeemEmailVerifiedToken\s*\(/g) || []).toHaveLength(2);
  });

  it('both phone consumers burn the nonce, and await the burn', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../routes/publicAuthRoutes.ts', import.meta.url), 'utf8');
    const calls = src.match(/consumeVerificationNonce\s*\(/g) || [];
    const awaited = src.match(/await\s+twilioSMSService\.consumeVerificationNonce\s*\(/g) || [];
    expect(calls).toHaveLength(2);
    expect(awaited).toHaveLength(calls.length); // a missing await is a silent bypass
  });
});
