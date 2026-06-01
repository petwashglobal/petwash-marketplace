import { describe, it, expect } from 'vitest';

// These tests duplicate the SHAAM extraction regexes from
// server/services/ReceiptOCRService.ts so we can validate them without
// instantiating the Google Vision client. If the patterns there change,
// keep this file in sync — the patterns ARE the contract.
//
// The matching order in the production code is from most-specific
// (Hebrew explicit label) to least (English short label), so we test
// the ordering too.

const SHAAM_PATTERNS: RegExp[] = [
  /(?:מספר\s*הקצאה|מס['׳]?\s*הקצאה|הקצאת\s*חשבונית)[:\s#-]*(\d{9,12})/i,
  /(?:הקצאה)[:\s#-]+(\d{9,12})/i,
  /(?:Allocation\s*(?:Number|No|#)?|SHAAM(?:\s*Number)?)[:\s#-]*(\d{9,12})/i,
];

function extractShaam(text: string): string | undefined {
  for (const p of SHAAM_PATTERNS) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return undefined;
}

describe('SHAAM allocation extraction — Hebrew label variants', () => {
  it('matches "מספר הקצאה" with colon and 9-digit number', () => {
    expect(extractShaam('מספר הקצאה: 123456789')).toBe('123456789');
  });

  it('matches "מס\' הקצאה" (geresh) with 10-digit number', () => {
    expect(extractShaam("מס' הקצאה 1234567890")).toBe('1234567890');
  });

  it('matches "מס׳ הקצאה" (Hebrew geresh ׳)', () => {
    expect(extractShaam('מס׳ הקצאה  123456789')).toBe('123456789');
  });

  it('matches "הקצאת חשבונית" form', () => {
    expect(extractShaam('הקצאת חשבונית: 987654321')).toBe('987654321');
  });

  it('matches bare "הקצאה" label when followed by a separator', () => {
    expect(extractShaam('הקצאה: 555666777')).toBe('555666777');
  });

  it('matches "הקצאה" with hash separator', () => {
    expect(extractShaam('הקצאה #555666777')).toBe('555666777');
  });
});

describe('SHAAM allocation extraction — English label variants', () => {
  it('matches "Allocation Number:"', () => {
    expect(extractShaam('Allocation Number: 100200300')).toBe('100200300');
  });

  it('matches "Allocation No"', () => {
    expect(extractShaam('Allocation No 100200300')).toBe('100200300');
  });

  it('matches "SHAAM:"', () => {
    expect(extractShaam('SHAAM: 100200300')).toBe('100200300');
  });

  it('matches "SHAAM Number"', () => {
    expect(extractShaam('SHAAM Number 100200300')).toBe('100200300');
  });

  it('is case-insensitive on English', () => {
    expect(extractShaam('allocation number: 100200300')).toBe('100200300');
  });
});

describe('SHAAM allocation extraction — length bounds', () => {
  it('rejects 8-digit number (too short for an allocation)', () => {
    expect(extractShaam('מספר הקצאה: 12345678')).toBeUndefined();
  });

  it('accepts 12-digit number (maximum)', () => {
    expect(extractShaam('מספר הקצאה: 123456789012')).toBe('123456789012');
  });

  it('rejects 13-digit number (too long)', () => {
    expect(extractShaam('מספר הקצאה: 1234567890123')).toBeUndefined();
  });
});

describe('SHAAM allocation extraction — negative cases', () => {
  it('returns undefined for a receipt with no allocation labels', () => {
    expect(extractShaam('Total: 590 ILS\nDate: 2026-05-23')).toBeUndefined();
  });

  it('does not match the company tax id pattern (ח.פ. is different)', () => {
    expect(extractShaam('ח.פ. 517145033')).toBeUndefined();
  });

  it('does not match a phone number that happens to be 9 digits', () => {
    expect(extractShaam('Phone: 555123456')).toBeUndefined();
  });
});

describe('SHAAM allocation extraction — realistic invoice excerpts', () => {
  it('extracts from a typical Hebrew tax-invoice header block', () => {
    const text = [
      'חברת אקמה לוגיסטיקה בע"מ',
      'ח.פ. 517145033',
      'חשבונית מס 2026-1042',
      'תאריך: 23/05/2026',
      'מספר הקצאה: 458123900',
      'סה"כ כולל מע"מ: 1,180 ₪',
    ].join('\n');
    expect(extractShaam(text)).toBe('458123900');
  });

  it('prefers the explicit "מספר הקצאה" over a later loose match', () => {
    const text = [
      'הקצאה ראשונה',
      'מספר הקצאה: 111222333',
      'הקצאה: 999888777',
    ].join('\n');
    expect(extractShaam(text)).toBe('111222333');
  });
});
