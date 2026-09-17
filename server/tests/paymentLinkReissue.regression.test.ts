/**
 * A dead SUMIT link must not strand a booking — and a replacement must never
 * be handed out while SUMIT holds money for it (2026-09-17).
 *
 * SUMIT links expire (default 1h; we now ask for PAYMENT_LINK_TTL_HOURS). /pay
 * demanded paymentTransactionId IS NULL and status accepted/meet_greet_completed,
 * both of which change the moment the first link is issued, so the customer had
 * no way back: the booking sat in payment_pending for ever and /cancel refunded
 * ₪0 (paymentHeldAt was never set).
 *
 * Source-pinned: the ordering guarantees here are what make a second link safe.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');
const pay = (() => {
  const src = R('server/routes/booking-requests.ts');
  const i = src.indexOf("router.post('/:requestId/pay'");
  return src.slice(i, src.indexOf("router.", i + 50) > 0 ? src.indexOf('\n});', src.indexOf('res.json({\n      success: true,\n      status: \'payment_pending\'', i)) : undefined);
})();

describe('payment link expiry + replacement', () => {
  it('asks SUMIT for a link that outlives the checkout', () => {
    const svc = R('server/services/SumitBookingPayment.ts');
    expect(svc).toMatch(/export const PAYMENT_LINK_TTL_HOURS = \d+;/);
    expect(svc).toMatch(/expirationHours: PAYMENT_LINK_TTL_HOURS/);
    expect(R('server/services/SumitClient.ts')).toMatch(/ExpirationHours: input\.expirationHours/);
  });

  it('a replacement is only for a payment_pending booking whose link is already dead', () => {
    expect(pay).toMatch(/const isReissue =[\s\S]{0,260}booking\.status === 'payment_pending'/);
    expect(pay).toMatch(/previousSessionId\.startsWith\('bkg_'\)/);
    expect(pay).toMatch(/booking\.updatedAt < linkDeadAt/);
  });

  it('SUMIT is asked BEFORE a replacement link is opened, and an unclaimed payment blocks it', () => {
    expect(pay.indexOf('unclaimedPaymentsIn')).toBeGreaterThan(-1);
    expect(pay.indexOf('unclaimedPaymentsIn')).toBeLessThan(pay.indexOf('createSumitBookingSession'));
    expect(pay).toMatch(/suspects\.length > 0[\s\S]{0,1600}PAYMENT_MAY_HAVE_SUCCEEDED/);
    expect(pay).toMatch(/dedupeKey: `booking_pay_reissue_blocked:\$\{requestId\}:`/);
  });

  it('a SUMIT outage fails CLOSED — no second page', () => {
    expect(pay).toMatch(/catch \(lookupErr: any\)[\s\S]{0,400}PAYMENT_PROVIDER_UNAVAILABLE/);
    expect(pay.indexOf('PAYMENT_PROVIDER_UNAVAILABLE')).toBeLessThan(pay.indexOf('createSumitBookingSession'));
  });

  it('the slot claim still lets exactly one caller through, on either path', () => {
    expect(pay).toMatch(/isReissue\s*\?\s*and\(\s*\n?\s*eq\(bookingRequests\.paymentTransactionId, previousSessionId as string\)/);
    expect(pay).toMatch(/isNull\(bookingRequests\.paymentTransactionId\),\s*\n\s*inArray\(bookingRequests\.status, \['accepted', 'meet_greet_completed'\]\)/);
  });

  it('a replacement reuses the booking escrow row and restores the old id on rollback', () => {
    expect(pay).toMatch(/isReissue \? \(previousSessionId as string\) : sessionId/);
    expect(pay).toMatch(/paymentTransactionId: isReissue \? previousSessionId : null/);
  });

  it('unclaimedPaymentsIn throws (never returns empty) when SUMIT cannot be listed', () => {
    const cron = R('server/cron/sumit-unclaimed-payments.ts');
    const fn = cron.slice(cron.indexOf('export async function unclaimedPaymentsIn'), cron.indexOf('export async function runSumitUnclaimedPaymentWatch'));
    expect(fn).toMatch(/if \(!r\.ok\) throw new Error\(`sumit_list_failed/);
  });
});
