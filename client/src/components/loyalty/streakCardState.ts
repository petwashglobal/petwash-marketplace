/**
 * Render decision + zero-filling for LoyaltyStreakCard.
 *
 * Lives in its own .ts file for one concrete reason: this repo's vitest runs
 * `environment: 'node'` and cannot import a .tsx module at all, so anything
 * left inside the component is permanently untestable. Pulling the decision
 * out is the difference between a real test and a source pin.
 *
 * The bug this replaces (2026-09-19, found on the CEO's own phone): the card
 * rendered a spinner for `isLoading || !streaks`. `isLoading` goes false the
 * moment the query settles; `!streaks` does not. So for anyone the summary
 * endpoint returns no streak block for — a brand-new member, or any error
 * response — the spinner never resolved. It sat as a blank white card between
 * the loyalty wallet and the Prestige card with no state the member could
 * reach that would end it.
 */

export interface StreakSummary {
  walkBookings: number;
  sitBookings: number;
  consecutiveSameProvider: { providerId: string; count: number } | null;
}

export type StreakCardState = 'hidden' | 'loading' | 'ready';

export function streakCardState(input: {
  hasUser: boolean;
  hasData: boolean;
  isLoading: boolean;
}): StreakCardState {
  if (!input.hasUser) return 'hidden';
  // Spin ONLY while a request is genuinely in flight with nothing to show yet.
  // Never on "settled but empty" — that is the eternal-spinner case. Note the
  // query is `enabled: !!user && !propData`, so it may never run at all; keying
  // the spinner on isLoading alone left it with no exit in that state either.
  if (!input.hasData && input.isLoading) return 'loading';
  return 'ready';
}

export const ZERO_STREAKS: StreakSummary = {
  walkBookings: 0,
  sitBookings: 0,
  consecutiveSameProvider: null,
};

/**
 * Never hand the card a missing streak block — an absent streak IS zero.
 * A member with no completed bookings has a streak of zero, which is true,
 * renderable, and already what every field on the card defaults to.
 */
export function withZeroStreaks(
  streaks: Partial<StreakSummary> | null | undefined,
): StreakSummary {
  return {
    walkBookings: streaks?.walkBookings ?? 0,
    sitBookings: streaks?.sitBookings ?? 0,
    consecutiveSameProvider: streaks?.consecutiveSameProvider ?? null,
  };
}
