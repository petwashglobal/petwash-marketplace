import { describe, it, expect } from 'vitest';
import { supplierInvoiceSumitSendService } from '../services/SupplierInvoiceSumitSendService';

// These tests cover the pure-logic surface of the service. The full happy-path
// (load invoice → call SUMIT → update row → write audit) requires the live
// drizzle db and is exercised by integration tests, not here. Anything that
// would require process.env mutation or db.update mocking is intentionally
// not covered in this file.

describe('SupplierInvoiceSumitSendService — idempotency key', () => {
  const mkInvoice = (overrides: Record<string, unknown> = {}) => ({
    id: 42,
    fileHash:
      '0d4f7e1c5e64a1f2b3a09c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f',
    status: 'ready_for_accountant',
    sumitStatus: null,
    sumitDocumentId: null,
    sumitIdempotencyKey: null,
    sumitSentAt: null,
    sumitLastError: null,
    ocrInvoiceNumber: 'INV-2026-001',
    ocrSupplierName: 'Acme Pet Supplies Ltd',
    ocrBusinessNumber: '517145033',
    ocrAmountBeforeVat: '100.00',
    ocrVatAmount: '18.00',
    ocrTotalAmount: '118.00',
    supplierId: 7,
    ...overrides,
  });

  it('produces the same idempotency key for the same invoice+hash', () => {
    const inv = mkInvoice();
    const key1 = (supplierInvoiceSumitSendService as any).buildIdempotencyKey(inv);
    const key2 = (supplierInvoiceSumitSendService as any).buildIdempotencyKey(inv);
    expect(key1).toBe(key2);
  });

  it('produces a different key when invoice id differs', () => {
    const a = (supplierInvoiceSumitSendService as any).buildIdempotencyKey(mkInvoice({ id: 1 }));
    const b = (supplierInvoiceSumitSendService as any).buildIdempotencyKey(mkInvoice({ id: 2 }));
    expect(a).not.toBe(b);
  });

  it('produces a different key when file hash differs', () => {
    const a = (supplierInvoiceSumitSendService as any).buildIdempotencyKey(mkInvoice());
    const b = (supplierInvoiceSumitSendService as any).buildIdempotencyKey(
      mkInvoice({
        fileHash:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })
    );
    expect(a).not.toBe(b);
  });

  it('stays under the DB column length (varchar(80))', () => {
    const key = (supplierInvoiceSumitSendService as any).buildIdempotencyKey(
      mkInvoice({ id: 99999999 })
    );
    expect(key.length).toBeLessThanOrEqual(80);
  });

  it('uses the petwash_sumit prefix so SUMIT staff can identify our calls', () => {
    const key = (supplierInvoiceSumitSendService as any).buildIdempotencyKey(mkInvoice());
    expect(key.startsWith('petwash_sumit_')).toBe(true);
  });

  it('includes the invoice id in the key for human debug', () => {
    const key = (supplierInvoiceSumitSendService as any).buildIdempotencyKey(mkInvoice({ id: 12345 }));
    expect(key.includes('12345')).toBe(true);
  });
});

describe('SupplierInvoiceSumitSendService — surface shape', () => {
  it('exports a singleton with a send() method', () => {
    expect(typeof supplierInvoiceSumitSendService).toBe('object');
    expect(typeof supplierInvoiceSumitSendService.send).toBe('function');
  });
});
