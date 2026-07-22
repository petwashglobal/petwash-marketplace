/**
 * Canonical checkout rail (CEO 2026-07-22 mockup #3) — end-to-end wire pins.
 *
 * What shipped: /checkout page rendering ONLY server-owned catalog prices,
 * card rail live via SUMIT hosted page, bit/PayBox/ApplePay as honest
 * coming-soon tiles, server-validated coupons (kiosk wash SKUs only, redeemed
 * only on verified payment), and the flagship eGift page finally plugged into
 * the real EGIFT_* SKU rail instead of the sealed legacy endpoint.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const paymentsSumit = readFileSync(resolve(ROOT, 'server/routes/payments-sumit.ts'), 'utf8');
const activation = readFileSync(resolve(ROOT, 'server/services/PurchaseActivationService.ts'), 'utf8');
const checkoutPage = readFileSync(resolve(ROOT, 'client/src/pages/CheckoutCanon.tsx'), 'utf8');
const app = readFileSync(resolve(ROOT, 'client/src/App.tsx'), 'utf8');
const egift = readFileSync(resolve(ROOT, 'client/src/pages/EGift.tsx'), 'utf8');
const helper = readFileSync(resolve(ROOT, 'client/src/lib/sumitCheckout.ts'), 'utf8');
const adminSumit = readFileSync(resolve(ROOT, 'client/src/pages/AdminSumitControl.tsx'), 'utf8');

describe('server-owned catalog endpoint', () => {
  it('GET /catalog exists and serves the Phase-1 price list', () => {
    expect(paymentsSumit).toMatch(/router\.get\('\/catalog'/);
    expect(paymentsSumit).toMatch(/vatIncluded: true/);
  });
});

describe('coupons on /begin — server-validated, fail-closed, kiosk-only', () => {
  it('accepts couponCode in the schema', () => {
    expect(paymentsSumit).toMatch(/couponCode: z\.string\(\)/);
  });

  it('maps ONLY kiosk wash SKUs to coupon order types (no eGift / no top-up value arbitrage)', () => {
    const mapBlock = paymentsSumit.slice(
      paymentsSumit.indexOf('const COUPON_ORDER_TYPE'),
      paymentsSumit.indexOf('};', paymentsSumit.indexOf('const COUPON_ORDER_TYPE')),
    );
    expect(mapBlock).toContain('SINGLE_WASH');
    expect(mapBlock).toContain('WASH_PACKAGE_10');
    expect(mapBlock).not.toContain('EGIFT');
    expect(mapBlock).not.toContain('ACCOUNT_CREDIT');
  });

  it('rejects an invalid coupon BEFORE creating the hosted payment (never silent full charge)', () => {
    const rejectAt = paymentsSumit.indexOf("error: 'coupon_invalid'");
    const redirectAt = paymentsSumit.indexOf('sumitClient.beginRedirect');
    expect(rejectAt).toBeGreaterThan(-1);
    expect(redirectAt).toBeGreaterThan(rejectAt);
  });

  it('keeps a ₪1 floor so SUMIT is never asked to charge zero', () => {
    expect(paymentsSumit).toMatch(/COUPON_DISCOUNT_TOO_LARGE/);
  });
});

describe('coupon redemption records only on VERIFIED payment', () => {
  it('redeemAtomic runs after the paid-claim lock and before product activation', () => {
    const paidAudit = activation.indexOf("'sumit.payment_paid'");
    const redeem = activation.indexOf('redeemAtomic');
    const activate = activation.indexOf('activated = await activateProduct');
    expect(paidAudit).toBeGreaterThan(-1);
    expect(redeem).toBeGreaterThan(paidAudit);
    expect(activate).toBeGreaterThan(redeem);
  });

  it('is idempotent per purchase and fail-soft (a bookkeeping error never blocks activation)', () => {
    expect(activation).toMatch(/idempotencyKey: `sumit-coupon-\$\{purchase\.id\}`/);
    expect(activation).toMatch(/coupon redemption record failed \(activation continues\)/);
  });
});

describe('the /checkout page — canonical, server-priced, honest methods', () => {
  it('is routed in App.tsx', () => {
    expect(app).toMatch(/path="\/checkout"/);
    expect(app).toMatch(/CheckoutCanon/);
  });

  it('renders prices from the server catalog and holds no catalog price constants', () => {
    expect(checkoutPage).toMatch(/\/api\/payments\/sumit\/catalog/);
    // The Phase-1 catalog amounts (agorot) must not be hardcoded client-side.
    for (const cents of ['15000', '22000', '40000', '10000', '25000', '50000', '100000']) {
      expect(checkoutPage).not.toContain(cents);
    }
  });

  it('card rail is live; bit / PayBox / Apple Pay are visible but honestly disabled', () => {
    // Tiles get data-testid="checkout-method-<id>" from the methods array.
    expect(checkoutPage).toMatch(/data-testid=\{`checkout-method-\$\{m\.id\}`\}/);
    expect(checkoutPage).toMatch(/id: 'card'[\s\S]*?live: true/);
    for (const m of ['applepay', 'bit', 'paybox']) {
      expect(checkoutPage).toContain(`id: '${m}'`);
    }
    expect(checkoutPage).toMatch(/live: false/);
  });

  it('shows the 18% VAT line derived from the VAT-inclusive total', () => {
    expect(checkoutPage).toMatch(/totalCents \/ 1\.18/);
  });

  it('sends only the coupon CODE to /begin (never a client amount)', () => {
    expect(checkoutPage).toMatch(/couponCode: coupon\.code/);
    expect(checkoutPage).not.toMatch(/amountIls/);
  });
});

describe('eGift is on the real rail', () => {
  it('no longer calls the sealed legacy endpoint', () => {
    expect(egift).not.toContain('/api/multi-service-gift');
  });

  it('tier purchases start a SKU checkout with the gift metadata', () => {
    expect(egift).toMatch(/startSkuCheckout/);
    expect(egift).toMatch(/EGIFT_100/);
    expect(egift).toMatch(/EGIFT_1000/);
    expect(egift).toMatch(/recipientName: formData\.recipientName/);
  });
});

describe('legacy raw-amount helper is gone', () => {
  it('sumitCheckout exposes startSkuCheckout and no raw-amount begin call', () => {
    expect(helper).toMatch(/export async function startSkuCheckout/);
    // The old helper posted a client-side amount, which /begin's SKU-only
    // schema always rejected — a dead wire that must not return.
    expect(helper).not.toMatch(/startSumitCheckout/);
  });

  it('the admin ₪1 rail test uses the wallet-topup SKU path', () => {
    expect(adminSumit).toMatch(/startWalletTopUpCheckout\(\{ amountIls: 1 \}\)/);
  });
});
