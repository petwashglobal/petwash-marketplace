/**
 * Regression pin — THE DUPLICATE TAX INVOICE GUARD.
 *
 * The hourly cron used to claim it was "idempotent (deterministic key per Nayax
 * tx), so overlapping runs can never double-issue a document". It was not:
 *
 *   - the deterministic key reached SUMIT only as an Idempotency-Key header and
 *     an ExternalReference, and SUMIT deduplicates on NEITHER — which is exactly
 *     why read-before-recreate had to be built;
 *   - candidates came from the live Nayax feed alone, consulting nothing
 *     persisted, and nothing recorded the document afterwards.
 *
 * Run hourly over a rolling window, that issues a fresh tax invoice for every
 * eligible wash on every run. A tax invoice cannot be withdrawn.
 *
 * The first test here is the one that matters: the SAME sale, run TWICE, must
 * produce exactly ONE document.
 */
import { describe, it, expect } from 'vitest';
import {
  issueSaleWithClaim,
  recoverSaleClaim,
  issueSalesWithClaims,
  SALE_ISSUANCE_STATE,
  type SaleClaim,
  type SaleIssuanceStore,
  type SaleSumitPort,
} from '../services/nayaxSaleIssuance';
import { idempotencyKeyFor, type DocumentableSale } from '../services/nayaxSumitBridge';

const sale = (over: Partial<DocumentableSale> = {}): DocumentableSale => ({
  transactionId: '2206704842',
  machineId: '182443',
  totalInclVat: 48,
  amountBeforeVat: 40.68,
  vatAmount: 7.32,
  currency: 'ILS',
  settledAt: '2026-09-05 13:19:13',
  ...over,
} as DocumentableSale);

/**
 * In-memory store that reproduces the REAL SQL semantics: the unique index means
 * a claim cannot be taken while the row is CLAIMED or ISSUED.
 */
function makeStore() {
  const rows = new Map<string, SaleClaim>();
  const links: any[] = [];
  const key = (m: string, t: string) => `${m}:${t}`;
  const store: SaleIssuanceStore = {
    async claim(s, now) {
      const k = key(String(s.machineId), String(s.transactionId));
      const existing = rows.get(k);
      if (existing && (existing.state === SALE_ISSUANCE_STATE.CLAIMED
                    || existing.state === SALE_ISSUANCE_STATE.ISSUED)) {
        return null; // the guarded DO UPDATE matched nothing
      }
      const next: SaleClaim = {
        state: SALE_ISSUANCE_STATE.CLAIMED,
        externalReference: idempotencyKeyFor(String(s.transactionId)),
        firstCreateAttemptAt: existing?.firstCreateAttemptAt ?? now, // COALESCE
        attemptCount: (existing?.attemptCount ?? 0) + 1,
        sumitDocumentId: existing?.sumitDocumentId ?? null,
      };
      rows.set(k, next);
      return next;
    },
    async get(m, t) { return rows.get(key(m, t)) ?? null; },
    async settle(m, t, next) {
      const k = key(m, t);
      const cur = rows.get(k);
      if (!cur) return;
      rows.set(k, {
        ...cur,
        state: next.state,
        sumitDocumentId: next.documentId ?? cur.sumitDocumentId ?? null,
      });
    },
    async recordDocumentLink(input) { links.push(input); },
  };
  return { store, rows, links };
}

function makeSumit(over: Partial<SumitCall> = {}) {
  const calls = { create: 0, lookup: 0 };
  let n = 0;
  const sumit: SaleSumitPort = {
    async createCustomerReceipt() {
      calls.create += 1;
      return { wired: true, sumitDocumentId: `DOC-${++n}` };
    },
    async findDocumentByExternalReference() {
      calls.lookup += 1;
      return { outcome: 'ABSENT' as const };
    },
    ...(over as any),
  };
  return { sumit, calls };
}
type SumitCall = SaleSumitPort;

describe('THE GUARD — the same wash cannot be invoiced twice', () => {
  it('two runs over the same sale produce exactly ONE document', async () => {
    const { store, links } = makeStore();
    const { sumit, calls } = makeSumit();
    const s = sale();

    const first = await issueSaleWithClaim({ store, sumit }, s);
    const second = await issueSaleWithClaim({ store, sumit }, s);

    expect(first).toMatchObject({ issued: true, documentId: 'DOC-1' });
    // The second run reports the SAME document — it does not create another.
    expect(second).toMatchObject({ issued: true, documentId: 'DOC-1' });
    expect(calls.create).toBe(1);
    expect(links).toHaveLength(1);
  });

  it('twelve runs — an hourly cron over half a day — still produce ONE document', async () => {
    const { store } = makeStore();
    const { sumit, calls } = makeSumit();
    const s = sale();
    for (let i = 0; i < 12; i++) await issueSaleWithClaim({ store, sumit }, s);
    expect(calls.create).toBe(1);
  });

  it('a concurrent run that loses the claim never creates', async () => {
    const { store } = makeStore();
    const { sumit, calls } = makeSumit();
    const s = sale();
    // Claim held (state CLAIMED, create still in flight — no settle yet).
    await store.claim(s, new Date());
    const out = await issueSaleWithClaim({ store, sumit }, s);
    expect(out).toMatchObject({ issued: false, state: 'ALREADY_CLAIMED' });
    expect(calls.create).toBe(0);
  });

  it('distinct sales are each invoiced once', async () => {
    const { store } = makeStore();
    const { sumit, calls } = makeSumit();
    const sales = [sale({ transactionId: '1' }), sale({ transactionId: '2' }), sale({ transactionId: '3' })];
    await issueSalesWithClaims({ store, sumit }, sales);
    await issueSalesWithClaims({ store, sumit }, sales);
    expect(calls.create).toBe(3);
  });
});

describe('the claim is written BEFORE the create call', () => {
  it('a create that never returns still leaves an attempt instant to search from', async () => {
    const { store, rows } = makeStore();
    const s = sale();
    const sumit: SaleSumitPort = {
      async createCustomerReceipt() { throw new Error('network died mid-flight'); },
      async findDocumentByExternalReference() { return { outcome: 'ABSENT' as const }; },
    };
    await expect(issueSaleWithClaim({ store, sumit }, s)).rejects.toThrow();
    const row = rows.get('182443:2206704842')!;
    expect(row.firstCreateAttemptAt).toBeInstanceOf(Date);
    expect(row.state).toBe(SALE_ISSUANCE_STATE.CLAIMED);
  });
});

describe('no store means no guard — so issuance refuses', () => {
  it('refuses to issue a batch with no claim store, and creates nothing', async () => {
    const { sumit, calls } = makeSumit();
    const out = await issueSalesWithClaims({ store: null, sumit }, [sale()]);
    expect(out.refused).toBe('no_claim_store');
    expect(out.outcomes).toHaveLength(0);
    expect(calls.create).toBe(0);
  });
});

describe('"no exception" is not "document exists"', () => {
  it('parks a create that returns no document id, and does not link it', async () => {
    const { store, links } = makeStore();
    const { sumit } = makeSumit({
      async createCustomerReceipt() { return { wired: true, sumitDocumentId: null }; },
    } as any);
    const out = await issueSaleWithClaim({ store, sumit }, sale());
    expect(out).toMatchObject({ issued: false, state: SALE_ISSUANCE_STATE.PENDING_LOOKUP });
    expect(links).toHaveLength(0);
  });

  it('parks an unwired result rather than treating silence as success', async () => {
    const { store } = makeStore();
    const { sumit } = makeSumit({
      async createCustomerReceipt() { return { wired: false, reason: 'not_wired' }; },
    } as any);
    const out = await issueSaleWithClaim({ store, sumit }, sale());
    expect(out).toMatchObject({ issued: false, state: SALE_ISSUANCE_STATE.PENDING_LOOKUP });
  });
});

describe('recovery reads SUMIT rather than recreating blindly', () => {
  const ATTEMPT = new Date('2026-09-05T13:20:00Z');

  async function parked() {
    const { store, links } = makeStore();
    const s = sale();
    await store.claim(s, ATTEMPT);
    await store.settle('182443', '2206704842', { state: SALE_ISSUANCE_STATE.PENDING_LOOKUP });
    return { store, links, s };
  }

  it('FOUND → links the existing document, creates nothing', async () => {
    const { store, links, s } = await parked();
    const { sumit, calls } = makeSumit({
      async findDocumentByExternalReference() {
        return { outcome: 'FOUND' as const, documentId: 'DOC-EXISTING', documentNumber: '10999' };
      },
    } as any);
    const out = await recoverSaleClaim({ store, sumit }, s);
    expect(out).toMatchObject({ issued: true, documentId: 'DOC-EXISTING', recovered: true });
    expect(calls.create).toBe(0);
    expect(links).toHaveLength(1);
  });

  it('searches around the CREATE ATTEMPT, not the wash time', async () => {
    const { store, s } = await parked();
    let seen: Date | null | undefined;
    const { sumit } = makeSumit({
      async findDocumentByExternalReference(input: any) {
        seen = input.createAttemptAt;
        return { outcome: 'ABSENT' as const };
      },
    } as any);
    await recoverSaleClaim({ store, sumit }, s);
    expect(seen).toEqual(ATTEMPT);
  });

  it('INCONCLUSIVE → NEEDS_RECONCILIATION, creates nothing', async () => {
    const { store, s } = await parked();
    const { sumit, calls } = makeSumit({
      async findDocumentByExternalReference() {
        return { outcome: 'INCONCLUSIVE' as const, reason: 'not_wired' };
      },
    } as any);
    const out = await recoverSaleClaim({ store, sumit }, s);
    expect(out).toMatchObject({ issued: false, state: SALE_ISSUANCE_STATE.NEEDS_RECONCILIATION });
    expect(calls.create).toBe(0);
  });

  it('FOUND_MISMATCH → NEEDS_RECONCILIATION, creates nothing', async () => {
    const { store, s } = await parked();
    const { sumit, calls } = makeSumit({
      async findDocumentByExternalReference() {
        return { outcome: 'FOUND_MISMATCH' as const, documentId: 'X', documentType: 'Receipt' };
      },
    } as any);
    const out = await recoverSaleClaim({ store, sumit }, s);
    expect(out).toMatchObject({ state: SALE_ISSUANCE_STATE.NEEDS_RECONCILIATION });
    expect(calls.create).toBe(0);
  });

  it('ABSENT inside the budget → exactly one recreate', async () => {
    const { store, s } = await parked();
    const { sumit, calls } = makeSumit();
    const out = await recoverSaleClaim({ store, sumit }, s);
    expect(out.issued).toBe(true);
    expect(calls.create).toBe(1);
  });

  it('ABSENT with the budget exhausted → NEEDS_RECONCILIATION, creates nothing', async () => {
    const { store, s } = await parked();
    // A second failed pass: attemptCount now exceeds the budget of one.
    await store.claim(s, ATTEMPT);
    await store.settle('182443', '2206704842', { state: SALE_ISSUANCE_STATE.PENDING_LOOKUP });
    const { sumit, calls } = makeSumit();
    const out = await recoverSaleClaim({ store, sumit }, s);
    expect(out).toMatchObject({ state: SALE_ISSUANCE_STATE.NEEDS_RECONCILIATION });
    expect(calls.create).toBe(0);
  });
});
