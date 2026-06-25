/**
 * eGift → SUMIT re-route (CEO-locked rail rule: Nayax = physical card at machine
 * ONLY; everything online via SUMIT/UPay). This moves eGift purchase off the
 * Nayax two-phase flow onto the SUMIT begin→webhook→activate path, and fulfils
 * the recipient-bound voucher via GiftOrchestrationService. Source-introspection
 * (DB/payment-runtime-bound), per repo convention.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const sumit = readFileSync(resolve(ROOT, 'server/routes/payments-sumit.ts'), 'utf8');
const activation = readFileSync(resolve(ROOT, 'server/services/PurchaseActivationService.ts'), 'utf8');

describe('eGift → SUMIT re-route', () => {
  it('SUMIT catalog offers the 4 eGift tiers with server-owned prices (no client amount)', () => {
    expect(sumit).toMatch(/EGIFT_100:\s*\{[^}]*amountCents: 10000[^}]*productType: 'EGIFT'/);
    expect(sumit).toMatch(/EGIFT_250:\s*\{[^}]*amountCents: 25000/);
    expect(sumit).toMatch(/EGIFT_500:\s*\{[^}]*amountCents: 50000/);
    expect(sumit).toMatch(/EGIFT_1000:\s*\{[^}]*amountCents: 100000/);
    expect(sumit).toMatch(/'EGIFT_100', 'EGIFT_250', 'EGIFT_500', 'EGIFT_1000'/); // begin sku enum
    expect(sumit).toMatch(/surface: 'egift'/);
  });

  it('activation treats EGIFT as owned + fulfils the recipient voucher (never credits the buyer)', () => {
    expect(activation).toMatch(/'ACCOUNT_CREDIT', 'WASH_PACKAGE', 'SINGLE_WASH', 'EGIFT'/); // OWNED
    expect(activation).toMatch(/case 'EGIFT': \{/);
    expect(activation).toMatch(/new GiftOrchestrationService\(\)\.createMultiServiceGiftCard\(/);
    expect(activation).toMatch(/if \(!recipientEmail\) return false/); // no recipient → pending, don't lose value
  });

  it('eGift is redeemable at K9000 + all platforms by default', () => {
    expect(activation).toMatch(/\['all'\]/);
  });
});
