/**
 * Two live money holes (2026-09-18 audit):
 *
 * 1. Cancelling a wallet-funded booking refunded the WHOLE debit whatever the
 *    cancellation tier said. A customer told "no refund applies
 *    (customer_under_24h)" got ₪1,000 back: provider ₪0, Pet Wash ₪0, and
 *    recordRefund never ran (it is gated on refundCents > 0), so nothing in
 *    the ledger showed the money moving.
 * 2. A card that WAS charged and then could not be fulfilled (escrow hold
 *    failed, or the booking changed during the payment) produced a log line
 *    and nothing else — no alert, and there is no automatic card-refund rail.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const src = read('server/routes/booking-requests.ts');
const cancelStart = src.indexOf('Refund the amount the CANCELLATION TIER allows');
const cancelBlock = src.slice(cancelStart, src.indexOf('Notify the OTHER party about cancellation', cancelStart));

// The rule the route now applies.
const walletRefund = (refundCents: number, debitedCents: number) =>
  Math.min(Math.max(0, refundCents), debitedCents);

describe('a cancellation refunds what the tier says', () => {
  it('under 24h: told no refund, gets no refund (was the full ₪1,000)', () => {
    expect(walletRefund(0, 100_000)).toBe(0);
  });

  it('24–72h: half (was the full amount)', () => {
    expect(walletRefund(50_000, 100_000)).toBe(50_000);
  });

  it('over 72h: the whole debit', () => {
    expect(walletRefund(100_000, 100_000)).toBe(100_000);
  });

  it('never more than was actually taken', () => {
    expect(walletRefund(150_000, 100_000)).toBe(100_000);
  });

  it('the route computes exactly that, and keeps the debit when nothing is due', () => {
    expect(cancelBlock).toContain('const walletRefundCents = Math.min(Math.max(0, refundCents), debitedCents);');
    expect(cancelBlock).toContain('if (walletRefundCents <= 0) {');
    expect(cancelBlock).toContain('Cancel with no refund due — wallet debit kept');
    expect(cancelBlock).toContain('amountCents: walletRefundCents,');
    expect(cancelBlock).not.toContain('amountCents: debitedCents,');
    // The provider EMERGENCY cancel keeps its full refund — that is the policy.
    expect(src).toContain("reason: 'provider_emergency_cancel'");
  });

  it('a partial refund leaves the booking debited, not "refunded"', () => {
    expect(cancelBlock).toContain("financeState: walletRefundCents >= debitedCents ? 'refunded' : 'debited',");
  });
});

describe('a charged card that could not be fulfilled reaches a human', () => {
  const helper = read('server/lib/serviceBookingCardPayment.ts');

  it('raises a critical payment alert naming the amount and the reason', () => {
    expect(helper).toContain('export async function alertPaidButNotFulfilled');
    expect(helper).toContain("severity: 'critical'");
    expect(helper).toContain('dedupeKey: `paid_not_fulfilled:${input.kind}:${input.bookingRef}`');
    expect(helper).toContain('Refund it in the clearing back office');
  });

  it('never throws on the failure path it is called from', () => {
    const fn = helper.slice(helper.indexOf('export async function alertPaidButNotFulfilled'));
    expect(fn).toContain('} catch (alertErr: any) {');
  });

  it('both rails call it where the money was already claimed', () => {
    const walk = read('server/routes/walk-my-pet.ts');
    const academy = read('server/routes/academy.ts');
    expect(walk).toContain("reason: `escrow_hold_failed: ${escrowErr?.message ?? 'unknown'}`");
    expect(walk).toContain("reason: 'status_changed_during_payment'");
    expect(academy).toContain("reason: 'status_changed_during_payment'");
    // and only after a verified payment
    expect(walk.indexOf('verifyServiceCardPayment')).toBeLessThan(walk.indexOf('alertPaidButNotFulfilled'));
  });
});
