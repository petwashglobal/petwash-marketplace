import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SumitClient } from '../services/SumitClient';

const originalEnv = { ...process.env };

function clearSumitEnv() {
  process.env = { ...originalEnv };
  delete process.env.SUMIT_ENABLED;
  delete process.env.SUMIT_API_KEY;
  delete process.env.SUMIT_COMPANY_ID;
  delete process.env.SUMIT_WEBHOOK_SECRET;
  delete process.env.SUMIT_API_BASE_URL;
  delete process.env.SUMIT_SANDBOX;
}

describe('SumitClient.connectionTest — read-only key proof', () => {
  beforeEach(() => clearSumitEnv());
  afterEach(() => { clearSumitEnv(); vi.restoreAllMocks(); });

  it('returns ok:false + !reachable when API key is missing (no HTTP call)', async () => {
    process.env.SUMIT_COMPANY_ID = 'co_test';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await new SumitClient().connectionTest();
    expect(r.ok).toBe(false);
    expect(r.reachable).toBe(false);
    expect(r.reason).toMatch(/SUMIT_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns ok:false + !reachable when Company ID is missing (no HTTP call)', async () => {
    process.env.SUMIT_API_KEY = 'sk_test';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await new SumitClient().connectionTest();
    expect(r.ok).toBe(false);
    expect(r.reachable).toBe(false);
    expect(r.reason).toMatch(/SUMIT_COMPANY_ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does NOT require SUMIT_ENABLED or webhook secret — only the credential pair', async () => {
    // No SUMIT_ENABLED, no SUMIT_WEBHOOK_SECRET on purpose.
    process.env.SUMIT_API_KEY = 'sk_test';
    process.env.SUMIT_COMPANY_ID = 'co_test';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ VATRate: 18 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await new SumitClient().connectionTest();
    expect(r.ok).toBe(true);
    expect(r.authRejected).toBe(false);
    expect(r.vatRate).toBe(18);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.sumit.co.il/accounting/general/getvatrate/');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.Credentials.APIKey).toBe('sk_test');
    expect(body.Credentials.CompanyID).toBe('co_test');
  });

  it('flags authRejected on 401 (bad key reached SUMIT)', async () => {
    process.env.SUMIT_API_KEY = 'bad';
    process.env.SUMIT_COMPANY_ID = 'co_test';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"unauthorized"}', { status: 401 })));
    const r = await new SumitClient().connectionTest();
    expect(r.ok).toBe(false);
    expect(r.reachable).toBe(true);
    expect(r.authRejected).toBe(true);
    expect(r.httpStatus).toBe(401);
  });

  it('treats a non-auth 4xx as reachable + key-likely-valid (not authRejected)', async () => {
    process.env.SUMIT_API_KEY = 'sk_test';
    process.env.SUMIT_COMPANY_ID = 'co_test';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"bad date"}', { status: 400 })));
    const r = await new SumitClient().connectionTest();
    expect(r.ok).toBe(false);
    expect(r.reachable).toBe(true);
    expect(r.authRejected).toBe(false);
    expect(r.httpStatus).toBe(400);
  });

  it('returns ok:false + !reachable on a network error (never throws)', async () => {
    process.env.SUMIT_API_KEY = 'sk_test';
    process.env.SUMIT_COMPANY_ID = 'co_test';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ENOTFOUND'); }));
    const r = await new SumitClient().connectionTest();
    expect(r.ok).toBe(false);
    expect(r.reachable).toBe(false);
    expect(r.reason).toMatch(/Could not reach SUMIT/);
  });
});
