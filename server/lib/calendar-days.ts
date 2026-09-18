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

// The implementation now lives in shared/calendarDays.ts so the booking screen
// counts the SAME nights the server charges (2026-09-18). Kept as a re-export:
// this path is pinned by server/tests/dstOverbilling.regression.test.ts.
export { countCalendarDays } from '@shared/calendarDays';
