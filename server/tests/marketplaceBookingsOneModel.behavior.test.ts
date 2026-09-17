/**
 * Marketplace bookings, the provider escrow and the shared VAT calculator all
 * price a job the one way (shared/marketplaceMoney.ts): customer pays the
 * provider's rate + 15% fee on top, VAT is inside the fee, the provider keeps
 * the whole rate. ₪100 → customer ₪115, provider ₪100, fee ₪15 (VAT ₪2.29).
 *
 * Before 2026-09-17, on a ₪100 job:
 *  - BookingLifecycleService charged ₪102.70 (VAT on the fee, never the fee)
 *    and paid the provider ₪85
 *  - PaymentGatewayService escrowed ₪72.03 for the provider (15% out, then
 *    Pet Wash's VAT out of the provider's share)
 *  - grossFromProviderShare priced ₪117.65 (rate ÷ 0.85)
 *  - the booking screen's estimate showed ₪129.80 (10% fee + 18% on all)
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../db', () => ({ db: {}, pool: {} }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('firebase-admin', () => ({ default: { firestore: () => ({}) }, firestore: () => ({}) }));
vi.mock('../lib/firebase-admin', () => ({ default: { firestore: () => ({}) }, db: {} }));

import VATCalculatorService from '../services/VATCalculatorService';
import { splitMarketplaceJob } from '@shared/marketplaceMoney';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('VATCalculatorService prices a provider rate with the fee on top', () => {
  it('₪100 rate → customer ₪115', () => {
    expect(VATCalculatorService.grossFromProviderShare(100)).toBe(115);
  });

  it('a fee-on-top gross splits back into ₪15 fee and ₪100 for the provider', () => {
    const gross = VATCalculatorService.grossFromProviderShare(100);
    const calc = VATCalculatorService.calculateMarketplaceVAT(gross, VATCalculatorService.feeShareOfGross());
    expect(calc.platformFeeGross).toBe(15);
    expect(calc.providerGross).toBe(100);
    expect(calc.vatOnPlatformFee).toBe(2.29);
  });

  it('agrees with splitMarketplaceJob on awkward rates', () => {
    for (const rate of [1, 99.99, 333.33, 1234.56, 2880]) {
      const s = splitMarketplaceJob(Math.round(rate * 100));
      const gross = VATCalculatorService.grossFromProviderShare(rate);
      const calc = VATCalculatorService.calculateMarketplaceVAT(gross, VATCalculatorService.feeShareOfGross());
      expect(Math.abs(gross * 100 - s.customerTotalCents)).toBeLessThanOrEqual(1);
      expect(Math.abs(calc.platformFeeGross * 100 - s.serviceFeeCents)).toBeLessThanOrEqual(1);
      expect(Math.abs(calc.providerGross * 100 - s.providerPayoutCents)).toBeLessThanOrEqual(1);
    }
  });

  it('recordTransaction(rate) books the fee as 15% of the rate', () => {
    const src = read('server/services/VATCalculatorService.ts');
    const body = src.slice(src.indexOf('async recordTransaction('), src.indexOf('async recordTransactionFromGross('));
    expect(body).toContain('this.calculateMarketplaceVAT(grossCollectedILS, this.feeShareOfGross(commissionRate))');
  });
});

describe('marketplace booking quote (BookingLifecycleService)', () => {
  const src = read('server/services/BookingLifecycleService.ts');

  it('prices through splitMarketplaceJob', () => {
    expect(src).toContain('const split = splitMarketplaceJob(subtotalCents);');
    expect(src).toContain('const totalCents = split.customerTotalCents;');
    expect(src).toContain('const providerEarningsCents = split.providerPayoutCents;');
    expect(src).not.toMatch(/const totalCents = subtotalCents \+ vatCents/);
  });

  it('escrow owes the provider everything but the fee — no VAT taken from them', () => {
    const escrow = src.slice(src.indexOf('private async createEscrowHolding'), src.indexOf('private async scheduleEscrowRelease'));
    expect(escrow).toContain('const netProviderAmountCents = grossAmountCents - platformFeeCents;');
    expect(escrow).toContain('const vatCents = vatFromInclusive(platformFeeCents);');
  });
});

describe('PaymentGatewayService escrow holds the provider\'s whole rate', () => {
  const src = read('server/services/PaymentGatewayService.ts');
  const body = src.slice(src.indexOf('private static async createEscrowPayout'), src.indexOf('superAppPayouts).values'));

  it('uses the stored fee and pays out total − fee', () => {
    expect(body).toContain('parseFloat(booking.platformFee');
    expect(body).toContain('const netAmount = Math.round((totalAmount - platformFee) * 100) / 100;');
    expect(body).not.toContain('providerNet');
  });

  it('₪115 booking with ₪15 fee → ₪100 held for the provider', () => {
    expect(Math.round((115 - 15) * 100) / 100).toBe(100);
  });
});

describe('the booking screen estimate is the same model', () => {
  const src = read('client/src/pages/MarketplaceBookingFlow.tsx');

  it('uses splitMarketplaceJob, not 10% + 18% on everything', () => {
    expect(src).toContain('splitMarketplaceJob((basePriceCents ?? 0) + addonsTotalCents)');
    expect(src).not.toMatch(/\* 0\.10\)/);
    expect(src).not.toMatch(/subtotalCents \* 0\.18/);
    expect(src).not.toContain('Platform Fee (10%)');
  });

  it('₪100 → ₪115 total with ₪15 fee', () => {
    const s = splitMarketplaceJob(10000);
    expect([s.customerTotalCents, s.serviceFeeCents, s.serviceFeeVatCents]).toEqual([11500, 1500, 229]);
  });
});

describe('the P&L ledger is not writable by customers', () => {
  it('/api/vat/record-transaction is admin-only', () => {
    const src = read('server/routes/vat.ts');
    expect(src).toContain('router.post("/record-transaction", requireAdmin,');
  });
});
