/**
 * What the 2026-09-19 sample run (scripts/admin/send-sample-emails.ts) showed
 * customers were actually receiving, pinned so it cannot come back:
 *   • the shop confirmation printed the estimated delivery as a raw ISO string
 *   • the booking confirmation printed a three-night stay as "(4320 min)"
 *   • the booking template's own header says NO PURPLE, and pet_sitting was purple
 *   • every template's logo is one hosted URL — that file must exist in client/public
 * Plus: every sample the script renders builds, in both languages, without a
 * database, and carries the [SAMPLE] marker so it can never pass for a receipt.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatEstimatedDelivery, shopOrderConfirmation } from '../email/templates/shop-order-confirmation-2026';
import { formatDuration, buildBookingConfirmationEmail } from '../email/templates/booking-confirmation-2026';
import { PETWASH_LOGO_BASE64 } from '../email/templates/logo-base64';

const ROOT = resolve(__dirname, '..', '..');

describe('shop order confirmation — estimated delivery is a date, not a timestamp', () => {
  it('formats an ISO string in Israel time, in the customer language', () => {
    const he = formatEstimatedDelivery('2026-09-22T07:29:30.816Z', true);
    const en = formatEstimatedDelivery('2026-09-22T07:29:30.816Z', false);
    expect(he).not.toContain('T07:29');
    expect(en).not.toContain('T07:29');
    expect(en).toMatch(/22 September/);
    expect(he).toMatch(/22 בספטמבר/);
  });
  it('leaves a non-date string alone and an empty one empty', () => {
    expect(formatEstimatedDelivery('3-5 business days', false)).toBe('3-5 business days');
    expect(formatEstimatedDelivery(undefined, false)).toBe('');
  });
  it('the rendered email never contains an ISO timestamp', () => {
    const html = shopOrderConfirmation({
      orderId: 'T-1', customerName: 'A', customerEmail: 'a@example.invalid',
      items: [{ name_he: 'x', quantity: 1, unit_price_cents: 100, line_total_cents: 100 }],
      subtotalCents: 100, discountCents: 0, deliveryCents: 0, giftWrapCents: 0, netCents: 85, vatCents: 15, totalCents: 100,
      paymentMethod: 'card', deliveryMethod: 'post', estimatedDelivery: '2026-09-22T07:29:30.816Z',
      deliveryAddress: null, language: 'he', orderDate: '2026-09-19T07:00:00.000Z',
    });
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });
});

describe('booking confirmation — duration and brand colour', () => {
  it('reads minutes, hours and days as a person would', () => {
    expect(formatDuration(45, false)).toBe('45 min');
    expect(formatDuration(60, false)).toBe('1 h');
    expect(formatDuration(90, false)).toBe('1 h 30 min');
    expect(formatDuration(4320, false)).toBe('3 days');
    expect(formatDuration(1500, false)).toBe('1 day 1 h');
    expect(formatDuration(4320, true)).toBe('3 ימים');
    expect(formatDuration(30, true)).toBe('30 דק׳');
  });
  it('no service band is purple (the template header says NO PURPLE)', () => {
    const src = readFileSync(resolve(ROOT, 'server/email/templates/booking-confirmation-2026.ts'), 'utf8');
    const block = src.slice(src.indexOf('const SERVICE_COLORS'), src.indexOf('};', src.indexOf('const SERVICE_COLORS')));
    const colours = [...block.matchAll(/#([0-9a-f]{6})/gi)].map((m) => m[1].toLowerCase());
    expect(colours.length).toBeGreaterThan(0);
    for (const hex of colours) {
      const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
      // Purple: red and blue both clearly above green.
      expect(r > g + 40 && b > g + 40, `#${hex} is purple`).toBe(false);
    }
  });
  it('a three-night stay renders as days in the email', () => {
    const html = buildBookingConfirmationEmail({
      recipientType: 'customer', language: 'en', bookingRef: 'T-2', customerName: 'A', serviceName: 'pet_sitting',
      serviceLabel: 'Overnight', petName: 'Luna', dateFormatted: 'Monday', timeFormatted: '10:00',
      locationName: 'Home', durationMinutes: 4320, priceFormatted: '₪540.00', dashboardUrl: 'https://petwash.co.il/x',
    });
    expect(html).toContain('(3 days)');
    expect(html).not.toContain('4320 min');
  });
});

describe('the email logo is a hosted file that exists', () => {
  it('points at https://petwash.co.il/… and the file is in client/public', () => {
    expect(PETWASH_LOGO_BASE64.startsWith('https://petwash.co.il/')).toBe(true);
    const rel = PETWASH_LOGO_BASE64.replace('https://petwash.co.il/', '');
    expect(existsSync(resolve(ROOT, 'client/public', rel)), `${rel} missing from client/public`).toBe(true);
  });
});

describe('the sample script renders every email in both languages without a database', () => {
  it('nine samples, each marked [SAMPLE], each a full HTML document', async () => {
    const mod = await import('../../scripts/admin/send-sample-emails');
    for (const locale of ['he', 'en'] as const) {
      const samples = await mod.buildSamples(locale, 'sample@example.invalid');
      expect(samples.length).toBe(9);
      for (const s of samples) {
        expect(s.subject.startsWith('[SAMPLE] ')).toBe(true);
        expect(s.html.length).toBeGreaterThan(1000);
        expect(s.html).toMatch(/<html|<!DOCTYPE/i);
      }
    }
  });
});
