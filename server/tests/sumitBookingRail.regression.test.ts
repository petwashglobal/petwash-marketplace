/**
 * SUMIT booking card rail (CEO "go full on" 2026-08-05):
 *  The canonical booking /pay used a dark Nayax rail (ONLINE_CARD_NOT_LIVE), so real
 *  bookings dead-ended at "accepted — pay to confirm". SUMIT is live + verified, so
 *  /pay can now use it behind BOOKING_CARD_RAIL. These pins lock the invariants that
 *  keep the new rail from charging-without-confirming (§4) or faking a confirm (§6):
 *   · the rail is flag-gated (default nayax) — no silent switch;
 *   · confirmation is server-side verified (getTransaction), amount-matched, and
 *     Deal-Gated before status flips to 'confirmed' — never trusting the querystring.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const bookingRequests = R('server/routes/booking-requests.ts');
const sumitPay = R('server/services/SumitBookingPayment.ts');

describe('SUMIT booking rail is flag-gated (Nayax path preserved)', () => {
  it('/pay selects the rail via BOOKING_CARD_RAIL, defaulting to nayax', () => {
    expect(bookingRequests).toMatch(/BOOKING_CARD_RAIL\s*\|\|\s*'nayax'/);
    expect(bookingRequests).toMatch(/cardRail === 'sumit'/);
  });
  it('the SUMIT session helper mirrors the Nayax result shape (drop-in swap)', () => {
    expect(sumitPay).toMatch(/createSumitBookingSession/);
    expect(sumitPay).toMatch(/ONLINE_CARD_NOT_LIVE/); // honest "not live" when unwired
  });
  it('beginRedirect creates a page only — money is verified server-side, not here', () => {
    expect(sumitPay).toMatch(/verifySumitBookingPayment/);
    expect(sumitPay).toMatch(/getTransaction/);
  });
});

describe('SUMIT return NEVER confirms without server-side proof', () => {
  const ret = bookingRequests.slice(bookingRequests.indexOf('/:requestId/sumit-return'));
  it('re-verifies with SUMIT before confirming (querystring is not trusted)', () => {
    expect(ret).toMatch(/verifySumitBookingPayment/);
    expect(ret).toMatch(/if \(!verify\.valid\) return fail/);
  });
  it('enforces amount match against the booking (anti price-tampering, §4)', () => {
    expect(ret).toMatch(/Math\.abs\(verify\.amountCents - booking\.totalCents\) > 1/);
    expect(ret).toMatch(/amount_mismatch/);
  });
  it('only confirms a payment_pending booking; idempotent on already-confirmed (§4)', () => {
    expect(ret).toMatch(/booking\.status !== 'payment_pending'/);
    expect(ret).toMatch(/status === 'confirmed'.*\|\|.*'in_progress'/s);
  });
  it('respects the Deal Gate — holds money + alerts instead of faking a confirm (§6)', () => {
    expect(ret).toMatch(/canConfirmBooking\(requestId\)/);
    expect(ret).toMatch(/deal_gate_blocked/);
  });
  it('only flips status to confirmed after all gates pass', () => {
    expect(ret).toMatch(/status: 'confirmed'/);
    expect(ret).toMatch(/paymentHeldAt: new Date\(\)/);
  });
});
