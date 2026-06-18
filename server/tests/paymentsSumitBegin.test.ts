/**
 * payments-sumit /begin — server-owned price + eGift recipient + the
 * client-cannot-inject-reserved-keys guarantee.
 *
 * Drives the real router via supertest with the DB / SUMIT / auth deps mocked,
 * and inspects the exact row handed to purchases.insert().
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Capture whatever the route inserts into `purchases`.
let insertedValues: any = null;

vi.mock('../middleware/firebase-auth', () => ({
  validateFirebaseToken: (req: any, _res: any, next: any) => {
    req.firebaseUser = { uid: 'buyer-1', email: 'buyer@example.com', name: 'Buyer One' };
    next();
  },
}));

vi.mock('../services/SumitClient', () => ({
  sumitClient: {
    beginRedirect: vi.fn(async () => ({ wired: true, redirectUrl: 'https://sumit.example/pay/abc' })),
  },
}));

vi.mock('drizzle-orm', () => ({ eq: (col: any, val: any) => ({ _t: 'eq', col, val }) }));

vi.mock('@shared/schema', () => ({
  purchases: { id: { _col: 'id' }, surfaceRefId: { _col: 'surfaceRefId' } },
}));

vi.mock('../db', () => ({
  db: {
    select: (_cols?: any) => ({
      from: (_t: any) => ({ where: (_w: any) => ({ limit: (_n: number) => Promise.resolve([]) }) }),
    }),
    insert: (_t: any) => ({
      values: (vals: any) => { insertedValues = vals; return Promise.resolve([{ id: 'p' }]); },
    }),
  },
}));

vi.mock('../lib/logger', () => ({ logger: { info: () => {}, warn: () => {}, error: () => {} } }));

import paymentsSumitRoutes from '../routes/payments-sumit';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/payments/sumit', paymentsSumitRoutes);
  return a;
}

beforeEach(() => { insertedValues = null; });

describe('POST /api/payments/sumit/begin', () => {
  it('strips client-injected reserved keys (egiftGiftCardId) — anti charged-but-no-gift', async () => {
    const res = await request(app())
      .post('/api/payments/sumit/begin')
      .send({
        sku: 'EGIFT_250',
        recipient: { name: 'Dana', email: 'dana@example.com' },
        // Hostile client trying to pre-trip the activation idempotency belt:
        metadata: { egiftGiftCardId: 'EVIL', egiftPublicCode: 'EVIL2', note: 'benign' },
      });

    expect(res.status).toBe(200);
    expect(res.body.redirectUrl).toBe('https://sumit.example/pay/abc');

    // The reserved activation key must be forced null — NOT the client value.
    expect(insertedValues.metadataJson.egiftGiftCardId).toBeNull();
    expect(insertedValues.metadataJson.egiftPublicCode).toBeNull();
    // Benign client metadata is preserved.
    expect(insertedValues.metadataJson.note).toBe('benign');
    // Recipient + amount are server-owned.
    expect(insertedValues.metadataJson.egiftRecipientEmail).toBe('dana@example.com');
    expect(insertedValues.productType).toBe('EGIFT_CARD');
    expect(insertedValues.amountCents).toBe(25000);
    expect(insertedValues.status).toBe('payment_pending');
  });

  it('eGift without a recipient → 400 egift_recipient_required (no purchase row)', async () => {
    const res = await request(app())
      .post('/api/payments/sumit/begin')
      .send({ sku: 'EGIFT_100' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('egift_recipient_required');
    expect(insertedValues).toBeNull();
  });

  it('a non-owned / unknown SKU is rejected (provider commerce not purchasable)', async () => {
    const res = await request(app())
      .post('/api/payments/sumit/begin')
      .send({ sku: 'DOG_WALKING_BOOKING' });
    expect(res.status).toBe(400); // zod enum rejects it before any order is created
    expect(insertedValues).toBeNull();
  });

  it('wash package uses the server price, not any client value', async () => {
    const res = await request(app())
      .post('/api/payments/sumit/begin')
      .send({ sku: 'WASH_PACKAGE_5', metadata: { amountCents: 1 } });
    expect(res.status).toBe(200);
    expect(insertedValues.amountCents).toBe(22000); // ₪220 from the catalog, not the client's 1
    expect(insertedValues.metadataJson.washCount).toBe(5);
  });
});
