/**
 * Academy is paid by card (CEO 2026-09-18: rail "a").
 *
 * Before: the trainer's confirm took the wallet part and left the rest
 * uncollected forever (paymentStatus 'pending'), and the receipt covered the
 * wallet part only. ₪345 session with ₪100 credit → ₪245 never charged.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const src = read('server/routes/academy.ts');
const pay = src.slice(src.indexOf("router.post('/bookings/:bookingId/pay'"), src.indexOf("router.get('/bookings/:bookingId/sumit-return'"));
const ret = src.slice(src.indexOf("router.get('/bookings/:bookingId/sumit-return'"), src.indexOf("router.post('/bookings/:id/confirm'"));

describe('what is still owed', () => {
  // The helper the routes use, reproduced from source so the arithmetic is pinned.
  const outstanding = (totalIls: number, walletCents: number, paid = false) =>
    paid ? 0 : Math.max(0, Math.round(totalIls * 100) - Math.max(0, walletCents));

  it('₪345 session, ₪100 credit → ₪245 to pay', () => {
    expect(outstanding(345, 100_00)).toBe(245_00);
  });

  it('wallet covers it all → nothing to pay; already paid → nothing to pay', () => {
    expect(outstanding(345, 345_00)).toBe(0);
    expect(outstanding(345, 0, true)).toBe(0);
  });

  it('the source computes it the same way', () => {
    expect(src).toContain('function academyOutstandingCents(booking: any): number {');
    expect(src).toContain("if (booking.paymentStatus === 'completed') return 0;");
    expect(src).toContain('return Math.max(0, total - Math.max(0, fromWallet));');
  });
});

describe('the pay route', () => {
  it('customer only, confirmed only, amount from the booking', () => {
    expect(pay).toContain('if (booking.userId !== userId)');
    expect(pay).toContain("if (booking.bookingStatus !== 'confirmed')");
    expect(pay).toContain('const amountCents = academyOutstandingCents(booking);');
    expect(pay).toContain("code: 'ACADEMY_ALREADY_PAID'");
    expect(pay).not.toMatch(/req\.body\.(amount|total|price)/);
  });

  it('uses the shared rail helper', () => {
    expect(pay).toContain('beginServiceCardPayment({');
    expect(pay).toContain("kind: 'academy'");
  });
});

describe('the return handler is the only door to paid', () => {
  it('verifies before marking anything', () => {
    expect(ret).toContain('verifyServiceCardPayment(');
    expect(ret.indexOf('verifyServiceCardPayment')).toBeLessThan(ret.indexOf("paymentStatus: 'completed'"));
    expect(ret).toContain('expectedAmountCents: outstanding');
    expect(ret).toContain('if (!verified.ok) return fail(verified.reason);');
  });

  it('marks paid + escrow held, guarded on the confirmed state', () => {
    expect(ret).toContain("paymentStatus: 'completed'");
    expect(ret).toContain("escrowStatus: 'held'");
    expect(ret).toContain("eq(trainerBookings.bookingStatus, 'confirmed')");
    expect(ret).toContain("return fail('status_changed_during_payment')");
  });

  it('a second return on a paid session is success, not a double charge', () => {
    expect(ret).toMatch(/paymentStatus === 'completed'\) return ok\(\)/);
  });

  it('issues the receipt for the card money', () => {
    expect(ret).toContain("issueAcademyReceipt(booking, verified.amountCents / 100, 'card')");
  });
});

describe('receipts follow the money', () => {
  it('one helper, separate receipts for wallet and card', () => {
    expect(src).toContain('async function issueAcademyReceipt(');
    expect(src).toContain("sourceKey: `booking:${booking.bookingId}:${source}`");
    expect(src).toContain("issueAcademyReceipt(booking, (booking.walletHoldCents || 0) / 100, 'wallet')");
    expect(src).toContain("paymentMethod: source === 'card' ? 'Credit card' : 'PetWash Wallet'");
  });

  it('the confirm still fails loudly when the receipt cannot be persisted', () => {
    expect(src).toContain('if (err instanceof FiscalOutboxUnavailableError)');
    expect(src).toContain("error: 'fiscal_receipt_unavailable'");
  });
});

describe('the customer is told what to pay', () => {
  it('confirm returns the amount due and where to pay it', () => {
    expect(src).toContain('amountDueCents: outstandingCents');
    expect(src).toContain('payUrl: `/academy/bookings/${encodeURIComponent(bookingId)}/pay`');
  });

  it('there is a page for it, and the screen says so', () => {
    expect(read('client/src/App.tsx')).toContain('<Route path="/academy/bookings/:bookingId/pay">');
    const page = read('client/src/pages/academy/PayAcademy.tsx');
    expect(page).toContain('/api/academy/bookings/${encodeURIComponent(bookingId)}/pay');
    expect(page).toContain('window.location.assign(body.paymentUrl)');
    const screen = read('client/src/pages/academy/BookingFlow.tsx');
    expect(screen).toContain('data-testid="academy-what-is-collected"');
    expect(screen).toContain('תשלום מאובטח');
    expect(screen).not.toContain('אינה נגבית באתר בשלב זה');
  });
});
