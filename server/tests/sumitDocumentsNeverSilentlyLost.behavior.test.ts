/**
 * A PAID SALE OR A REFUND MUST NEVER SILENTLY MISS ITS SUMIT DOCUMENT —
 * AND A RETRY MUST NEVER ISSUE A SECOND ONE (2026-09-17).
 *
 * Card payments for bookings went live on 2026-09-17 (#2545). Two holes:
 *
 *  1. SumitClient returns "no document id" on a rejection or a dropped
 *     connection WITHOUT throwing. The receipt dispatcher returned
 *     {status:'no_document_id'}, runFiscalDocumentAndPersistOnFailure counted
 *     that as success, and nothing was queued. The credit-note path was a bare
 *     try/catch. Result: the customer paid (or was refunded) and the document
 *     the tax authority sees did not exist, with no retry and no alert.
 *
 *  2. Retrying naïvely is worse: if the request reached SUMIT and only the
 *     reply was lost, a second create issues a SECOND legal document, which can
 *     never be deleted — only credited (הוראות ניהול פנקסי חשבונות §23(ב)).
 *
 * issueOnceAtSumit fixes both: a create that returns no id THROWS (so the
 * outbox retries), and a retry reads SUMIT by ExternalReference before it
 * creates anything.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../db', () => ({ db: {}, pool: {} }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../lib/sendgrid', () => ({ createMailService: vi.fn(), isSendGridConfigured: () => false }));
vi.mock('../services/googleSheetsIntegration', () => ({ appendFormSubmission: vi.fn() }));
vi.mock('../services/TaxSequenceService', () => ({ allocateTaxSequenceNumber: vi.fn() }));
vi.mock('../lib/invoiceSequence', () => ({ generateCommissionInvoiceNumber: vi.fn() }));

import { IsraeliDigitalReceiptService, type SumitIssuer } from '../services/IsraeliDigitalReceiptService';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');
const AT = new Date('2026-09-17T09:34:00Z');

function issuer(over: Partial<SumitIssuer> = {}): SumitIssuer & { calls: { create: number; lookup: number } } {
  const calls = { create: 0, lookup: 0 };
  return {
    calls,
    createCustomerReceipt: vi.fn(async () => ({ sumitDocumentId: 'NEW-1' })),
    createCreditDocument: vi.fn(async () => ({ sumitDocumentId: 'NEW-1' })),
    findDocumentByExternalReference: vi.fn(async () => ({ outcome: 'ABSENT' as const })),
    ...over,
  } as any;
}

const run = (sumit: SumitIssuer, retry: boolean, create: () => Promise<{ sumitDocumentId?: string; reason?: string }>) =>
  IsraeliDigitalReceiptService.issueOnceAtSumit({
    sumitClient: sumit, retry, externalReference: 'PW-2026-000123',
    documentTypes: ['InvoiceAndReceipt'], createAttemptAt: AT, create,
  });

describe('first attempt', () => {
  it('a document id → issued, no lookup (the lookup costs paid SUMIT calls)', async () => {
    const s = issuer();
    const create = vi.fn(async () => ({ sumitDocumentId: '10510' }));
    await expect(run(s, false, create)).resolves.toEqual({ sumitDocumentId: '10510', recovered: false });
    expect(s.findDocumentByExternalReference).not.toHaveBeenCalled();
  });

  it('SUMIT rejected / connection dropped (no id, no throw) → THROWS so the outbox queues it', async () => {
    const s = issuer();
    await expect(run(s, false, async () => ({ reason: 'Network error: socket hang up' })))
      .rejects.toThrow(/SUMIT_NOT_ISSUED:PW-2026-000123: Network error/);
  });
});

describe('retry — read before recreate', () => {
  it('the first attempt DID reach SUMIT → link it, never create a second legal document', async () => {
    const s = issuer({
      findDocumentByExternalReference: vi.fn(async () => ({ outcome: 'FOUND' as const, documentId: '10510', documentType: 'InvoiceAndReceipt' })),
    });
    const create = vi.fn(async () => ({ sumitDocumentId: 'DUPLICATE' }));
    await expect(run(s, true, create)).resolves.toEqual({ sumitDocumentId: '10510', recovered: true });
    expect(create).not.toHaveBeenCalled();
    expect(s.findDocumentByExternalReference).toHaveBeenCalledWith({
      externalReference: 'PW-2026-000123', documentTypes: ['InvoiceAndReceipt'], createAttemptAt: AT,
    });
  });

  it('definitely absent → create it now', async () => {
    const s = issuer();
    const create = vi.fn(async () => ({ sumitDocumentId: '10511' }));
    await expect(run(s, true, create)).resolves.toEqual({ sumitDocumentId: '10511', recovered: false });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('could not read SUMIT → do NOT create; stay queued for a person', async () => {
    const s = issuer({ findDocumentByExternalReference: vi.fn(async () => ({ outcome: 'INCONCLUSIVE' as const, reason: 'http_500' })) });
    const create = vi.fn(async () => ({ sumitDocumentId: 'X' }));
    await expect(run(s, true, create)).rejects.toThrow(/SUMIT_RECONCILE_NEEDED:.*lookup inconclusive \(http_500\)/);
    expect(create).not.toHaveBeenCalled();
  });

  it('the reference exists under another document type → do NOT create', async () => {
    const s = issuer({ findDocumentByExternalReference: vi.fn(async () => ({ outcome: 'FOUND_MISMATCH' as const, documentId: '9', documentType: 'Invoice' })) });
    const create = vi.fn(async () => ({ sumitDocumentId: 'X' }));
    await expect(run(s, true, create)).rejects.toThrow(/another document type \(Invoice\)/);
    expect(create).not.toHaveBeenCalled();
  });

  it('absent, then the create fails again → still throws (keeps retrying, then flags for review)', async () => {
    await expect(run(issuer(), true, async () => ({ reason: 'Status 1: invalid customer' })))
      .rejects.toThrow(/SUMIT_NOT_ISSUED/);
  });
});

describe('wiring — both legal documents use it, and the retry worker looks first', () => {
  const svc = read('services/IsraeliDigitalReceiptService.ts');
  const drainer = read('index.ts');

  it('customer receipt AND platform-fee document go through issueOnceAtSumit', () => {
    const d = svc.slice(svc.indexOf('private static async dispatchReceiptToSumitWired('), svc.indexOf('static async generateReceipt('));
    expect(d.match(/issueOnceAtSumit\(\{/g)).toHaveLength(2);
    expect(d).not.toContain("status: 'no_document_id'");
    // A booking with no Pet Wash fee is a legitimate "nothing to issue", not a failure.
    expect(d).toContain("return { status: 'nothing_to_issue' };");
  });

  it('refund credit notes are durable: outbox job + lookup-before-create', () => {
    const i = svc.indexOf('static async issueCreditNote(params');
    const body = svc.slice(i, svc.indexOf('static async dispatchCreditNoteToSumit(', i));
    expect(body).toContain("kind: 'sumit_credit_dispatch'");
    expect(body).toContain('sourceKey: `credit_note:${creditNote.id}`');
    expect(body).not.toContain('sumitClient.createCreditDocument(');
    const wired = svc.slice(svc.indexOf('static async dispatchCreditNoteToSumitWired('));
    expect(wired).toContain("documentTypes: ['CreditInvoiceAndReceipt']");
    expect(wired).toContain('externalReference: credit.receiptNumber');
  });

  it('the retry worker passes retry:true for both kinds', () => {
    expect(drainer).toMatch(/sumit_receipt_dispatch: async \(p: any\) => \{\s*await IsraeliDigitalReceiptService\.dispatchReceiptToSumit\(\{[^}]*retry: true \}\);/);
    expect(drainer).toMatch(/sumit_credit_dispatch: async \(p: any\) => \{\s*await IsraeliDigitalReceiptService\.dispatchCreditNoteToSumit\(\{[^}]*retry: true \}\);/);
    expect(read('services/fiscalDocumentOutbox.ts')).toContain("| 'sumit_credit_dispatch'");
  });

  it('a first attempt is NOT a retry (no paid lookup on the happy path)', () => {
    expect(svc).toContain('runNow: () => IsraeliDigitalReceiptService.dispatchReceiptToSumit({ receiptId: receipt.id, paymentClass: params.paymentClass })');
    expect(svc).toContain('runNow: () => IsraeliDigitalReceiptService.dispatchCreditNoteToSumit({ creditNoteId: creditNote.id })');
  });
});
