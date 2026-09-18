/**
 * Walks are paid by card (CEO 2026-09-18: "a" — the rail the other bookings
 * use). Before it: accepting a walk flipped the row to 'confirmed' with an
 * escrow DOCUMENT and no money — no card charge, no wallet debit, no fiscal
 * document — while the screen promised a wallet hold, a charge after the walk
 * and 72-hour escrow protection.
 *
 * The invariant this file guards: a walk can only read 'confirmed' after a
 * payment was verified server-side.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const routes = read('server/routes/walk-my-pet.ts');
const core = read('server/services/booking-response/acceptWalkBookingCore.ts');
const ret = routes.slice(routes.indexOf("router.get('/walks/:bookingId/sumit-return'"), routes.indexOf("router.post('/walks/holds'"));

describe('accepting a walk confirms nothing', () => {
  it('the core ends at payment_pending and holds nothing', () => {
    expect(core).toContain("paymentRail: 'AWAITING_CUSTOMER_CARD'");
    expect(core).not.toContain("paymentRail: 'MISSING'");
    expect(core).not.toContain('walkEliteBookingEngine');
    expect(core).not.toMatch(/set\(\{ status: 'confirmed'/);
  });

  it('the customer is told what to pay and where', () => {
    expect(core).toContain('/walk-my-pet/bookings/${booking.bookingId}/pay');
  });
});

describe('the payment route', () => {
  it('only the owner, only while awaiting payment', () => {
    const pay = routes.slice(routes.indexOf("router.post('/walks/:bookingId/pay'"), routes.indexOf("router.get('/walks/:bookingId/sumit-return'"));
    expect(pay).toContain("if (booking.ownerId !== userId)");
    expect(pay).toContain("if (booking.status !== 'payment_pending')");
    expect(pay).toContain('beginServiceCardPayment(');
    // the amount comes from the booking, never from the request body
    expect(pay).toContain("amountCents = Math.round(parseFloat(booking.totalCost || '0') * 100)");
    expect(pay).not.toMatch(/req\.body\.(amount|total|price)/);
  });

  it('a dark rail says so and charges nothing', () => {
    const helper = read('server/lib/serviceBookingCardPayment.ts');
    expect(helper).toContain("if (!cardRailIsLive())");
    expect(helper).toContain("code: 'ONLINE_CARD_NOT_LIVE'");
    expect(helper).toContain("(process.env.BOOKING_CARD_RAIL || 'nayax').trim().toLowerCase() === 'sumit'");
  });
});

describe('the return handler is the only door to confirmed', () => {
  it('verifies with SUMIT before anything else happens', () => {
    expect(ret).toContain('verifyServiceCardPayment(');
    expect(ret.indexOf('verifyServiceCardPayment')).toBeLessThan(ret.indexOf("status: 'confirmed'"));
    // The gate itself is unchanged; it grew a body in 2026-09-19 so that a
    // payment landing for a walk that is no longer payable (the customer
    // cancelled while the hosted page was open) raises the paid-but-not-
    // fulfilled alert instead of being redirected away and forgotten.
    expect(ret).toContain("if (booking.status !== 'payment_pending')");
    expect(ret).toMatch(/inspectServiceCardPayment\(\{[\s\S]{0,400}alertPaidButNotFulfilled/);
    expect(ret).toContain('paid_after_status_change');
  });

  it('the hold comes before the confirm, and a failed hold refuses', () => {
    expect(ret.indexOf('confirmBooking(')).toBeLessThan(ret.indexOf("status: 'confirmed'"));
    expect(ret).toContain("return fail('escrow_hold_failed')");
  });

  it('the confirm is guarded on payment_pending (no overwriting a cancellation)', () => {
    expect(ret).toContain("eq(walkBookings.status, 'payment_pending')");
    expect(ret).toContain("return fail('status_changed_during_payment')");
  });

  it('an already-confirmed walk returns success (idempotent second return)', () => {
    expect(ret).toMatch(/booking\.status === 'confirmed'[\s\S]{0,120}return ok\(\)/);
  });
});

describe('the amount, the booking and the payment are bound together', () => {
  const helper = read('server/lib/serviceBookingCardPayment.ts');

  it('the paid amount must match the booking (1 agora tolerance)', () => {
    expect(helper).toContain('Math.abs(verified.amountCents - Math.round(input.expectedAmountCents)) > 1');
    expect(helper).toContain("reason: 'amount_mismatch'");
  });

  it('a transaction cannot be replayed against another booking, or reused', () => {
    expect(helper).toContain('verifySumitBookingPayment(String(txnId), String(input.bookingRef))');
    expect(helper).toContain('claimSumitPayment(String(txnId), `${input.kind}:${input.bookingRef}`');
    expect(helper).toContain('if (!claimAllowsFulfil(claim))');
  });

  it('a payment with no amount is refused, not waved through', () => {
    expect(helper).toContain("if (typeof verified.amountCents !== 'number') return { ok: false, reason: 'amount_missing' }");
  });
});

describe('the screen matches the rail', () => {
  const screen = read('client/src/pages/walk-my-pet/BookingFlow.tsx');

  it('says payment happens after the walker accepts, on a secure page', () => {
    expect(screen).toContain('data-testid="walk-payment-truth"');
    expect(screen).toContain('לאחר שהמטייל/ת יאשר/תאשר תקבל/י קישור לתשלום מאובטח');
    expect(screen).not.toContain('הסכום ייושמר מהארנק שלך עם אישור המוליך/ה, ויחויב לאחר סיום ההליכה');
    expect(screen).not.toContain('תשלום מקוון עדיין לא זמין להליכות');
  });

  it('there is a page to pay from, and it charges nothing itself', () => {
    const page = read('client/src/pages/walk-my-pet/PayWalk.tsx');
    expect(page).toContain('/api/walk-my-pet/walks/${encodeURIComponent(bookingId)}/pay');
    expect(page).toContain('window.location.assign(body.paymentUrl)');
    expect(read('client/src/App.tsx')).toContain('<Route path="/walk-my-pet/bookings/:bookingId/pay">');
  });
});
