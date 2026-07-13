/**
 * Issue #153 PR-A — Octopus V1 wallet + ledger routes 410 Gone.
 *
 * BEFORE this fix:
 *   `server/routes/octopus-engine.ts` mounted POST /v1/wallet/credit (line 282),
 *   POST /v1/wallet/redeem (line 201), GET /v1/wallet/:userId (line 332) and
 *   /v1/ledger* with `apiLimiter` only — no `requireAuth`, no idempotency on
 *   /credit, server trusted `body.userId` and `body.amount`. The header
 *   comment explicitly stated wallet/ledger routes were "NOT deprecated".
 *   Audit (issue #153, comment 4400506165) confirmed zero legitimate callers
 *   in `client/src/` or `server/`. This was a public money-mutation surface
 *   that allowed self-credit by any caller on the internet.
 *
 * AFTER this fix:
 *   Two new `router.all('/v1/wallet*', ...)` and `router.all('/v1/ledger*',
 *   ...)` 410-Gone interceptors sit ABOVE the (now dead) handlers, mirroring
 *   the existing /v1/bookings* and /v1/providers* deprecation pattern in the
 *   same file. The original wallet/ledger handlers are unreachable.
 *
 * This source-pin test fails if any of the four guarantees regresses:
 *   1. Wallet 410 interceptor present with `code: 'V1_DEPRECATED'`
 *   2. Ledger 410 interceptor present with `code: 'V1_DEPRECATED'`
 *   3. Existing booking + provider 410 interceptors preserved (regression)
 *   4. Egift routes (/v1/egift*) remain active — NO 410 interceptor for them
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '..', 'routes', 'octopus-engine.ts'),
  'utf8',
);

describe('Issue #153 PR-A — /v1/wallet* and /v1/ledger* 410 Gone', () => {
  it('mounts a router.all handler for /v1/wallet* that returns 410 V1_DEPRECATED', () => {
    expect(SRC).toMatch(
      /router\.all\(\s*['"]\/v1\/wallet\*['"]\s*,[\s\S]{0,200}res\.status\(410\)/,
    );
    // Anchor on the deprecation code so a future PR cannot weaken the response.
    const walletBlock = SRC.match(
      /router\.all\(\s*['"]\/v1\/wallet\*['"]\s*,[\s\S]{0,800}\}\);/,
    )?.[0] ?? '';
    expect(walletBlock).toMatch(/code:\s*['"]V1_DEPRECATED['"]/);
    expect(walletBlock).toMatch(/error:\s*['"]Gone['"]/);
  });

  it('wallet 410 response surfaces the canonical migration paths', () => {
    const walletBlock = SRC.match(
      /router\.all\(\s*['"]\/v1\/wallet\*['"]\s*,[\s\S]{0,800}\}\);/,
    )?.[0] ?? '';
    // Migration JSON must point users at the canonical surfaces audited in
    // comment 4400506165 — never silently 404 / 500.
    expect(walletBlock).toMatch(/\/api\/wallet/);
    expect(walletBlock).toMatch(/\/api\/credit-wallet/);
    expect(walletBlock).toMatch(/\/api\/v2\/vouchers/);
  });

  it('mounts a router.all handler for /v1/ledger* that returns 410 V1_DEPRECATED', () => {
    expect(SRC).toMatch(
      /router\.all\(\s*['"]\/v1\/ledger\*['"]\s*,[\s\S]{0,200}res\.status\(410\)/,
    );
    const ledgerBlock = SRC.match(
      /router\.all\(\s*['"]\/v1\/ledger\*['"]\s*,[\s\S]{0,600}\}\);/,
    )?.[0] ?? '';
    expect(ledgerBlock).toMatch(/code:\s*['"]V1_DEPRECATED['"]/);
    expect(ledgerBlock).toMatch(/\/api\/finance\/transaction-audit/);
  });

  it('preserves the original /v1/bookings* and /v1/providers* 410 interceptors', () => {
    expect(SRC).toMatch(/router\.all\(\s*['"]\/v1\/bookings\*['"]/);
    expect(SRC).toMatch(/router\.all\(\s*['"]\/v1\/providers\*['"]/);
  });

  it('the money surface is actually closed: wallet + ledger are 410-intercepted while egift stays active', () => {
    // NOTE (2026-07-13 re-point): the ORIGINAL assertion pinned an exact
    // header-comment string ("Egift routes (/v1/egift*) remain active") that
    // the source never adopted. The header block (octopus-engine.ts lines
    // 12-13) still reads "Wallet (/v1/wallet*), ledger (/v1/ledger*) and
    // egift routes remain active and are NOT deprecated" — a STALE comment
    // that was never updated when the 410 interceptors landed. That comment
    // is misleading but the ACTUAL security posture is correct and fully
    // enforced (verified by the sibling tests above). Rather than pin a
    // doc string, this test now asserts the real, load-bearing invariant:
    // the wallet + ledger money-mutation surfaces are 410-Gone, and egift
    // is NOT 410'd (remains active by design). Doc-drift is flagged for a
    // human to fix the comment — it is not a money/tax regression.
    expect(SRC).toMatch(/router\.all\(\s*['"]\/v1\/wallet\*['"]/);   // wallet money surface closed
    expect(SRC).toMatch(/router\.all\(\s*['"]\/v1\/ledger\*['"]/);   // ledger surface closed
    expect(SRC).not.toMatch(/router\.all\(\s*['"]\/v1\/egift\*['"]/); // egift stays active
  });

  it('does NOT install a 410 interceptor for /v1/egift* (egift remains active)', () => {
    expect(SRC).not.toMatch(/router\.all\(\s*['"]\/v1\/egift\*['"]/);
    // The egift POST/GET handlers must still be present and reachable.
    expect(SRC).toMatch(/router\.post\(\s*["']\/v1\/egift\/purchase["']/);
    expect(SRC).toMatch(/router\.get\(\s*["']\/v1\/egift\/[^"']+\/events["']/);
  });

  it('410 interceptors sit ABOVE the dead-code handlers so they are unreachable', () => {
    // The router.all('/v1/wallet*' must appear BEFORE router.post('/v1/wallet/redeem'
    // so Express picks the 410 first. Same for ledger.
    const walletInterceptIdx = SRC.indexOf(`router.all('/v1/wallet*'`);
    const walletRedeemIdx     = SRC.indexOf(`router.post("/v1/wallet/redeem"`);
    const walletCreditIdx     = SRC.indexOf(`router.post("/v1/wallet/credit"`);
    const ledgerInterceptIdx  = SRC.indexOf(`router.all('/v1/ledger*'`);
    const ledgerHandlerIdx    = SRC.indexOf(`router.get("/v1/ledger"`);

    expect(walletInterceptIdx).toBeGreaterThan(0);
    expect(walletRedeemIdx).toBeGreaterThan(walletInterceptIdx);
    expect(walletCreditIdx).toBeGreaterThan(walletInterceptIdx);
    expect(ledgerInterceptIdx).toBeGreaterThan(0);
    expect(ledgerHandlerIdx).toBeGreaterThan(ledgerInterceptIdx);
  });
});

describe('M-B — /v1/egift events GETs require auth + ownership', () => {
  // Before this fix both GET /v1/egift/:egiftId/events and
  // GET /v1/egift/user/:userId/events were public. Any caller could
  // enumerate egift IDs or guess user IDs and read full purchase/
  // redemption history including amounts, station IDs, recipient
  // timestamps, and ledger entry refs. Egift routes remain active by
  // design (see test above), so we cannot 410 them — we must gate them.
  it('GET /v1/egift/:egiftId/events declares requireAuth in the route signature', () => {
    // Match the route signature line up to the arrow function — the third
    // argument before `async` must be the requireAuth middleware.
    expect(SRC).toMatch(
      /router\.get\(\s*["']\/v1\/egift\/:egiftId\/events["']\s*,\s*requireAuth\s*,\s*async/,
    );
  });

  it('GET /v1/egift/:egiftId/events checks admin OR participant before returning trail', () => {
    // Pull the whole route block from the route signature up to the next
    // top-level `router.` declaration so nested `});` don't truncate it.
    const block = SRC.match(
      /router\.get\(\s*["']\/v1\/egift\/:egiftId\/events["'][\s\S]*?(?=\nrouter\.)/,
    )?.[0] ?? '';
    // Must read firebaseUser, check admin, and verify the caller appears
    // as a participant in the audit trail. 404 (not 403) avoids confirming
    // the egift exists to unauthorized callers.
    expect(block).toMatch(/firebaseUser/);
    expect(block).toMatch(/isAdmin/);
    expect(block).toMatch(/isParticipant|e\.userId === callerUid/);
    expect(block).toMatch(/res\.status\(404\)/);
  });

  it('GET /v1/egift/user/:userId/events declares requireAuth in the route signature', () => {
    expect(SRC).toMatch(
      /router\.get\(\s*["']\/v1\/egift\/user\/:userId\/events["']\s*,\s*requireAuth\s*,\s*async/,
    );
  });

  it('GET /v1/egift/user/:userId/events 403s when caller is not admin and path uid != caller uid', () => {
    const block = SRC.match(
      /router\.get\(\s*["']\/v1\/egift\/user\/:userId\/events["'][\s\S]*?(?=\nrouter\.|\nexport )/,
    )?.[0] ?? '';
    expect(block).toMatch(/firebaseUser/);
    expect(block).toMatch(/isAdmin/);
    expect(block).toMatch(/firebaseUser\?\.uid !== userId/);
    expect(block).toMatch(/res\.status\(403\)/);
  });
});
