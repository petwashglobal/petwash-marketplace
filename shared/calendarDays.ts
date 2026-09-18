/**
 * Asia/Jerusalem-aware calendar-day ("nights") counting, shared by the server
 * price and the booking screen (2026-09-18).
 *
 * The sitter screen counted 24-hour blocks (Math.ceil(ms / 86_400_000)) while
 * the server counts calendar boundaries, so a Mon 09:00 → Tue 18:00 stay showed
 * 2 days (₪575) and was charged 1 (₪287.50). Counting calendar days is also
 * DST-immune: an Israeli calendar day is 23h or 25h twice a year.
 *
 * Pure function: no DB, no env, no money logic. Returns 0 for same-day,
 * end <= start, or invalid dates — the "minimum one night" rule belongs to
 * pricing, not to the counter.
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
