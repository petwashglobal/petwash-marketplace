/**
 * SUMIT hosted-page payments, pinned to SUMIT's OFFICIAL schema (2026-09-13).
 *
 * Source: https://api.sumit.co.il/swagger/v1/swagger.json — not guesses.
 *   /billing/payments/get/  request  { Credentials, PaymentID: integer }
 *                           response { Status, UserErrorMessage, Data: { Payment: {
 *                                      ID, CustomerID, ValidPayment, Status, Amount, … } } }
 *   BeginRedirect.RedirectURL: SUMIT appends OG-CustomerID, OG-PaymentID, OG-ExternalIdentifier.
 * Live read-only probe of the production account: unknown id → HTTP 200,
 * { Data: null, Status: 1, UserErrorMessage: "Payment not found" }.
 *
 * What was broken:
 *   1. getTransaction read `Valid` / `Data.Valid` / Status 'approved' — never sent,
 *      so a paying customer was always "not paid"; and `Data.Amount` (really
 *      `Data.Payment.Amount`), so every caller's amount comparison was skipped.
 *   2. Return handlers read `?ID=` — SUMIT sends `OG-PaymentID`.
 *   3. The Payment object has no external identifier, so the per-order binding
 *      never compared anything. The durable claim is the binding now.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { interpretSumitPaymentGet, parseSumitPaymentId, sumitClient } from '../services/SumitClient';
import { claimAllowsFulfil, claimSumitPayment, readSumitPaymentIdFromReturn } from '../lib/sumitPaymentReturn';

// Exactly the documented shape.
function officialPayment(over: Record<string, unknown> = {}) {
  return {
    Status: 0,
    UserErrorMessage: null,
    TechnicalErrorDetails: null,
    Data: {
      Payment: {
        ID: 555001, CustomerID: 9001, Date: '2026-09-13T10:00:00', ValidPayment: true,
        Status: '000', StatusDescription: 'מאושר', Amount: 48,
        PaymentMethod: { ID: 77, CreditCard_LastDigits: '4242' }, AuthNumber: '0123456',
        ...over,
      },
    },
  };
}

describe('getTransaction reads the fields SUMIT actually sends', () => {
  it('a documented valid payment verifies, with the amount in agorot', () => {
    expect(interpretSumitPaymentGet(officialPayment(), 555001)).toEqual({
      valid: true, amountCents: 4800, customerId: '9001', paymentMethodId: '77',
    });
  });

  it('the OLD guessed shape no longer verifies (it was never what SUMIT sends)', () => {
    const guessed = { Valid: true, Amount: 48, Status: 'approved', Data: { Valid: true, Amount: 48 } };
    expect(interpretSumitPaymentGet(guessed, 555001).valid).toBe(false);
  });

  it('the live "Payment not found" answer is refused', () => {
    const live = { Data: null, Status: 1, UserErrorMessage: 'Payment not found', TechnicalErrorDetails: null };
    const v = interpretSumitPaymentGet(live, 1);
    expect(v.valid).toBe(false);
    expect(v.reason).toContain('Payment not found');
  });

  it('ValidPayment false (declined) is refused', () => {
    expect(interpretSumitPaymentGet(officialPayment({ ValidPayment: false }), 555001).valid).toBe(false);
  });

  it('a truthy-but-not-true ValidPayment is refused', () => {
    expect(interpretSumitPaymentGet(officialPayment({ ValidPayment: 'true' }), 555001).valid).toBe(false);
  });

  it('a missing or zero amount is a refusal, never "skip the amount check"', () => {
    expect(interpretSumitPaymentGet(officialPayment({ Amount: undefined }), 555001)).toMatchObject({ valid: false, reason: 'amount_missing' });
    expect(interpretSumitPaymentGet(officialPayment({ Amount: 0 }), 555001)).toMatchObject({ valid: false, reason: 'amount_missing' });
    expect(interpretSumitPaymentGet(officialPayment({ Amount: '48' }), 555001)).toMatchObject({ valid: false });
  });

  it('a response for a different payment id is refused', () => {
    expect(interpretSumitPaymentGet(officialPayment(), 555002)).toMatchObject({ valid: false, reason: 'payment_id_mismatch' });
  });

  it('decimal shekels round to the agora (₪48.30 → 4830)', () => {
    expect(interpretSumitPaymentGet(officialPayment({ Amount: 48.3 }), 555001).amountCents).toBe(4830);
  });
});

describe('getTransaction request', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; vi.unstubAllGlobals(); });

  function wire() {
    process.env.SUMIT_ENABLED = 'true';
    process.env.SUMIT_API_KEY = 'test-key-not-real';
    process.env.SUMIT_COMPANY_ID = '12345';
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec-test';
    process.env.SUMIT_API_BASE_URL = 'https://sumit.test';
  }

  it('sends PaymentID as an integer to /billing/payments/get/ and nothing guessed', async () => {
    wire();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(officialPayment()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const v = await sumitClient.getTransaction('555001');
    expect(v).toMatchObject({ wired: true, valid: true, amountCents: 4800 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://sumit.test/billing/payments/get/');
    const body = JSON.parse(String(init.body));
    expect(body.PaymentID).toBe(555001);
    expect(body).not.toHaveProperty('TransactionID');
  });

  it('a non-numeric id never reaches SUMIT', async () => {
    wire();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const bad of ['', 'txn_1', '12; DROP', '-5', '0', '1e5', '99999999999999999999']) {
      const v = await sumitClient.getTransaction(bad);
      expect(v.valid).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('the return link: SUMIT appends OG-PaymentID', () => {
  it('reads OG-PaymentID first', () => {
    expect(readSumitPaymentIdFromReturn({ 'OG-PaymentID': '555001', 'OG-CustomerID': '9001', ext: 'e1' })).toBe('555001');
  });
  it('still accepts the legacy ID param for links already issued', () => {
    expect(readSumitPaymentIdFromReturn({ ID: '42' })).toBe('42');
  });
  it('OG-PaymentID wins over a conflicting ID', () => {
    expect(readSumitPaymentIdFromReturn({ 'OG-PaymentID': '7', ID: '8' })).toBe('7');
  });
  it('garbage becomes empty (callers treat empty as failed)', () => {
    expect(readSumitPaymentIdFromReturn({ 'OG-PaymentID': "1' OR 1=1" })).toBe('');
    expect(readSumitPaymentIdFromReturn({})).toBe('');
    expect(parseSumitPaymentId(['1', '2'])).toBeNull();
  });
});

describe('one SUMIT payment fulfils exactly one order (real Postgres engine)', () => {
  let database: any;
  beforeAll(async () => {
    const pg = new PGlite();
    await pg.exec(readFileSync(join(__dirname, '../../migrations/0154_sumit_payment_claims.sql'), 'utf8'));
    database = drizzle(pg);
  });

  it('first order claims; the same order again is idempotent', async () => {
    expect(await claimSumitPayment('1001', 'topup_A', 'wallet_purchase', database)).toBe('claimed');
    expect(await claimSumitPayment('1001', 'topup_A', 'wallet_purchase', database)).toBe('same_order');
  });

  it('THE REPLAY: the paid id against another unpaid order is refused', async () => {
    expect(await claimSumitPayment('2002', 'topup_A', 'wallet_purchase', database)).toBe('claimed');
    expect(await claimSumitPayment('2002', 'topup_B', 'wallet_purchase', database)).toBe('other_order');
  });

  it('and across surfaces (a wallet payment cannot also issue a guest eGift)', async () => {
    expect(await claimSumitPayment('3003', 'order_X', 'wallet_purchase', database)).toBe('claimed');
    expect(await claimSumitPayment('3003', 'order_X', 'egift_guest', database)).toBe('other_order');
  });

  it('50 concurrent returns for one payment across 50 orders → exactly one wins', async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => claimSumitPayment('4004', `order_${i}`, 'booking', database)),
    );
    expect(results.filter((r) => r === 'claimed')).toHaveLength(1);
    expect(results.filter((r) => claimAllowsFulfil(r))).toHaveLength(1);
  });

  it('FAIL CLOSED when the claim cannot be written', async () => {
    const broken = { execute: async () => { throw new Error('relation "sumit_payment_claims" does not exist'); } };
    const r = await claimSumitPayment('5005', 'order_Z', 'egift_guest', broken as any);
    expect(r).toBe('unavailable');
    expect(claimAllowsFulfil(r)).toBe(false);
  });

  it('an invalid id or empty order never claims', async () => {
    expect(await claimSumitPayment('abc', 'order', 'booking', database)).toBe('unavailable');
    expect(await claimSumitPayment('6006', '', 'booking', database)).toBe('unavailable');
  });
});

describe('every SUMIT return handler claims the payment before it fulfils', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
  const cases: Array<[string, string, string]> = [
    ['routes/payments-sumit.ts', "claimSumitPayment(txnId, ext || 'no_ext', 'wallet_purchase')", 'activateFromVerifiedPayment({'],
    ['routes/egift-guest.ts', "claimSumitPayment(txnId, ext, 'egift_guest')", 'await issueVoucher({'],
    ['routes/save-card.ts', "claimSumitPayment(txnId, ext, 'save_card')", 'redis.getDel(pendingKey(ext))'],
    ['routes/booking-requests.ts', "claimSumitPayment(String(txnId), `booking:${requestId}`, 'booking')", 'canConfirmBooking(requestId)'],
  ];
  for (const [file, claimCall, fulfilCall] of cases) {
    it(`${file}: reads OG-PaymentID and claims before fulfilling`, () => {
      const src = read(file);
      expect(src).toContain('readSumitPaymentIdFromReturn(req.query');
      expect(src).not.toMatch(/req\.query\.ID \|\| req\.query\.id/);
      const c = src.indexOf(claimCall);
      const f = src.indexOf(fulfilCall, c > 0 ? 0 : 0);
      expect(c).toBeGreaterThan(0);
      expect(f).toBeGreaterThan(c);
    });
  }
});

describe('connectionTest: SUMIT says HTTP 200 even for a wrong key', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; vi.unstubAllGlobals(); });
  function wire() {
    process.env.SUMIT_ENABLED = 'true';
    process.env.SUMIT_API_KEY = 'test-key-not-real';
    process.env.SUMIT_COMPANY_ID = '12345';
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec-test';
    process.env.SUMIT_API_BASE_URL = 'https://sumit.test';
  }

  it('the live wrong-key answer is NOT "authenticated"', async () => {
    wire();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      Data: null, Status: 1, UserErrorMessage: 'Invalid Credentials (CompanyID/APIKey are incorrect)', TechnicalErrorDetails: null,
    }), { status: 200 })));
    const r = await sumitClient.connectionTest();
    expect(r.ok).toBe(false);
    expect(r.authRejected).toBe(true);
  });

  it('the live good answer reads the VAT rate from Data.Rate (18)', async () => {
    wire();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      Data: { Rate: 18.0 }, Status: 0, UserErrorMessage: null, TechnicalErrorDetails: null,
    }), { status: 200 })));
    const r = await sumitClient.connectionTest();
    expect(r).toMatchObject({ ok: true, vatRate: 18 });
  });
});
