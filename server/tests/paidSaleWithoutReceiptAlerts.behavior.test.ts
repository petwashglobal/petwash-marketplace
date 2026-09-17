/**
 * A PAID SALE WITH NO TAX DOCUMENT MUST RAISE AN ALERT (2026-09-17).
 *
 * generateReceipt reports failure in its RETURN VALUE — it does not throw. All
 * six callers ignore it: booking-requests, ShopService, academy, prestige-pass,
 * guest eGift, and PurchaseActivationService (wallet top-up / eGift / wash
 * package). So a customer could pay and have no tax document, leaving one log
 * line nobody reads.
 *
 * The alert is raised inside generateReceipt, so every surface — and every
 * future one — is covered by one piece of code.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const alerts: any[] = [];
vi.mock('../db', () => ({ db: {}, pool: {} }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../lib/sendgrid', () => ({ createMailService: vi.fn(), isSendGridConfigured: () => false }));
vi.mock('../services/googleSheetsIntegration', () => ({ appendFormSubmission: vi.fn() }));
vi.mock('../services/TaxSequenceService', () => ({ allocateTaxSequenceNumber: vi.fn() }));
vi.mock('../lib/invoiceSequence', () => ({ generateCommissionInvoiceNumber: vi.fn() }));
vi.mock('../services/AlertEngine', () => ({
  createOrUpdateAlert: vi.fn(async (a: any) => { alerts.push(a); }),
}));

import { raiseMissingReceiptAlert } from '../services/IsraeliDigitalReceiptService';

beforeEach(() => { alerts.length = 0; });

describe('the alert', () => {
  it('one critical finance alert per sale, naming the amount and the reason', async () => {
    await raiseMissingReceiptAlert({ bookingId: 'shop:PW-SHOP-7', platform: 'shop', totalAmount: 129.9, error: 'tax sequence exhausted' });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      dedupeKey: 'receipt_missing:shop:PW-SHOP-7',
      category: 'finance_doc',
      severity: 'critical',
      linkedEntityId: 'shop:PW-SHOP-7',
      source: 'receipt_engine',
    });
    expect(alerts[0].message).toContain('₪129.90');
    expect(alerts[0].message).toContain('tax sequence exhausted');
  });

  it('never throws — the money has already moved', async () => {
    const { createOrUpdateAlert } = await import('../services/AlertEngine');
    (createOrUpdateAlert as any).mockRejectedValueOnce(new Error('alert store down'));
    await expect(raiseMissingReceiptAlert({ bookingId: 'b', platform: 'shop', totalAmount: 1, error: 'x' }))
      .resolves.toBeUndefined();
  });
});

describe('wired into the one place every sale passes through', () => {
  const svc = readFileSync(join(__dirname, '../services/IsraeliDigitalReceiptService.ts'), 'utf8');
  const tail = svc.slice(svc.indexOf("logger.error('[Digital Receipt] 🔴 Generation failed"));

  it('generateReceipt raises it when it cannot write the document', () => {
    expect(tail).toContain('await raiseMissingReceiptAlert({');
    expect(tail).toContain('bookingId: params.bookingId ?? `${params.platform}:unknown`');
  });

  it('still returns success:false rather than throwing — callers must not fail the sale', () => {
    expect(tail).toMatch(/return \{\s*success: false,\s*error: error\.message,\s*\};/);
  });

  it('covers the surfaces that ignore the result', () => {
    const callers = [
      ['routes/booking-requests.ts', 'await IsraeliDigitalReceiptService.generateReceipt({'],
      ['services/ShopService.ts', 'await IsraeliDigitalReceiptService.generateReceipt({'],
      ['routes/egift-guest.ts', 'await IsraeliDigitalReceiptService.generateReceipt({'],
      ['services/PurchaseActivationService.ts', 'await IsraeliDigitalReceiptService.generateReceipt({'],
    ] as const;
    for (const [file, call] of callers) {
      expect(readFileSync(join(__dirname, '..', file), 'utf8'), file).toContain(call);
    }
  });
});
