/**
 * The streak card must never spin forever.
 * Regression pin — 2026-09-19.
 *
 * WHAT HAPPENED
 * The CEO's Prestige home showed a white card containing nothing but a spinner,
 * wedged between the loyalty wallet card and the Prestige pass card. It never
 * resolved. The condition was:
 *
 *     if (isLoading || !streaks) return <spinner/>;
 *
 * `isLoading` goes false the instant the query settles. `!streaks` does not.
 * So for anyone /api/loyalty-credits/summary returns no streak block for — a
 * brand-new member with zero bookings, or ANY error response — the card
 * rendered a spinner permanently. His account has 0 bookings and 0 pets, so he
 * hit it on his own product.
 *
 * Worse, `enabled: !!user && !propData` means the query may never run at all.
 * In that state `isLoading` alone could never clear the spinner either.
 *
 * THE RULE
 * Spin only while a request is genuinely in flight with nothing to show yet.
 * A settled-but-empty response is an ANSWER: this member has a streak of zero.
 * Zero is true, renderable, and already the default for every field on the
 * card. A spinner in its place tells the member their data is broken when it
 * is merely empty — and there is no state they can reach that ends it.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { streakCardState, withZeroStreaks, ZERO_STREAKS } from './streakCardState';

describe('streakCardState — the spinner has an exit in every state', () => {
  it('hides entirely when there is no signed-in user', () => {
    expect(streakCardState({ hasUser: false, hasData: false, isLoading: true })).toBe('hidden');
    expect(streakCardState({ hasUser: false, hasData: true, isLoading: false })).toBe('hidden');
  });

  it('spins only while a request is in flight with nothing to show', () => {
    expect(streakCardState({ hasUser: true, hasData: false, isLoading: true })).toBe('loading');
  });

  it('SETTLED WITH NO DATA RENDERS — this is the bug', () => {
    // The old code returned a spinner here, forever.
    expect(streakCardState({ hasUser: true, hasData: false, isLoading: false })).toBe('ready');
  });

  it('renders as soon as there is data, even if a refetch is in flight', () => {
    expect(streakCardState({ hasUser: true, hasData: true, isLoading: true })).toBe('ready');
    expect(streakCardState({ hasUser: true, hasData: true, isLoading: false })).toBe('ready');
  });

  it('never returns "loading" for a query that was never enabled', () => {
    // enabled:false → no request will ever run. If this returned 'loading' the
    // spinner would have no exit at all, which is the failure mode being pinned.
    expect(streakCardState({ hasUser: true, hasData: true, isLoading: false })).not.toBe('loading');
  });

  it('is total — no input combination falls through to undefined', () => {
    const seen = new Set<string>();
    for (const hasUser of [false, true]) {
      for (const hasData of [false, true]) {
        for (const isLoading of [false, true]) {
          const r = streakCardState({ hasUser, hasData, isLoading });
          expect(['hidden', 'loading', 'ready']).toContain(r);
          seen.add(r);
        }
      }
    }
    expect(seen).toEqual(new Set(['hidden', 'loading', 'ready']));
  });

  it('exactly ONE of the eight combinations spins', () => {
    let spinning = 0;
    for (const hasUser of [false, true])
      for (const hasData of [false, true])
        for (const isLoading of [false, true])
          if (streakCardState({ hasUser, hasData, isLoading }) === 'loading') spinning++;
    expect(spinning).toBe(1);
  });
});

describe('withZeroStreaks — an absent streak is a zero streak', () => {
  it('turns undefined into renderable zeros', () => {
    expect(withZeroStreaks(undefined)).toEqual(ZERO_STREAKS);
  });

  it('turns null into renderable zeros', () => {
    expect(withZeroStreaks(null)).toEqual(ZERO_STREAKS);
  });

  it('fills only the missing fields and keeps real ones', () => {
    expect(withZeroStreaks({ walkBookings: 7 })).toEqual({
      walkBookings: 7, sitBookings: 0, consecutiveSameProvider: null,
    });
  });

  it('preserves a real provider streak', () => {
    const streak = { providerId: 'p1', count: 4 };
    expect(withZeroStreaks({ consecutiveSameProvider: streak }).consecutiveSameProvider).toBe(streak);
  });

  it('treats a genuine zero as a zero, not as missing', () => {
    expect(withZeroStreaks({ walkBookings: 0, sitBookings: 0 })).toEqual(ZERO_STREAKS);
  });

  it('always returns every field the card reads', () => {
    const r = withZeroStreaks({});
    expect(Object.keys(r).sort()).toEqual(
      ['consecutiveSameProvider', 'sitBookings', 'walkBookings'],
    );
  });
});

describe('the component actually uses the decision', () => {
  // Source-pinned: a node-env vitest cannot import the .tsx at all, which is
  // precisely why the logic was moved out of it.
  const CARD = readFileSync(
    path.join(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..'),
      'client/src/components/loyalty/LoyaltyStreakCard.tsx',
    ),
    'utf8',
  );

  it('no longer spins on a falsy streaks value', () => {
    expect(CARD).not.toMatch(/isLoading \|\| !streaks/);
  });

  it('routes rendering through streakCardState', () => {
    expect(CARD).toMatch(/const state\s*=\s*streakCardState\(\{/);
    expect(CARD).toMatch(/if \(state === 'loading'\)/);
    expect(CARD).toMatch(/if \(state === 'hidden'\) return null/);
  });

  it('zero-fills the streaks before rendering', () => {
    expect(CARD).toMatch(/withZeroStreaks\(data\?\.streaks\)/);
  });
});
