import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB so stamp()'s insert is a no-op and no real connection is made.
const valuesMock = vi.fn(async () => {});
vi.mock('../db', () => ({
  db: { insert: () => ({ values: valuesMock }) },
  pool: {},
  isDatabaseAvailable: () => true,
}));
// Avoid loading shared/schema.ts (has a pre-existing duplicate-declaration the test
// loader can't parse); the table object is only used as a db.insert() arg, which is mocked.
vi.mock('@shared/schema', () => ({ superAppPayments: {} }));

import { TransactionStampService } from '../services/unified-booking/TransactionStampService';

describe('TransactionStampService — money safety (no paid booking without a payment reference)', () => {
  const svc = new TransactionStampService();
  beforeEach(() => valuesMock.mockClear());

  it('REJECTS a PAID stamp with a real amount and NO payment reference', async () => {
    await expect(svc.stamp({
      bookingId: 'b1', amount: 120, type: 'PAID' as any, provider: 'NAYAX', stampedBy: 'u1',
    })).rejects.toMatchObject({ code: 'PAYMENT_REFERENCE_REQUIRED' });
    expect(valuesMock).not.toHaveBeenCalled(); // never wrote a "completed" payment row
  });

  it('REJECTS a PAID stamp with a blank/whitespace reference', async () => {
    await expect(svc.stamp({
      bookingId: 'b1', amount: 120, type: 'PAID' as any, provider: 'NAYAX', providerRef: '   ', stampedBy: 'u1',
    })).rejects.toMatchObject({ code: 'PAYMENT_REFERENCE_REQUIRED' });
  });

  it('ACCEPTS a PAID stamp with a real payment reference', async () => {
    const txn = await svc.stamp({
      bookingId: 'b1', amount: 120, type: 'PAID' as any, provider: 'NAYAX', providerRef: 'nayax_abc123', stampedBy: 'u1',
    });
    expect(txn.gross).toBe(120);
    expect(valuesMock).toHaveBeenCalledTimes(1);
  });

  it('ACCEPTS a free (gross 0) complimentary stamp without a reference', async () => {
    const txn = await svc.stampComplimentary({ bookingId: 'b1', reason: 'loyalty reward', stampedBy: 'admin' });
    expect(txn.gross).toBe(0);
    expect(valuesMock).toHaveBeenCalledTimes(1);
  });

  it('ACCEPTS a refund stamp (not a PAID type) without the paid-reference rule', async () => {
    const txn = await svc.stampRefund({
      bookingId: 'b1', originalTransactionId: 't0', refundAmount: 50, reason: 'cancel', stampedBy: 'u1',
    });
    expect(txn.type).toBe('REFUND');
    expect(valuesMock).toHaveBeenCalledTimes(1);
  });
});
