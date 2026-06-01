import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { SumitClient } from '../services/SumitClient';

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.SUMIT_ENABLED;
  delete process.env.SUMIT_API_KEY;
  delete process.env.SUMIT_COMPANY_ID;
  delete process.env.SUMIT_WEBHOOK_SECRET;
  delete process.env.SUMIT_API_BASE_URL;
}

describe('SumitClient — stub behavior', () => {
  beforeEach(() => resetEnv());
  afterEach(() => resetEnv());

  it('health() returns wired:false with no env', () => {
    const client = new SumitClient();
    const h = client.health();
    expect(h.wired).toBe(false);
    expect(h.companyIdConfigured).toBe(false);
    expect(h.webhookSecretConfigured).toBe(false);
    expect(h.baseUrl).toBe('https://api.sumit.co.il');
  });

  it('createDocument returns wired:false and never throws when SUMIT is off', async () => {
    const client = new SumitClient();
    const result = await client.createDocument({
      supplierInvoiceId: 'inv_test_1',
      idempotencyKey: 'idem_1',
      customer: { name: 'Acme Pet Supplies', businessNumber: '517145033' },
      amountBeforeVat: 100,
      vatAmount: 18,
      totalAmount: 118,
      currency: 'ILS',
      description: 'shampoo restock',
    });
    expect(result.wired).toBe(false);
    expect(result.idempotencyKey).toBe('idem_1');
    expect(result.sumitDocumentId).toBeUndefined();
    expect(result.reason).toMatch(/not wired/i);
  });

  it('createDocument echoes idempotencyKey unchanged', async () => {
    const client = new SumitClient();
    const r1 = await client.createDocument({
      supplierInvoiceId: 'inv_x',
      idempotencyKey: 'idem_stable_key',
      customer: { name: 'X', businessNumber: '0' },
      amountBeforeVat: 1,
      vatAmount: 0,
      totalAmount: 1,
      currency: 'ILS',
      description: 'x',
    });
    expect(r1.idempotencyKey).toBe('idem_stable_key');
  });
});

describe('SumitClient.verifyWebhookSignature', () => {
  beforeEach(() => resetEnv());
  afterEach(() => resetEnv());

  it('returns false when SUMIT_WEBHOOK_SECRET is unset', () => {
    const client = new SumitClient();
    expect(client.verifyWebhookSignature('{"a":1}', 'deadbeef')).toBe(false);
  });

  it('returns false when no header signature is provided', () => {
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec_test';
    const client = new SumitClient();
    expect(client.verifyWebhookSignature('{"a":1}', undefined)).toBe(false);
  });

  it('returns true for a correctly signed payload', () => {
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec_test';
    const client = new SumitClient();
    const body = '{"event":"document.created","id":"doc_1"}';
    const sig = crypto
      .createHmac('sha256', 'whsec_test')
      .update(Buffer.from(body, 'utf8'))
      .digest('hex');
    expect(client.verifyWebhookSignature(body, sig)).toBe(true);
  });

  it('returns false when signature does not match', () => {
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec_test';
    const client = new SumitClient();
    const body = '{"event":"document.created","id":"doc_1"}';
    const wrong = crypto.createHmac('sha256', 'WRONG_SECRET').update(body).digest('hex');
    expect(client.verifyWebhookSignature(body, wrong)).toBe(false);
  });

  it('returns false when signature length differs (no timing leak)', () => {
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec_test';
    const client = new SumitClient();
    expect(client.verifyWebhookSignature('hello', 'ab')).toBe(false);
  });

  it('returns false on a non-hex signature string', () => {
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec_test';
    const client = new SumitClient();
    expect(client.verifyWebhookSignature('hello', 'zz-not-hex')).toBe(false);
  });

  it('accepts a Buffer body', () => {
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec_test';
    const client = new SumitClient();
    const body = Buffer.from('{"event":"x"}', 'utf8');
    const sig = crypto.createHmac('sha256', 'whsec_test').update(body).digest('hex');
    expect(client.verifyWebhookSignature(body, sig)).toBe(true);
  });
});

describe('SumitClient — wiring flags', () => {
  beforeEach(() => resetEnv());
  afterEach(() => resetEnv());

  it('health() flips to wired:true only with full env + SUMIT_ENABLED=true', () => {
    process.env.SUMIT_ENABLED = 'true';
    process.env.SUMIT_API_KEY = 'sk_test';
    process.env.SUMIT_COMPANY_ID = 'co_test';
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec_test';
    const client = new SumitClient();
    expect(client.health().wired).toBe(true);
  });

  it('createDocument fires the real send path when fully wired (no longer a PR-S4 throw)', async () => {
    process.env.SUMIT_ENABLED = 'true';
    process.env.SUMIT_API_KEY = 'sk_test';
    process.env.SUMIT_COMPANY_ID = 'co_test';
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec_test';
    // Mock fetch so this unit test NEVER reaches the real api.sumit.co.il.
    const fetchMock = vi.fn(async () => new Response('{"DocumentNumber":"doc-1"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new SumitClient();
    const result = await client.createDocument({
      supplierInvoiceId: 'i',
      idempotencyKey: 'k',
      customer: { name: 'n', businessNumber: 'b' },
      amountBeforeVat: 1,
      vatAmount: 0,
      totalAmount: 1,
      currency: 'ILS',
      description: 'd',
    });
    // The "PR-S4 not implemented" throw is gone: it now performs a real
    // (here mocked) call and returns a structured result, never throws.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.wired).toBe(true);
    expect(result.idempotencyKey).toBe('k');
    vi.restoreAllMocks();
  });

  it('SUMIT_ENABLED unset means wired:false even with all keys', () => {
    process.env.SUMIT_API_KEY = 'sk_test';
    process.env.SUMIT_COMPANY_ID = 'co_test';
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec_test';
    const client = new SumitClient();
    expect(client.health().wired).toBe(false);
  });
});
