/**
 * parseCsv — the in-browser parser feeding the Tower Control Nayax report
 * import. Locks quoted-field, CRLF, and empty-line handling so a real Nayax
 * Core export round-trips into clean row objects.
 */
import { describe, it, expect } from 'vitest';
import { parseCsv } from '@/lib/csv';

describe('parseCsv', () => {
  it('parses a simple header + rows', () => {
    const rows = parseCsv('Transaction ID,Amount\nTX-1,55.00\nTX-2,48.00\n');
    expect(rows).toEqual([
      { 'Transaction ID': 'TX-1', Amount: '55.00' },
      { 'Transaction ID': 'TX-2', Amount: '48.00' },
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const rows = parseCsv('Name,Note\n"Kfar Saba, Right","said ""ok"""\n');
    expect(rows).toEqual([{ Name: 'Kfar Saba, Right', Note: 'said "ok"' }]);
  });

  it('handles CRLF line endings and skips blank lines', () => {
    const rows = parseCsv('A,B\r\n1,2\r\n\r\n3,4\r\n');
    expect(rows).toEqual([{ A: '1', B: '2' }, { A: '3', B: '4' }]);
  });

  it('returns [] for a header-only or empty file', () => {
    expect(parseCsv('A,B\n')).toEqual([]);
    expect(parseCsv('')).toEqual([]);
  });

  it('tolerates short rows (missing trailing columns become empty strings)', () => {
    const rows = parseCsv('A,B,C\n1,2\n');
    expect(rows).toEqual([{ A: '1', B: '2', C: '' }]);
  });
});
