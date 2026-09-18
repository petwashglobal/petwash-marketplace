/**
 * Academy used to have no card rail: the wallet part was debited on
 * trainer-confirm and the rest was never collected (paymentStatus 'pending'),
 * while the screen said "you will be charged once the trainer approves" —
 * ₪345 shown, ₪100 taken, ₪245 never charged.
 *
 * The rail landed 2026-09-18: the screen now says the wallet part is taken on
 * confirm and the balance is paid by card on a secure page.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const screen = read('client/src/pages/academy/BookingFlow.tsx');

describe('the academy screen says what is actually collected', () => {
  it('states what the wallet covers and that the rest is paid by card', () => {
    expect(screen).toContain('data-testid="academy-what-is-collected"');
    expect(screen).toContain('תשלום מאובטח');
    expect(screen).not.toContain('אינה נגבית באתר בשלב זה');
  });

  it('no longer promises a charge after the trainer approves', () => {
    expect(screen).not.toContain('חיוב יבוצע רק לאחר שהמאמן/ת יאשר/תאשר את הפגישה');
    expect(screen).not.toContain('הסכום ייושמר מהארנק שלך עם אישור המאמן/ת, ויחויב לאחר סיום השיעור');
  });
});

describe('the server backs the wording', () => {
  const src = read('server/routes/academy.ts');

  it('confirm takes the wallet part and reports the balance with a pay link', () => {
    expect(src).toContain("paymentStatus: walletFunded ? 'completed' : 'pending'");
    expect(src).toContain('amountCents: booking.walletHoldCents,');
    expect(src).toContain('amountDueCents: outstandingCents');
    expect(src).toContain('payUrl: `/academy/bookings/${encodeURIComponent(bookingId)}/pay`');
  });

  it('the balance is payable by card, and only a verified payment marks it paid', () => {
    expect(src).toContain("router.post('/bookings/:bookingId/pay'");
    expect(src).toContain("router.get('/bookings/:bookingId/sumit-return'");
    expect(src.indexOf('verifyServiceCardPayment')).toBeLessThan(src.indexOf("paymentStatus: 'completed',"));
  });
});
