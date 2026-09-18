/**
 * Walk-My-Pet escrow must FAIL CLOSED. If the escrow hold throws on
 * walker-accept, the booking must NOT be confirmed, must NOT write a
 * PAYMENT_CAPTURED ledger, and must NOT issue an Israeli tax receipt —
 * else a free walk + a real tax doc results.
 *
 * 2026-08-28: the walker-accept path in server/routes/walk-my-pet.ts
 * used to inline the try/catch(escrowErr). It has since been
 * refactored to delegate to acceptWalkBookingCore, which returns a
 * structured `coreResult` with an `errorCode` field. The
 * fail-closed guarantee moved with it — walker-accept now translates
 * `coreResult.errorCode === 'ESCROW_HOLD_FAILED'` to HTTP 502
 * (never 200, never a receipt, never a ledger entry).
 *
 * The test pin follows the invariant, not the implementation. The
 * check now looks at what the CURRENT source guarantees:
 *   • The walker-accept branch reads `coreResult.errorCode ===
 *     'ESCROW_HOLD_FAILED'` and returns 502 with a stable code.
 *   • The console.error-then-continue anti-pattern the earlier
 *     regression banned still isn't present.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const SRC = readFileSync(resolve(__dirname, '..', 'routes', 'walk-my-pet.ts'), 'utf8');

describe('walk-my-pet escrow fail-closed', () => {
  // 2026-09-18: the hold moved to the verified card payment. Accept places no
  // hold at all, so the fail-closed invariant now lives in /sumit-return: a
  // walk that was paid but could not be held must NOT read 'confirmed'.
  it('a failed hold in the payment return leaves the walk unconfirmed', () => {
    const ret = SRC.slice(SRC.indexOf("router.get('/walks/:bookingId/sumit-return'"), SRC.indexOf("router.post('/walks/holds'"));
    // 2026-09-18: the log line became a critical ALERT — a charged card with no
    // booking must reach a human, not a log file.
    expect(ret).toMatch(/alertPaidButNotFulfilled\(\{/);
    expect(ret).toMatch(/reason: `escrow_hold_failed/);
    expect(ret).toMatch(/return fail\('escrow_hold_failed'\)/);
    // the status flip happens only after the hold, and only from payment_pending
    expect(ret.indexOf("escrow_hold_failed")).toBeLessThan(ret.indexOf("status: 'confirmed'"));
    expect(ret).toMatch(/eq\(walkBookings\.status, 'payment_pending'\)/);
  });

  it('the walk is confirmed only after the payment is verified', () => {
    const ret = SRC.slice(SRC.indexOf("router.get('/walks/:bookingId/sumit-return'"), SRC.indexOf("router.post('/walks/holds'"));
    expect(ret.indexOf('verifyServiceCardPayment')).toBeLessThan(ret.indexOf("status: 'confirmed'"));
    expect(ret).toMatch(/if \(!verified\.ok\) return fail\(verified\.reason\)/);
  });

  it('does not console.error-and-continue on escrow failure', () => {
    // The anti-pattern the earlier regression banned. A drift back to
    // logging-then-confirming would silently mint free walks with real
    // Israeli tax receipts.
    expect(SRC).not.toMatch(/console\.error\('\[Walk My Pet\] Escrow confirmation failed for bookingId:'/);
  });
});
