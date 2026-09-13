/**
 * Every SUMIT call, pinned to SUMIT's OFFICIAL schema (2026-09-13).
 * Source: https://api.sumit.co.il/swagger/v1/swagger.json.
 *
 * Two facts drive every test here:
 *   1. SUMIT answers HTTP 200 for EVERYTHING. Success is envelope Status 0
 *      (live: a wrong key is 200 + Status 1 "Invalid Credentials").
 *   2. Results live under Data.* — documents/create returns Data.DocumentID,
 *      customers/create Data.CustomerID, getforcustomer Data.PaymentMethod…
 *      The client read top-level guesses, so a document SUMIT really created
 *      came back id-less, which the K9000 bridge treated as "create again".
 *
 * Read-only audit of the production SUMIT account the same day: 552 documents,
 * 0 duplicate ExternalReferences — none of these bugs has fired yet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { readSumitEnvelope, sumitClient } from '../services/SumitClient';

const saved = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

function respond(...bodies: unknown[]) {
  let i = 0;
  fetchMock = vi.fn(async () => new Response(JSON.stringify(bodies[Math.min(i++, bodies.length - 1)]), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
}
const sentBody = (n = 0) => JSON.parse(String((fetchMock.mock.calls[n] as any)[1].body));
const sentUrl = (n = 0) => String((fetchMock.mock.calls[n] as any)[0]);

const REFUSED = { Data: null, Status: 1, UserErrorMessage: 'Invalid Credentials (CompanyID/APIKey are incorrect)', TechnicalErrorDetails: null };

beforeEach(() => {
  process.env.SUMIT_ENABLED = 'true';
  process.env.SUMIT_API_KEY = 'test-key-not-real';
  process.env.SUMIT_COMPANY_ID = '12345';
  process.env.SUMIT_WEBHOOK_SECRET = 'whsec-test';
  process.env.SUMIT_API_BASE_URL = 'https://sumit.test';
});
afterEach(() => { process.env = { ...saved }; vi.unstubAllGlobals(); });

const receiptInput = {
  idempotencyKey: 'PW-TEST-1',
  customer: { name: 'Test' },
  amountBeforeVat: 40.68,
  vatAmount: 7.32,
  totalAmount: 48,
  currency: 'ILS',
  description: 'K9000 wash',
};

describe('readSumitEnvelope', () => {
  it('Status 0 is the only success', () => {
    expect(readSumitEnvelope({ Status: 0, Data: { X: 1 } })).toEqual({ ok: true, data: { X: 1 } });
    expect(readSumitEnvelope(REFUSED)).toMatchObject({ ok: false });
    expect(readSumitEnvelope({ Status: 'Success (0)', Data: {} })).toMatchObject({ ok: true }); // schema's string enum
    expect(readSumitEnvelope({ Status: 'BusinessError (1)', UserErrorMessage: 'x' })).toMatchObject({ ok: false });
    expect(readSumitEnvelope(null)).toMatchObject({ ok: false });
    // Flat accepted create seen in SUMIT's own API log (no Status, real DocumentID).
    expect(readSumitEnvelope({ DocumentID: 5, DocumentNumber: 10001 })).toMatchObject({ ok: true });
    expect(readSumitEnvelope({ DocumentID: 'E' })).toMatchObject({ ok: false });
  });
});

describe('document ids come from Data.DocumentID', () => {
  it('createCustomerReceipt: the documented success returns the id (not the number)', async () => {
    respond({ Status: 0, Data: { DocumentID: 900123, DocumentNumber: 10501, CustomerID: 55 } });
    const r = await sumitClient.createCustomerReceipt(receiptInput as any);
    expect(r).toMatchObject({ wired: true, sumitDocumentId: '900123' });
    expect(sentUrl()).toBe('https://sumit.test/accounting/documents/create/');
  });

  it('the old guessed top-level shape yields NO id', async () => {
    respond({ DocumentNumber: 'INV-999', ID: 7 });
    const r = await sumitClient.createCustomerReceipt(receiptInput as any);
    expect(r.sumitDocumentId).toBeUndefined();
  });

  it('a refusal (HTTP 200 + Status 1) is reported with SUMIT’s message, never as a created document', async () => {
    respond(REFUSED);
    const r = await sumitClient.createCustomerReceipt(receiptInput as any);
    expect(r.sumitDocumentId).toBeUndefined();
    expect(r.reason).toContain('Invalid Credentials');
  });

  it('createCreditDocument reads Data.DocumentID', async () => {
    respond({ Status: 0, Data: { DocumentID: 900200, DocumentNumber: 20001 } });
    const r = await sumitClient.createCreditDocument({
      idempotencyKey: 'CR-1', originalSumitDocumentId: '900123', customer: { name: 'T' },
      amountBeforeVat: 40.68, vatAmount: 7.32, totalAmount: 48, currency: 'ILS', description: 'refund',
    } as any);
    expect(r.sumitDocumentId).toBe('900200');
  });

  it('createCreditDocument refusal carries the reason', async () => {
    respond(REFUSED);
    const r = await sumitClient.createCreditDocument({
      idempotencyKey: 'CR-2', customer: { name: 'T' }, amountBeforeVat: 1, vatAmount: 0.18, totalAmount: 1.18, currency: 'ILS', description: 'x',
    } as any);
    expect(r.sumitDocumentId).toBeUndefined();
    expect(r.reason).toContain('Status 1');
  });
});

describe('customers', () => {
  it('createCustomer reads Data.CustomerID / Data.CustomerHistoryURL', async () => {
    respond({ Status: 0, Data: { CustomerID: 4242, CustomerHistoryURL: 'https://app.sumit.co.il/c/4242' } });
    const r: any = await sumitClient.createCustomer({ externalIdentifier: 'u1', name: 'T', email: 't@example.com' } as any);
    expect(JSON.stringify(r)).toContain('4242');
  });

  it('createCustomer refusal is not a customer', async () => {
    respond(REFUSED);
    const r: any = await sumitClient.createCustomer({ externalIdentifier: 'u1', name: 'T', email: 't@example.com' } as any);
    expect(JSON.stringify(r)).not.toContain('4242');
    expect(r.reason).toContain('Status 1');
  });

  it('getCustomerDetailsUrl reads Data.CustomerHistoryURL', async () => {
    respond({ Status: 0, Data: { CustomerHistoryURL: 'https://app.sumit.co.il/c/4242' } });
    const r: any = await sumitClient.getCustomerDetailsUrl('4242');
    expect(r.url).toBe('https://app.sumit.co.il/c/4242');
  });
});

describe('beginRedirect', () => {
  it('success → Data.RedirectURL', async () => {
    respond({ Status: 0, Data: { RedirectURL: 'https://pay.sumit.co.il/o2cy14/a/redirectpayment/?redirectid=abc' } });
    const r = await sumitClient.beginRedirect({ externalId: 'e1', redirectUrl: 'https://petwash.co.il/r', description: 'x', amountIls: 20 } as any);
    expect(r.redirectUrl).toContain('pay.sumit.co.il');
  });

  it('a refusal whose error text contains a URL never becomes a pay page', async () => {
    respond({ Status: 2, Data: null, UserErrorMessage: 'see https://evil.example/help', TechnicalErrorDetails: 'https://x.example' });
    const r = await sumitClient.beginRedirect({ externalId: 'e1', redirectUrl: 'https://petwash.co.il/r', description: 'x', amountIls: 20 } as any);
    expect(r.redirectUrl).toBeUndefined();
  });
});

describe('saved payment methods', () => {
  it('getForCustomer: Data.PaymentMethod is ONE object', async () => {
    respond({ Status: 0, Data: { PaymentMethod: { ID: 77, CreditCard_LastDigits: '4242' }, InactivePaymentMethods: [] } });
    const r = await sumitClient.getForCustomer(4242);
    expect(r.items).toHaveLength(1);
    expect((r.items[0] as any).ID).toBe(77);
  });

  it('getForCustomer: no active method → empty; refusal → empty with reason', async () => {
    respond({ Status: 0, Data: { PaymentMethod: null, InactivePaymentMethods: [] } });
    expect((await sumitClient.getForCustomer(4242)).items).toHaveLength(0);
    respond(REFUSED);
    const r = await sumitClient.getForCustomer(4242);
    expect(r.items).toHaveLength(0);
    expect(r.reason).toContain('Status 1');
  });

  it('setForCustomer sends SingleUseToken and reads Data.PaymentMethod.ID', async () => {
    respond({ Status: 0, Data: { CustomerID: 4242, PaymentMethod: { ID: 88 } } });
    const r = await sumitClient.setForCustomer({ sumitCustomerId: 4242, singlePaymentToken: 'tok-1' });
    expect(sentBody()).toHaveProperty('SingleUseToken', 'tok-1');
    expect(sentBody()).not.toHaveProperty('SinglePaymentToken');
    expect(r).toMatchObject({ saved: true, paymentMethodId: '88' });
  });

  it('setForCustomer refusal is not saved', async () => {
    respond(REFUSED);
    expect((await sumitClient.setForCustomer({ sumitCustomerId: 4242, singlePaymentToken: 'tok-1' })).saved).toBe(false);
  });

  it('removeSavedMethod: schema has only Customer; a refusal is not "removed"', async () => {
    respond(REFUSED);
    const r = await sumitClient.removeSavedMethod({ sumitCustomerId: 4242, paymentMethodId: '88' });
    expect(sentBody()).not.toHaveProperty('PaymentMethodID');
    expect(r.removed).toBe(false);
  });
});

describe('documents for a customer', () => {
  it('uses /accounting/documents/list/ (search does not exist) and keeps only this customer, across pages', async () => {
    respond(
      { Status: 0, Data: { HasNextPage: true, Documents: [{ DocumentID: 1, CustomerID: 4242 }, { DocumentID: 2, CustomerID: 9 }] } },
      { Status: 0, Data: { HasNextPage: false, Documents: [{ DocumentID: 3, CustomerID: 4242 }] } },
    );
    const r = await sumitClient.listDocumentsForCustomer(4242);
    expect(sentUrl()).toBe('https://sumit.test/accounting/documents/list/');
    expect(r.items.map((d: any) => d.DocumentID)).toEqual([1, 3]);
    expect(sentBody(1).Paging.StartIndex).toBe(2);
    expect(sentBody()).not.toHaveProperty('Filter');
  });

  it('a refusal is empty WITH a reason (never a silent "no documents")', async () => {
    respond(REFUSED);
    const r = await sumitClient.listDocumentsForCustomer(4242);
    expect(r.items).toHaveLength(0);
    expect(r.reason).toContain('Status 1');
  });
});

describe('charges with no SUMIT idempotency key are disabled (fail closed)', () => {
  it('chargeSavedCard never calls SUMIT without its explicit flag', async () => {
    respond({ Status: 0, Data: {} });
    const r = await sumitClient.chargeSavedCard({ idempotencyKey: 'k', sumitCustomerId: 4242, description: 'x', amountIls: 450 });
    expect(r.captured).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('chargeRecurring never calls SUMIT without its explicit flag', async () => {
    respond({ Status: 0, Data: {} });
    const r = await sumitClient.chargeRecurring({ idempotencyKey: 'k', sumitCustomerId: 4242, description: 'x', amountIls: 99 });
    expect(r.sumitDocumentId).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('chargeSavedCard (flag on) reads Data.Payment.ValidPayment, not guesses', async () => {
    process.env.SUMIT_SAVED_CARD_CHARGE_ENABLED = 'true';
    respond({ Status: 0, Data: { Payment: { ID: 555, ValidPayment: false }, DocumentID: null } });
    const r = await sumitClient.chargeSavedCard({ idempotencyKey: 'k', sumitCustomerId: 4242, description: 'x', amountIls: 450 });
    expect(r.captured).toBe(false);
    expect(sentBody()).not.toHaveProperty('ExternalIdentifier');
    expect(sentBody()).toHaveProperty('DocumentLanguage', 'Hebrew');
  });

  it('cancelRecurring: a refusal is not "cancelled"; the id is an integer', async () => {
    respond(REFUSED);
    const r = await sumitClient.cancelRecurring({ sumitCustomerId: 4242, recurringId: '31' });
    expect(r.cancelled).toBe(false);
    expect(sentBody().RecurringCustomerItemID).toBe(31);
  });

  it('listRecurringForCustomer reads Data.RecurringItems', async () => {
    respond({ Status: 0, Data: { RecurringItems: [{ ID: 31 }, { ID: 32 }] } });
    expect((await sumitClient.listRecurringForCustomer(4242)).items).toHaveLength(2);
  });
});

describe('stored-value eGift sold through the Nayax till follows the CPA mapping', () => {
  it('EGIFT_PURCHASE → payment-only Receipt, no VAT-bearing item', async () => {
    respond({ Status: 0, Data: { DocumentID: 900300, DocumentNumber: 30001 } });
    const { SumitReceiptService } = await import('../services/SumitReceiptService');
    const r = await SumitReceiptService.issueCustomerReceipt({
      idempotencyKey: 'nayax-1', sourceRef: 'v1', customerName: 'T', totalAmountIls: 250,
      description: 'PetWash e-Gift card', paymentClass: 'EGIFT_PURCHASE',
    });
    expect(r).toMatchObject({ ok: true, sumitDocumentId: '900300' });
    const body = sentBody();
    expect(body.Details.Type).toBe('Receipt');
    expect(body.Items).toBeUndefined();
  });

  it('a plain paid sale (no class) stays InvoiceAndReceipt with the VAT line', async () => {
    respond({ Status: 0, Data: { DocumentID: 900301, DocumentNumber: 10502 } });
    const { SumitReceiptService } = await import('../services/SumitReceiptService');
    await SumitReceiptService.issueCustomerReceipt({
      idempotencyKey: 'k9000-1', sourceRef: 'w1', customerName: 'T', totalAmountIls: 48, description: 'wash',
    });
    const body = sentBody();
    expect(body.Details.Type).toBe('InvoiceAndReceipt');
    expect(body.Items[0].UnitPrice).toBe(48); // VAT-inclusive entry — SUMIT extracts the VAT
    expect(body.VATIncluded).toBe(true);
  });

  it('the Nayax eGift approval passes EGIFT_PURCHASE', () => {
    const src = readFileSync(join(__dirname, '../nayaxService.ts'), 'utf8');
    expect(src).toContain("pending.isGiftCard ? { paymentClass: 'EGIFT_PURCHASE' as const } : {}");
  });
});

describe('marketplace bookings: Pet Wash documents ONLY its platform fee (gross model, 2026-09-14)', () => {
  it('the dispatcher sends the fee amount, never the whole booking (covered by marketplaceGrossModel.behavior.test.ts)', () => {
    const src = readFileSync(join(__dirname, '../services/IsraeliDigitalReceiptService.ts'), 'utf8');
    expect(src).not.toContain("return { status: 'withheld' };");
    expect(src).toContain('const feeIls = Number(row.brokerCommissionAmount ?? row.platformFeeAmount ?? 0);');
  });
});
