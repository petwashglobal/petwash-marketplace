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
 * MODERNITY SEV-1 #2 EXCEPTION (2026-08-20 audit — "Fix: 5 modernity SEV-1
 * wiring gaps"): booking-requests.ts also handles the SUMIT return path
 * (GET /:requestId/sumit-return). That handler is itself a confirmed+paid
 * transition and MUST create the calendar event, mirroring walk-my-pet.ts
 * and the Nayax webhook. The ban on createBookingEvent is therefore
 * relaxed to "anywhere OUTSIDE the sumit-return confirmed+paid branch";
 * a stray createBookingEvent in the accept handler or the cancel handler
 * still fails this guard.
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

// Modernity SEV-1 #2: isolate the sumit-return handler (the sole allowed
// createBookingEvent site inside booking-requests.ts).
function sliceSumitReturnHandler(src: string): string {
  const start = src.indexOf("router.get('/:requestId/sumit-return'");
  if (start < 0) throw new Error('sumit-return handler not found');
  const nextRoute = src.indexOf('router.', start + 1);
  return nextRoute > start ? src.slice(start, nextRoute) : src.slice(start);
}

const bookingRequestPaymentWebhook = sliceBookingRequestPaymentWebhook(webhookSrc);
const sumitReturnHandler = sliceSumitReturnHandler(bookingRequestsSrc);
const calendarCreateCall = /calendarIntegrationService\.createBookingEvent\s*\(/;

function calendarCreateCallIndex(src: string): number {
  return src.search(calendarCreateCall);
}

describe('PR-BOOKING-CALENDAR-A — calendar created only after payment truth', () => {
  it('booking-requests only creates a calendar event inside the sumit-return confirmed+paid branch', () => {
    // Modernity SEV-1 #2 exception: the sumit-return handler is the ONE
    // allowed site for createBookingEvent in booking-requests.ts. Anywhere
    // else (accept, cancel, misc mutations) remains banned. Enforce by
    // stripping the allowed handler and asserting the remainder is clean.
    const withoutAllowedHandler = bookingRequestsSrc.replace(sumitReturnHandler, '');
    expect(withoutAllowedHandler).not.toMatch(/createBookingEvent/);
    // The sumit-return handler itself must create the calendar event.
    expect(sumitReturnHandler).toMatch(calendarCreateCall);
    // And it must document the exception so future authors know it exists.
    expect(sumitReturnHandler).toMatch(/Modernity SEV-1 #2/);
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
