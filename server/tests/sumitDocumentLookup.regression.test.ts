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
  // When we ASKED SUMIT to create — never the wash settlement instant.
  createAttemptAt: new Date('2026-09-06T09:00:00Z'),
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


/**
 * The search window, and the date format it is sent in.
 *
 * Both of these were wrong in the first version of this function, and both fail
 * SILENTLY into ABSENT — the one outcome that authorises creating a second legal
 * tax document for a wash that already has one.
 */
describe('window and date format — the two silent paths to a duplicate', () => {
  const bodyOf = (f: any) => JSON.parse(f.mock.calls[0][1].body);

  // Measured on the 480 real documents: service→issue gap is min -1d, MEDIAN 30d,
  // max 56d. A ±3d window around SETTLEMENT would have said ABSENT for 455 of 480
  // documents that exist. The window must sit on the create attempt.
  it('centres the window on the create attempt, not on any settlement time', async () => {
    const f = vi.fn().mockResolvedValue(ok([]));
    vi.stubGlobal('fetch', f);
    await sumitClient.findDocumentByExternalReference({
      ...ARGS, createAttemptAt: new Date('2026-09-05T21:00:00Z'), windowDays: 30,
    });
    const b = bodyOf(f);
    expect(b.DateFrom).toBe('2026-08-07');   // 30d before the ATTEMPT
    expect(b.DateTo).toBe('2026-10-06');
  });

  it('is INCONCLUSIVE when the create-attempt timestamp is unknown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([])));
    for (const at of [undefined, null, new Date('nonsense')]) {
      const r = await sumitClient.findDocumentByExternalReference({ ...ARGS, createAttemptAt: at as any });
      expect(r.outcome).toBe('INCONCLUSIVE');
      expect(r).not.toEqual({ outcome: 'ABSENT' });
    }
  });

  // Verified live 2026-09-06: SUMIT reads MM/DD/YYYY or ISO. '01/09/2026' →
  // Status 2. Worse, a DD/MM string whose halves are both ≤12 is read as a
  // DIFFERENT MONTH, returns zero rows cleanly, and yields ABSENT.
  it('sends ISO dates, never DD/MM', async () => {
    const f = vi.fn().mockResolvedValue(ok([]));
    vi.stubGlobal('fetch', f);
    await sumitClient.findDocumentByExternalReference({
      ...ARGS, createAttemptAt: new Date('2026-09-06T09:00:00Z'), windowDays: 1,
    });
    const b = bodyOf(f);
    for (const d of [b.DateFrom, b.DateTo]) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d).not.toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
    expect(b.DateFrom).toBe('2026-09-05');
    expect(b.DateTo).toBe('2026-09-07');
  });

  it('defaults to a window wide enough to cover observed issuance lag', async () => {
    const f = vi.fn().mockResolvedValue(ok([]));
    vi.stubGlobal('fetch', f);
    await sumitClient.findDocumentByExternalReference(ARGS);
    const b = bodyOf(f);
    const days = (Date.parse(b.DateTo) - Date.parse(b.DateFrom)) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(60);
  });
});
