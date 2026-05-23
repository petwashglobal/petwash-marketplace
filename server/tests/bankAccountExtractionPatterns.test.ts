import { describe, it, expect } from 'vitest';

// Mirrors the bank-account extraction regexes in ReceiptOCRService. Tests
// the patterns in isolation so we can validate without instantiating the
// Vision client. If the patterns in production drift, this file must
// update with them — the patterns ARE the contract.

const BANK_PATTERNS: RegExp[] = [
  /(?:בנק)\D{0,10}(\d{1,3})\D{0,10}(?:סניף)\D{0,10}(\d{1,3})\D{0,10}(?:ח(?:ש?ב?ון)?)\D{0,10}(\d{4,9})/i,
  /(?<![\d])(\d{1,3})\s*[-\/]\s*(\d{3})\s*[-\/]\s*(\d{4,9})(?![\d])/,
  /(?:סניף)\D{0,10}(\d{3})\D{0,10}(?:ח(?:ש?ב?ון)?)\D{0,10}(\d{4,9})/i,
];

function extractBank(text: string): string | undefined {
  for (const p of BANK_PATTERNS) {
    const m = text.match(p);
    if (m) {
      return m.length >= 4 && m[3] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}`;
    }
  }
  return undefined;
}

describe('bank-account extraction — explicit Hebrew labels', () => {
  it('matches "בנק X סניף Y חשבון Z"', () => {
    expect(extractBank('בנק 10 סניף 805 חשבון 12345678')).toBe('10-805-12345678');
  });

  it('tolerates extra whitespace + punctuation between fields', () => {
    expect(extractBank('בנק 12, סניף 920 , חשבון 99887766')).toBe('12-920-99887766');
  });

  it('matches "חשב" abbreviation', () => {
    expect(extractBank('בנק 10 סניף 805 חשב 4567890')).toBe('10-805-4567890');
  });

  it('matches "ח." abbreviation', () => {
    expect(extractBank('בנק 11 סניף 132 ח. 76543210')).toBe('11-132-76543210');
  });
});

describe('bank-account extraction — compact triple form', () => {
  it('matches "10-805-12345678"', () => {
    expect(extractBank('10-805-12345678')).toBe('10-805-12345678');
  });

  it('matches "10 / 805 / 12345678" (slash separator)', () => {
    expect(extractBank('10 / 805 / 12345678')).toBe('10-805-12345678');
  });

  it('captures even when embedded in surrounding text', () => {
    expect(extractBank('Payment to 14-680-99887766 within 30 days')).toBe('14-680-99887766');
  });
});

describe('bank-account extraction — branch+account fallback', () => {
  it('matches "סניף 805 חשבון 12345678" without bank code', () => {
    expect(extractBank('סניף 805 חשבון 12345678')).toBe('805-12345678');
  });
});

describe('bank-account extraction — negative cases', () => {
  it('returns undefined when no bank pattern present', () => {
    expect(extractBank('Total: 590 ILS')).toBeUndefined();
  });

  it('KNOWN LIMITATION: compact pattern matches Israeli "050-123-4567" phone format', () => {
    // 3-3-4 digit format is shared with bank short notation. In practice OCR
    // text from a supplier invoice has the bank account in the "to pay"
    // footer and phone numbers elsewhere, so the false-positive doesn't fire
    // often. Documented here so future maintainers don't get surprised.
    // Tightening would risk dropping real bank accounts.
    expect(extractBank('Phone: 050-123-4567')).toBe('050-123-4567');
  });

  it('does not match a date "23/05/2026" (no 4+ digit final group)', () => {
    // The compact pattern requires a 4-9 digit final group; 2026 is 4 digits
    // but the prefix 23 → branch 05 → only 2 digits, mismatches branch=3.
    expect(extractBank('Date: 23/05/2026')).toBeUndefined();
  });

  it('does not run away on long digit runs', () => {
    // 17-digit run should not produce a valid match because the pattern
    // requires explicit separators or labels.
    expect(extractBank('12345678901234567')).toBeUndefined();
  });
});

describe('bank-account extraction — realistic invoice excerpts', () => {
  it('extracts from a typical Hebrew tax-invoice footer', () => {
    const text = [
      'אקמה לוגיסטיקה בע"מ',
      'ח.פ. 517145033',
      'לתשלום:',
      'בנק 10 סניף 805 חשבון 76543210',
      'ע"ש אקמה לוגיסטיקה בע"מ',
    ].join('\n');
    expect(extractBank(text)).toBe('10-805-76543210');
  });

  it('prefers the explicit Hebrew form over a stray compact-style number', () => {
    const text = [
      'הזמנה: 100-200-300',
      'בנק 12 סניף 920 חשבון 99887766',
    ].join('\n');
    // The explicit form is later in the text but matches a different
    // pattern (the FIRST in the array), which we try first.
    expect(extractBank(text)).toBe('12-920-99887766');
  });
});
