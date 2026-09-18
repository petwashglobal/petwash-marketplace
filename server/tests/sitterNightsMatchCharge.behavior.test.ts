/**
 * The sitter booking screen and the server must count the SAME nights, and the
 * customer must never be charged a surcharge the screen did not show.
 *
 * Before 2026-09-18:
 *  - the screen counted 24-hour blocks (Math.ceil(ms / 86_400_000)), the server
 *    counts calendar days: Mon 09:00 → Tue 18:00 showed ₪575 and charged
 *    ₪287.50, and the sitter was paid for one night, not two
 *  - the engine added a 50% holiday surge the screen has no line for (₪862.50
 *    shown → ₪1,293.75 charged). Inert only because the holiday windows had
 *    expired; refreshing them would have switched it on silently.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { countCalendarDays } from '@shared/calendarDays';
import { splitMarketplaceJob } from '@shared/marketplaceMoney';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const nights = (a: string, b: string) => Math.max(1, countCalendarDays(new Date(a), new Date(b), 'Asia/Jerusalem'));

describe('nights', () => {
  it('Mon 09:00 → Tue 18:00 is one night, not two', () => {
    expect(nights('2026-09-21T09:00:00+03:00', '2026-09-22T18:00:00+03:00')).toBe(1);
  });

  it('₪250/night: screen and charge are both ₪287.50', () => {
    const rate = 250_00 * nights('2026-09-21T09:00:00+03:00', '2026-09-22T18:00:00+03:00');
    expect(splitMarketplaceJob(rate).customerTotalCents).toBe(287_50);
  });

  it('a same-day stay still bills one night; longer stays count boundaries', () => {
    expect(nights('2026-09-21T09:00:00+03:00', '2026-09-21T20:00:00+03:00')).toBe(1);
    expect(nights('2026-09-21T09:00:00+03:00', '2026-09-24T09:00:00+03:00')).toBe(3);
  });

  it('DST-immune: the October fall-back week counts calendar nights', () => {
    expect(nights('2026-10-23T12:00:00+03:00', '2026-10-26T12:00:00+02:00')).toBe(3);
  });

  it('the screen uses the shared counter, not ms math', () => {
    const src = read('client/src/pages/sitter-suite/BookingFlow.tsx');
    expect(src).toContain("import { countCalendarDays } from '@shared/calendarDays';");
    expect(src).toContain("return Math.max(1, countCalendarDays(start, end, 'Asia/Jerusalem'));");
    expect(src).not.toMatch(/Math\.ceil\(diff \/ \(1000 \* 60 \* 60 \* 24\)\)/);
  });

  it('the server still imports it from its pinned path', () => {
    expect(read('server/services/SitterAdvancedBookingEngine.ts'))
      .toMatch(/import \{ countCalendarDays \} from '\.\.\/lib\/calendar-days'/);
    expect(read('server/lib/calendar-days.ts')).toContain("export { countCalendarDays } from '@shared/calendarDays';");
  });
});

describe('holiday surge', () => {
  const src = read('server/services/SitterAdvancedBookingEngine.ts');

  it('is not added to a price the screen never showed', () => {
    expect(src).toContain('const holidaySurge = 0;');
    expect(src).not.toContain('holidaySurge = subtotal * 0.50');
    expect(src).not.toMatch(/subtotal \+= holidaySurge/);
  });

  it('₪750 stay stays ₪862.50 — not ₪1,293.75', () => {
    expect(splitMarketplaceJob(750_00).customerTotalCents).toBe(862_50);
    expect(splitMarketplaceJob(750_00 + 375_00).customerTotalCents).toBe(1_293_75);
  });
});
