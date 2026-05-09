/**
 * Issue #153 PR-I — Multi-day DST overbilling fix.
 *
 * Forensic audit (PR #202) finding #10 + CEO-flagged Tel Aviv multi-day
 * boarding bug:
 *   server/services/SitterAdvancedBookingEngine.ts:282-292 used
 *     Math.ceil((endDate - startDate) / 86_400_000)
 *   to count "days" for boarding-type services. At Asia/Jerusalem
 *   fall-back DST, one calendar day spans 25 wall-clock hours, so a
 *   3-night stay measured ~73 h of ms; ceil(73/24)=4 ⇒ customer
 *   overbilled by a full night.
 *
 * Resolution — count calendar days in Asia/Jerusalem timezone via
 * server/lib/calendar-days.ts (DST-immune by construction).
 *
 * Locked invariants this suite enforces:
 *
 *   A. countCalendarDays() handles same-day, multi-day, fall-back DST,
 *      spring-forward DST, end<=start guard, invalid Date guard.
 *
 *   B. The specific Asia/Jerusalem fall-back DST date pair that
 *      reproduced the bug (2024-10-26 09:00 → 2024-10-29 09:00, local)
 *      now returns 3 nights, NOT 4. The naive ms-ratio Math.ceil
 *      approach is asserted to STILL return 4 on that pair, proving
 *      the helper diverges from the buggy math at the right place.
 *
 *   C. The booking engine boarding branch now calls countCalendarDays
 *      instead of the Math.ceil(ms/86_400_000) literal. The hourly
 *      branch math is preserved unchanged (scope guard).
 *
 *   D. The helper imports zero vendor SDKs / DB / process.env / money
 *      logic. No money-flow keyword introduced anywhere by this PR.
 *
 *   E. PR-I traceability marker present in both the helper and the
 *      engine.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { countCalendarDays } from '../lib/calendar-days';

const ROOT = resolve(__dirname, '..', '..');
const helperSrc = readFileSync(resolve(ROOT, 'server/lib/calendar-days.ts'), 'utf8');
const engineSrc = readFileSync(
  resolve(ROOT, 'server/services/SitterAdvancedBookingEngine.ts'),
  'utf8',
);

const helperCodeOnly = helperSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const engineCodeOnly = engineSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ── Helpers for building Asia/Jerusalem-anchored Date objects ────────────
//
// Constructs a UTC Date that, when read in Asia/Jerusalem, displays as the
// requested local wall-clock time on the requested local calendar date.
// `offsetHours` is the timezone offset that applied at that moment:
//   • IDT (summer / pre-fall-back): UTC+3
//   • IST (winter / post-fall-back): UTC+2
function jerusalemWallClock(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  offsetHours: 2 | 3,
): Date {
  // hour local = hour UTC + offset → hour UTC = hour local - offset
  return new Date(Date.UTC(year, month - 1, day, hour - offsetHours, 0, 0, 0));
}

// ── A. Helper algorithmic correctness ────────────────────────────────────

describe('PR-I — countCalendarDays helper (Asia/Jerusalem)', () => {
  it('1. same calendar day → 0', () => {
    const start = jerusalemWallClock(2024, 6, 15, 10, 3);
    const end = jerusalemWallClock(2024, 6, 15, 14, 3);
    expect(countCalendarDays(start, end, 'Asia/Jerusalem')).toBe(0);
  });

  it('2. standard non-DST 3-night stay → 3', () => {
    // June (no DST transition); IDT all the way: UTC+3
    const start = jerusalemWallClock(2024, 6, 15, 9, 3);
    const end = jerusalemWallClock(2024, 6, 18, 9, 3);
    expect(countCalendarDays(start, end, 'Asia/Jerusalem')).toBe(3);
  });

  it('3. fall-back DST 3-night stay (the original bug) → 3, not 4', () => {
    // Asia/Jerusalem 2024 fall-back was on Sun 2024-10-27 02:00 IDT → 01:00 IST.
    // Stay starts 2024-10-26 09:00 IDT (UTC+3); ends 2024-10-29 09:00 IST (UTC+2).
    const start = jerusalemWallClock(2024, 10, 26, 9, 3);
    const end = jerusalemWallClock(2024, 10, 29, 9, 2);

    // Sanity: the millisecond delta is ~73h here (DST gave +1h that night).
    const diffHours = (end.getTime() - start.getTime()) / 3_600_000;
    expect(diffHours).toBeCloseTo(73, 5);

    // Buggy math (the prior code): would return 4. We assert that
    // explicitly so the test documents the pre-fix behaviour.
    const naiveCeil = Math.ceil(
      (end.getTime() - start.getTime()) / 86_400_000,
    );
    expect(naiveCeil).toBe(4);

    // Calendar-day math (post-fix): 3 nights.
    expect(countCalendarDays(start, end, 'Asia/Jerusalem')).toBe(3);
  });

  it('4. spring-forward DST 3-night stay → 3', () => {
    // Asia/Jerusalem 2024 spring-forward: Fri 2024-03-29 02:00 IST → 03:00 IDT.
    // Stay starts 2024-03-28 09:00 IST (UTC+2); ends 2024-03-31 09:00 IDT (UTC+3).
    const start = jerusalemWallClock(2024, 3, 28, 9, 2);
    const end = jerusalemWallClock(2024, 3, 31, 9, 3);
    // ms delta is ~71h (lost 1 hour to DST). Calendar count: 3.
    expect(countCalendarDays(start, end, 'Asia/Jerusalem')).toBe(3);
  });

  it('5. end <= start → 0 (no negative durations)', () => {
    const start = jerusalemWallClock(2024, 6, 15, 9, 3);
    expect(countCalendarDays(start, start, 'Asia/Jerusalem')).toBe(0);
    const earlier = jerusalemWallClock(2024, 6, 14, 9, 3);
    expect(countCalendarDays(start, earlier, 'Asia/Jerusalem')).toBe(0);
  });

  it('6. invalid Date inputs → 0 (fail-soft)', () => {
    const valid = jerusalemWallClock(2024, 6, 15, 9, 3);
    expect(countCalendarDays(new Date('not-a-date'), valid, 'Asia/Jerusalem')).toBe(0);
    expect(countCalendarDays(valid, new Date('not-a-date'), 'Asia/Jerusalem')).toBe(0);
  });

  it('7. defaults timeZone to Asia/Jerusalem when unspecified', () => {
    const start = jerusalemWallClock(2024, 10, 26, 9, 3);
    const end = jerusalemWallClock(2024, 10, 29, 9, 2);
    expect(countCalendarDays(start, end)).toBe(3);
  });

  it('8. crossing midnight by minutes counts as 1 night', () => {
    // 2024-06-15 23:30 IDT (UTC+3) → 2024-06-16 00:30 IDT.
    // 60 minutes wall-clock, but crosses one Asia/Jerusalem midnight.
    const start = new Date(Date.UTC(2024, 5, 15, 20, 30, 0, 0)); // = 23:30 IDT
    const end = new Date(Date.UTC(2024, 5, 15, 21, 30, 0, 0));   // = 00:30 IDT next day
    expect(countCalendarDays(start, end, 'Asia/Jerusalem')).toBe(1);
  });
});

// ── B. Engine boarding branch is wired to the helper ─────────────────────

describe('PR-I — booking engine boarding branch uses calendar-day helper', () => {
  it('9. SitterAdvancedBookingEngine imports countCalendarDays', () => {
    expect(engineSrc).toMatch(
      /import\s*\{\s*countCalendarDays\s*\}\s*from\s*['"][./]+lib\/calendar-days['"]/,
    );
  });

  it('10. calculateDuration boarding branch calls countCalendarDays', () => {
    // Locate calculateDuration block.
    const fnIdx = engineSrc.indexOf('private calculateDuration');
    expect(fnIdx).toBeGreaterThan(0);
    const fnSlice = engineSrc.slice(fnIdx, fnIdx + 1500);

    // Boarding branch present + uses helper with Asia/Jerusalem.
    expect(fnSlice).toMatch(/serviceType\s*===\s*['"]Boarding['"]/);
    expect(fnSlice).toMatch(/countCalendarDays\s*\(\s*startDate\s*,\s*endDate\s*,\s*['"]Asia\/Jerusalem['"]\s*\)/);
  });

  it('11. the prior Math.ceil(diffMs / 86_400_000) literal is GONE from the boarding branch', () => {
    // Defence: ensure the buggy ms-ratio pattern no longer appears in
    // the calculateDuration body.
    const fnIdx = engineSrc.indexOf('private calculateDuration');
    const fnSlice = engineSrc.slice(fnIdx, fnIdx + 1500);
    // The exact buggy expression — `Math.ceil(diffMs / (1000 * 60 * 60 * 24))` —
    // must not appear anywhere in this function's body.
    expect(fnSlice).not.toMatch(/Math\.ceil\(\s*diffMs\s*\/\s*\(\s*1000\s*\*\s*60\s*\*\s*60\s*\*\s*24\s*\)\s*\)/);
    // Same form expressed as the constant 86_400_000 — defensive.
    expect(fnSlice).not.toMatch(/Math\.ceil\(\s*diffMs\s*\/\s*86[_]?400[_]?000\s*\)/);
  });

  it('12. hourly branch math is preserved unchanged (scope guard)', () => {
    // Hourly path: drop-in, walking — kept on raw ms hour-ratio.
    const fnIdx = engineSrc.indexOf('private calculateDuration');
    const fnSlice = engineSrc.slice(fnIdx, fnIdx + 1500);
    expect(fnSlice).toMatch(/Math\.ceil\(\s*diffMs\s*\/\s*\(\s*1000\s*\*\s*60\s*\*\s*60\s*\)\s*\)/);
  });
});

// ── C. Helper purity + scope guards ──────────────────────────────────────

describe('PR-I — helper purity + scope guards', () => {
  it('13. helper imports zero vendor SDK / DB / env', () => {
    expect(helperCodeOnly).not.toMatch(/from\s+['"][^'"]*\/db['"]/);
    expect(helperCodeOnly).not.toMatch(/process\.env/);
    expect(helperCodeOnly).not.toMatch(/import[^;]*['"][^'"]*nayax[^'"]*['"]/i);
    expect(helperCodeOnly).not.toMatch(/import[^;]*['"][^'"]*tranzila[^'"]*['"]/i);
    expect(helperCodeOnly).not.toMatch(/import[^;]*['"][^'"]*stripe[^'"]*['"]/i);
    expect(helperCodeOnly).not.toMatch(/import[^;]*['"][^'"]*sumit[^'"]*['"]/i);
  });

  it('14. helper introduces no money-flow keyword (defence-in-depth)', () => {
    expect(helperCodeOnly).not.toMatch(/(payout|refund|wallet|charge|debit|capture|authorize|invoice|receipt)/i);
  });

  it('15. engine diff at calculateDuration introduces no money-flow keyword', () => {
    const fnIdx = engineSrc.indexOf('private calculateDuration');
    const fnSlice = engineSrc.slice(fnIdx, fnIdx + 1500);
    // Strip comments inside the function body for code-only check.
    const codeOnly = fnSlice
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/(payout|refund|wallet|nayax|tranzila|stripe|sumit|invoice|receipt)/i);
  });
});

// ── D. Traceability ──────────────────────────────────────────────────────

describe('PR-I — traceability marker', () => {
  it('16. helper docstring mentions PR-I + Asia/Jerusalem + finding #10', () => {
    expect(helperSrc).toMatch(/PR-I/);
    expect(helperSrc).toMatch(/Asia\/Jerusalem/);
    expect(helperSrc).toMatch(/finding #10|finding ?#?10/);
  });

  it('17. engine calculateDuration mentions PR-I above the boarding branch', () => {
    const fnIdx = engineSrc.indexOf('private calculateDuration');
    const block = engineSrc.slice(Math.max(0, fnIdx - 800), fnIdx + 1500);
    expect(block).toMatch(/PR-I/);
  });
});
