/**
 * Four provider-side defects found by the 2026-09-13 inconsistency sweep.
 * Each is a query or a default that is quietly wrong, so it fails by finding
 * nothing rather than by throwing — the kind that survives review for months.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rateCardUpdates } from '../routes/provider-rate-card';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('1. sitter reassignment can actually find a sitter', () => {
  it('searches for the status approval really writes', () => {
    const src = R('server/jobs/booking-expiry.ts');
    expect(src).toContain("eq(sitterProfiles.verificationStatus, 'active')");
    expect(src).not.toContain("eq(sitterProfiles.verificationStatus, 'verified')");
  });
  it('…and that is the word the approval path writes for a SITTER', () => {
    const approval = R('server/services/AdminProviderReviewService.ts');
    expect(approval).toMatch(/sitterProfiles[\s\S]{0,400}?verificationStatus: 'active'/);
  });
});

describe('2. a walker booking can be priced', () => {
  it('reads base_hourly_rate (the column that exists) and converts ILS→agorot', () => {
    const src = R('server/routes/booking-requests.ts');
    expect(src).toContain("Math.round(parseFloat(walker.baseHourlyRate || '0') * 100)");
    expect(src).not.toContain("parseInt(walker.hourlyRate || '0')");
  });
  it('the rate-card route writes that same column', () => {
    expect(R('server/routes/provider-rate-card.ts')).toContain('baseHourlyRate');
  });
});

describe('3. saving an hourly rate does not delist the sitter', () => {
  it('an hour-only update leaves the day rate alone', () => {
    const out = rateCardUpdates({ available: true, sitterHourIls: 60 } as any);
    expect(out.sitter).toBeDefined();
    expect(out.sitter).not.toHaveProperty('pricePerDayCents');
    expect(out.sitter!.pricePerHourCents).toBe(6000);
  });
  it('a day update still sets it', () => {
    const out = rateCardUpdates({ available: true, sitterDayIls: 150 } as any);
    expect(out.sitter!.pricePerDayCents).toBe(15000);
  });
  it('explicitly going unavailable still delists', () => {
    const out = rateCardUpdates({ available: false, sitterHourIls: 60 } as any);
    expect(out.sitter!.pricePerDayCents).toBe(0);
  });
  it('and an unavailable day update delists too', () => {
    const out = rateCardUpdates({ available: false, sitterDayIls: 150 } as any);
    expect(out.sitter!.pricePerDayCents).toBe(0);
  });
});

describe('4. a live meet-and-greet request makes the provider busy', () => {
  it('booking search counts it', () => {
    const src = R('server/routes/booking-search.ts');
    const busy = src.slice(src.indexOf('const busyFromRequests'), src.indexOf('const busyFromRequests') + 900);
    expect(busy).toContain("'meet_greet_requested'");
  });
  it('the rebook nudge counts it', () => {
    expect(R('server/jobs/rebook-scheduler.ts')).toContain("'meet_greet_requested'");
  });
  it('it really is a state the booking router writes', () => {
    expect(R('server/routes/booking-requests.ts')).toContain('meet_greet_requested');
  });
});
