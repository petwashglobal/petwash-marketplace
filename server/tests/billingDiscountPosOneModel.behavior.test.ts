/**
 * One money model (shared/marketplaceMoney.ts) in the billing engine, the
 * provider receipt, the discount-ownership tool and every provider-facing
 * "what you earn" line: fee 15% of the rate ON TOP, provider keeps the rate.
 * Plus: /api/pricing/admin/* had no admin check at all (2026-09-17).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rules: any[] = [];
vi.mock('../db', () => ({ pool: { query: async () => ({ rows: rules }) }, db: {} }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { discountOwnershipService } from '../services/DiscountOwnershipService';
import { buildProviderTxReceipt } from '../email/templates/transaction-receipt-2026';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const compute = (absorb: { absorb_by: string; platform_pct: number; provider_pct: number }) => {
  rules.length = 0; rules.push(absorb);
  return discountOwnershipService.computeProviderPayout({
    grossBookingCents: 10000, couponDiscountCents: 2000, couponId: 1, orderType: 'sitter' as any, commissionRate: 0.15,
  });
};

describe('discount ownership — who pays for a coupon', () => {
  it('platform absorbs → provider still gets the full ₪100', async () => {
    const r = await compute({ absorb_by: 'platform', platform_pct: 100, provider_pct: 0 });
    expect(r.providerPayoutCents).toBe(10000);
    expect(r.commissionCents).toBe(1500);
  });

  it('provider absorbs → provider gets ₪80, fee 15% of that', async () => {
    const r = await compute({ absorb_by: 'provider', platform_pct: 0, provider_pct: 100 });
    expect(r.providerPayoutCents).toBe(8000);
    expect(r.commissionCents).toBe(1200);
  });

  it('50/50 → provider gives up only their half', async () => {
    const r = await compute({ absorb_by: 'split', platform_pct: 50, provider_pct: 50 });
    expect(r.providerPayoutCents).toBe(9000);
  });
});

describe('BillingEngine platform fee', () => {
  const src = read('server/services/BillingEngine.ts');
  const fn = src.slice(src.indexOf('function calcPlatformFee'), src.indexOf('export const BillingEngine'));
  // Evaluate the real function body in isolation.
  const calc = new Function('ISRAELI_VAT_RATE', `${fn.replace(/: \{[\s\S]*?\} \{/, ' {').replace(/\(grossAgorot: number, feeRate: number\)/, '(grossAgorot, feeRate)')}; return calcPlatformFee;`)(0.18);

  it('₪115 charged → fee ₪15 (₪12.71 net + ₪2.29 VAT), provider ₪100', () => {
    expect(calc(11500, 0.15)).toEqual({ platformFeeAgorot: 1271, platformFeeVatAgorot: 229, providerPayoutAgorot: 10000 });
  });

  it('always adds back up to the charge', () => {
    for (const g of [1, 115, 9999, 123456]) {
      const r = calc(g, 0.15);
      expect(r.platformFeeAgorot + r.platformFeeVatAgorot + r.providerPayoutAgorot).toBe(g);
    }
  });
});

describe('provider transaction receipt', () => {
  it('₪115 charge shows fee ₪15 and payout ₪100', () => {
    const html = buildProviderTxReceipt({
      invoiceNo: 'I', txId: 'T', date: new Date('2026-09-17'), serviceDate: new Date('2026-09-17'),
      serviceType: 'petsitter', serviceDescHe: 'ש', serviceDescEn: 'S', providerName: 'P', petName: 'K',
      customerName: 'C', customerEmail: 'c@petwash.co.il', grossChargedIls: 115, platformFeeRate: 0.15,
      paymentLast4: '0000', paymentBrand: 'Visa',
    });
    expect(html).toMatch(/15\.00/);
    expect(html).toMatch(/100\.00/);
    expect(html).not.toMatch(/17\.25/);
    expect(html).not.toMatch(/97\.75/);
  });
});

describe('/api/pricing/admin/* is admin-only', () => {
  it('the router guards every /admin path before any handler', () => {
    const src = read('server/routes/pricing.ts');
    const guard = src.indexOf("router.use('/admin', requireAdmin");
    expect(guard).toBeGreaterThan(0);
    const firstAdminRoute = src.search(/router\.(get|post|put|patch|delete)\('\/admin/);
    expect(guard).toBeLessThan(firstAdminRoute);
  });
});

describe('what providers are told they earn', () => {
  it('no screen or email says 85% / 82.3% / "deducted"', () => {
    for (const f of [
      'client/src/pages/provider-os/POSServices.tsx',
      'client/src/pages/provider-os/POSWallet.tsx',
      'server/email/templates/welcome-provider-signup-2026.ts',
    ]) {
      const s = read(f);
      expect(s, f).not.toMatch(/82\.3|0\.823|85% of the payment|commission \(15%\) deducted/);
    }
    const orch = read('server/services/PetWashOperationsOrchestrator.ts');
    expect(orch).not.toContain('You keep <strong style="color:#E7C978;">85%</strong>');
  });

  it('the wallet example is ₪100 price → client ₪115 → payout ₪100', () => {
    const s = read('client/src/pages/provider-os/POSWallet.tsx');
    expect(s).toContain("{ label: 'Client pays',                          value: '₪115.00'");
    expect(s).toContain("{ label: 'Your payout',                          value: '₪100.00'");
  });

  it('the unused "Walker Deduction (15%)" string is gone', () => {
    expect(read('client/src/lib/i18n.ts')).not.toContain("'emergency.walkerDeduction'");
  });
});
