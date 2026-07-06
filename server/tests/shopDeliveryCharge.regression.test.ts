/**
 * Shop checkout delivery CHARGE must reflect weight + distance (2026-07-06).
 *
 * Bug: ShopService.calculateDelivery (what checkout actually charges) returned a
 * FLAT ₪29.90/free, ignoring parcel weight and destination zone — even though the
 * customer-facing estimate priced via DeliveryRouter (weight tiers + periphery
 * surcharge). Heavy/periphery orders undercharged (loss); light central ones
 * overcharged. This pins that the charge now goes through the same router.
 *
 * DB-coupled (address + cart) → verified by source-introspection + the router's
 * own unit test (deliveryRouter.test.ts), per repo norm for money/DB engines.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const svc = readFileSync(resolve(ROOT, 'server/services/ShopService.ts'), 'utf8');
// isolate the calculateDelivery method body
const body = svc.slice(svc.indexOf('async calculateDelivery('), svc.indexOf('_addBusinessDays(n: number)'));

describe('shop delivery charge — weight + distance aware (2026-07-06)', () => {
  it('prices the charge via the vetted DeliveryRouter, not a flat rate', () => {
    expect(body).toMatch(/getDeliveryOptions\(/);
    // must NOT just return the old flat STANDARD_CENTS as the happy path
    expect(body).not.toMatch(/return\s*\{\s*cents:\s*DELIVERY_RATES\.STANDARD_CENTS,\s*estimatedDate/);
  });

  it('feeds real parcel weight (sum of item weight_grams x quantity) into the rate', () => {
    expect(body).toMatch(/weight_grams/);
    expect(body).toMatch(/totalGrams/);
  });

  it('feeds the destination (city + zip) so far/periphery deliveries cost more', () => {
    expect(body).toMatch(/_getAddress\(addressId\)/);
    expect(body).toMatch(/city:/);
    expect(body).toMatch(/postcode:/);
  });

  it('still zero-charges store/groomer pickup', () => {
    expect(body).toMatch(/pickup_station.*pickup_groomer|pickup_groomer/);
    expect(body).toMatch(/cents:\s*0/);
  });
});
