/**
 * Regression pin — Turnstile cross-pod replay guard (AUDIT-SMS-10 / #223b).
 *
 * Cloudflare Turnstile invalidates a token on the first successful
 * verification at its end, but that invalidation is asynchronous with
 * respect to concurrent verify calls. Two requests carrying the SAME
 * token can hit two different Cloud Run pods within the same
 * millisecond, each fire a verify to Cloudflare BEFORE the invalidation
 * propagates, and BOTH pass. That is a per-instance state problem —
 * neither pod knows the other has already claimed the token.
 *
 * Fix: server/lib/verifyTurnstile.ts SETNX's a short-TTL Redis key
 * hashed from the token BEFORE it calls Cloudflare. The first pod
 * wins; any subsequent verify sees the key and rejects as `replayed`.
 * On a Cloudflare HTTP error / negative verdict / thrown exception
 * the key is released so a real user retrying doesn't get locked out.
 * Successful verifies do not release: the token IS consumed.
 *
 * Redis-outage semantics: `redis.setNx` returns false when Redis is
 * unreachable, and `redis.isConnected()` also returns false; the code
 * treats that combination as "no replay guard available, fall through
 * to Cloudflare-only verification" — the same behaviour as before this
 * guard existed. That means outage doesn't open the barn door AND
 * doesn't lock legit users out.
 *
 * This pin walks the source and refuses any regression that drops the
 * SETNX or the release-on-failure branches.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const src = readFileSync(join(ROOT, 'server/lib/verifyTurnstile.ts'), 'utf8');

describe('AUDIT-SMS-10 / #223b — Turnstile cross-pod replay guard', () => {
  it('imports the shared redis service', () => {
    expect(src).toMatch(/import\s*\{\s*redis\s*\}\s*from\s*['"]\.\.\/services\/redis['"]/);
  });

  it('hashes the token before using it as a Redis key (never puts the raw token in Redis)', () => {
    expect(src).toMatch(/createHash\(['"]sha256['"]\)\.update\(token\)/);
    expect(src).toMatch(/const REPLAY_KEY_PREFIX\s*=\s*['"]turnstile-replay:['"]/);
  });

  it('the guard uses SETNX (atomic one-shot claim) before calling Cloudflare', () => {
    expect(src).toMatch(/redis\.setNx\(tokenReplayKey\(trimmed\)/);
    // The claim MUST happen BEFORE the fetch to Cloudflare — a claim
    // that happens AFTER the network round-trip has already lost the
    // race the guard is meant to close.
    const setNxIdx = src.indexOf('redis.setNx(tokenReplayKey');
    const fetchIdx = src.indexOf('fetch(\'https://challenges.cloudflare.com');
    expect(setNxIdx).toBeGreaterThan(0);
    expect(fetchIdx).toBeGreaterThan(0);
    expect(setNxIdx).toBeLessThan(fetchIdx);
  });

  it('a rejected SETNX + connected Redis returns the "replayed" reason', () => {
    expect(src).toMatch(/if\s*\(\s*!claimed\s*&&\s*redis\.isConnected\(\)\s*\)/);
    expect(src).toMatch(/reason:\s*['"]replayed['"]/);
  });

  it('releases the claim on HTTP error / negative verdict / exception (retry-safe)', () => {
    // Three release paths — one per failure branch.
    const releases = src.match(/await redis\.del\(tokenReplayKey\(trimmed\)\)\.catch/g) || [];
    expect(releases.length).toBeGreaterThanOrEqual(3);
  });

  it('successful verify does NOT release the claim (token is consumed)', () => {
    // Structural: the returns { valid: true } must NOT sit inside any
    // block whose immediately-preceding statement releases the key.
    // Concretely: no `redis.del(tokenReplayKey…` may appear between
    // the close-brace of the `if (!data.success)` block and the
    // `return { valid: true };` line — that gap is the SUCCESS branch
    // of the same function.
    const negativeBlockCloseRe = /if\s*\(\s*!data\.success\s*\)[\s\S]*?\}\s*\n/;
    const successReturn = 'return { valid: true };';
    const negIdx = src.search(negativeBlockCloseRe);
    const successIdx = src.indexOf(successReturn);
    expect(negIdx, 'negative-verdict block must exist').toBeGreaterThan(0);
    expect(successIdx, 'success return must exist').toBeGreaterThan(0);
    expect(successIdx).toBeGreaterThan(negIdx);
    // The negative block ends at the '}' — find that position and
    // scan the gap up to the success return.
    const negBlockMatch = src.match(negativeBlockCloseRe);
    const negBlockEnd = negIdx + (negBlockMatch?.[0].length ?? 0);
    const successBranchGap = src.slice(negBlockEnd, successIdx);
    expect(successBranchGap).not.toMatch(/redis\.del\(tokenReplayKey/);
  });
});
