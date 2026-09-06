/**
 * Fiscal cutover — the guard that stops the live rail turning historical turnover
 * into per-transaction invoices.
 *
 * WHY THIS PIN EXISTS
 * On 05/09/2026 a manual backfill ran with NAYAX_SUMIT_CUTOVER_AT=2026-01-01 and
 * issued 481 individual tax invoices for the Jul–Sep history. The written
 * instruction for that period was ONE consolidated document built from the Nayax
 * report. Before this guard, `server/` had NO cutover concept at all — the live
 * cron would have done the same thing to every historical row Lynx returned.
 *
 * The two treatments are the bookkeeper's distinction, not ours:
 *   HISTORICAL_CONSOLIDATED  many transactions → one consolidated document
 *   POST_CUTOVER_INDIVIDUAL  one transaction  → one document
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  applyFiscalCutover, fiscalCutoverAt, bridgeWired, FISCAL_TREATMENT,
  selectDocumentableSales, buildReceiptInput, K9000_INCOME_ITEM,
  FISCAL_LINK_TYPE, FISCAL_LINK_SOURCE,
  type DocumentableSale, type FiscalDocumentLink,
} from '../services/nayaxSumitBridge';

const sale = (id: string, settledAt?: string): DocumentableSale => ({
  transactionId: id, machineId: '182443', totalInclVat: 48, amountBeforeVat: 40.68,
  vatAmount: 7.32, currency: 'ILS', settledAt,
});
const CUTOVER = new Date('2026-09-05T13:00:00+03:00');

describe('fiscal cutover — historical vs post-cutover treatment', () => {
  const saved = process.env.NAYAX_SUMIT_CUTOVER_AT;
  beforeEach(() => { delete process.env.NAYAX_SUMIT_CUTOVER_AT; });
  afterEach(() => {
    if (saved === undefined) delete process.env.NAYAX_SUMIT_CUTOVER_AT;
    else process.env.NAYAX_SUMIT_CUTOVER_AT = saved;
  });

  // FOUR states, not three. An earlier draft had three and could not express
  // that 481 individual historical finals demonstrably exist in SUMIT, while the
  // bookkeeper may still direct consolidated coverage for some historical set.
  it('can represent every fiscal treatment that actually occurs', () => {
    expect(Object.keys(FISCAL_TREATMENT).sort()).toEqual([
      'HISTORICAL_CONSOLIDATED',
      'HISTORICAL_EXISTING_INDIVIDUAL',
      'HISTORICAL_UNRESOLVED',
      'POST_CUTOVER_INDIVIDUAL',
    ]);
  });

  it('keeps consolidated coverage representable — the bookkeeper may still direct it', () => {
    expect(FISCAL_TREATMENT.HISTORICAL_CONSOLIDATED).toBe('HISTORICAL_CONSOLIDATED');
  });

  it('records individual historical finals as what they are, not as consolidated', () => {
    expect(FISCAL_TREATMENT.HISTORICAL_EXISTING_INDIVIDUAL)
      .toBe('HISTORICAL_EXISTING_INDIVIDUAL');
    expect(FISCAL_TREATMENT.HISTORICAL_EXISTING_INDIVIDUAL)
      .not.toBe(FISCAL_TREATMENT.HISTORICAL_CONSOLIDATED);
  });

  it('has an honest default for a settled transaction with no established treatment', () => {
    expect(FISCAL_TREATMENT.HISTORICAL_UNRESOLVED).toBe('HISTORICAL_UNRESOLVED');
  });

  // The relationship is many-to-one and observed, so it lives in link records —
  // not in the enum, which is only a label.
  it('models transaction↔document coverage as links with provenance', () => {
    expect(Object.keys(FISCAL_LINK_TYPE).sort())
      .toEqual(['CONSOLIDATED_COVERAGE', 'CREDIT_REFUND', 'INDIVIDUAL_ORIGINAL']);
    expect(Object.keys(FISCAL_LINK_SOURCE).sort()).toEqual(
      ['BOOKKEEPER_DIRECTED', 'BRIDGE_ISSUED', 'MANUAL', 'SUMIT_EXTERNAL_REFERENCE']);
  });

  it('lets many transactions share one consolidated document', () => {
    const observedAt = '2026-09-06T12:00:00Z';
    const links: FiscalDocumentLink[] = ['a', 'b', 'c'].map((t) => ({
      nayaxTransactionId: t, sumitDocumentId: 'DOC-X',
      linkType: FISCAL_LINK_TYPE.CONSOLIDATED_COVERAGE,
      source: FISCAL_LINK_SOURCE.BOOKKEEPER_DIRECTED, observedAt,
    }));
    expect(new Set(links.map((l) => l.sumitDocumentId)).size).toBe(1);
    expect(new Set(links.map((l) => l.nayaxTransactionId)).size).toBe(3);
  });

  it('lets one transaction carry an original AND a later credit', () => {
    const links: FiscalDocumentLink[] = [
      { nayaxTransactionId: 't1', sumitDocumentId: 'D1',
        linkType: FISCAL_LINK_TYPE.INDIVIDUAL_ORIGINAL,
        source: FISCAL_LINK_SOURCE.SUMIT_EXTERNAL_REFERENCE,
        observedAt: '2026-09-06T12:00:00Z' },
      { nayaxTransactionId: 't1', sumitDocumentId: 'D2',
        linkType: FISCAL_LINK_TYPE.CREDIT_REFUND,
        source: FISCAL_LINK_SOURCE.SUMIT_EXTERNAL_REFERENCE,
        observedAt: '2026-09-06T12:00:00Z' },
    ];
    expect(links.filter((l) => l.nayaxTransactionId === 't1')).toHaveLength(2);
  });

  // THE CORE GUARANTEE. Without a cutover the old code issued for EVERY settled
  // row; the safe default is the opposite.
  it('issues NOTHING when no cutover is configured — never everything', () => {
    const { eligible, historical } = applyFiscalCutover(
      [sale('a', '2026-09-06T09:00:00Z'), sale('b', '2026-07-10T12:00:00Z')], null);
    expect(eligible).toHaveLength(0);
    expect(historical).toHaveLength(2);
  });

  // NOTE ON WHAT THIS PROVES. In the test environment SUMIT and Lynx are not
  // wired, so `canIssue` is already false for reasons unrelated to the cutover —
  // asserting `canIssue === false` here would pass even with the guard removed.
  // The honest, environment-independent invariant is the implication:
  // the bridge may never be able to issue while the cutover is unconfigured.
  it('can never issue while the cutover is unconfigured', () => {
    expect(fiscalCutoverAt()).toBeNull();
    const w = bridgeWired();
    expect(w.cutover).toBe(false);
    expect(w.canIssue && !w.cutover).toBe(false); // canIssue ⇒ cutover
  });

  it('exposes cutover as its own wiring condition, not folded into the others', () => {
    process.env.NAYAX_SUMIT_CUTOVER_AT = '2026-09-05T13:00:00+03:00';
    expect(fiscalCutoverAt()?.toISOString()).toBe(CUTOVER.toISOString());
    expect(bridgeWired().cutover).toBe(true);
    delete process.env.NAYAX_SUMIT_CUTOVER_AT;
    expect(bridgeWired().cutover).toBe(false);
  });

  it('treats an unparseable cutover as unset rather than as epoch zero', () => {
    process.env.NAYAX_SUMIT_CUTOVER_AT = 'whenever';
    expect(fiscalCutoverAt()).toBeNull();
    expect(bridgeWired().cutover).toBe(false);
  });

  it('withholds a sale settled BEFORE the cutover', () => {
    const { eligible, historical } = applyFiscalCutover([sale('old', '2026-08-10T09:00:00Z')], CUTOVER);
    expect(eligible).toHaveLength(0);
    expect(historical.map((s) => s.transactionId)).toEqual(['old']);
  });

  it('issues for a sale settled AFTER the cutover', () => {
    const { eligible, historical } = applyFiscalCutover([sale('new', '2026-09-06T09:00:00Z')], CUTOVER);
    expect(eligible.map((s) => s.transactionId)).toEqual(['new']);
    expect(historical).toHaveLength(0);
  });

  // The boundary is inclusive at the cutover instant — one rule, no gap, no overlap.
  it('treats the cutover instant itself as post-cutover', () => {
    const { eligible } = applyFiscalCutover([sale('edge', CUTOVER.toISOString())], CUTOVER);
    expect(eligible.map((s) => s.transactionId)).toEqual(['edge']);
  });

  // A legal document must never be dated on a timestamp we could not read.
  it('withholds a sale whose settlement timestamp is missing or unparseable', () => {
    const { eligible, historical } = applyFiscalCutover(
      [sale('nodate', undefined), sale('junk', 'not-a-date')], CUTOVER);
    expect(eligible).toHaveLength(0);
    expect(historical).toHaveLength(2);
  });

  it('splits a mixed batch on the boundary and keeps every row accounted for', () => {
    const batch = [
      sale('jul', '2026-07-10T12:42:00Z'), sale('aug', '2026-08-20T08:00:00Z'),
      sale('sep-before', '2026-09-05T05:00:00Z'), sale('sep-after', '2026-09-05T11:00:00Z'),
    ];
    const { eligible, historical } = applyFiscalCutover(batch, CUTOVER);
    expect(eligible.map((s) => s.transactionId)).toEqual(['sep-after']);
    expect(historical.map((s) => s.transactionId)).toEqual(['jul', 'aug', 'sep-before']);
    expect(eligible.length + historical.length).toBe(batch.length);
  });

  // The selector must carry the settlement instant through, or the gate is blind.
  it('carries settledAt from the Lynx row so the gate has something to judge', () => {
    const [s] = selectDocumentableSales([{
      TransactionID: 900, MachineID: 182443, CurrencyCode: 'ILS',
      AuthorizationValue: 48, SettlementValue: 48, PaymentMethod: 'Credit Card',
      SettlementDateTimeGMT: '2026-09-06T09:00:00',
    }]);
    expect(s.settledAt).toBe('2026-09-06T09:00:00');
    expect(applyFiscalCutover([s], CUTOVER).eligible).toHaveLength(1);
  });
});

/**
 * The catalogue item on FUTURE documents.
 *
 * The 481 documents issued 05/09/2026 are attached to a SUMIT item named
 * "PetWash rail verification" — a wiring-test name that became the business
 * product label, which is why SUMIT's product report reads
 * "PetWash rail verification — ₪20,945, 99.9%". That item and those documents
 * are frozen. These pins govern what the bridge bills against from now on.
 */
describe('K9000 income item — future documents only', () => {
  it('bills against a stable Hebrew business product, not a test name', () => {
    expect(K9000_INCOME_ITEM.name).toBe('שטיפת כלבים בשירות עצמי – Pet Wash™');
    expect(K9000_INCOME_ITEM.externalId).toBe('PETWASH-K9000-WASH');
  });

  it('never reuses the test item id the 481 documents are attached to', () => {
    expect(K9000_INCOME_ITEM.externalId).not.toBe('PETWASH-K9000-SELFWASH');
    expect(K9000_INCOME_ITEM.name.toLowerCase()).not.toContain('verification');
    expect(K9000_INCOME_ITEM.name.toLowerCase()).not.toContain('test');
  });

  // The item is the PRODUCT. Putting the bay in the item name would give SUMIT one
  // "product" per bay and make the product report useless — the exact failure mode
  // the description-derived item created.
  it('keeps station and bay OFF the item and ON the line', () => {
    const wald = buildReceiptInput(sale('t1', '2026-09-06T09:00:00Z'));
    expect(wald.item).toEqual({
      name: K9000_INCOME_ITEM.name, externalId: K9000_INCOME_ITEM.externalId,
    });
    expect(wald.item!.name).not.toContain('ימין');
    expect(wald.lineDescription).toBe('כפר סבא פארק ולד — ימין');
  });

  it('gives every bay the SAME item but its OWN line', () => {
    const bays = ['182374', '182403', '182443', '182462'].map((m) =>
      buildReceiptInput({ ...sale('x', '2026-09-06T09:00:00Z'), machineId: m }));
    expect(new Set(bays.map((b) => b.item!.externalId)).size).toBe(1);
    expect(new Set(bays.map((b) => b.lineDescription)).size).toBe(4);
    expect(bays.map((b) => b.lineDescription)).toContain('פארק 80 כפר סבא הירוקה — ימין');
  });
});
