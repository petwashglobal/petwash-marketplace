/**
 * K9000 / station money-path hardening — pins three verified defects so they
 * cannot come back (2026-08-17, stations sprint).
 *
 * 1. MEMBER REDEEM DEAD END (P0, money-adjacent)
 *    POST /api/k9000/generate-qr inserted into `redemption_sessions` WITHOUT
 *    `session_type`, which is `NOT NULL` with no default in the live schema
 *    (docs/recovery/.../prod-schema-2026-07-03.sql:20495). Every insert threw a
 *    not-null violation that the surrounding catch swallowed as "non-fatal", so
 *    the row never existed, GET /api/credit-wallet/redemptions/:id/status always
 *    404'd, and K9000Redeem.tsx could never leave the "show your QR" step. And
 *    even with the row present, nothing ever moved it off 'pending' — not
 *    /api/k9000/redeem-wash, not the Cortina settlement commit. A member whose
 *    wash was debited saw no confirmation and could present the next rotated QR
 *    at the other bay: a second debit for one intended wash.
 *
 * 2. CORTINA CALLBACKS WERE UNAUTHENTICATED (P0 once the flag flips)
 *    server/routes/nayax-cortina.ts is mounted under /api/webhooks/, which the
 *    global CSRF gate skips because "HMAC-verified webhooks are authenticated
 *    out-of-band" — true of nayax-webhooks.ts, false here. Nothing verified the
 *    caller, so with NAYAX_CORTINA_ENABLED=true anyone who guessed a bay's Nayax
 *    TerminalId could commit a stranger's reservation (debiting their pre-paid
 *    credit) or void/refund-spam the ops queue.
 *
 * 3. START_CYCLE DOUBLE-VEND WINDOW (money-critical)
 *    The duplicate-activation guard fetched an arbitrary unordered 50 audit rows
 *    and matched in JS, so past ~50 washes the same Nayax transaction could buy a
 *    second wash. Now matched in SQL on the jsonb key.
 *
 * Source-pin style (see the other *.regression.test.ts here): these paths are
 * Nayax-runtime-bound and DARK, so we assert on the source rather than boot a
 * live Cortina/kiosk rail.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (...p: string[]) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');

const routesSrc     = read('routes.ts');
const k9000Src      = read('routes', 'k9000.ts');
const cortinaSrc    = read('routes', 'nayax-cortina.ts');
const redemptionSrc = read('services', 'K9000RedemptionService.ts');

describe('1. member K9000 redeem hold is created and settled', () => {
  it('generate-qr supplies the NOT NULL session_type column', () => {
    const idx = routesSrc.indexOf("app.post('/api/k9000/generate-qr'");
    expect(idx).toBeGreaterThan(-1);
    const block = routesSrc.slice(idx, idx + 6000);
    expect(block).toMatch(/sessionType:\s*'hardware_qr'/);
  });

  it('generate-qr retires the member\'s earlier pending k9000 holds (no 45s row leak)', () => {
    const idx = routesSrc.indexOf("app.post('/api/k9000/generate-qr'");
    const block = routesSrc.slice(idx, idx + 6000);
    expect(block).toMatch(/status:\s*'expired'/);
  });

  it('a settle helper exists, is fail-soft, and touches status only (no balance math)', () => {
    expect(redemptionSrc).toMatch(/export async function completeMemberRedemptionHold/);
    const idx = redemptionSrc.indexOf('export async function completeMemberRedemptionHold');
    const fn = redemptionSrc.slice(idx, idx + 2500);
    // Only flips 'pending' → 'completed' for this member's k9000 rows.
    expect(fn).toMatch(/status:\s*'completed'/);
    expect(fn).toMatch(/eq\(redemptionSessions\.status,\s*'pending'\)/);
    expect(fn).toMatch(/eq\(redemptionSessions\.platform,\s*'k9000'\)/);
    // Must never throw: the wash is already debited and audited when it runs.
    expect(fn).toMatch(/catch\s*\(/);
    // Must not move money.
    expect(fn).not.toMatch(/walletAccounts|creditTransactions|BalanceCents|washPackageCredits/);
  });

  it('both redeem rails settle the hold — wallet kiosk AND Cortina settlement', () => {
    expect(k9000Src).toMatch(/completeMemberRedemptionHold\(/);
    expect(cortinaSrc).toMatch(/completeMemberRedemptionHold\(/);
  });

  it('the settle call is fire-and-forget so it cannot unwind a running wash', () => {
    expect(k9000Src).toMatch(/void completeMemberRedemptionHold\(/);
    expect(cortinaSrc).toMatch(/void completeMemberRedemptionHold\(/);
  });
});

describe('2. Cortina inbound callbacks authenticate the caller', () => {
  it('has a constant-time shared-secret check', () => {
    expect(cortinaSrc).toMatch(/function rejectUnauthenticatedCaller/);
    expect(cortinaSrc).toMatch(/crypto\.timingSafeEqual/);
  });

  it('fails CLOSED when Cortina is enabled but no inbound secret is configured', () => {
    const idx = cortinaSrc.indexOf('function rejectUnauthenticatedCaller');
    const fn = cortinaSrc.slice(idx, idx + 1200);
    expect(fn).toMatch(/if \(!expected\)/);
    expect(fn).toMatch(/inbound_secret_not_configured/);
  });

  it('EVERY money-bearing callback runs the guard — authorize, settlement, void, refund', () => {
    // One guard per router.post(...) in this file.
    const posts  = cortinaSrc.match(/router\.post\(/g) ?? [];
    const guards = cortinaSrc.match(/rejectUnauthenticatedCaller\(req\)/g) ?? [];
    expect(posts.length).toBeGreaterThanOrEqual(4);
    expect(guards.length).toBe(posts.length);
  });

  it('the guard runs BEFORE any bay resolution or reservation work', () => {
    const settle = cortinaSrc.slice(cortinaSrc.indexOf("router.post(['/settlement'"));
    const guardAt = settle.indexOf('rejectUnauthenticatedCaller');
    const parseAt = settle.indexOf('parseCortinaRequest');
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(parseAt);
  });
});

describe('3. start_cycle duplicate-transaction guard matches in SQL, not in JS', () => {
  it('no longer pulls an arbitrary unordered 50-row window', () => {
    const idx = k9000Src.indexOf('IDEMPOTENCY CHECK: prevent double-activation');
    expect(idx).toBeGreaterThan(-1);
    const block = k9000Src.slice(idx, idx + 1800);
    // The old shape: an unbounded eventType select capped at 50, scanned in JS.
    // Assert against the whole file so a copy of the old guard anywhere fails too.
    expect(k9000Src).not.toMatch(/existingWash/);
    const code = block.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    expect(code).not.toMatch(/\.limit\(50\)/);
  });

  it('matches the transactionId inside the jsonb metadata in the WHERE clause', () => {
    const idx = k9000Src.indexOf('IDEMPOTENCY CHECK: prevent double-activation');
    const block = k9000Src.slice(idx, idx + 1800);
    expect(block).toMatch(/->>\s*'transactionId'/);
    expect(block).toMatch(/\.limit\(1\)/);
  });
});
