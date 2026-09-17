/**
 * The commission record and the provider's payout tax summary follow the one
 * money model (shared/marketplaceMoney.ts): the fee is 15% of the rate, paid by
 * the customer ON TOP; the provider keeps the whole rate.
 *
 * Before 2026-09-17:
 *  - calculateCommission took a caller-chosen rate (route default 20%) OUT of
 *    what the customer paid: ₪115 paid → provider ₪92, fee ₪23
 *  - any provider could call /calculate-commission for themselves, writing
 *    commission rows and burning sequential invoice numbers
 *  - calculatePayoutTaxObligations took another 15% off a payout that was
 *    already the provider's net: ₪100 → take-home ₪85
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const inserted: any[] = [];
vi.mock('../db', () => ({
  db: {
    insert: () => ({ values: async (v: any) => { inserted.push(v); } }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [], orderBy: async () => [] }) }) }),
  },
}));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../lib/invoiceSequence', () => ({ generateCommissionInvoiceNumber: vi.fn(async () => 'COMM-INV-1') }));
vi.mock('../lib/piiFieldCrypto', () => ({ encryptPII: (v: any) => v, maskPII: (v: any) => v }));

import { IsraeliContractorComplianceService as Svc } from '../services/IsraeliContractorCompliance';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

beforeEach(() => { inserted.length = 0; });

describe('commission on a booking', () => {
  it('₪115 paid → fee ₪15 (VAT ₪2.29 inside), provider ₪100', async () => {
    const c = await Svc.calculateCommission('p1', 'sitter', 1, 115);
    expect(c.commissionRate).toBe(15);
    expect(c.commissionAmount).toBe(15);
    expect(c.vatAmount).toBe(2.29);
    expect(c.providerEarnings).toBe(100);
    expect(inserted[0]).toMatchObject({ commissionRate: '15', commissionAmount: '15', providerEarnings: '100' });
  });

  it('a caller cannot choose the rate', async () => {
    const c = await (Svc.calculateCommission as any)('p1', 'sitter', 1, 115, 25);
    expect(c.commissionAmount).toBe(15);
    expect(c.providerEarnings).toBe(100);
  });

  it('always balances to what the customer paid', async () => {
    for (const paid of [1.15, 57.5, 333.33, 1150, 3312]) {
      const c = await Svc.calculateCommission('p1', 'walker', 1, paid);
      expect(Math.round((c.providerEarnings + c.commissionAmount) * 100)).toBe(Math.round(paid * 100));
    }
  });
});

describe('who may record a commission', () => {
  it('/calculate-commission is admin-only and has no rate input', () => {
    const src = read('routes/israeli-contractor-compliance.ts');
    const handler = src.slice(src.indexOf("router.post('/calculate-commission'"), src.indexOf("router.post('/calculate-independence'"));
    expect(handler).toContain('await verifyAdmin(req);');
    expect(handler).not.toContain('verifyProviderOwnership');
    expect(handler).not.toContain('commissionRate');
  });
});

describe('payout tax summary', () => {
  it('takes nothing more off the provider payout', async () => {
    const r = await Svc.calculatePayoutTaxObligations('p1', 100, { hasWithholdingExemption: true, exemptionPercentage: 100 } as any);
    expect(r.taxSummary.petwashCommission).toBe(0);
    expect(r.taxSummary.providerTakeHome).toBe(100 - r.taxSummary.remitToTaxAuthority);
    expect(r.taxSummary.totalDeductions).toBe(r.taxSummary.remitToTaxAuthority);
  });
});
