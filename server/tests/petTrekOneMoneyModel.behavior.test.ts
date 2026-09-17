/**
 * PetTrek on the one money model (CEO 2026-09-18: "it's 15%"), so the service
 * is correct whenever it is unfrozen — its routes return 403 today.
 *
 * Before: the fare estimator took 15% OUT of the fare (₪100 trip → driver ₪85)
 * and the chauffeur engine took 25% (driver ₪75) while the base engine priced
 * the trip as Pet Wash's own sale (18% VAT on the whole fare).
 * Now: driver keeps the fare, customer pays 15% on top, VAT inside the fee.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitMarketplaceJob } from '@shared/marketplaceMoney';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('fare estimate', () => {
  const src = read('server/services/PetTrekFareEstimationService.ts');

  it('splits with splitMarketplaceJob — no 15% taken out', () => {
    expect(src).toContain('const split = splitMarketplaceJob(Math.round(subtotal * 100));');
    expect(src).toContain('const driverPayout = split.providerPayoutCents / 100;');
    expect(src).not.toContain('subtotal * (1 - COMMISSION_RATE_TRANSPORT)');
  });

  it('estimatedFare is what the customer pays; driverFare is the fare', () => {
    expect(src).toContain('estimatedFare: customerTotal,');
    expect(src).toContain('driverFare: Math.round(subtotal * 100) / 100,');
  });

  it('₪100 fare → customer ₪115, driver ₪100, fee ₪15 (VAT ₪2.29)', () => {
    const s = splitMarketplaceJob(10000);
    expect([s.customerTotalCents, s.providerPayoutCents, s.serviceFeeCents, s.serviceFeeVatCents])
      .toEqual([11500, 10000, 1500, 229]);
  });
});

describe('chauffeur booking engine', () => {
  const src = read('server/services/booking-engines/pettrek/PetTrekChauffeurBookingEngine.ts');

  it('is a marketplace job and keeps the driver whole', () => {
    expect(src).toContain("protected moneyModel(): 'marketplace' {");
    expect(src).not.toContain('subtotal * 0.75');
  });
});

describe('booking screen', () => {
  it('splits the driver fare, so the fee is not added twice', () => {
    const src = read('client/src/pages/pettrek/BookTrip.tsx');
    expect(src).toContain('vatCalculator.calculateVAT(fareEstimate.driverFare ?? fareEstimate.estimatedFare)');
  });
});

describe('PetTrek is still frozen', () => {
  it('every route but /status returns 403', () => {
    const src = read('server/routes/pettrek.ts');
    expect(src).toMatch(/403/);
    expect(src).toMatch(/status/);
  });
});
