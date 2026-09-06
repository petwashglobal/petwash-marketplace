/**
 * Regression pin — REFUND ORCHESTRATION ORDERING.
 *
 * The pure rules live in nayaxRefundRail. What is pinned HERE is the sequence in
 * which they are acted on, because every duplicate-tax-document failure mode is
 * an ordering failure, not a logic failure:
 *
 *   - claim BEFORE create, so a crash mid-flight is still recoverable;
 *   - recovery reads SUMIT around the CREATE ATTEMPT, never the transaction time;
 *   - a create that returns no document id is NOT a success;
 *   - an INCONCLUSIVE read never authorises a second create.
 *
 * A fake store and a fake SUMIT are used deliberately: these guarantees must hold
 * without a database and without a live fiscal API, and a test that needed either
 * would not be run often enough to protect anything.
 */
import { describe, it, expect } from 'vitest';
import {
  attemptCreditIssuance,
  recoverClaim,
  splitInclusiveMinor,
  type RefundRow,
  type RefundStore,
  type SumitCreditPort,
} from '../services/nayaxRefundOrchestrator';
import { REFUND_STATE } from '../services/nayaxRefundRail';

const MACHINE = '182443';
const REFUND_TX = '6990000517';

/** Every call, in order, so ordering can be asserted rather than assumed. */
type Call = { kind: 'load' | 'claim' | 'settle' | 'link' | 'create' | 'lookup'; detail?: any };

function makeWorld(over: Partial<RefundRow> = {}, sumitOver: Partial<SumitCreditPort> = {}) {
  const calls: Call[] = [];
  const row: RefundRow = {
    refundTransactionId: REFUND_TX,
    machineId: MACHINE,
    amountMinor: 4800,
    currency: 'ILS',
    originalTransactionId: '4595298208',
    originalResolutionSource: 'NAYAX_AUTHORITATIVE',
    originalFiscalDocumentId: '10480',
    originalAmountMinor: 4800,
    confirmedCreditedMinor: 0,
    reversalIsFinal: true,
    refundSettledAt: new Date('2026-07-01T09:30:00Z'),
    state: REFUND_STATE.READY,
    externalReference: `nayax-credit:${REFUND_TX}`,
    firstCreateAttemptAt: null,
    attemptCount: 0,
    sumitCreditDocumentId: null,
    ...over,
  };

  const store: RefundStore = {
    async load() { calls.push({ kind: 'load' }); return { ...row }; },
    async claim(_m, _r, now) {
      calls.push({ kind: 'claim', detail: { now } });
      // Same predicate as the real SQL: a held or settled claim is not re-taken.
      if (row.state === REFUND_STATE.CLAIMED || row.state === REFUND_STATE.ISSUED) return null;
      row.firstCreateAttemptAt = row.firstCreateAttemptAt ?? now; // COALESCE
      row.attemptCount += 1;
      row.state = REFUND_STATE.CLAIMED;
      return { firstCreateAttemptAt: row.firstCreateAttemptAt!, attemptCount: row.attemptCount };
    },
    async settle(_m, _r, next) {
      calls.push({ kind: 'settle', detail: next });
      row.state = next.state;
      if (next.documentId) row.sumitCreditDocumentId = next.documentId;
    },
    async recordCreditLink(input) { calls.push({ kind: 'link', detail: input }); },
  };

  const sumit: SumitCreditPort = {
    async createCreditDocument(input) {
      calls.push({ kind: 'create', detail: input });
      return { wired: true, sumitDocumentId: 'CREDIT-1' };
    },
    async findDocumentByExternalReference(input) {
      calls.push({ kind: 'lookup', detail: input });
      return { outcome: 'ABSENT' as const };
    },
    ...sumitOver,
  };

  return { calls, row, store, sumit };
}

const kinds = (calls: Call[]) => calls.map((c) => c.kind);
const count = (calls: Call[], k: Call['kind']) => calls.filter((c) => c.kind === k).length;

describe('claim is persisted BEFORE the create call', () => {
  it('writes the claim first, then creates, then settles', async () => {
    const w = makeWorld();
    const out = await attemptCreditIssuance({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(kinds(w.calls)).toEqual(['load', 'claim', 'create', 'settle', 'link']);
    expect(out).toEqual({ issued: true, state: 'ISSUED', documentId: 'CREDIT-1' });
  });

  it('records the attempt instant, so recovery has a window to search', async () => {
    const w = makeWorld();
    await attemptCreditIssuance({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(w.row.firstCreateAttemptAt).toBeInstanceOf(Date);
  });
});

describe('a blocked refund never reaches SUMIT', () => {
  it('does not claim and does not create when the original is unresolved', async () => {
    const w = makeWorld({ originalTransactionId: null });
    const out = await attemptCreditIssuance({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(count(w.calls, 'create')).toBe(0);
    expect(count(w.calls, 'claim')).toBe(0);
    expect(out).toMatchObject({ issued: false, reason: 'blocked' });
  });

  it('does not create when only a heuristic named the original', async () => {
    const w = makeWorld({ originalResolutionSource: 'HEURISTIC_SUGGESTION' });
    await attemptCreditIssuance({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(count(w.calls, 'create')).toBe(0);
  });

  it('does not create when the refund has no Nayax close to date the credit by', async () => {
    const w = makeWorld({ refundSettledAt: null });
    await attemptCreditIssuance({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(count(w.calls, 'create')).toBe(0);
  });
});

describe('"no exception" is not "document exists"', () => {
  it('parks a wired:false result as PENDING_LOOKUP, never ISSUED', async () => {
    const w = makeWorld({}, {
      async createCreditDocument() { return { wired: false, reason: 'not_wired' }; },
    });
    const out = await attemptCreditIssuance({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(out).toMatchObject({ issued: false, state: REFUND_STATE.PENDING_LOOKUP });
    expect(count(w.calls, 'link')).toBe(0);
  });

  it('parks a 2xx-with-no-document-id as PENDING_LOOKUP', async () => {
    // createCreditDocument never throws by contract, so this is the shape a real
    // failure takes: a returned object carrying no id.
    const w = makeWorld({}, {
      async createCreditDocument() { return { wired: true, sumitDocumentId: null }; },
    });
    const out = await attemptCreditIssuance({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(out).toMatchObject({ state: REFUND_STATE.PENDING_LOOKUP });
    expect(count(w.calls, 'link')).toBe(0);
  });
});

describe('the claim is a lock', () => {
  it('a second caller is refused while a claim is held, and does not create', async () => {
    const w = makeWorld();
    const first = await attemptCreditIssuance({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(first.issued).toBe(true);
    // Row is now ISSUED — a re-entry must return the existing document untouched.
    const second = await attemptCreditIssuance({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(second).toEqual({ issued: true, state: 'ISSUED', documentId: 'CREDIT-1' });
    expect(count(w.calls, 'create')).toBe(1);
  });

  it('refuses a caller arriving while the claim is still CLAIMED', async () => {
    const w = makeWorld({ state: REFUND_STATE.CLAIMED });
    const out = await attemptCreditIssuance({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(out).toMatchObject({ issued: false, reason: 'claim_in_flight' });
    expect(count(w.calls, 'create')).toBe(0);
  });
});

describe('the credit document is dated by the Nayax refund close', () => {
  it('sends documentDate equal to the refund settlement instant', async () => {
    const w = makeWorld({ refundSettledAt: new Date('2026-07-01T09:30:00Z') });
    await attemptCreditIssuance({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    const create = w.calls.find((c) => c.kind === 'create')!;
    expect(create.detail.documentDate.toISOString()).toBe('2026-07-01T09:30:00.000Z');
  });

  it('keys the document on the refund event, never on the sale', async () => {
    const w = makeWorld();
    await attemptCreditIssuance({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    const create = w.calls.find((c) => c.kind === 'create')!;
    expect(create.detail.idempotencyKey).toBe(`nayax-credit:${REFUND_TX}`);
    expect(create.detail.originalSumitDocumentId).toBe('10480');
  });

  it('splits a VAT-inclusive amount at the statutory rate', () => {
    // ₪48 inclusive — the live bay price.
    expect(splitInclusiveMinor(4800)).toEqual({
      totalAmount: 48, amountBeforeVat: 40.68, vatAmount: 7.32,
    });
  });
});

describe('recovery searches around the CREATE ATTEMPT, not the transaction', () => {
  const ATTEMPT = new Date('2026-08-10T10:00:00Z');
  const SETTLED = new Date('2026-07-01T09:30:00Z');

  it('passes first_create_attempt_at to the lookup', async () => {
    const w = makeWorld({
      state: REFUND_STATE.PENDING_LOOKUP, firstCreateAttemptAt: ATTEMPT,
      refundSettledAt: SETTLED, attemptCount: 1,
    });
    await recoverClaim({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    const lookup = w.calls.find((c) => c.kind === 'lookup')!;
    expect(lookup.detail.createAttemptAt).toBe(ATTEMPT);
    expect(lookup.detail.createAttemptAt).not.toBe(SETTLED);
  });

  it('FINDS a document issued far from the transaction but near the attempt — and does NOT recreate', async () => {
    // The measured reality on the 481 real K9000 documents: the gap from service
    // to issue ran to a median of 30 days and a maximum of 56. This models a
    // document issued 2026-08-12 for a wash on 2026-07-01. A window centred on
    // the wash would report ABSENT and authorise a duplicate legal document; a
    // window centred on the attempt finds it.
    const ISSUED_AT = new Date('2026-08-12T00:00:00Z');
    const WINDOW_DAYS = 30;
    const w = makeWorld(
      {
        state: REFUND_STATE.PENDING_LOOKUP, firstCreateAttemptAt: ATTEMPT,
        refundSettledAt: SETTLED, attemptCount: 1,
      },
      {
        async findDocumentByExternalReference(input) {
          const at = input.createAttemptAt!;
          const withinWindow =
            Math.abs(ISSUED_AT.getTime() - at.getTime()) <= WINDOW_DAYS * 86400_000;
          return withinWindow
            ? { outcome: 'FOUND' as const, documentId: 'CREDIT-EXISTING', documentNumber: '30001' }
            : { outcome: 'ABSENT' as const };
        },
      },
    );
    const out = await recoverClaim({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);

    expect(out).toMatchObject({ state: REFUND_STATE.ISSUED, recreated: false, documentId: 'CREDIT-EXISTING' });
    expect(count(w.calls, 'create')).toBe(0);
    expect(count(w.calls, 'link')).toBe(1);

    // And the counterfactual that makes the point: the same document is NOT
    // findable from a window centred on the settlement instant.
    expect(Math.abs(ISSUED_AT.getTime() - SETTLED.getTime()) > WINDOW_DAYS * 86400_000).toBe(true);
  });
});

describe('recovery never turns uncertainty into a second document', () => {
  const base = {
    state: REFUND_STATE.PENDING_LOOKUP,
    firstCreateAttemptAt: new Date('2026-08-10T10:00:00Z'),
    attemptCount: 1,
  };

  it('INCONCLUSIVE → NEEDS_RECONCILIATION, zero creates', async () => {
    const w = makeWorld(base, {
      async findDocumentByExternalReference() {
        return { outcome: 'INCONCLUSIVE' as const, reason: 'not_wired' };
      },
    });
    const out = await recoverClaim({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(out.state).toBe(REFUND_STATE.NEEDS_RECONCILIATION);
    expect(count(w.calls, 'create')).toBe(0);
  });

  it('FOUND_MISMATCH → NEEDS_RECONCILIATION, zero creates', async () => {
    const w = makeWorld(base, {
      async findDocumentByExternalReference() {
        return { outcome: 'FOUND_MISMATCH' as const, documentId: 'X', documentType: 'Invoice' };
      },
    });
    const out = await recoverClaim({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(out.state).toBe(REFUND_STATE.NEEDS_RECONCILIATION);
    expect(count(w.calls, 'create')).toBe(0);
    expect(count(w.calls, 'link')).toBe(0);
  });

  it('ABSENT inside the budget → exactly ONE recreate', async () => {
    const w = makeWorld(base);
    const out = await recoverClaim({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(out.recreated).toBe(true);
    expect(count(w.calls, 'create')).toBe(1);
  });

  it('ABSENT with the budget exhausted → NEEDS_RECONCILIATION, zero creates', async () => {
    const w = makeWorld({ ...base, attemptCount: 2 });
    const out = await recoverClaim({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(out.state).toBe(REFUND_STATE.NEEDS_RECONCILIATION);
    expect(count(w.calls, 'create')).toBe(0);
  });

  it('an already-issued claim is returned untouched — no lookup, no create', async () => {
    const w = makeWorld({ state: REFUND_STATE.ISSUED, sumitCreditDocumentId: 'CREDIT-9' });
    const out = await recoverClaim({ store: w.store, sumit: w.sumit }, MACHINE, REFUND_TX);
    expect(out).toMatchObject({ state: REFUND_STATE.ISSUED, documentId: 'CREDIT-9', recreated: false });
    expect(count(w.calls, 'lookup')).toBe(0);
    expect(count(w.calls, 'create')).toBe(0);
  });
});
