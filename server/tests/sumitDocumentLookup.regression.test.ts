/**
 * findDocumentByExternalReference — the duplicate guard behind stale-claim recovery.
 *
 * THE FAILURE THIS PREVENTS
 * The create request reaches SUMIT, SUMIT issues the document, and the HTTP
 * response dies on the way back. Our claim is left stale. If recovery calls
 * create again, a SECOND legal tax document exists for one wash — and an issued
 * Israeli tax document cannot be deleted, only credited.
 *
 * So recovery must read before it recreates, and the only dangerous confusion is
 * "I could not tell" collapsing into "not found". Every test below exists to keep
 * those two apart. Fixtures only: fetch is stubbed, no SUMIT call is made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sumitClient } from '../services/SumitClient';

const ARGS = {
  externalReference: 'nayax-bay:2207959160',
  documentTypes: ['InvoiceAndReceipt'],
  dateHint: new Date('2026-09-06T09:00:00Z'),
};
const saved: Record<string, string | undefined> = {};
const ENV = ['SUMIT_ENABLED', 'SUMIT_API_KEY', 'SUMIT_COMPANY_ID', 'SUMIT_WEBHOOK_SECRET'];

const ok = (rows: unknown[], hasNext = false) => ({
  ok: true, status: 200,
  json: async () => ({ Status: 0, Data: { Documents: rows, HasNextPage: hasNext } }),
});

beforeEach(() => {
  for (const k of ENV) saved[k] = process.env[k];
  process.env.SUMIT_ENABLED = 'true';
  process.env.SUMIT_API_KEY = 'test-key';
  process.env.SUMIT_COMPANY_ID = '1455151432';
  process.env.SUMIT_WEBHOOK_SECRET = 'test-secret';
});
afterEach(() => {
  for (const k of ENV) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]!);
  vi.unstubAllGlobals();
});

describe('findDocumentByExternalReference — never mistakes doubt for absence', () => {
  it('returns FOUND with the document id when the reference matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([
      { DocumentID: 111, DocumentNumber: 10480, ExternalReference: 'nayax-bay:other' },
      { DocumentID: 222, DocumentNumber: 10481, ExternalReference: ARGS.externalReference },
    ])));
    const r = await sumitClient.findDocumentByExternalReference(ARGS);
    expect(r).toEqual({ outcome: 'FOUND', documentId: '222', documentNumber: '10481' });
  });

  it('returns ABSENT only when pagination completes cleanly with no match', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([
      { DocumentID: 111, ExternalReference: 'nayax-bay:someone-else' },
    ], false)));
    expect(await sumitClient.findDocumentByExternalReference(ARGS)).toEqual({ outcome: 'ABSENT' });
  });

  // ── Everything below must NOT be ABSENT. Each would otherwise authorise a
  //    second legal document for a wash that already has one.
  it('is INCONCLUSIVE when the client is not wired — not ABSENT', async () => {
    process.env.SUMIT_ENABLED = 'false';
    const r = await sumitClient.findDocumentByExternalReference(ARGS);
    expect(r.outcome).toBe('INCONCLUSIVE');
    expect(r).not.toEqual({ outcome: 'ABSENT' });
  });

  it('is INCONCLUSIVE on an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    const r = await sumitClient.findDocumentByExternalReference(ARGS);
    expect(r.outcome).toBe('INCONCLUSIVE');
    expect((r as any).reason).toContain('503');
  });

  it('is INCONCLUSIVE when the network throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    const r = await sumitClient.findDocumentByExternalReference(ARGS);
    expect(r.outcome).toBe('INCONCLUSIVE');
    expect((r as any).reason).toContain('ECONNRESET');
  });

  it('is INCONCLUSIVE when SUMIT reports a non-zero Status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ Status: 2, UserErrorMessage: 'Invalid Request JSON' }),
    }));
    expect((await sumitClient.findDocumentByExternalReference(ARGS)).outcome).toBe('INCONCLUSIVE');
  });

  // The subtle one: pages keep coming and we run out of budget. The document may
  // well be on the next page — reporting ABSENT here is how a duplicate is born.
  it('is INCONCLUSIVE when the page budget is exhausted with more pages pending', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([{ DocumentID: 1, ExternalReference: 'x' }], true)));
    const r = await sumitClient.findDocumentByExternalReference({ ...ARGS, maxPages: 3 });
    expect(r.outcome).toBe('INCONCLUSIVE');
    expect((r as any).reason).toContain('page_budget_exhausted');
  });

  it('is INCONCLUSIVE when the reference matches but carries no document id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([
      { ExternalReference: ARGS.externalReference },
    ])));
    const r = await sumitClient.findDocumentByExternalReference(ARGS);
    expect(r.outcome).toBe('INCONCLUSIVE');
    expect((r as any).reason).toBe('match_without_document_id');
  });

  it('finds a match on a later page rather than stopping at the first', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok([{ DocumentID: 1, ExternalReference: 'a' }], true))
      .mockResolvedValueOnce(ok([{ DocumentID: 2, ExternalReference: ARGS.externalReference }], true));
    vi.stubGlobal('fetch', f);
    const r = await sumitClient.findDocumentByExternalReference(ARGS);
    expect(r).toMatchObject({ outcome: 'FOUND', documentId: '2' });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('never reports ABSENT from any failure mode', async () => {
    const failures = [
      { ok: false, status: 500, json: async () => ({}) },
      { ok: true, status: 200, json: async () => ({ Status: 'BusinessError' }) },
    ];
    for (const f of failures) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(f));
      expect((await sumitClient.findDocumentByExternalReference(ARGS)).outcome).not.toBe('ABSENT');
    }
  });
});
