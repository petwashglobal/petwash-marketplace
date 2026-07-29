/**
 * Template sweep 2026-07-29 (follow-up to #1587–#1591): the refs and address
 * fields we already CAPTURE must actually RENDER.
 *
 *   1. shopOrderConfirmation accepts the RAW shop_delivery_addresses row
 *      (snake_case full_name / zip_code) — both live call sites pass it
 *      unmapped, and before this fix the email printed "undefined" for the
 *      customer name and dropped the ZIP + delivery notes.
 *   2. shopOrderConfirmation shows the payment reference when given one.
 *   3. buildServiceCompletedEmail renders bookingRef (was accepted, never shown).
 *   4. buildProviderTxReceipt + providerPayout render per-booking refs.
 *
 * Lesson #1590 applies: these are RENDER tests, not grep tests — each template
 * is executed so an out-of-scope variable throws here, not in production.
 */
import { describe, it, expect } from 'vitest';
import { shopOrderConfirmation } from '../email/templates/shop-order-confirmation-2026';
import { buildServiceCompletedEmail } from '../email/templates/service-completed-review-2026';
import { buildProviderTxReceipt } from '../email/templates/transaction-receipt-2026';
import { providerPayout } from '../email/templates/provider-payout-2026';

const baseShopOrder = {
  orderId: 'PW-1001',
  customerName: 'ניר',
  customerEmail: 'x@petwash.co.il',
  items: [{ name_he: 'שמפו', name_en: 'Shampoo', quantity: 1, unit_price_cents: 4900, line_total_cents: 4900 }],
  subtotalCents: 4900, discountCents: 0, deliveryCents: 1500, giftWrapCents: 0,
  netCents: 5424, vatCents: 976, totalCents: 6400,
  paymentMethod: 'wallet', deliveryMethod: 'courier',
  orderDate: new Date('2026-07-29T10:00:00Z').toISOString(),
} as any;

describe('shopOrderConfirmation — raw snake_case delivery row renders correctly', () => {
  const rawRow = {
    full_name: 'רונית הדד', phone: '0501234567',
    street: 'דיזנגוף 153', city: 'תל אביב', zip_code: '6343804',
    notes: 'קוד שער 1234',
  } as any;

  it('renders the customer name from full_name (no "undefined")', () => {
    const html = shopOrderConfirmation({ ...baseShopOrder, deliveryAddress: rawRow });
    expect(html).toContain('רונית הדד');
    expect(html).not.toContain('undefined');
  });

  it('renders ZIP from zip_code and the delivery notes', () => {
    const html = shopOrderConfirmation({ ...baseShopOrder, deliveryAddress: rawRow });
    expect(html).toContain('6343804');
    expect(html).toContain('קוד שער 1234');
  });

  it('still accepts the camelCase shape', () => {
    const html = shopOrderConfirmation({
      ...baseShopOrder,
      deliveryAddress: { fullName: 'דנה', street: 'הרצל', city: 'רעננה', zipCode: '4365304' } as any,
    });
    expect(html).toContain('דנה');
    expect(html).toContain('4365304');
    expect(html).not.toContain('undefined');
  });

  it('renders the payment reference when provided, omits the row when absent', () => {
    const withRef = shopOrderConfirmation({ ...baseShopOrder, paymentRef: 'TXN-20260729-1234' });
    expect(withRef).toContain('TXN-20260729-1234');
    expect(withRef).toContain('אסמכתא');
    const without = shopOrderConfirmation(baseShopOrder);
    expect(without).not.toContain('אסמכתא');
  });
});

describe('buildServiceCompletedEmail — bookingRef finally renders', () => {
  it('shows the booking ref in the summary', () => {
    const html = buildServiceCompletedEmail({
      language: 'he', bookingRef: 'BK-2026-000123', customerName: 'ניר הדד', firstName: 'ניר',
      providerName: 'מיכל', serviceLabel: 'טיול כלבים', serviceIcon: '🐶', petName: 'קנזו',
      dateFormatted: '29.07.2026', priceFormatted: '₪120',
      loyaltyPointsEarned: 12, loyaltyTotalPoints: 340, loyaltyTier: 'זהב',
      reviewUrl: 'https://petwash.co.il/r', bookAgainUrl: 'https://petwash.co.il/b',
      dashboardUrl: 'https://petwash.co.il/d',
    });
    expect(html).toContain('BK-2026-000123');
    expect(html).toContain('מספר הזמנה');
  });
});

describe('provider templates — per-booking refs', () => {
  it('buildProviderTxReceipt renders bookingRef when given', () => {
    const html = buildProviderTxReceipt({
      invoiceNo: 'PW-INV-1', txId: 'TXN-1', date: new Date('2026-07-29'), serviceDate: new Date('2026-07-29'),
      serviceType: 'petsitter', serviceDescHe: 'שמירה', serviceDescEn: 'Sitting',
      providerName: 'מיכל', petName: 'קנזו', customerName: 'ניר', customerEmail: 'x@petwash.co.il',
      grossChargedIls: 200, platformFeeRate: 0.15, paymentLast4: '4521', paymentBrand: 'Visa',
      bookingRef: 'BK-2026-000777',
    });
    expect(html).toContain('BK-2026-000777');
    expect(html).toContain('מספר הזמנה');
  });

  it('providerPayout renders a per-line bookingRef when given', () => {
    const html = providerPayout({
      providerName: 'מיכל', providerEmail: 'p@x.co.il', providerId: 'uid1', providerType: 'sitter',
      periodStart: '2026-07-20', periodEnd: '2026-07-26',
      bookings: [{ date: '2026-07-21', serviceType: 'שמירה', petName: 'קנזו', bookingRef: 'BK-2026-000555', grossCents: 20000, commissionCents: 3000, netCents: 17000, status: 'completed' }],
      totalGrossCents: 20000, totalCommissionCents: 3000, totalBonusCents: 0, totalDeductionsCents: 0,
      netPayoutCents: 17000, commissionRatePercent: 15, payoutMethod: 'bank',
    });
    expect(html).toContain('BK-2026-000555');
  });
});
