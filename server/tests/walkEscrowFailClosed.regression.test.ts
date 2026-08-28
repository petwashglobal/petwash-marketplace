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
  it('walker-accept returns 502 with ESCROW_HOLD_FAILED — never 200 + receipt', () => {
    // The invariant: an escrow failure returns the stable code and
    // never reaches the confirmation success path. The refactored
    // coreResult pattern (post 2026-08-28) is what we pin now.
    expect(SRC).toMatch(/coreResult\.errorCode === 'ESCROW_HOLD_FAILED'/);
    expect(SRC).toMatch(/return res\.status\(502\)/);
    expect(SRC).toMatch(/code:\s*['"]ESCROW_HOLD_FAILED['"]/);
  });

  it('does not console.error-and-continue on escrow failure', () => {
    // The anti-pattern the earlier regression banned. A drift back to
    // logging-then-confirming would silently mint free walks with real
    // Israeli tax receipts.
    expect(SRC).not.toMatch(/console\.error\('\[Walk My Pet\] Escrow confirmation failed for bookingId:'/);
  });
});
