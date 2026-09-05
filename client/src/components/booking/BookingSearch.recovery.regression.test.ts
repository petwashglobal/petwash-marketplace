/**
 * REGRESSION PIN — provider search recovery buttons + error state.
 *
 * 1. STALE CLOSURE: the "no results" recovery buttons did
 *      setFilters(p => ({ ...p, radiusKm: p.radiusKm + 10 })); handleSearch();
 *    `handleSearch` is a useCallback over `filters`, and React state updates
 *    are async — so "Expand radius to 30 km" POSTed the OLD 20 km and the
 *    customer got the identical empty page. Fixed by `searchWith(next)`, which
 *    takes the next filters explicitly.
 *
 * 2. NO ERROR STATE: searchMutation had onSuccess and no onError, so a 500 or
 *    a dropped connection left hasSearched=false — the page silently reverted
 *    to "you haven't searched yet" with no message and no retry.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, 'BookingSearch.tsx'), 'utf8');

describe('BookingSearch — no-results recovery', () => {
  it('exposes searchWith(next) that mutates with the explicit next filters', () => {
    expect(src).toMatch(/const searchWith = useCallback\(\(next: SearchFilters\) => \{/);
    expect(src).toMatch(/searchMutation\.mutate\(next\)/);
  });

  it('no recovery button pairs a functional setFilters with a bare handleSearch()', () => {
    // the exact stale-closure shape: setFilters(p => ...) immediately followed
    // by handleSearch() inside one onClick body
    expect(src).not.toMatch(/setFilters\(p => \(\{[\s\S]{0,160}?\}\)\);\s*\n\s*handleSearch\(\);/);
  });

  it('every recovery button goes through searchWith', () => {
    const calls = src.match(/searchWith\(\{ \.\.\.filters,/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(6);
  });
});

describe('BookingSearch — failure is visible', () => {
  it('the mutation has an onError that records a message', () => {
    expect(src).toMatch(/onError: \(err: any\) => \{/);
    expect(src).toMatch(/setSearchError\(/);
    expect(src).toMatch(/setHasSearched\(true\)/);
  });

  it('renders a retryable error card, and suppresses the results block while errored', () => {
    expect(src).toMatch(/\{searchError && !searchMutation\.isPending && \(/);
    expect(src).toMatch(/\{hasSearched && !searchError && !searchMutation\.isPending && \(/);
  });

  it('clears the error on a successful search', () => {
    expect(src).toMatch(/onSuccess: \(data\) => \{\s*\n\s*setSearchError\(null\);/);
  });
});
