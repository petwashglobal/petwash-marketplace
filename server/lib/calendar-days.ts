/**
 * Asia/Jerusalem-aware calendar-day counting (PR-I).
 *
 * Background — forensic audit (PR #202) finding #10 + CEO-flagged
 * Tel Aviv multi-day overbilling bug:
 *
 *   The prior boarding-duration math at
 *     server/services/SitterAdvancedBookingEngine.ts:287
 *   used:
 *     Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000)
 *   That counts elapsed-millisecond windows, which is NOT the same as
 *   "calendar nights" once a Daylight Saving Time transition lands
 *   inside the booking window:
 *     • At Asia/Jerusalem fall-back DST (last Sunday of October), one
 *       calendar day spans 25 wall-clock hours. A 3-night stay across
 *       that boundary measures ~73h of ms; ceil(73/24)=4 ⇒ customer
 *       overbilled by 1 night.
 *     • At spring-forward DST (last Friday of March), one calendar day
 *       spans 23 wall-clock hours. The same code can also miscount.
 *
 * Resolution — count CALENDAR DAYS in the target timezone, not
 * millisecond ratios. DST-immune by construction: calendar boundaries
 * (Y-M-D in the local zone) do not shift when DST transitions occur.
 *
 * Boundaries:
 *   • Pure function. No DB, no process.env, no money logic, no vendor
 *     SDK. Safe to call from any layer.
 *   • Returns 0 for same-day inputs, end ≤ start, or invalid Date.
 *   • Returns the count of calendar-day boundaries crossed between
 *     start and end in the supplied timezone (defaults to
 *     Asia/Jerusalem). Synonymous with "nights" for typical
 *     boarding semantics.
 *
 * Out of scope:
 *   • Same-day "minimum 1 night" billing minimum (different concern;
 *     belongs in pricing rules, not in the duration calculator).
 *   • Hourly billing for drop-in / walking services (preserved
 *     unchanged in the engine).
 */

const MS_PER_DAY = 86_400_000;

const CANONICAL_FORMAT_LOCALE = 'en-CA'; // produces 'YYYY-MM-DD'

export function countCalendarDays(
  start: Date,
  end: Date,
  timeZone: string = 'Asia/Jerusalem',
): number {
  if (!(start instanceof Date) || !(end instanceof Date)) return 0;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end <= start) return 0;

  const fmt = new Intl.DateTimeFormat(CANONICAL_FORMAT_LOCALE, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const startYmd = fmt.format(start); // 'YYYY-MM-DD'
  const endYmd = fmt.format(end);

  const [sy, sm, sd] = startYmd.split('-').map((n) => Number.parseInt(n, 10));
  const [ey, em, ed] = endYmd.split('-').map((n) => Number.parseInt(n, 10));

  if ([sy, sm, sd, ey, em, ed].some((v) => Number.isNaN(v))) return 0;

  // Compare via UTC-anchored midnights — DST-immune.
  const startEpoch = Date.UTC(sy, sm - 1, sd);
  const endEpoch = Date.UTC(ey, em - 1, ed);
  return Math.round((endEpoch - startEpoch) / MS_PER_DAY);
}
