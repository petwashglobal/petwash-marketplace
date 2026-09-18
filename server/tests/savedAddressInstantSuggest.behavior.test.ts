/**
 * The customer's saved addresses must appear in the address field itself —
 * instantly, everywhere, and free.
 *
 * Until 2026-09-18 they were only listed inside AddressPicker (4 screens), so
 * profile and every other address field made the customer retype an address
 * they had already given us — and every keystroke went to the suggest service
 * instead of matching what we already had.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { matchSavedAddresses } from '../../client/src/lib/savedAddressMatch';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const src = read('client/src/components/ui/google-places-autocomplete.tsx');

const rows = [
  { id: 1, address: 'הרצל 5, תל אביב', street: 'הרצל', city: 'תל אביב', label: 'home', isDefault: false },
  { id: 2, address: 'ויצמן 12, רמת גן', street: 'ויצמן', city: 'רמת גן', label: 'work', isDefault: true },
  { id: 3, address: 'עוזי חיטמן 8, ראש העין', street: 'עוזי חיטמן', city: 'ראש העין', label: 'custom', customLabel: 'ההורים' },
] as any[];

describe('matching saved addresses locally', () => {
  it('empty input lists them, default first', () => {
    const r = matchSavedAddresses(rows, '');
    expect(r.map((x) => x.id)).toEqual([2, 1, 3]);
  });

  it('matches Hebrew street, city, and a custom label', () => {
    expect(matchSavedAddresses(rows, 'הרצל').map((x) => x.id)).toEqual([1]);
    expect(matchSavedAddresses(rows, 'רמת').map((x) => x.id)).toEqual([2]);
    expect(matchSavedAddresses(rows, 'ההורים').map((x) => x.id)).toEqual([3]);
  });

  it('no match means no rows — the suggest service still answers', () => {
    expect(matchSavedAddresses(rows, 'חיפה')).toEqual([]);
  });

  it('caps the list so it never buries the typed results', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: i, address: `רחוב ${i}, תל אביב`, city: 'תל אביב' })) as any[];
    expect(matchSavedAddresses(many, 'תל אביב').length).toBe(4);
  });
});

describe('the field shows them without a request', () => {
  it('loads them once and shares the cache across screens', () => {
    expect(src).toContain("queryKey: ['/api/user/addresses']");
    expect(src).toContain('staleTime: 10 * 60 * 1000');
    expect(src).toContain('enabled: !!user?.uid');
  });

  it('shows them on focus, before anything is typed', () => {
    expect(src).toContain('if (predictions.length > 0 || savedMatches.length > 0) {');
  });

  it('shows matches while typing without waiting for the debounce', () => {
    const typing = src.slice(src.indexOf('const handleInputChange'), src.indexOf('const handleKeyDown'));
    expect(typing).toContain('if (matchSavedAddresses(savedAddressesRef.current, val).length > 0) {');
    expect(typing.indexOf('matchSavedAddresses')).toBeLessThan(typing.indexOf('debounceRef.current = setTimeout'));
  });

  it('picking one costs nothing: no fetch, and every part is filled from the row', () => {
    const pick = src.slice(src.indexOf('const selectSaved = useCallback'), src.indexOf('Reveal the detail boxes'));
    expect(pick).not.toMatch(/fetch\(|getApiUrl\(/);
    expect(pick).toContain('postalCode: row.postalCode || undefined');
    expect(pick).toContain('lat: row.lat != null ? Number(row.lat) : undefined');
    expect(pick).toContain('onPlaceSelected?.(details)');
  });

  it('saved rows render above the typed suggestions', () => {
    expect(src.indexOf('data-testid="saved-address-suggestions"')).toBeLessThan(src.indexOf('predictions.map((pred, idx)'));
  });
});

describe('the field no longer claims to search Google', () => {
  it('profile says saved addresses instead', () => {
    const acc = read('client/src/pages/MyAccount.tsx');
    expect(acc).not.toContain('חפש כתובת ב-Google');
    expect(acc).not.toContain('Search address with Google');
    expect(acc).toContain('או בחר/י מהכתובות השמורות');
  });

  it('the suggest engine is still the free one', () => {
    expect(src).toContain('/api/geocode/suggest');
  });
});
