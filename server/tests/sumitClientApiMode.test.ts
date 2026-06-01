import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { SumitClient } from '../services/SumitClient';

const originalEnv = { ...process.env };

function setSumitEnv(opts: Partial<Record<string, string>> = {}) {
  process.env.SUMIT_API_KEY = opts.SUMIT_API_KEY ?? 'sk_test';
  process.env.SUMIT_COMPANY_ID = opts.SUMIT_COMPANY_ID ?? 'co_test';
  process.env.SUMIT_WEBHOOK_SECRET = opts.SUMIT_WEBHOOK_SECRET ?? 'whsec_test';
  process.env.SUMIT_ENABLED = opts.SUMIT_ENABLED ?? 'true';
  if (opts.SUMIT_SANDBOX !== undefined) {
    process.env.SUMIT_SANDBOX = opts.SUMIT_SANDBOX;
  } else {
    delete process.env.SUMIT_SANDBOX;
  }
  if (opts.SUMIT_API_BASE_URL !== undefined) {
    process.env.SUMIT_API_BASE_URL = opts.SUMIT_API_BASE_URL;
  } else {
    delete process.env.SUMIT_API_BASE_URL;
  }
}

function clearSumitEnv() {
  process.env = { ...originalEnv };
  delete process.env.SUMIT_ENABLED;
  delete process.env.SUMIT_API_KEY;
  delete process.env.SUMIT_COMPANY_ID;
  delete process.env.SUMIT_WEBHOOK_SECRET;
  delete process.env.SUMIT_API_BASE_URL;
  delete process.env.SUMIT_SANDBOX;
}

const sampleInput = {
  supplierInvoiceId: '42',
  idempotencyKey: 'petwash_sumit_42_abc',
  customer: {
    name: 'Acme Supplies Ltd',
    businessNumber: '517145033',
  },
  amountBeforeVat: 100,
  vatAmount: 18,
  totalAmount: 118,
  currency: 'ILS' as const,
  description: 'shampoo restock',
};

describe('SumitClient — sandbox-by-default safety', () => {
  beforeEach(() => clearSumitEnv());
  afterEach(() => clearSumitEnv());

  it('health() reports the single api host when SUMIT_SANDBOX is unset', () => {
    setSumitEnv();
    const h = new SumitClient().health();
    // SUMIT exposes ONE host. Sandbox vs production is the credential pair,
    // not the URL. (sandbox-api.sumit.co.il never existed — NXDOMAIN.)
    expect(h.baseUrl).toBe('https://api.sumit.co.il');
  });

  it('health() reports the api host even when SUMIT_SANDBOX="true" (host is not sandbox-selected)', () => {
    setSumitEnv({ SUMIT_SANDBOX: 'true' });
    expect(new SumitClient().health().baseUrl).toBe('https://api.sumit.co.il');
  });

  it('health() flips to production URL only when SUMIT_SANDBOX="false"', () => {
    setSumitEnv({ SUMIT_SANDBOX: 'false' });
    expect(new SumitClient().health().baseUrl).toBe('https://api.sumit.co.il');
  });

  it('any non-"false" value keeps the sandbox header tag true (defense against typos)', async () => {
    // Host is always api.sumit.co.il now; the typo-defense moved to the
    // X-PetWash-Sandbox tag — a typo must NOT flip into production-send mode.
    for (const typo of ['prod', 'FALSE', '0']) {
      setSumitEnv({ SUMIT_SANDBOX: typo });
      const fetchMock = vi.fn(async () => new Response('{"DocumentNumber":"t"}', { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      await new SumitClient().createDocument(sampleInput);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url, `typo=${typo}`).toBe('https://api.sumit.co.il/accounting/documents/create/');
      expect((init as RequestInit).headers as Record<string, string>, `typo=${typo}`)
        .toMatchObject({ 'X-PetWash-Sandbox': 'true' });
      vi.restoreAllMocks();
    }
  });

  it('explicit SUMIT_API_BASE_URL overrides both', () => {
    setSumitEnv({ SUMIT_API_BASE_URL: 'https://custom.example/v1' });
    expect(new SumitClient().health().baseUrl).toBe('https://custom.example/v1');
  });
});

describe('SumitClient — createDocument HTTP shape (sandbox)', () => {
  beforeEach(() => clearSumitEnv());
  afterEach(() => { clearSumitEnv(); vi.restoreAllMocks(); });

  it('returns wired:false when not wired (env missing)', async () => {
    // SUMIT_ENABLED unset
    process.env.SUMIT_API_KEY = 'sk';
    const r = await new SumitClient().createDocument(sampleInput);
    expect(r.wired).toBe(false);
    expect(r.idempotencyKey).toBe(sampleInput.idempotencyKey);
    expect(r.sumitDocumentId).toBeUndefined();
  });

  it('POSTs to the api host with body-embedded Credentials + Idempotency-Key header', async () => {
    setSumitEnv();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ DocumentNumber: 'doc-1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const r = await new SumitClient().createDocument(sampleInput);
    expect(r.wired).toBe(true);
    expect(r.sumitDocumentId).toBe('doc-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.sumit.co.il/accounting/documents/create/');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Idempotency-Key']).toBe(sampleInput.idempotencyKey);
    expect(headers['X-PetWash-Sandbox']).toBe('true');

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.Credentials.APIKey).toBe('sk_test');
    expect(body.Credentials.CompanyID).toBe('co_test');
    expect(body.Customer.Name).toBe('Acme Supplies Ltd');
    expect(body.Customer.ExternalIdentifier).toBe('517145033');
    expect(body.Items[0].UnitPrice).toBe(100);
    expect(body.Items[0].Currency).toBe('ILS');
    expect(body.ExternalIdentifier).toBe(sampleInput.idempotencyKey);
    expect(body.DocumentType).toBe(1);
  });

  it('switches to production URL when SUMIT_SANDBOX="false"', async () => {
    setSumitEnv({ SUMIT_SANDBOX: 'false' });
    const fetchMock = vi.fn(async () => new Response('{"DocumentNumber":"x"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await new SumitClient().createDocument(sampleInput);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.sumit.co.il/accounting/documents/create/');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-PetWash-Sandbox']).toBe('false');
  });

  it('extracts documentId from various response shapes', async () => {
    setSumitEnv();
    const variants: Array<[string, string]> = [
      [JSON.stringify({ DocumentNumber: 'A' }), 'A'],
      [JSON.stringify({ documentNumber: 'B' }), 'B'],
      [JSON.stringify({ Document: { DocumentNumber: 'C' } }), 'C'],
      [JSON.stringify({ Document: { Number: 'D' } }), 'D'],
      [JSON.stringify({ DocumentID: 'E' }), 'E'],
      [JSON.stringify({ id: 99 }), '99'],
    ];

    for (const [payload, expected] of variants) {
      const fetchMock = vi.fn(async () => new Response(payload, { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      const r = await new SumitClient().createDocument(sampleInput);
      expect(r.sumitDocumentId, `payload=${payload}`).toBe(expected);
    }
  });

  it('returns wired:true with no docId when response has no recognised field', async () => {
    setSumitEnv();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"other":1}', { status: 200 })));
    const r = await new SumitClient().createDocument(sampleInput);
    expect(r.wired).toBe(true);
    expect(r.sumitDocumentId).toBeUndefined();
    expect(r.rawResponse).toEqual({ other: 1 });
  });

  it('returns wired:true + reason on non-2xx (real reach, semantic error)', async () => {
    setSumitEnv();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"bad request"}', { status: 400 })));
    const r = await new SumitClient().createDocument(sampleInput);
    expect(r.wired).toBe(true);
    expect(r.sumitDocumentId).toBeUndefined();
    expect(r.reason).toMatch(/SUMIT returned 400/);
  });

  it('returns wired:false on network error (could not reach SUMIT)', async () => {
    setSumitEnv();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }));
    const r = await new SumitClient().createDocument(sampleInput);
    expect(r.wired).toBe(false);
    expect(r.reason).toMatch(/Network error/);
  });
});

describe('SumitClient.verifyWebhookSignature (unchanged from prior tests)', () => {
  beforeEach(() => clearSumitEnv());
  afterEach(() => clearSumitEnv());

  it('valid signature returns true', () => {
    process.env.SUMIT_WEBHOOK_SECRET = 'whsec_test';
    const body = '{"event":"doc.created"}';
    const sig = crypto.createHmac('sha256', 'whsec_test').update(body).digest('hex');
    expect(new SumitClient().verifyWebhookSignature(body, sig)).toBe(true);
  });
});
