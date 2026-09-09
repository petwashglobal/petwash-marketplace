/**
 * Settlement ingestion — regression pin (2026-09-08).
 *
 * The B and D layers. Every rule here exists because getting it wrong makes a
 * shortfall look reconciled, which is worse than having no bank leg at all.
 * Parsing is pure, so it is tested for real.
 */
import { describe, it, expect } from 'vitest';
import { parseAmountMinor, parseValueDate, parseBankCsv } from '../services/FiscalSettlementIngest';

describe('amount parsing — Israeli bank exports', () => {
  it('handles thousands separators, symbols and blanks', () => {
    expect(parseAmountMinor('7,633.78')).toBe(763378);
    expect(parseAmountMinor('₪ 7,633.78')).toBe(763378);
    expect(parseAmountMinor('48')).toBe(4800);
    // Blank means "not a credit", which is different from zero. Returning 0
    // would silently create a zero-value credit row.
    expect(parseAmountMinor('')).toBeNull();
    expect(parseAmountMinor(undefined)).toBeNull();
    expect(parseAmountMinor('-')).toBeNull();
  });

  it('reads accounting negatives both ways', () => {
    expect(parseAmountMinor('(320.00)')).toBe(-32000);
    expect(parseAmountMinor('320.00-')).toBe(-32000);
    expect(parseAmountMinor('-320.00')).toBe(-32000);
  });

  it('refuses text rather than coercing it to a number', () => {
    expect(parseAmountMinor('n/a')).toBeNull();
    expect(parseAmountMinor('סה"כ')).toBeNull();
  });

  it('uses minor units — no float drift on fiscal values', () => {
    expect(parseAmountMinor('0.07')).toBe(7);
    expect(parseAmountMinor('1234567.89')).toBe(123456789);
  });
});

describe('value-date parsing — ambiguity is REFUSED, never guessed', () => {
  it('accepts ISO and Israeli DD/MM', () => {
    expect(parseValueDate('2026-08-03')).toBe('2026-08-03');
    expect(parseValueDate('03/08/2026')).toBe('2026-08-03');
    expect(parseValueDate('3.8.2026')).toBe('2026-08-03');
  });

  it('refuses an impossible month instead of swapping the parts', () => {
    // 08/13/2026 is US order. Guessing would move a credit into the wrong
    // month — exactly the error reconciliation exists to catch.
    expect(parseValueDate('08/13/2026')).toBeNull();
    expect(parseValueDate('not a date')).toBeNull();
    expect(parseValueDate('')).toBeNull();
  });
});

describe('bank CSV import', () => {
  const csv = [
    'Bank Hapoalim — account statement',
    'branch 000 account 00000',
    'תאריך ערך,תיאור,זכות,חובה,אסמכתא',
    '03/08/2026,העברת נאייקס ישראל,"7,633.78",,44551',
    '01/08/2026,חשמל,,320.00,10001',
    '05/08/2026,NAYAX part 2,"2,633.78",,44552',
    ',סה"כ,"10,267.56",,',
  ].join('\n');

  it('finds the header past the bank preamble', () => {
    const { credits } = parseBankCsv(csv);
    expect(credits.length).toBe(2);
    expect(credits[0]).toMatchObject({ valueDate: '2026-08-03', amountMinor: 763378 });
  });

  it('ignores debits — a payment out is not a receipt', () => {
    const { credits } = parseBankCsv(csv);
    expect(credits.some((c) => c.narrative.includes('חשמל'))).toBe(false);
  });

  it('keeps the narrative verbatim — it is how a credit is attributed to Nayax', () => {
    const { credits } = parseBankCsv(csv);
    expect(credits[0].narrative).toContain('נאייקס');
    expect(credits[0].bankReference).toBe('44551');
  });

  it('a trailing total row is not an error', () => {
    // Footer rows have no value date. Flagging them would train the operator
    // to ignore the rejected list, which is where real problems appear.
    const { rejected } = parseBankCsv(csv);
    expect(rejected).toEqual([]);
  });

  it('a credit row with an unreadable date IS rejected, not dropped', () => {
    const bad = ['תאריך ערך,תיאור,זכות', '99/99/2026,NAYAX,"100.00"'].join('\n');
    const { credits, rejected } = parseBankCsv(bad);
    expect(credits).toEqual([]);
    expect(rejected[0].reason).toMatch(/value date/i);
  });

  it('reports a file with no usable header instead of importing nothing silently', () => {
    const { rejected } = parseBankCsv('just,some,columns\n1,2,3');
    expect(rejected[0].reason).toMatch(/header/i);
  });
});
