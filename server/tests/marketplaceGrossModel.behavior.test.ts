/**
 * MARKETPLACE GROSS MODEL (CEO 2026-09-14 — Rover / Mad Paws;
 * docs/finance/00-platform-role-model.md §0.6–0.7).
 *
 *   customer pays   ₪115 = provider price ₪100 + Pet Wash fee ₪15 (fee ON TOP — quoteEngine)
 *   provider        legal seller; invoices the customer ₪100 from their own books
 *   Pet Wash        revenue = the ₪15 fee only → one חשבונית מס/קבלה for ₪15 to the customer
 *   provider owed   ₪100 (their full price), released only by a Pet Wash admin
 *
 * Before: the provider's share was recorded 4 ways (₪100 / ₪97.75 / ₪85 / ₪85 —
 * 15% taken twice) and Pet Wash's document was withheld because it would have
 * put the whole booking on Pet Wash's invoice.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const row = {
  id: 7, receiptNumber: 'PW-2026-000123', bookingId: 'BR-abc', platform: 'booking-requests',
  customerName: 'Dana', customerEmail: 'dana@example.com', customerPhone: null,
  subtotalAmount: '112.71', vatAmount: '2.29', totalAmount: '115.00', platformFeeAmount: '15.00', brokerCommissionAmount: '15.00',
  sumitDocumentId: null,
};
const updates: any[] = [];
vi.mock('../db', () => {
  const chain: any = { from: () => chain, where: () => chain, limit: async () => [row], set: (v: any) => { updates.push(v); return chain; } };
  return { db: { select: () => chain, update: () => chain }, pool: {} };
});
const createCustomerReceipt = vi.fn(async () => ({ wired: true, sumitDocumentId: '900555' }));
vi.mock('../services/SumitClient', () => ({ sumitClient: { isWired: () => true, createCustomerReceipt } }));

import { IsraeliDigitalReceiptService } from '../services/IsraeliDigitalReceiptService';

describe('Pet Wash documents its platform fee only', () => {
  it('₪115 booking (₪100 provider + ₪15 fee) → ONE ₪15 חשבונית מס/קבלה to the customer, VAT only inside the ₪15', async () => {
    const r = await IsraeliDigitalReceiptService.dispatchReceiptToSumit({ receiptId: 7, paymentClass: 'PROVIDER_BOOKING_COMMISSION' });
    expect(r).toEqual({ status: 'issued', sumitDocumentId: '900555' });
    expect(createCustomerReceipt).toHaveBeenCalledTimes(1);
    const input = (createCustomerReceipt.mock.calls[0] as any)[0];
    expect(input.documentType).toBe('InvoiceAndReceipt');
    expect(input.totalAmount).toBe(15);
    expect(input.vatAmount).toBeCloseTo(2.29, 2);
    expect(input.amountBeforeVat).toBeCloseTo(12.71, 2);
    expect(input.customer.email).toBe('dana@example.com');
    expect(input.description).toContain('נותן השירות');
    expect(updates[0]).toMatchObject({ sumitDocumentId: '900555', issuerOfRecord: 'sumit' });
  });
});

describe('the provider is owed their full price everywhere', () => {
  const br = readFileSync(join(__dirname, '../routes/booking-requests.ts'), 'utf8');
  const cron = readFileSync(join(__dirname, '../cron/auto-approve-completions.ts'), 'utf8');

  it('booking creation stores providerPayoutCents = subtotal', () => {
    expect(br).toContain('providerPayoutCents: subtotalCents,');
  });
  it('earning records never take the fee from the provider again', () => {
    expect(br).toMatch(/baseAmount: booking\.subtotalCents \/ 100,[\s\S]{0,300}platformFeePercent: 0,/);
    expect(cron).toMatch(/platformFeePercent: 0,/);
    expect(cron).not.toMatch(/platformFeePercent: 15,/);
  });
  it('receipts record the full provider price', () => {
    expect(br).toContain('providerPayoutAmount: (booking.providerPayoutCents ?? (booking.subtotalCents || 0)) / 100,');
    expect(cron).toContain('providerPayoutAmount: (booking.subtotalCents || 0) / 100,');
  });
  it('escrow commission percent makes the provider share equal the provider price', () => {
    const escrowShare = (totalCents: number, subtotalCents: number) => {
      const pct = totalCents > 0 ? ((totalCents - subtotalCents) / totalCents) * 100 : 0;
      return totalCents - Math.round(totalCents * (pct / 100));     // EscrowService math
    };
    expect(escrowShare(11500, 10000)).toBe(10000);   // fee on top
    expect(escrowShare(9000, 10000)).toBe(10000);    // promo funded by Pet Wash (§0.2.4) — provider still whole
    expect(escrowShare(34500, 30000)).toBe(30000);
    expect(br).toContain('booking.totalCents > 0 ? ((booking.totalCents - booking.subtotalCents) / booking.totalCents) * 100 : 0,');
  });
});

describe('the provider records their own invoice (Pet Wash never issues it)', () => {
  const br = readFileSync(join(__dirname, '../routes/booking-requests.ts'), 'utf8');
  const walk = readFileSync(join(__dirname, '../routes/walk-my-pet.ts'), 'utf8');
  const mig = readFileSync(join(__dirname, '../../migrations/0159_provider_service_invoice.sql'), 'utf8');
  it('migration adds the invoice number to booking_requests and walk_bookings', () => {
    expect(mig).toMatch(/ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS provider_invoice_number/);
    expect(mig).toMatch(/ALTER TABLE walk_bookings\s+ADD COLUMN IF NOT EXISTS provider_invoice_number/);
  });
  it('only the provider of a completed job can record it', () => {
    const i = br.indexOf("router.post('/:requestId/provider-invoice'");
    const body = br.slice(i, i + 1600);
    expect(body).toContain("if (booking.providerId !== userId) return res.status(403)");
    expect(body).toContain("['provider_marked_complete', 'completed', 'reviewed'].includes");
    const w = walk.indexOf("router.post('/walks/:bookingId/provider-invoice', requireAuth");
    expect(walk.slice(w, w + 1600)).toContain('walkerRow.userId !== callerId');
  });
  it('the evidence loader requires it for every marketplace job', () => {
    const loader = readFileSync(join(__dirname, '../services/jobEvidenceLoader.ts'), 'utf8');
    // EVERY loader, not a fixed count: walks, marketplace bookings and (2026-09-18)
    // Sitter Suite stays. A new product must carry the same rule.
    const loaders = loader.match(/export async function load\w*Evidence\(/g) ?? [];
    expect(loaders.length).toBeGreaterThanOrEqual(3);
    expect(loader.match(/providerInvoiceRequired: true,/g)).toHaveLength(loaders.length);
    // reads safely even before the migration is applied
    expect(loader).toContain("to_jsonb(br)->>'provider_invoice_number'");
    expect(loader).toContain("to_jsonb(sb)->>'provider_invoice_number'");
  });
});
