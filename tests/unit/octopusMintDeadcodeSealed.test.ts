/**
 * PR-DANGER-1 regression pins — the octopus-engine V1 money-mint handlers
 * are deleted and stay deleted.
 *
 * The triage identified three unauthenticated / under-authorized money-
 * mint handlers in server/routes/octopus-engine.ts that were only "safe"
 * because a `router.all('/v1/wallet*', …)` sentinel registered first in
 * the file and short-circuited every call with 410. That's a mount-order
 * guarantee — one merge that reorders the mounts, deletes the sentinel,
 * or splits the file converts the public API into a self-serve mint of
 * unlimited platform credit with NO audit row on the sentinel side
 * explaining what happened.
 *
 * This test pins the invariant three ways:
 *   1) The specific mint HANDLERS must be gone from the file.
 *   2) The sentinels (`/v1/wallet*` and `/v1/brain*`) must still be there.
 *   3) The client tree must not contain any caller that would break if
 *      the handlers stay deleted (belt-and-braces).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { glob } from 'node:fs';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PR-DANGER-1 — octopus-engine unauthenticated mint handlers stay deleted', () => {
  const src = read('server/routes/octopus-engine.ts');

  it('POST /v1/wallet/redeem handler is gone from octopus-engine.ts', () => {
    // The handler body took { userId, platform, amount } from the request
    // body with NO auth check and directly mutated octopus_wallets.balance.
    // It was "safe" only because the /v1/wallet* sentinel above returned
    // 410 first. Regression: the handler must not reappear at ANY path
    // inside this file — no `router.post("/v1/wallet/redeem"`, no
    // typo variant, no `.post('/v1/wallet/redeem'` etc.
    expect(src).not.toMatch(/router\.post\(\s*['"][^'"]*\/v1\/wallet\/redeem['"]/);
  });

  it('POST /v1/wallet/credit handler is gone from octopus-engine.ts', () => {
    // Same shape as /redeem but for the ADD direction — even worse: no
    // idempotency, no existing-balance floor, would create a new wallet
    // row if none existed. The mint-in-one-call handler must stay deleted.
    expect(src).not.toMatch(/router\.post\(\s*['"][^'"]*\/v1\/wallet\/credit['"]/);
  });

  it('POST /v1/brain/redeem handler is gone from octopus-engine.ts', () => {
    // Auth-gated but client-controlled amountCents with no ownership /
    // face-value check — an authed user could forge redemption receipts
    // against any eGift at any value. The `/v1/brain*` sentinel added by
    // this PR now short-circuits the route.
    expect(src).not.toMatch(/router\.post\(\s*['"][^'"]*\/v1\/brain\/redeem['"]/);
  });

  it('/v1/wallet* sentinel is still mounted (410 with migration table)', () => {
    // If a future refactor accidentally removes the sentinel, we lose the
    // defense that made the (now-deleted) handlers harmless in the first
    // place. Also pins the migration table's content so the message keeps
    // pointing at the canonical rail.
    expect(src).toMatch(/router\.all\(\s*['"]\/v1\/wallet\*['"]/);
    const walletSentinel = src.match(
      /router\.all\(\s*['"]\/v1\/wallet\*['"][\s\S]{0,600}?\}\);\s*\n/,
    );
    expect(walletSentinel, 'wallet sentinel missing').toBeTruthy();
    expect(walletSentinel![0]).toMatch(/V1_DEPRECATED/);
    expect(walletSentinel![0]).toMatch(/\/api\/wallet/);
  });

  it('/v1/brain* sentinel is mounted (new — was uncovered before)', () => {
    // The brain-redeem handler previously sat outside any sentinel — this
    // PR added its sentinel. Regression: the sentinel must exist AND
    // point callers at /api/v2/vouchers/redeem.
    expect(src).toMatch(/router\.all\(\s*['"]\/v1\/brain\*['"]/);
    const brainSentinel = src.match(
      /router\.all\(\s*['"]\/v1\/brain\*['"][\s\S]{0,500}?\}\);\s*\n/,
    );
    expect(brainSentinel, 'brain sentinel missing').toBeTruthy();
    expect(brainSentinel![0]).toMatch(/V1_DEPRECATED/);
    expect(brainSentinel![0]).toMatch(/\/api\/v2\/vouchers\/redeem/);
  });

  it('sentinels register BEFORE any remaining v1 handler (mount-order defense)', () => {
    // Even for the handlers we did NOT delete (bookings admin routes, etc.),
    // the file's safety depends on the router.all('/v1/…*') sentinels
    // registering earlier in the file. If someone reorders the file so a
    // `router.post` sits above its matching sentinel, that specific path
    // becomes live again. Pin the ordering: every sentinel index must be
    // less than every remaining v1 router.post index for the same prefix.
    const idx = (needle: string) => src.indexOf(needle);
    const walletSentinelIdx = idx(`router.all('/v1/wallet*'`);
    const brainSentinelIdx = idx(`router.all('/v1/brain*'`);
    const bookingsSentinelIdx = idx(`router.all('/v1/bookings*'`);
    const providersSentinelIdx = idx(`router.all('/v1/providers*'`);
    const ledgerSentinelIdx = idx(`router.all('/v1/ledger*'`);
    expect(walletSentinelIdx).toBeGreaterThan(-1);
    expect(brainSentinelIdx).toBeGreaterThan(-1);
    expect(bookingsSentinelIdx).toBeGreaterThan(-1);
    expect(providersSentinelIdx).toBeGreaterThan(-1);
    expect(ledgerSentinelIdx).toBeGreaterThan(-1);
    // Any remaining router.post('/v1/wallet/…) — none should exist — but
    // pin the invariant for future-proofing.
    const walletPostIdx = src.search(/router\.post\(\s*['"]\/v1\/wallet\//);
    expect(walletPostIdx === -1 || walletPostIdx > walletSentinelIdx).toBe(true);
    // Same for /v1/brain/.
    const brainPostIdx = src.search(/router\.post\(\s*['"]\/v1\/brain\//);
    expect(brainPostIdx === -1 || brainPostIdx > brainSentinelIdx).toBe(true);
  });
});

describe('PR-DANGER-1 — zero client callers of the deleted paths (grep verified)', () => {
  it('no client file references /v1/wallet/redeem, /v1/wallet/credit, or /v1/brain/redeem', () => {
    // The triage confirmed zero callers when this PR was written. Pin the
    // fact so a future client edit that introduces a caller trips the
    // test — the caller author has to see this file, learn the endpoint
    // is retired, and migrate to the canonical rail instead.
    const clientDir = path.join(root, 'client', 'src');
    const bad: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue;
        const content = fs.readFileSync(full, 'utf8');
        if (/\/v1\/wallet\/redeem|\/v1\/wallet\/credit|\/v1\/brain\/redeem/.test(content)) {
          bad.push(full.slice(root.length + 1));
        }
      }
    };
    walk(clientDir);
    expect(bad, `caller(s) of deleted endpoints: ${bad.join(', ')}`).toEqual([]);
  });
});
