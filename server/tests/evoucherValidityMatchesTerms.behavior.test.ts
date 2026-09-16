/**
 * A PAID GIFT CARD DIED FOUR YEARS EARLY (2026-09-17).
 *
 * Our published Terms say it twice, English and Hebrew:
 *   "E-vouchers are valid for 60 months (5 years) from purchase date"
 *   "שוברים דיגיטליים תקפים ל-60 חודשים (5 שנים) מתאריך הרכישה"
 *
 * The purchase paths used `expiresInMonths: 60`. Three places wrote 365 days:
 *
 *  - server/nayaxService.ts stamped `expiresAt = now + 365 days` onto a voucher
 *    the customer had just PAID for. The redeem routes test `expires_at`, so on
 *    day 366 the remaining balance was refused — money gone, four years before
 *    the Terms said it could be.
 *  - the Apple and Google wallet passes showed "expires in 12 months" whenever a
 *    voucher had NO expiry recorded. Redemption treats null as valid
 *    (`expires_at IS NULL OR expires_at > NOW()`), so the card went grey in the
 *    holder's wallet while the money behind it was still live.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EVOUCHER_VALIDITY_MONTHS, evoucherExpiry, evoucherPassExpiry } from '../../shared/evoucherValidity';

const repo = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');
const monthsBetween = (a: Date, b: Date) =>
  (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

describe('the number matches the promise', () => {
  it('60 months, and the Terms say 60 months in both languages', () => {
    expect(EVOUCHER_VALIDITY_MONTHS).toBe(60);
    const terms = repo('client/src/pages/Terms.tsx');
    expect(terms).toContain('60 months (5 years)');
    expect(terms).toContain('60 חודשים (5 שנים)');
  });

  it('a voucher bought today expires 60 months from today', () => {
    const bought = new Date('2026-09-17T09:00:00Z');
    expect(monthsBetween(bought, evoucherExpiry(bought))).toBe(60);
  });

  // No hard-coded year here: setMonth() works in the host's local time, so a
  // date written in UTC lands in a different calendar month depending on where
  // the test runs. The invariant that matters is the GAP, and that it is
  // nowhere near the 12 months this used to be.
  it('crossing a year boundary still lands 60 months out, not 12', () => {
    const bought = new Date('2026-12-31T22:00:00Z');
    const exp = evoucherExpiry(bought);
    expect(monthsBetween(bought, exp)).toBe(60);
    const years = (exp.getTime() - bought.getTime()) / (365.25 * 24 * 3600 * 1000);
    expect(years).toBeGreaterThan(4.9);
    expect(years).toBeLessThan(5.1);
  });
});

describe('the wallet pass never shortens a live card', () => {
  it('a recorded expiry is shown exactly as recorded', () => {
    const real = new Date('2030-01-15T00:00:00Z');
    expect(evoucherPassExpiry(real).toISOString()).toBe(real.toISOString());
    expect(evoucherPassExpiry(real.toISOString()).toISOString()).toBe(real.toISOString());
  });

  it('no expiry recorded → 60 months from when the voucher was created, not 12', () => {
    const created = new Date('2026-03-01T00:00:00Z');
    expect(monthsBetween(created, evoucherPassExpiry(null, created))).toBe(60);
  });

  it('an unusable date falls back rather than showing "Invalid Date" on someone’s card', () => {
    expect(evoucherPassExpiry('not-a-date', 'also-not-a-date').getTime()).toBeGreaterThan(Date.now());
  });
});

describe('no caller writes its own duration any more', () => {
  it('the Nayax purchase path uses the shared expiry', () => {
    const src = repo('server/nayaxService.ts');
    expect(src).toContain('expiresAt: evoucherExpiry(),');
    expect(src).not.toMatch(/365 \* 24 \* 60 \* 60 \* 1000/);
  });

  it('both wallet passes use the shared expiry', () => {
    const src = repo('server/routes/gift-cards.ts');
    expect(src.match(/evoucherPassExpiry\(voucher\.expiresAt, voucher\.createdAt\)/g)).toHaveLength(2);
    expect(src).not.toMatch(/365 \* 24 \* 60 \* 60 \* 1000/);
  });

  it('the other purchase paths already said 60 and still do', () => {
    expect(repo('server/routes.ts').match(/expiresInMonths: 60/g)?.length).toBeGreaterThanOrEqual(2);
    expect(repo('server/services/PurchaseActivationService.ts')).toContain('expiresInMonths: 60');
    expect(repo('server/services/giftOrchestrationService.ts')).toContain('config.expiresInMonths || 60');
  });
});
