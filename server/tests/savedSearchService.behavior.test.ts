/**
 * SavedSearchService — Program 31.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemorySavedSearchStore,
  isSameSearch,
  type SavedSearch,
} from '../services/marketplace/SavedSearchService';

const store = new InMemorySavedSearchStore();
beforeEach(() => store.clear());

const bruno: SavedSearch = {
  savedSearchId: 'S-1',
  ownerUid: 'sarah',
  service: 'DOG_WALK',
  areaCode: 'TLV_CENTER',
  petMix: [{ species: 'dog', count: 2 }],
  updatedAt: '2026-08-30T10:00:00Z',
};

describe('SavedSearchService', () => {
  it('put + list returns the row', () => {
    store.put(bruno);
    expect(store.list('sarah')).toHaveLength(1);
  });

  it('list is scoped by ownerUid', () => {
    store.put(bruno);
    expect(store.list('other-user')).toEqual([]);
  });

  it('put is idempotent (same savedSearchId updates in place)', () => {
    store.put(bruno);
    store.put({ ...bruno, areaCode: 'TLV_NORTH' });
    const list = store.list('sarah');
    expect(list).toHaveLength(1);
    expect(list[0].areaCode).toBe('TLV_NORTH');
  });

  it('delete removes only the matching row', () => {
    store.put(bruno);
    store.put({ ...bruno, savedSearchId: 'S-2' });
    store.delete('sarah', 'S-1');
    expect(store.list('sarah').map((r) => r.savedSearchId)).toEqual(['S-2']);
  });

  it('isSameSearch: identical shape returns true regardless of pet order', () => {
    const a = { ...bruno, petMix: [{ species: 'dog' as const, count: 1 }, { species: 'cat' as const, count: 1 }] };
    const b = { ...bruno, petMix: [{ species: 'cat' as const, count: 1 }, { species: 'dog' as const, count: 1 }] };
    expect(isSameSearch(a, b)).toBe(true);
  });

  it('isSameSearch: different areaCode → false', () => {
    const a = { ...bruno, areaCode: 'TLV_CENTER' };
    const b = { ...bruno, areaCode: 'TLV_NORTH' };
    expect(isSameSearch(a, b)).toBe(false);
  });

  it('isSameSearch: different pet count → false', () => {
    const a = { ...bruno, petMix: [{ species: 'dog' as const, count: 2 }] };
    const b = { ...bruno, petMix: [{ species: 'dog' as const, count: 3 }] };
    expect(isSameSearch(a, b)).toBe(false);
  });

  it('isSameSearch: dates comparison', () => {
    const a = { ...bruno, dates: { startAt: '2026-09-01T10:00:00Z', endAt: '2026-09-01T11:00:00Z' } };
    const b = { ...bruno, dates: { startAt: '2026-09-01T10:00:00Z', endAt: '2026-09-01T12:00:00Z' } };
    expect(isSameSearch(a, b)).toBe(false);
  });

  it('isSameSearch: requirements order does not matter', () => {
    const a = { ...bruno, requirements: ['MEDICATION', 'CAT_FRIENDLY'] };
    const b = { ...bruno, requirements: ['CAT_FRIENDLY', 'MEDICATION'] };
    expect(isSameSearch(a, b)).toBe(true);
  });
});
