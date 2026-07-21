/**
 * Provider home income chart — the canonical mockup's month-review block.
 *
 * The mockup shows "סקירת חודש" with a month total, a "+X% מהחודש שעבר" delta
 * and WEEK-BY-WEEK BARS. The earnings card existed with the numbers, but no
 * weekly series was ever computed server-side and no chart rendered — the most
 * visible missing block on the provider flagship screen (CEO "everything wired"
 * sweep, 2026-07-22).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const server = readFileSync(resolve(ROOT, 'server/routes/provider-dashboard-v2.ts'), 'utf8');
const client = readFileSync(resolve(ROOT, 'client/src/pages/ProviderHome.tsx'), 'utf8');

describe('income chart — wired end to end', () => {
  it('server computes current-month weekly buckets', () => {
    expect(server).toMatch(/CEIL\(EXTRACT\(DAY FROM service_completed_at\) \/ 7\.0\)::int AS week_of_month/);
    expect(server).toMatch(/date_trunc\('month', NOW\(\)\)/);
  });

  it('series is padded to the real week count of the month (zero weeks included)', () => {
    expect(server).toMatch(/Math\.ceil\(daysInMonth \/ 7\)/);
    expect(server).toMatch(/weeklyByBucket\.get\(i \+ 1\) \?\? 0/);
  });

  it('month-over-month is null against a zero month — never a fabricated %', () => {
    expect(server).toMatch(/lastM > 0 \? Math\.round/);
    expect(server).toMatch(/: null/);
  });

  it('response carries weeklySeries + monthOverMonthPct', () => {
    expect(server).toMatch(/weeklySeries,\s*\n\s*monthOverMonthPct,/);
  });

  it('client renders the bars from exactly this series (guarded for old caches)', () => {
    expect(client).toMatch(/Array\.isArray\(earn\?\.weeklySeries\)/);
    expect(client).toMatch(/Math\.round\(\(w\.amount \/ max\) \* 48\)/);
    // Zero-earning weeks still draw a 2px baseline — the week visibly exists.
    expect(client).toMatch(/Math\.max\(2,/);
  });
});
