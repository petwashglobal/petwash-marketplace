/**
 * Regression tests for the customer-PII visibility gate (bookingPii.ts).
 *
 * Locks the CEO hard rule: a provider must not see the customer's precise
 * location before accepting a booking, and the owner always sees their own data.
 */

import { describe, it, expect } from 'vitest';
import { maskCustomerLocationForProvider, PROVIDER_FULL_DETAIL_STATUSES } from '@shared/lib/bookingPii';

const PROVIDER = 'provider-uid';
const OWNER = 'owner-uid';

function makeBooking(status: string) {
  return {
    requestId: 'BR-1',
    ownerId: OWNER,
    providerId: PROVIDER,
    status,
    serviceType: 'dog_walking',
    petCount: 1,
    subtotalCents: 10000,
    // coarse — must always survive
    customerCity: 'Tel Aviv',
    customerCityKey: 'tel-aviv',
    customerCountry: 'IL',
    // precise — must be masked for a provider pre-accept
    customerAddress: '12 Dizengoff St, Tel Aviv',
    customerStreet: 'Dizengoff',
    customerStreetNumber: '12',
    customerApartment: '4B',
    customerPostalCode: '6433201',
    customerLatitude: '32.0809',
    customerLongitude: '34.7806',
    customerPlaceId: 'ChIJxxxx',
  };
}

const PRECISE = [
  'customerAddress', 'customerStreet', 'customerStreetNumber', 'customerApartment',
  'customerPostalCode', 'customerLatitude', 'customerLongitude', 'customerPlaceId',
] as const;

describe('maskCustomerLocationForProvider', () => {
  it('masks precise location for the provider on a PENDING booking', () => {
    const out = maskCustomerLocationForProvider(makeBooking('pending'), PROVIDER);
    for (const f of PRECISE) expect(out[f], f).toBeNull();
    expect(out.addressMasked).toBe(true);
    // coarse fields survive so the provider can judge area/distance
    expect(out.customerCity).toBe('Tel Aviv');
    expect(out.customerCityKey).toBe('tel-aviv');
    expect(out.customerCountry).toBe('IL');
  });

  it('reveals full location to the provider once ACCEPTED', () => {
    const out = maskCustomerLocationForProvider(makeBooking('accepted'), PROVIDER);
    expect(out.customerAddress).toBe('12 Dizengoff St, Tel Aviv');
    expect(out.customerLatitude).toBe('32.0809');
    expect(out.addressMasked).toBeUndefined();
  });

  it('reveals full location across every post-accept status', () => {
    for (const status of PROVIDER_FULL_DETAIL_STATUSES) {
      const out = maskCustomerLocationForProvider(makeBooking(status), PROVIDER);
      expect(out.customerAddress, status).toBe('12 Dizengoff St, Tel Aviv');
      expect(out.addressMasked, status).toBeUndefined();
    }
  });

  it('NEVER masks for the owner viewing their own booking (even pending)', () => {
    const out = maskCustomerLocationForProvider(makeBooking('pending'), OWNER);
    expect(out.customerAddress).toBe('12 Dizengoff St, Tel Aviv');
    expect(out.customerLatitude).toBe('32.0809');
    expect(out.addressMasked).toBeUndefined();
  });

  it('fails CLOSED — masks for the provider on declined / cancelled / unknown statuses', () => {
    for (const status of ['declined', 'cancelled', 'some_future_status']) {
      const out = maskCustomerLocationForProvider(makeBooking(status), PROVIDER);
      expect(out.customerAddress, status).toBeNull();
      expect(out.addressMasked, status).toBe(true);
    }
  });

  it('no-ops when there is no viewer id', () => {
    const out = maskCustomerLocationForProvider(makeBooking('pending'), undefined);
    expect(out.customerAddress).toBe('12 Dizengoff St, Tel Aviv');
  });
});
