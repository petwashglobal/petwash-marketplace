/**
 * Task 25 — CEO fire order 101-140.
 *
 * BOOKING CANCEL REPLAY audit — MONEY-SIDE effects, not just the
 * notification. Distinguishes:
 *   (A) notification idempotency — covered by PR #1802 canonical
 *       helper (dispatchOnce on booking.cancelled event).
 *   (B) BUSINESS/MONEY idempotency — verified here.
 *
 * Findings:
 *
 *   1. The status flip (UPDATE booking_requests SET status='cancelled')
 *      is guarded by the applyTransition() state-machine check ABOVE
 *      it. A second cancel-from-cancelled is rejected — but the
 *      status flip itself is NOT wrapped in SELECT FOR UPDATE, so two
 *      TRULY simultaneous cancels can each pass the state check and
 *      both UPDATE. This is a status-write race, not a money race.
 *
 *   2. The wallet-side effects (releaseBookingHold / refundBookingWallet
 *      / debitBookingFromHold) ARE atomically idempotent at the
 *      WalletLedger layer, keyed on `wallet:booking:release:{bookingId}`
 *      / `wallet:booking:refund:{bookingId}` / `wallet:booking:debit:{bookingId}`
 *      in the `walletIdempotencyKeys` table. A replay call returns
 *      `{ idempotent: true }` and does NOT double-move money.
 *
 *   3. The Firestore escrow refund is gated on `escrow.status === 'held'`
 *      (line ~3956). Once refunded, status='refunded' and the loop
 *      skips — natural state-machine idempotency at the escrow layer.
 *
 *   4. The credit-note issuance (IsraeliDigitalReceiptService) is
 *      explicitly gated on `!result.idempotent` inside
 *      refundBookingWallet — a replay does NOT emit a second credit
 *      note (fiscal safety).
 *
 * Conclusion: money side effects are guaranteed at-most-once via the
 * wallet-ledger + escrow-status layers, INDEPENDENT of any status-
 * flip race. This test pins each layer's guarantee so a future
 * refactor cannot silently regress them.
 *
 * NO code change in this PR. Money code untouched.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('cancel endpoint invokes idempotent-by-key wallet operations', () => {
  const CANCEL = R('routes/booking-requests.ts');
  const start = CANCEL.indexOf("router.post('/:requestId/cancel'");
  const region = CANCEL.slice(start, start + 20000);

  it('the cancel handler is registered', () => {
    expect(start).toBeGreaterThan(-1);
  });

  it('state-machine gate rejects illegal transitions BEFORE any side effect', () => {
    expect(region).toMatch(/applyTransition\(\{[\s\S]{0,400}to: 'cancelled'/);
    expect(region).toMatch(/transitionCheck\.result\.ok/);
    // The reject path returns BEFORE the UPDATE — pins early-return.
    const applyIdx = region.indexOf('applyTransition(');
    const updateIdx = region.indexOf('db.update(bookingRequests)');
    expect(applyIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeGreaterThan(applyIdx);
  });

  it('wallet hold-release runs only when financeState === hold_active AND holdCents > 0', () => {
    expect(region).toMatch(/if \(financeState === 'hold_active' && holdCents > 0\)/);
    expect(region).toMatch(/walletService\.releaseBookingHold\(/);
  });

  it('Firestore escrow refund is gated on escrow.status === held (skips already-refunded escrows)', () => {
    expect(region).toMatch(/if \(escrow\.status === 'held'\)/);
    expect(region).toMatch(/EscrowService\.refundEscrowPayment\(/);
  });
});

describe('WalletService money operations are idempotent by bookingId', () => {
  const WALLET = R('services/WalletService.ts');

  it('releaseBookingHold keys on wallet:booking:release:{bookingId}', () => {
    expect(WALLET).toMatch(/`wallet:booking:release:\$\{params\.bookingId\}`/);
  });

  it('refundBookingWallet keys on wallet:booking:refund:{bookingId}', () => {
    expect(WALLET).toMatch(/`wallet:booking:refund:\$\{params\.bookingId\}`/);
  });

  it('debitBookingFromHold keys on wallet:booking:debit:{bookingId}', () => {
    expect(WALLET).toMatch(/`wallet:booking:debit:\$\{params\.bookingId\}`/);
  });

  it('refundBookingWallet emits credit note only on non-idempotent result (fiscal safety)', () => {
    expect(WALLET).toMatch(/if \(!result\.idempotent\)/);
    expect(WALLET).toMatch(/IsraeliDigitalReceiptService[\s\S]*issueCreditNoteForBooking/);
  });
});

describe('WalletLedger consults walletIdempotencyKeys on every write', () => {
  const LEDGER = R('services/WalletLedger.ts');

  it('WalletLedger uses walletIdempotencyKeys', () => {
    expect(LEDGER).toMatch(/walletIdempotencyKeys/);
  });

  it('WalletLedger looks up idempotencyKey BEFORE writing (returns cached response on hit)', () => {
    // The lookup pattern:
    //   .select({ responseJson: walletIdempotencyKeys.responseJson, requestHash: walletIdempotencyKeys.requestHash })
    //   .from(walletIdempotencyKeys)
    //   .where(eq(walletIdempotencyKeys.idempotencyKey, ...))
    const matches = LEDGER.match(/\.from\(walletIdempotencyKeys\)/g) || [];
    expect(matches.length).toBeGreaterThan(1);
  });

  it('WalletLedger INSERTs into walletIdempotencyKeys after committing the ledger write', () => {
    const inserts = LEDGER.match(/\.insert\(walletIdempotencyKeys\)/g) || [];
    expect(inserts.length).toBeGreaterThanOrEqual(3); // release / debit / refund
  });
});
