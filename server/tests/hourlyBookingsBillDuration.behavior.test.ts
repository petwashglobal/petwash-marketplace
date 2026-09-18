/**
 * Hourly providers (walkers, trainers) were priced as ONE hour whatever the
 * booking window was, and walk rows stored the hourly RATE as the booking
 * subtotal — the column every walker-earnings figure reads.
 *
 *  - booking-requests legacy branch: ₪80/h walker, 3-hour window, 1 pet →
 *    subtotal ₪80 (₪92 charged) for ₪240 of service, and the walker was paid
 *    ₪80 (providerPayoutCents = subtotalCents).
 *  - walk-my-pet bridge: a 30-minute ₪60/h walk stored ₪60 against a ₪34.50
 *    total, so "your earnings" showed ₪60 per walk regardless of length.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitMarketplaceJob } from '@shared/marketplaceMoney';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const hours = (a: string, b: string) => Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 3_600_000));

describe('hourly rate × hours booked', () => {
  const src = read('server/routes/booking-requests.ts');

  it('the hourly branch multiplies by the hours', () => {
    expect(src).toContain('subtotalCents = hourlyRateCents * totalHours * data.petCount;');
    expect(src).not.toContain('subtotalCents = hourlyRateCents * data.petCount;');
    expect(src).toContain("const totalHours = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)));");
  });

  it('the hours are stored on the row, not null', () => {
    expect(src).toContain('totalHours: hourlyRateCents > 0 ? String(totalHours) : null,');
  });

  it('₪80/h, 3 hours → ₪240 to the walker, ₪276 charged (was ₪80 / ₪92)', () => {
    const h = hours('2026-09-21T09:00:00+03:00', '2026-09-21T12:00:00+03:00');
    expect(h).toBe(3);
    const s = splitMarketplaceJob(80_00 * h);
    expect(s.providerPayoutCents).toBe(240_00);
    expect(s.customerTotalCents).toBe(276_00);
  });

  it('a part hour rounds up, and a zero-length window still bills one hour', () => {
    expect(hours('2026-09-21T09:00:00+03:00', '2026-09-21T09:30:00+03:00')).toBe(1);
    expect(hours('2026-09-21T09:00:00+03:00', '2026-09-21T09:00:00+03:00')).toBe(1);
  });
});

describe('walk rows store the walk price, and earnings read the payout', () => {
  const src = read('server/routes/walk-my-pet.ts');

  it('the bridge stores pricing.subtotal, never the hourly rate', () => {
    expect(src).not.toContain('subtotalCents: Math.round(pricing.baseRate * 100)');
    expect(src.match(/subtotalCents: Math\.round\(pricing\.subtotal \* 100\)/g)?.length).toBe(2);
  });

  it('every earnings figure is what the walker is owed', () => {
    expect(src).toContain('const earned = (r: any) => r.providerPayoutCents ?? r.subtotalCents ?? 0;');
    expect(src).not.toMatch(/reduce\(\(sum, r\) => sum \+ \(r\.subtotalCents \|\| 0\), 0\)/);
    expect(src).toContain('earnings: (r.providerPayoutCents ?? r.subtotalCents ?? 0) / 100,');
  });

  it('a 30-minute ₪60/h walk: walker ₪30, customer ₪34.50', () => {
    const s = splitMarketplaceJob(30_00);
    expect(s.providerPayoutCents).toBe(30_00);
    expect(s.customerTotalCents).toBe(34_50);
  });
});
