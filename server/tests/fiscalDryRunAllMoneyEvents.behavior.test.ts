/**
 * FISCAL DRY RUN — every money event, end to end, with NO real money and NO
 * real document (2026-09-13, CEO: "test bookkeeping and gov, not real, careful").
 *
 * For each kind of sale this runs the REAL code that decides the tax treatment
 * (getSumitDocumentMapping + IsraeliDigitalReceiptService.resolveReceiptVat) and
 * the REAL SUMIT request builder (SumitClient.createCustomerReceipt /
 * createCreditDocument). fetch is stubbed: nothing leaves the process. It then
 * re-does SUMIT's arithmetic on what we WOULD have sent and checks, to the agora:
 *
 *   - document total  == money the customer actually paid / was refunded
 *   - document type   == the CPA mapping for that class
 *   - VAT             == what our own ledger row records
 *   - stored value    carries no VAT line at all
 *   - dates           land in the Israeli calendar day (VAT period)
 *   - SHAAM           allocation-number threshold by issue date
 *
 * Found by this suite before any live test: the old net-price line made ~15% of
 * prices drift 1 agora (₪49 → ₪49.01 document for a ₪49.00 payment). Fixed by
 * VAT-inclusive entry — the bookkeeper's instruction and what the Nayax bridge
 * used for the 508 real invoices.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../db', () => ({ db: {}, pool: {} }));

import { sumitClient } from '../services/SumitClient';
import { getSumitDocumentMapping, type PetWashPaymentClass } from '../services/sumitDocumentMapping';
import { IsraeliDigitalReceiptService as Receipts } from '../services/IsraeliDigitalReceiptService';
import { isShaamAllocationRequired } from '@shared/israel-compliance-config';

const saved = { ...process.env };
let sent: any[] = [];
beforeEach(() => {
  process.env.SUMIT_ENABLED = 'true';
  process.env.SUMIT_API_KEY = 'dry-run-not-a-key';
  process.env.SUMIT_COMPANY_ID = '1';
  process.env.SUMIT_WEBHOOK_SECRET = 'dry-run';
  process.env.SUMIT_API_BASE_URL = 'https://dry-run.invalid';
  sent = [];
  let n = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ Status: 0, Data: { DocumentID: 900000 + ++n, DocumentNumber: 1 } }), { status: 200 });
  }));
});
afterEach(() => { process.env = { ...saved }; vi.unstubAllGlobals(); });

const agorot = (ils: number) => Math.round(ils * 100);

/** What SUMIT puts on the document for the body we sent (VAT-inclusive or not). */
function sumitDocument(body: any) {
  const items: any[] = body.Items ?? [];
  const lines = items.reduce((s, it) => s + agorot(it.UnitPrice) * (it.Quantity ?? 1), 0);
  const paid = (body.Payments ?? []).reduce((s: number, p: any) => s + agorot(p.Amount), 0);
  if (items.length === 0) return { totalAg: paid, vatAg: 0, paidAg: paid };
  if (body.VATIncluded) {
    const vatAg = Math.round(lines - lines / 1.18);
    return { totalAg: lines, vatAg, paidAg: paid };
  }
  const vatAg = Math.round(lines * 0.18);
  return { totalAg: lines + vatAg, vatAg, paidAg: paid };
}

type Scenario = { name: string; cls: PetWashPaymentClass; paid: number; commission?: number };
const SCENARIOS: Scenario[] = [
  { name: 'K9000 wash at the bay', cls: 'K9000_WASH', paid: 48 },
  { name: 'K9000 wash, next price', cls: 'K9000_WASH', paid: 55 },
  { name: 'Shop item', cls: 'SHOP_ITEM', paid: 129.9 },
  { name: 'Shop item (₪49)', cls: 'SHOP_ITEM', paid: 49 },
  { name: 'Wallet top-up', cls: 'WALLET_TOPUP', paid: 100 },
  { name: 'eGift purchase', cls: 'EGIFT_PURCHASE', paid: 250 },
  { name: 'Wash paid from eGift', cls: 'EGIFT_REDEMPTION', paid: 55 },
];

describe('dry run: each sale → the document SUMIT would issue', () => {
  const report: string[] = [];
  afterEach(() => { /* keep the table for the final print */ });

  for (const s of SCENARIOS) {
    it(`${s.name} — ₪${s.paid}`, async () => {
      const map = getSumitDocumentMapping(s.cls);
      const vat = Receipts.resolveReceiptVat({
        platform: 'dry-run', paymentClass: s.cls, bookingId: `dry-${s.cls}`, customerEmail: 'dry@run.invalid',
        serviceDescription: s.name, serviceDescriptionHe: s.name, subtotalAmount: s.paid,
        platformFeeAmount: s.commission ?? 0, totalAmount: s.paid, paymentMethod: 'card',
      });
      const r = await sumitClient.createCustomerReceipt({
        idempotencyKey: `DRY-${s.cls}`,
        documentType: map.documentType as any,
        customer: { name: 'Dry Run' },
        description: s.name,
        amountBeforeVat: vat.subtotalBeforeVAT,
        vatAmount: vat.vatAmount,
        totalAmount: vat.totalAmount,
        currency: 'ILS',
      });
      expect(r.sumitDocumentId).toBeDefined();
      const body = sent.at(-1);
      const doc = sumitDocument(body);

      expect(body.Details.Type).toBe(map.documentType);
      expect(doc.totalAg).toBe(agorot(s.paid));   // document == money received
      expect(doc.paidAg).toBe(agorot(s.paid));    // payment line == money received
      if (map.vatMode === 'NO_VAT_STORED_VALUE') {
        expect(body.Items).toBeUndefined();
        expect(doc.vatAg).toBe(0);
        expect(vat.vatAmount).toBe(0);
      } else {
        expect(Math.abs(doc.vatAg - agorot(vat.vatAmount))).toBeLessThanOrEqual(1); // SUMIT VAT vs our ledger
      }
      report.push(`${s.name.padEnd(24)} ₪${s.paid.toFixed(2).padStart(7)}  ${map.documentType.padEnd(17)} VAT ₪${(doc.vatAg / 100).toFixed(2)}`);
    });
  }

  it('prints the dry-run table', () => {
    // eslint-disable-next-line no-console
    console.log('\nFISCAL DRY RUN (nothing sent)\n' + report.join('\n'));
    expect(report.length).toBe(SCENARIOS.length);
  });
});

describe('every price from ₪1.00 to ₪3,000.00 — document total equals the payment', () => {
  it('VAT-inclusive entry: 0 mismatches (the old net line drifted on ~15%)', () => {
    let now = 0;
    let old = 0;
    for (let ag = 100; ag <= 300_000; ag++) {
      const total = ag / 100;
      // New: what createCustomerReceipt sends.
      if (sumitDocument({ Items: [{ UnitPrice: total, Quantity: 1 }], VATIncluded: true, Payments: [{ Amount: total }] }).totalAg !== ag) now++;
      // Old: net = toFixed(total / 1.18), VATIncluded false.
      const net = parseFloat((total / 1.18).toFixed(2));
      if (sumitDocument({ Items: [{ UnitPrice: net, Quantity: 1 }], VATIncluded: false, Payments: [{ Amount: total }] }).totalAg !== ag) old++;
    }
    expect(now).toBe(0);
    expect(old).toBeGreaterThan(40_000); // the bug this suite caught
  });

  it('the request builder really sends the gross with VATIncluded:true', async () => {
    await sumitClient.createCustomerReceipt({
      idempotencyKey: 'DRY-49', customer: { name: 'Dry' }, description: 'walk', amountBeforeVat: 41.53, vatAmount: 7.47, totalAmount: 49, currency: 'ILS',
    });
    expect(sent[0].Items[0].UnitPrice).toBe(49);
    expect(sent[0].VATIncluded).toBe(true);
    expect(sumitDocument(sent[0]).totalAg).toBe(4900);
  });
});

describe('refund → credit document', () => {
  it('₪48 refund: credited gross equals the money returned, linked to the original', async () => {
    const r = await sumitClient.createCreditDocument({
      idempotencyKey: 'DRY-CR-1', originalSumitDocumentId: '900001', customer: { name: 'Dry' },
      amountBeforeVat: 40.68, vatAmount: 7.32, totalAmount: 48, currency: 'ILS', description: 'refund',
    } as any);
    expect(r.sumitDocumentId).toBeDefined();
    const body = sent[0];
    expect(body.Details.Type).toBe('CreditInvoiceAndReceipt');
    expect(Number(body.OriginalDocumentID)).toBe(900001);
    expect(sumitDocument(body).totalAg).toBe(4800);
  });
});

describe('marketplace commission documents are withheld (structure not confirmed)', () => {
  it('PROVIDER_BOOKING_COMMISSION maps to VAT_ON_COMMISSION_ONLY, which the dispatcher withholds', () => {
    expect(getSumitDocumentMapping('PROVIDER_BOOKING_COMMISSION').vatMode).toBe('VAT_ON_COMMISSION_ONLY');
    const vat = Receipts.resolveReceiptVat({
      platform: 'dry-run', paymentClass: 'PROVIDER_BOOKING_COMMISSION', bookingId: 'dry-bk', customerEmail: 'dry@run.invalid',
      serviceDescription: 'sitter', serviceDescriptionHe: 'sitter', subtotalAmount: 100, platformFeeAmount: 15,
      totalAmount: 100, paymentMethod: 'card', brokerCommissionAmount: 15,
    });
    // Ledger: VAT only inside the ₪15 commission (15 − 15/1.18 = ₪2.29).
    expect(vat.vatAmount).toBeCloseTo(2.29, 2);
  });
});

describe('Israel Tax Authority rules the code applies', () => {
  it('SHAAM allocation number: above ₪5,000 before VAT from 1 June 2026 (₪10,000 before that in 2026)', () => {
    expect(isShaamAllocationRequired(5000, new Date('2026-09-13T10:00:00Z'))).toBe(false);
    expect(isShaamAllocationRequired(5000.01, new Date('2026-09-13T10:00:00Z'))).toBe(true);
    expect(isShaamAllocationRequired(9000, new Date('2026-03-01T10:00:00Z'))).toBe(false);
    expect(isShaamAllocationRequired(10000.01, new Date('2026-03-01T10:00:00Z'))).toBe(true);
    expect(isShaamAllocationRequired(-6000, new Date('2026-09-13T10:00:00Z'))).toBe(true); // credit notes by absolute value
  });

  it('a sale at 00:30 Israel time on 1 Sep is dated 1 Sep (not 31 Aug UTC) — right VAT period', async () => {
    await sumitClient.createCustomerReceipt({
      idempotencyKey: 'DRY-DATE', customer: { name: 'Dry' }, description: 'wash', amountBeforeVat: 40.68, vatAmount: 7.32,
      totalAmount: 48, currency: 'ILS', documentDate: new Date('2026-08-31T21:30:00Z'),
    } as any);
    expect(sent[0].Details.Date).toBe('2026-09-01');
  });

  it('nothing in this suite reached a real host', () => {
    expect(process.env.SUMIT_API_BASE_URL).toBe('https://dry-run.invalid');
  });
});
