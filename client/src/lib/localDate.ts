/**
 * todayLocalIso — YYYY-MM-DD for the browser's local calendar day.
 *
 * `new Date().toISOString().split('T')[0]` returns the UTC date, which is
 * off by up to a full day for users in Israel (UTC+2/+3) between 21:00 and
 * midnight local. When used as a date-picker `min` value that means the
 * picker allows "yesterday" as a valid pick — real users could book a walk
 * in the past by 2-3 hours. This helper always returns the LOCAL calendar
 * day, matching what the user sees on their device clock.
 */
export function todayLocalIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
