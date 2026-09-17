/**
 * The Walk My Pet screen showed the price without the server's 20% peak-hour
 * surcharge (7–9 AM, 5–7 PM): ₪100 at 08:00 showed ₪115, priced ₪138.
 * Both now use shared/walkPeakHours.ts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isWalkPeakHour, walkPeakSurcharge } from '@shared/walkPeakHours';
import { splitMarketplaceJob } from '@shared/marketplaceMoney';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');

describe('peak-hour rule', () => {
  it('7–9 and 17–19 are peak; the edges are not', () => {
    expect([6, 7, 8, 9, 16, 17, 18, 19].map(isWalkPeakHour)).toEqual([false, true, true, false, false, true, true, false]);
  });

  it('₪100 walk at 08:00 → ₪120 walker price → ₪138 total', () => {
    const rate = 100 + walkPeakSurcharge(8, 100);
    expect(rate).toBe(120);
    expect(splitMarketplaceJob(rate * 100).customerTotalCents).toBe(13800);
    expect(walkPeakSurcharge(12, 100)).toBe(0);
  });
});

describe('server and screen use the same rule', () => {
  it('engine', () => {
    const src = read('server/services/booking-engines/walk/WalkEliteBookingEngine.ts');
    expect(src).toContain('return walkPeakSurcharge(startDate.getHours(), subtotal);');
    expect(src).not.toContain('subtotal * 0.20');
  });

  it('screen adds the surcharge before the fee and shows it', () => {
    const src = read('client/src/pages/walk-my-pet/BookingFlow.tsx');
    expect(src).toContain('walkPeakSurcharge(selectedDate.getHours(), baseAmount)');
    expect(src).toContain('splitMarketplaceJob(Math.round((baseAmount + surcharge) * 100))');
    expect(src).toContain('data-testid="walk-peak-surcharge"');
  });
});
