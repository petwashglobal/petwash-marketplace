/**
 * A credit document must state the VAT we computed — or be refused.
 *
 * createCreditDocument accepted `vatAmount` and then ignored it: the body
 * always carried one VAT-bearing line with VATIncluded:true, so SUMIT derived
 * the VAT itself as 18/118 of the credited gross. For a booking that is the
 * same number, which is why nothing ever looked wrong.
 *
 * It is NOT the same number for a document that carried no VAT. A wallet
 * top-up / eGift purchase is issued as Type:'Receipt', payment-only, zero VAT,
 * because the tax event is at redemption (verified live on SUMIT doc #30000).
 * Crediting ₪500 of that would have produced a credit invoice reclaiming
 * ₪76.27 of VAT nobody ever charged or paid — VAT understated to the ITA, in
 * our favour, on a document carrying our company number.
 *
 * These pin the refusal, and pin that the ordinary cases still issue.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SumitClient } from '../services/SumitClient';

const originalEnv = { ...process.env };

function wireSumit() {
  process.env = { ...originalEnv };
  process.env.SUMIT_ENABLED = 'true';
  process.env.SUMIT_API_KEY = 'test-key-not-a-real-one';
  process.env.SUMIT_COMPANY_ID = '517145033';
  process.env.SUMIT_WEBHOOK_SECRET = 'test-webhook-secret';
  // Stays in sandbox (the default) — nothing here may reach the real company.
  delete process.env.SUMIT_SANDBOX;
  process.env.SUMIT_API_BASE_URL = 'https://sumit.invalid';
}

/** A fetch that would succeed — so a refusal can only come from the guard. */
function fetchThatWouldIssue() {
  return vi.fn(async () => new Response(
    JSON.stringify({ Status: 0, Data: { DocumentID: 99001 } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ));
}

describe('createCreditDocument refuses to misstate VAT', () => {
  beforeEach(() => wireSumit());
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('REFUSES a credit of a zero-VAT (stored-value) document, and calls SUMIT not at all', async () => {
    const fetchMock = fetchThatWouldIssue();
    vi.stubGlobal('fetch', fetchMock);

    const r = await new SumitClient().createCreditDocument({
      idempotencyKey: 'CN-EGIFT-1',
      customer: { name: 'Test Customer' },
      description: 'זיכוי שובר מתנה',
      amountBeforeVat: 500,
      vatAmount: 0, // stored value: no VAT was charged at purchase
      totalAmount: 500,
      currency: 'ILS',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.sumitDocumentId).toBeUndefined();
    expect(r.reason).toContain('CREDIT_VAT_MISMATCH');
    // The refusal names both numbers, so the person who picks it up off the
    // fiscal outbox can see WHY without reading the code.
    expect(r.reason).toContain('76.27');
    // wired:true — SUMIT is reachable and this is a refusal, not a no-op. That
    // distinction is what makes issueOnceAtSumit throw and raise the alert.
    expect(r.wired).toBe(true);
  });

  it('ISSUES the ordinary case: a full-VAT credit whose VAT is 18/118 of the gross', async () => {
    const fetchMock = fetchThatWouldIssue();
    vi.stubGlobal('fetch', fetchMock);

    const r = await new SumitClient().createCreditDocument({
      idempotencyKey: 'CN-WALK-1',
      originalSumitDocumentId: 10510,
      customer: { name: 'Test Customer' },
      description: 'זיכוי הזמנה',
      amountBeforeVat: 127.12,
      vatAmount: 22.88,
      totalAmount: 150,
      currency: 'ILS',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.sumitDocumentId).toBe('99001');
  });

  it('ISSUES a fee-only marketplace credit — the fee is VAT-inclusive, so the numbers agree', async () => {
    const fetchMock = fetchThatWouldIssue();
    vi.stubGlobal('fetch', fetchMock);

    // ₪1,000 walk, Pet Wash documents only its ₪150 fee. A one-third refund
    // credits ₪50 of fee with ₪7.63 of VAT — both rounded independently, which
    // the tolerance has to absorb.
    const r = await new SumitClient().createCreditDocument({
      idempotencyKey: 'CN-FEE-1',
      customer: { name: 'Test Customer' },
      description: 'זיכוי עמלה',
      amountBeforeVat: 42.37,
      vatAmount: 7.63,
      totalAmount: 50,
      currency: 'ILS',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.sumitDocumentId).toBe('99001');
  });

  it('REFUSES a credit that claims VAT at a rate the document would not show', async () => {
    const fetchMock = fetchThatWouldIssue();
    vi.stubGlobal('fetch', fetchMock);

    // 17% of an older era against a line SUMIT would stamp at 18%.
    const r = await new SumitClient().createCreditDocument({
      idempotencyKey: 'CN-OLD-RATE',
      customer: { name: 'Test Customer' },
      description: 'זיכוי ישן',
      amountBeforeVat: 854.70,
      vatAmount: 145.30,
      totalAmount: 1000,
      currency: 'ILS',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.reason).toContain('CREDIT_VAT_MISMATCH');
  });
});
