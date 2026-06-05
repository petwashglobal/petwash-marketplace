/**
 * PR-BOOKING-CALENDAR-A — calendar-timing source guard.
 *
 * Calendar events for marketplace booking-requests must be created ONLY after
 * payment is confirmed (nayax-webhooks.ts → payment.success → status
 * 'confirmed'), never on provider accept. This pins:
 *   1. the accept handler no longer creates a calendar event
 *   2. the payment webhook creates it, after the 'confirmed' write
 *   3. the creation stays non-blocking (setImmediate)
 *
 * Source-regex guard (matches the repo's existing *.regression.test.ts style)
 * so it runs without booting Express, Nayax, or Google Calendar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const bookingRequestsSrc = fs.readFileSync(path.join(ROOT, 'routes/booking-requests.ts'), 'utf8');
const webhookSrc = fs.readFileSync(path.join(ROOT, 'routes/nayax-webhooks.ts'), 'utf8');

function sliceBookingRequestPaymentWebhook(src: string): string {
  const start = src.indexOf("'/nayax/booking-request-payment'");
  if (start < 0) throw new Error('booking-request-payment webhook route not found');

  const nextRoute = src.indexOf('router.', start + 1);
  return nextRoute > start ? src.slice(start, nextRoute) : src.slice(start);
}

const bookingRequestPaymentWebhook = sliceBookingRequestPaymentWebhook(webhookSrc);
const calendarCreateCall = /calendarIntegrationService\.createBookingEvent\s*\(/;

function calendarCreateCallIndex(src: string): number {
  return src.search(calendarCreateCall);
}

describe('PR-BOOKING-CALENDAR-A — calendar created only after payment truth', () => {
  it('booking-requests accept handler no longer creates a calendar event', () => {
    expect(bookingRequestsSrc).not.toMatch(/createBookingEvent/);
  });

  it('booking-requests still deletes the calendar event on cancel (cleanup preserved)', () => {
    expect(bookingRequestsSrc).toMatch(/deleteBookingEvent/);
  });

  it('payment webhook creates the calendar event on confirmation', () => {
    expect(bookingRequestPaymentWebhook).toMatch(calendarCreateCall);
  });

  it('booking-request-payment calendar creation happens after the confirmed DB write', () => {
    const confirmedWriteIdx = bookingRequestPaymentWebhook.indexOf("status: 'confirmed'");
    const paymentTxIdx = bookingRequestPaymentWebhook.indexOf('paymentTransactionId: payload.transactionId');
    const calendarIdx = calendarCreateCallIndex(bookingRequestPaymentWebhook);
    expect(confirmedWriteIdx).toBeGreaterThan(-1);
    expect(paymentTxIdx).toBeGreaterThan(confirmedWriteIdx);
    expect(calendarIdx).toBeGreaterThan(-1);
    expect(calendarIdx).toBeGreaterThan(paymentTxIdx);
  });

  it('calendar creation is non-blocking (wrapped in setImmediate)', () => {
    // The createBookingEvent call must sit inside a setImmediate block so a
    // slow/failed calendar call never delays or rolls back payment confirmation.
    const afterConfirm = bookingRequestPaymentWebhook.slice(
      bookingRequestPaymentWebhook.indexOf("status: 'confirmed'"),
    );
    const calendarSegment = afterConfirm.slice(0, calendarCreateCallIndex(afterConfirm));
    expect(calendarSegment).toMatch(/setImmediate\(/);
  });
});
