import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { bookingRequestFiscalKind, bookingRequestIsPaid } from '../services/fiscalPassport/composer';

/**
 * 2026-09-17: BOOKING_CARD_RAIL=sumit made booking_requests the flow a
 * customer actually pays by card, and the new payment letter links to
 * /account/transactions — which listed shop, K9000, eGift, wallet and the
 * legacy sitter/walk/academy tables, but NOT booking_requests. A customer
 * who just paid would find their booking missing.
 */
const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('booking_requests fiscal kind', () => {
  it('maps each service to its platform, event and line item', () => {
    expect(bookingRequestFiscalKind('dog_walking')).toMatchObject({ platform: 'WALK_MY_PET', event: 'WALK_BOOKING_PAID', itemCode: 'WALK_60_MIN' });
    expect(bookingRequestFiscalKind('walking')).toMatchObject({ platform: 'WALK_MY_PET' });
    expect(bookingRequestFiscalKind('pet_sitting')).toMatchObject({ platform: 'SITTER_SUITE', event: 'SITTER_BOOKING_PAID' });
    expect(bookingRequestFiscalKind('training')).toMatchObject({ platform: 'ACADEMY', event: 'ACADEMY_BOOKING_PAID' });
    expect(bookingRequestFiscalKind('grooming')).toMatchObject({ platform: 'SITTER_SUITE' });
    expect(bookingRequestFiscalKind(null)).toMatchObject({ platform: 'WALK_MY_PET' });
  });
});

describe('paid means the money is actually held', () => {
  it('confirmed / in progress / completed, or a held payment with a transaction id', () => {
    expect(bookingRequestIsPaid({ status: 'confirmed' })).toBe(true);
    expect(bookingRequestIsPaid({ status: 'in_progress' })).toBe(true);
    expect(bookingRequestIsPaid({ status: 'completed' })).toBe(true);
    expect(bookingRequestIsPaid({ status: 'payment_pending', paymentHeldAt: new Date(), paymentTransactionId: '123' })).toBe(true);
  });
  it('not for pending, accepted-unpaid, or a stamp without a transaction', () => {
    expect(bookingRequestIsPaid({ status: 'pending' })).toBe(false);
    expect(bookingRequestIsPaid({ status: 'accepted' })).toBe(false);
    expect(bookingRequestIsPaid({ status: 'payment_pending', paymentHeldAt: new Date(), paymentTransactionId: null })).toBe(false);
    expect(bookingRequestIsPaid({})).toBe(false);
  });
});

describe('wiring', () => {
  it('the customer list queries booking_requests by owner', () => {
    const src = R('server/services/fiscalPassport/customerLister.ts');
    expect(src).toContain('.from(bookingRequests)');
    expect(src).toContain('eq(bookingRequests.ownerId, input.customerUid)');
    expect(src).toContain("source: 'booking_requests',");
    expect(src).toContain("| 'booking_requests';");
  });
  it('the detail view accepts the source, so a row is not a dead link', () => {
    expect(R('server/routes/fiscal-passport.ts')).toContain("'booking_requests',");
    const comp = R('server/services/fiscalPassport/composer.ts');
    expect(comp).toContain("case 'booking_requests':");
    expect(comp).toContain('async function composeBookingRequestFiscal(');
  });
  it('gross model: the provider is owed the subtotal, and only owner/provider/staff may look', () => {
    const comp = R('server/services/fiscalPassport/composer.ts');
    const fn = comp.slice(comp.indexOf('async function composeBookingRequestFiscal('), comp.indexOf('// ─── Booking-fiscal shared builder'));
    expect(fn).toContain('const providerExpected = Number(b.subtotalCents ?? 0)');
    expect(fn).toContain('if (!isOwner && !isProvider && !isStaff) return null;');
    expect(fn).toContain("sourceType: 'booking_requests',");
  });
});
