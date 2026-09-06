/**
 * Regression pin — FISCAL DATING OF K9000 DOCUMENTS.
 *
 * Bookkeeper ruling, 2026-09-06 (Michal):
 *   "מפה והלאה, במסגרת החיבור האוטומטי (API), כל חשבונית שתופק ב-SUMIT צריכה
 *    להיווצר בזמן אמת בהתאם לתאריך ולשעת סגירת העסקה בפועל ב-Nayax"
 *   — every invoice issued through the API must be created in real time according
 *     to the date and time the transaction ACTUALLY CLOSED at the Nayax terminal.
 *
 * Two engineering consequences, both pinned here:
 *
 *  1. The document must carry an EXPLICIT date taken from the Nayax close. Before
 *     this change the rail sent no date at all, so SUMIT stamped "now" — which is
 *     only equal to the close while the rail is perfectly current, and drifts on
 *     any retry, backlog or recovery.
 *
 *  2. That date must be derived from an instant parsed EXPLICITLY as UTC. Nayax's
 *     field is `SettlementDateTimeGMT` but carries no zone marker, and JavaScript
 *     resolves a zone-less timestamp in the host process's timezone. Measured on a
 *     dev laptop (Australia/Melbourne) vs a UTC server, bare `new Date()` put the
 *     same 22:30 GMT wash on two DIFFERENT Israeli days.
 *
 * Since the issue date alone determines the reporting period, a day that slips
 * across a month boundary moves income into the wrong VAT period. These tests
 * hold by construction on any host timezone.
 */
import { describe, it, expect } from 'vitest';
import {
  parseNayaxSettlementInstant,
  israeliFiscalDate,
  issuanceBlockers,
  ISSUANCE_BLOCKER,
  applyFiscalCutover,
  buildReceiptInput,
  type DocumentableSale,
} from '../services/nayaxSumitBridge';

function sale(over: Partial<DocumentableSale> = {}): DocumentableSale {
  return {
    transactionId: '3467932999',
    machineId: '182443',
    totalInclVat: 48,
    amountBeforeVat: 40.68,
    vatAmount: 7.32,
    currency: 'ILS',
    settledAt: '2026-09-05 09:30:00',
    ...over,
  } as DocumentableSale;
}

describe('parseNayaxSettlementInstant — zone-less Nayax times are UTC, not host-local', () => {
  it('reads a zone-less "YYYY-MM-DD HH:mm:ss" as GMT (the field name is authoritative)', () => {
    // This assertion is timezone-independent BY CONSTRUCTION: it names the instant,
    // not a local rendering. Under bare `new Date()` it fails on any non-UTC host.
    expect(parseNayaxSettlementInstant('2026-09-05 22:30:00')!.toISOString())
      .toBe('2026-09-05T22:30:00.000Z');
  });

  it('accepts the T-separated form identically', () => {
    expect(parseNayaxSettlementInstant('2026-09-05T22:30:00')!.toISOString())
      .toBe('2026-09-05T22:30:00.000Z');
  });

  it('honours an explicit Z or offset when Nayax does send one', () => {
    expect(parseNayaxSettlementInstant('2026-09-05T22:30:00Z')!.toISOString())
      .toBe('2026-09-05T22:30:00.000Z');
    expect(parseNayaxSettlementInstant('2026-09-06T01:30:00+03:00')!.toISOString())
      .toBe('2026-09-05T22:30:00.000Z');
  });

  it('REFUSES a DD/MM/YYYY string rather than guessing the month', () => {
    // The Excel export uses DD/MM. When both halves are <= 12 a guess is silently
    // a different month — so the fiscal rail refuses it. Refusing makes the sale
    // unissuable; guessing would make it MISDATED, which is worse.
    expect(parseNayaxSettlementInstant('05/09/2026 09:30:00')).toBeNull();
    expect(parseNayaxSettlementInstant('09/05/2026')).toBeNull();
  });

  it('returns null for empty, junk and impossible dates', () => {
    for (const bad of ['', '   ', 'yesterday', '2026-13-01 10:00:00', '2026-02-30 10:00:00', null, undefined]) {
      expect(parseNayaxSettlementInstant(bad as string | null | undefined)).toBeNull();
    }
  });
});

describe('israeliFiscalDate — the day on the face of the document is the day in ISRAEL', () => {
  it('rolls a late-evening GMT wash onto the NEXT Israeli day', () => {
    // 22:30 GMT on 5 Sep is 01:30 on 6 Sep in Israel (UTC+3 in summer).
    const t = parseNayaxSettlementInstant('2026-09-05 22:30:00')!;
    expect(israeliFiscalDate(t)).toBe('2026-09-06');
  });

  it('crosses a MONTH boundary correctly — this is the VAT-period case', () => {
    // 21:10 GMT on 31 Aug is 00:10 on 1 Sep in Israel: a different VAT period.
    const t = parseNayaxSettlementInstant('2026-08-31 21:10:00')!;
    expect(israeliFiscalDate(t)).toBe('2026-09-01');
  });

  it('leaves a daytime wash on its own day', () => {
    expect(israeliFiscalDate(parseNayaxSettlementInstant('2026-09-05 09:30:00')!))
      .toBe('2026-09-05');
  });

  it('emits yyyy-MM-dd, never DD/MM — SUMIT reads ISO or MM/DD only', () => {
    expect(israeliFiscalDate(parseNayaxSettlementInstant('2026-09-05 09:30:00')!))
      .toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('an undatable sale is WITHHELD, never issued with a substituted date', () => {
  it('blocks a sale whose settlement time is missing', () => {
    expect(issuanceBlockers(sale({ settledAt: undefined })))
      .toContain(ISSUANCE_BLOCKER.NO_SETTLEMENT_TIME);
  });

  it('blocks a sale whose settlement time is in the ambiguous DD/MM shape', () => {
    // Previously `new Date('05/09/2026 09:30:00')` parsed as 9 MAY in V8 and the
    // sale looked perfectly issuable — four months into the wrong period.
    expect(issuanceBlockers(sale({ settledAt: '05/09/2026 09:30:00' })))
      .toContain(ISSUANCE_BLOCKER.NO_SETTLEMENT_TIME);
  });

  it('does not block a sale with a well-formed settlement time', () => {
    expect(issuanceBlockers(sale())).not.toContain(ISSUANCE_BLOCKER.NO_SETTLEMENT_TIME);
  });
});

describe('cutover eligibility uses the same explicit instant', () => {
  const cutover = new Date('2026-09-10T00:00:00Z');

  it('a wash after the cutover is eligible', () => {
    const { eligible, withheld } = applyFiscalCutover([sale({ settledAt: '2026-09-11 08:00:00' })], cutover);
    expect(eligible).toHaveLength(1);
    expect(withheld).toHaveLength(0);
  });

  it('a wash before the cutover is withheld', () => {
    const { eligible, withheld } = applyFiscalCutover([sale({ settledAt: '2026-09-05 08:00:00' })], cutover);
    expect(eligible).toHaveLength(0);
    expect(withheld).toHaveLength(1);
  });

  it('an unparseable settlement time is WITHHELD, not silently admitted', () => {
    const { eligible, withheld } = applyFiscalCutover([sale({ settledAt: '11/09/2026 08:00:00' })], cutover);
    expect(eligible).toHaveLength(0);
    expect(withheld).toHaveLength(1);
  });
});

describe('the receipt the bridge builds carries the Nayax close as its fiscal date', () => {
  it('buildReceiptInput passes the settlement INSTANT through as documentDate', () => {
    const built = buildReceiptInput(sale({ settledAt: '2026-09-05 22:30:00' }));
    expect(built.documentDate?.toISOString()).toBe('2026-09-05T22:30:00.000Z');
  });

  it('leaves documentDate undefined when the time is unusable (that sale is withheld anyway)', () => {
    expect(buildReceiptInput(sale({ settledAt: '05/09/2026 09:30:00' })).documentDate)
      .toBeUndefined();
  });
});

describe('WIRE — createCustomerReceipt actually sends Details.Date to SUMIT', () => {
  /**
   * Stubbed fetch: this asserts the real request body without writing to SUMIT.
   * Before this change the body carried NO Date at all and SUMIT stamped "now".
   */
  async function captureBody(documentDate?: Date) {
    const prev = { ...process.env };
    const realFetch = globalThis.fetch;
    let captured: any = null;
    process.env.SUMIT_ENABLED = 'true';
    process.env.SUMIT_API_KEY = 'test-key';
    process.env.SUMIT_COMPANY_ID = '1455151432';
    process.env.SUMIT_WEBHOOK_SECRET = 'test-secret';
    // Deliberately an unresolvable host: even if the fetch stub below failed to
    // install, this test could never reach the real SUMIT API.
    process.env.SUMIT_API_BASE_URL = 'https://sumit.invalid';
    globalThis.fetch = (async (_url: any, init: any) => {
      captured = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Status: 0, Data: { DocumentID: 1, DocumentNumber: 1 } }),
      } as any;
    }) as any;
    try {
      const { sumitClient } = await import('../services/SumitClient');
      await sumitClient.createCustomerReceipt({
        idempotencyKey: 'nayax:3467932999',
        customer: { name: 'לקוח כללי – תחנות Pet Wash' },
        description: 'wash',
        amountBeforeVat: 40.68,
        vatAmount: 7.32,
        totalAmount: 48,
        currency: 'ILS',
        documentDate,
      });
    } finally {
      globalThis.fetch = realFetch;
      process.env = prev;
    }
    return captured;
  }

  it('stamps the ISRAELI day of the Nayax close, not the UTC day', async () => {
    // 22:30 GMT on 5 Sep = 01:30 on 6 Sep in Israel. The document must say 6 Sep.
    const body = await captureBody(new Date('2026-09-05T22:30:00Z'));
    expect(body?.Details?.Date).toBe('2026-09-06');
  });

  it('sends ISO yyyy-MM-dd, never DD/MM', async () => {
    const body = await captureBody(new Date('2026-09-05T06:30:00Z'));
    expect(body?.Details?.Date).toBe('2026-09-05');
  });

  it('omits Date entirely when the caller has no settlement instant', async () => {
    const body = await captureBody(undefined);
    expect(body?.Details && 'Date' in body.Details).toBe(false);
  });
});
