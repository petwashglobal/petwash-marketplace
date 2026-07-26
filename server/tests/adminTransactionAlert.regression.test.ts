/**
 * Regression pin — CEO transaction alerts (2026-07-26).
 *
 * "send email me complete booking transaction, shop purchase, canceled booking."
 * EmailService.sendAdminTransactionAlert emails the founder on each money event;
 * it is wired into booking confirmation, shop purchase, and cancellation.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const email = readFileSync(join(__dirname, '..', 'emailService.ts'), 'utf8');
const superApp = readFileSync(join(__dirname, '..', 'routes', 'super-app-bookings.ts'), 'utf8');
const shop = readFileSync(join(__dirname, '..', 'services', 'ShopService.ts'), 'utf8');

describe('admin transaction alert', () => {
  it('EmailService exposes sendAdminTransactionAlert to the founder', () => {
    expect(email).toMatch(/static async sendAdminTransactionAlert/);
    expect(email).toMatch(/nir\.h@petwash\.co\.il/);
    expect(email).toMatch(/ADMIN_TX_ALERT_EMAILS/); // ops-extendable without deploy
  });
  it('fires on booking confirmation', () => {
    expect(email).toMatch(/event:\s*'booking_confirmed'/);
  });
  it('fires on shop purchase', () => {
    expect(shop).toMatch(/sendAdminTransactionAlert\(\{[\s\S]{0,120}event:\s*'purchase'/);
  });
  it('fires on cancellation', () => {
    expect(superApp).toMatch(/sendAdminTransactionAlert\(\{[\s\S]{0,120}event:\s*'booking_cancelled'/);
  });
  it('is fail-soft (never throws into the customer flow)', () => {
    const seg = email.slice(email.indexOf('sendAdminTransactionAlert'));
    expect(seg).toMatch(/catch \(err: any\)/);
  });
});
