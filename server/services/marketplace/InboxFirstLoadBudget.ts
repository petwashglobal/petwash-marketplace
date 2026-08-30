/**
 * InboxFirstLoadBudget — CEO PROGRAM 49 (Performance).
 *
 * Pure evaluator. Doctrine: "Large user: 3,000 bookings, 10,000
 * messages, 500 docs. Inbox first load bounded. No N+1. Keyset
 * pagination. Counts via aggregates."
 *
 * Given the caller's requested page shape, returns a bounded
 * `effectiveLimit` and a `keysetCursor` shape the caller must
 * honour. The evaluator NEVER runs queries — it only shapes them.
 */

export interface FirstLoadInput {
  requestedLimit?: number;
  workspace: 'PET_PARENT' | 'PROVIDER';
  categoryCode?: string;                    // stable slug
  cursor?: KeysetCursor;
}

export interface KeysetCursor {
  /** Last item's meaningful timestamp (ISO). */
  afterAt: string;
  /** Last item's id — resolves ties on identical timestamps. */
  afterId: string;
}

export interface FirstLoadBudget {
  effectiveLimit: number;
  useKeyset: boolean;
  cursor?: KeysetCursor;
  reasonCode: string;
}

const HARD_CEILING = 100;
const DEFAULT_FIRST = 50;
const FIRST_PAGE_CEILING = 50;
const FOLLOW_PAGE_CEILING = 25;

/** First-load bounded ≤ 50 items; follow-page bounded ≤ 25. Both hard-capped at 100. */
export function budgetFirstLoad(input: FirstLoadInput): FirstLoadBudget {
  const requested = Number.isFinite(input.requestedLimit as number)
    ? Math.max(1, Math.floor(input.requestedLimit as number))
    : DEFAULT_FIRST;
  const clamped = Math.min(requested, HARD_CEILING);
  const useKeyset = !!input.cursor;
  const ceiling = useKeyset ? FOLLOW_PAGE_CEILING : FIRST_PAGE_CEILING;
  const effectiveLimit = Math.min(clamped, ceiling);
  return {
    effectiveLimit,
    useKeyset,
    cursor: input.cursor,
    reasonCode: useKeyset ? 'FOLLOW_PAGE_KEYSET' : 'FIRST_LOAD_BOUNDED',
  };
}

/** Guard for cursor freshness — a cursor with an unparsable afterAt is refused. */
export function isValidCursor(cursor: KeysetCursor | undefined): boolean {
  if (!cursor) return false;
  if (!cursor.afterAt || !cursor.afterId) return false;
  return Number.isFinite(Date.parse(cursor.afterAt));
}
