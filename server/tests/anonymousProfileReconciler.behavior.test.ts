/**
 * AnonymousProfileReconciler — CEO P0-CEP task #174 (Batch §1).
 *
 * Anonymous device profile → identified UID merge. Carry pre-signup
 * context (saved searches, favourites, attributes) but never risk
 * merging a stranger's device into a fresh account, and never
 * silently overwrite an anonymous profile already bound to a
 * different UID.
 */
import { describe, it, expect } from 'vitest';
import {
  reconcileAnonymousProfile,
  type AnonymousProfileSnapshot,
  type IdentifiedProfileSnapshot,
} from '@shared/marketplace/anonymousProfileReconciler';

const NOW = new Date('2026-08-31T12:00:00Z');
const TWO_HOURS_AGO = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);
const TWO_YEARS_AGO = new Date(NOW.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);

function anon(over: Partial<AnonymousProfileSnapshot> = {}): AnonymousProfileSnapshot {
  return {
    anonymousId: 'dev-abc',
    firstSeenAt: TWO_HOURS_AGO,
    lastSeenAt: NOW,
    hasAttributes: true,
    savedSearches: ['near-me', 'evening-walk'],
    favourites: ['prov-42'],
    ...over,
  };
}
function ident(over: Partial<IdentifiedProfileSnapshot> = {}): IdentifiedProfileSnapshot {
  return {
    uid: 'uid-signed-up',
    createdAt: NOW,
    ...over,
  };
}

describe('AnonymousProfileReconciler', () => {
  it('MERGE — same-session sign-up carries saved searches + favourites', () => {
    const v = reconcileAnonymousProfile({ anonymous: anon(), identified: ident(), now: NOW });
    expect(v.code).toBe('MERGE_INTO_IDENTIFIED');
    if (v.code !== 'MERGE_INTO_IDENTIFIED') throw new Error();
    expect(v.carriedItems.savedSearches).toEqual(['near-me', 'evening-walk']);
    expect(v.carriedItems.favourites).toEqual(['prov-42']);
  });

  it('KEEP_SEPARATE(ANONYMOUS_EMPTY) when nothing to carry', () => {
    const v = reconcileAnonymousProfile({
      anonymous: anon({ savedSearches: [], favourites: [], hasAttributes: false }),
      identified: ident(),
      now: NOW,
    });
    expect(v.code).toBe('KEEP_SEPARATE');
    if (v.code !== 'KEEP_SEPARATE') throw new Error();
    expect(v.reasonCode).toBe('ANONYMOUS_EMPTY');
  });

  it('KEEP_SEPARATE(ANONYMOUS_ALREADY_BOUND_ELSEWHERE) when reconciledToUid points at a different UID', () => {
    const v = reconcileAnonymousProfile({
      anonymous: anon({ reconciledToUid: 'uid-someone-else' }),
      identified: ident({ uid: 'uid-new-account' }),
      now: NOW,
    });
    expect(v.code).toBe('KEEP_SEPARATE');
    if (v.code !== 'KEEP_SEPARATE') throw new Error();
    expect(v.reasonCode).toBe('ANONYMOUS_ALREADY_BOUND_ELSEWHERE');
  });

  it('MERGE — reconciledToUid equal to identified.uid is idempotent re-merge', () => {
    const v = reconcileAnonymousProfile({
      anonymous: anon({ reconciledToUid: 'uid-signed-up' }),
      identified: ident(),
      now: NOW,
    });
    expect(v.code).toBe('MERGE_INTO_IDENTIFIED');
  });

  it('KEEP_SEPARATE(ANONYMOUS_TOO_OLD) — device from 2 years ago into a fresh account', () => {
    const v = reconcileAnonymousProfile({
      anonymous: anon({ firstSeenAt: TWO_YEARS_AGO }),
      identified: ident({ createdAt: NOW }),
      now: NOW,
    });
    expect(v.code).toBe('KEEP_SEPARATE');
    if (v.code !== 'KEEP_SEPARATE') throw new Error();
    expect(v.reasonCode).toBe('ANONYMOUS_TOO_OLD');
  });

  it('REJECT(NO_ANONYMOUS_ID) / REJECT(NO_IDENTIFIED_UID)', () => {
    const r1 = reconcileAnonymousProfile({ anonymous: anon({ anonymousId: '   ' }), identified: ident(), now: NOW });
    expect(r1.code).toBe('REJECT');
    if (r1.code !== 'REJECT') throw new Error();
    expect(r1.reasonCode).toBe('NO_ANONYMOUS_ID');

    const r2 = reconcileAnonymousProfile({ anonymous: anon(), identified: ident({ uid: '' }), now: NOW });
    expect(r2.code).toBe('REJECT');
    if (r2.code !== 'REJECT') throw new Error();
    expect(r2.reasonCode).toBe('NO_IDENTIFIED_UID');
  });

  it('empty savedSearches AND favourites but hasAttributes=true → still MERGE (attributes are context too)', () => {
    const v = reconcileAnonymousProfile({
      anonymous: anon({ savedSearches: [], favourites: [], hasAttributes: true }),
      identified: ident(),
      now: NOW,
    });
    expect(v.code).toBe('MERGE_INTO_IDENTIFIED');
    if (v.code !== 'MERGE_INTO_IDENTIFIED') throw new Error();
    expect(v.carriedItems.savedSearches).toEqual([]);
    expect(v.carriedItems.favourites).toEqual([]);
  });
});
