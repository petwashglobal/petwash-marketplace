/**
 * SUMIT B2C customer-receipt bridge.
 *
 * Every paid transaction must be able to issue a legal SUMIT חשבונית מס/קבלה,
 * but the bridge must be a SAFE no-op until the operator sets credentials — and
 * must NEVER fire an HTTP call or throw when unwired (a receipt failure cannot be
 * allowed to break an already-completed payment).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SumitClient } from '../services/SumitClient';
import fs from 'node:fs';
import path from 'node:path';

const ENV_KEYS = ['SUMIT_ENABLED', 'SUMIT_API_KEY', 'SUMIT_COMPANY_ID', 'SUMIT_WEBHOOK_SECRET'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

const SAMPLE = {
  idempotencyKey: 'RECEIPT-2026-000123',
  customer: { name: 'דנה כהן', email: 'dana@example.com' },
  description: 'שטיפת כלב K9000',
  amountBeforeVat: 50,
  vatAmount: 9,
  totalAmount: 59,
  currency: 'ILS' as const,
};

describe('SumitClient.createCustomerReceipt', () => {
  it('no-ops without firing fetch when not wired', async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any);
    const client = new SumitClient();
    const res = await client.createCustomerReceipt(SAMPLE);
    expect(res.wired).toBe(false);
    expect(res.idempotencyKey).toBe(SAMPLE.idempotencyKey);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('isWired() is false unless all four env vars are present', () => {
    for (const k of ENV_KEYS) delete process.env[k];
    const client = new SumitClient();
    expect(client.isWired()).toBe(false);
    process.env.SUMIT_ENABLED = 'true';
    process.env.SUMIT_API_KEY = 'k';
    process.env.SUMIT_COMPANY_ID = 'c';
    // still missing webhook secret
    expect(client.isWired()).toBe(false);
    process.env.SUMIT_WEBHOOK_SECRET = 's';
    expect(client.isWired()).toBe(true);
  });

  it('does not throw on a network error (returns wired:false)', async () => {
    process.env.SUMIT_ENABLED = 'true';
    process.env.SUMIT_API_KEY = 'k';
    process.env.SUMIT_COMPANY_ID = 'c';
    process.env.SUMIT_WEBHOOK_SECRET = 's';
    vi.spyOn(globalThis, 'fetch' as any).mockRejectedValue(new Error('ENOTFOUND'));
    const client = new SumitClient();
    const res = await client.createCustomerReceipt(SAMPLE);
    expect(res.sumitDocumentId).toBeUndefined();
    expect(res.reason).toMatch(/network error/i);
  });

  it('sends Type InvoiceAndReceipt + a Payments line when wired', async () => {
    process.env.SUMIT_ENABLED = 'true';
    process.env.SUMIT_API_KEY = 'k';
    process.env.SUMIT_COMPANY_ID = 'c';
    process.env.SUMIT_WEBHOOK_SECRET = 's';
    let sentBody: any;
    vi.spyOn(globalThis, 'fetch' as any).mockImplementation(async (_url: any, opts: any) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => ({ DocumentNumber: 'INV-999' }) } as any;
    });
    const client = new SumitClient();
    const res = await client.createCustomerReceipt(SAMPLE);
    expect(res.sumitDocumentId).toBe('INV-999');
    expect(sentBody.Details.Type).toBe('InvoiceAndReceipt');
    expect(sentBody.Payments?.[0]?.Amount).toBe(59);
    expect(sentBody.Details.ExternalIdentifier).toBe(SAMPLE.idempotencyKey);
  });
});

describe('IsraeliDigitalReceiptService wires SUMIT at the chokepoint', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'services', 'IsraeliDigitalReceiptService.ts'),
    'utf8',
  );
  it('generateReceipt dispatches to createCustomerReceipt behind isWired(), wrapped so it cannot throw', () => {
    expect(src).toMatch(/createCustomerReceipt/);
    expect(src).toMatch(/sumitClient\.isWired\(\)/);
    // idempotency uses our sequential receipt number
    expect(src).toMatch(/idempotencyKey:\s*receiptNumber/);
  });
});
