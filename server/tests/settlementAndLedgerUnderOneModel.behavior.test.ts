/**
 * The settlement row and the VAT ledger must book the fee that was ACTUALLY
 * charged — under the fee-on-top model and for stays sold before it.
 *
 * Two back-calculations assumed the fee came out of the provider's money:
 *  - IsraeliDigitalReceiptService: commission = payout × 15 / 85
 *      → on a ₪1,000 stay whose fee sat on top: ₪176.47 instead of ₪150
 *  - VATCalculatorService.recordTransactionFromGross: fee = 15% × collected
 *      → on a ₪1,150 booking_requests charge: ₪172.50 instead of ₪150
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../db', () => ({ db: {}, pool: {} }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../lib/sendgrid', () => ({ createMailService: vi.fn(), isSendGridConfigured: () => false }));
vi.mock('../services/googleSheetsIntegration', () => ({ appendFormSubmission: vi.fn() }));
vi.mock('../services/TaxSequenceService', () => ({ allocateTaxSequenceNumber: vi.fn() }));
vi.mock('../lib/invoiceSequence', () => ({ generateCommissionInvoiceNumber: vi.fn() }));
vi.mock('firebase-admin', () => ({ default: { firestore: () => ({}) }, firestore: () => ({}) }));
vi.mock('../lib/firebase-admin', () => ({ default: { firestore: () => ({}) }, db: {} }));

import { IsraeliDigitalReceiptService } from '../services/IsraeliDigitalReceiptService';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const settle = (grossPayoutAmount: number, brokerCommissionAmount?: number) =>
  IsraeliDigitalReceiptService.calculateProviderSettlement({
    bookingId: 'B', providerId: 'P', providerType: 'sitter',
    grossPayoutAmount, osekType: 'osek_murshe', brokerCommissionAmount,
  });

describe('provider settlement books the stored fee', () => {
  it('fee on top: ₪1,000 stay, ₪150 fee → commission ₪150, not ₪176.47', () => {
    expect(settle(1000, 150).brokerCommission).toBe(150);
    expect(settle(1000).brokerCommission).toBe(176.47); // what the old formula would book
  });

  it('a stay sold under the old model gets the same answer either way', () => {
    // base 1000, fee 150 taken out, payout 850
    expect(settle(850, 150).brokerCommission).toBe(150);
    expect(settle(850).brokerCommission).toBe(150);
  });

  it('a stored fee of zero is honoured, not replaced by a guess', () => {
    expect(settle(1000, 0).brokerCommission).toBe(0);
  });

  it('the provider is paid from their own amount — the fee never reduces it', () => {
    const r = settle(1000, 150);
    expect(r.grossPayout).toBe(1000);
    expect(r.netPaymentToProvider).toBe(1000 - r.withholdingTaxAmount);
  });
});

describe('the recorded commission rate reproduces the recorded amount', () => {
  it('derives rate = commission ÷ customer paid (13.04 on top, 15.00 out of the rate)', () => {
    const src = read('services/IsraeliDigitalReceiptService.ts');
    expect(src).toContain('(settlement.brokerCommission / paid) * 100');
    expect((150 / 1150) * 100).toBeCloseTo(13.04, 2);
    expect((150 / 1000) * 100).toBe(15);
  });
});

describe('the VAT ledger knows which model produced the total', () => {
  it('gross model: the fee is r / (1 + r) of what was collected', () => {
    const src = read('services/VATCalculatorService.ts');
    expect(src).toContain("opts?.model === 'gross' ? baseRate / (1 + baseRate) : baseRate");
    const r = 0.15;
    expect(Math.round(1150 * (r / (1 + r)) * 100) / 100).toBe(150);
    expect(1150 * r).toBe(172.5); // what it booked before
  });

  it('booking_requests (fee on top) tells the ledger so', () => {
    const src = read('routes/booking-requests.ts');
    const i = src.indexOf("bookingFlow: 'booking_requests'");
    expect(src.slice(i, i + 500)).toContain("{ model: 'gross' }");
  });

  it('Sitter Suite reads each stay’s model from its own stored numbers, inline AND on retry', () => {
    const src = read('routes/sitter-suite.ts');
    expect(src).toContain("booking.totalChargeCents > booking.basePriceCents ? 'gross' : 'net'");
    expect(src).toContain('moneyModel,');
    expect(src).toContain('{ model: moneyModel }');
    const drainer = read('index.ts');
    const i = drainer.indexOf('vat_ledger: async (p: any) =>');
    expect(drainer.slice(i, i + 700)).toContain("p.moneyModel === 'gross' ? { model: 'gross' } : undefined");
  });

  it('Sitter Suite settles with the fee it stored', () => {
    expect(read('routes/sitter-suite.ts')).toContain('brokerCommissionAmount: (booking.platformServiceFeeCents ?? 0) / 100');
  });
});
