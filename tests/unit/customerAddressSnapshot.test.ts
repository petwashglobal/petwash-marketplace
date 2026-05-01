import { describe, it, expect } from 'vitest';
import {
  customerAddressSnapshotSchema,
  createBookingRequestSchema,
} from '../../shared/schema';
import {
  cityKey,
  stripHebrewStreetPrefix,
  normalizeIsraeliPostalCode,
} from '../../shared/lib/address';

/**
 * Phase B6 — Customer address snapshot tests.
 *
 * Verifies the contract between the booking-create API and the
 * snapshot row: every field that lands on the booking row stays
 * truthful, structured, and language-agnostic.
 *
 * The end-to-end DB persistence is covered by the integration suite
 * once a Postgres test instance is provisioned. These tests cover the
 * Zod schema and the helpers used by the route handler to normalize
 * the snapshot before insert.
 */

describe('customerAddressSnapshotSchema — Zod validation', () => {
  it('accepts an empty object (all fields optional)', () => {
    const r = customerAddressSnapshotSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('accepts a fully populated Israeli address (real example A)', () => {
    const r = customerAddressSnapshotSchema.safeParse({
      formattedAddress: 'רחוב רימלט 18, רמת גן, ישראל',
      street: 'רחוב רימלט',
      streetNumber: '18',
      apartment: '77',
      city: 'רמת גן',
      country: 'IL',
      postalCode: '5235411',
      latitude: 32.0809,
      longitude: 34.8147,
      placeId: 'ChIJ-SnHa3BMHRURr-mVaiagREw',
    });
    expect(r.success).toBe(true);
  });

  it('accepts a fully populated address (real example B — no prefix)', () => {
    const r = customerAddressSnapshotSchema.safeParse({
      formattedAddress: 'עוזי חיטמן 8, ראש העין, ישראל',
      street: 'עוזי חיטמן',
      streetNumber: '8',
      city: 'ראש העין',
      country: 'IL',
      latitude: 32.0918,
      longitude: 34.9490,
    });
    expect(r.success).toBe(true);
  });

  it('rejects out-of-range latitude (defense in depth)', () => {
    const r = customerAddressSnapshotSchema.safeParse({ latitude: 91 });
    expect(r.success).toBe(false);
  });

  it('rejects out-of-range longitude (defense in depth)', () => {
    const r = customerAddressSnapshotSchema.safeParse({ longitude: 181 });
    expect(r.success).toBe(false);
  });

  it('accepts null postalCode (Israel often has no postcode)', () => {
    const r = customerAddressSnapshotSchema.safeParse({ postalCode: null });
    expect(r.success).toBe(true);
  });

  it('caps overlong text inputs', () => {
    // street ≤ 200, address ≤ 500
    const r = customerAddressSnapshotSchema.safeParse({
      street: 'a'.repeat(201),
    });
    expect(r.success).toBe(false);
  });
});

describe('createBookingRequestSchema — accepts customerAddress', () => {
  const baseBooking = {
    providerId: 'provider-uid-123',
    providerType: 'sitter' as const,
    serviceType: 'pet_sitting' as const,
    startDate: '2026-06-01T10:00:00.000Z',
    endDate: '2026-06-01T18:00:00.000Z',
    petCount: 1,
  };

  it('accepts a booking without an address snapshot (legacy callers)', () => {
    const r = createBookingRequestSchema.safeParse(baseBooking);
    expect(r.success).toBe(true);
  });

  it('accepts a booking with a Hebrew address snapshot', () => {
    const r = createBookingRequestSchema.safeParse({
      ...baseBooking,
      customerAddress: {
        formattedAddress: 'רחוב רימלט 18, רמת גן',
        street: 'רחוב רימלט',
        streetNumber: '18',
        apartment: '77',
        city: 'רמת גן',
        country: 'IL',
        latitude: 32.0809,
        longitude: 34.8147,
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects a booking with bad lat (defense in depth)', () => {
    const r = createBookingRequestSchema.safeParse({
      ...baseBooking,
      customerAddress: { latitude: 999 },
    });
    expect(r.success).toBe(false);
  });
});

describe('Snapshot normalisation — what the route handler stores', () => {
  // Mirrors the addressSnapshot construction in
  // server/routes/booking-requests.ts (B6.2 wiring). These tests prove
  // that the helpers used by the route produce the right column values
  // for the two real Hebrew examples.

  function buildSnapshot(addr: any) {
    return {
      customerAddress:      addr.formattedAddress?.slice(0, 5000) ?? null,
      customerStreet:       addr.street ? stripHebrewStreetPrefix(addr.street).slice(0, 200) : null,
      customerStreetNumber: addr.streetNumber?.toString().slice(0, 40) ?? null,
      customerApartment:    addr.apartment?.toString().slice(0, 80) ?? null,
      customerCity:         addr.city?.toString().slice(0, 120) ?? null,
      customerCityKey:      addr.city ? cityKey(addr.city).slice(0, 60) : null,
      customerCountry:      addr.country?.toString().slice(0, 2).toUpperCase() ?? null,
      customerPostalCode:   normalizeIsraeliPostalCode(addr.postalCode ?? null),
      customerLatitude:     typeof addr.latitude === 'number' && Number.isFinite(addr.latitude)
                              ? String(addr.latitude) : null,
      customerLongitude:    typeof addr.longitude === 'number' && Number.isFinite(addr.longitude)
                              ? String(addr.longitude) : null,
      customerPlaceId:      addr.placeId?.toString().slice(0, 200) ?? null,
    };
  }

  it('Example A: רחוב רימלט 18 דירה 77 רמת גן → snapshot strips prefix and sets cityKey', () => {
    const snap = buildSnapshot({
      formattedAddress: 'רחוב רימלט 18, רמת גן',
      street: 'רחוב רימלט',
      streetNumber: '18',
      apartment: '77',
      city: 'רמת גן',
      country: 'IL',
      latitude: 32.0809,
      longitude: 34.8147,
    });
    expect(snap.customerStreet).toBe('רימלט');           // prefix stripped
    expect(snap.customerStreetNumber).toBe('18');
    expect(snap.customerApartment).toBe('77');
    expect(snap.customerCity).toBe('רמת גן');             // raw spelling preserved
    expect(snap.customerCityKey).toBe('ramat-gan');       // normalised
    expect(snap.customerCountry).toBe('IL');
    expect(snap.customerPostalCode).toBeNull();           // no postcode given
    expect(snap.customerLatitude).toBe('32.0809');
    expect(snap.customerLongitude).toBe('34.8147');
  });

  it('Example B: עוזי חיטמן 8 ראש העין → snapshot stores everything language-agnostic', () => {
    const snap = buildSnapshot({
      formattedAddress: 'עוזי חיטמן 8, ראש העין',
      street: 'עוזי חיטמן',
      streetNumber: '8',
      city: 'ראש העין',
      country: 'IL',
      latitude: 32.0918,
      longitude: 34.9490,
    });
    expect(snap.customerStreet).toBe('עוזי חיטמן');       // no prefix to strip
    expect(snap.customerCityKey).toBe('rosh-haayin');     // normalised
    expect(snap.customerLatitude).toBe('32.0918');
  });

  it('English address from the same customer → identical cityKey', () => {
    const snapHe = buildSnapshot({ city: 'רמת גן', country: 'IL' });
    const snapEn = buildSnapshot({ city: 'Ramat Gan', country: 'IL' });
    expect(snapHe.customerCityKey).toBe(snapEn.customerCityKey);
    expect(snapHe.customerCityKey).toBe('ramat-gan');
  });

  it('postcode 7-digit → normalised to digits only', () => {
    const snap = buildSnapshot({ postalCode: '523-5411' });
    expect(snap.customerPostalCode).toBe('5235411');
  });

  it('missing or malformed postcode → null (never throws)', () => {
    expect(buildSnapshot({ postalCode: null }).customerPostalCode).toBeNull();
    expect(buildSnapshot({ postalCode: undefined }).customerPostalCode).toBeNull();
    expect(buildSnapshot({ postalCode: '12' }).customerPostalCode).toBeNull(); // too short
    expect(buildSnapshot({}).customerPostalCode).toBeNull();
  });

  it('country normalised to upper-case 2-char ISO code', () => {
    expect(buildSnapshot({ country: 'il' }).customerCountry).toBe('IL');
    expect(buildSnapshot({ country: 'us' }).customerCountry).toBe('US');
  });

  it('drops NaN / Infinity coordinates (defense in depth)', () => {
    const snap = buildSnapshot({ latitude: NaN, longitude: Number.POSITIVE_INFINITY });
    expect(snap.customerLatitude).toBeNull();
    expect(snap.customerLongitude).toBeNull();
  });

  it('caps overlong inputs (formattedAddress 5000, street 200)', () => {
    const snap = buildSnapshot({
      formattedAddress: 'a'.repeat(6000),
      street: 'b'.repeat(300),
    });
    expect(snap.customerAddress?.length).toBe(5000);
    expect(snap.customerStreet?.length).toBe(200);
  });
});

describe('Snapshot independence — booking row is the source of truth', () => {
  // This is a documentation test for the contract:
  // once written, the booking's customer_* columns do not change when
  // the customer mutates their profile address. The DB-level proof
  // comes with the integration suite.
  it('cityKey on the booking is independent of the customer profile', () => {
    const bookingSnapshotCity = cityKey('רמת גן');
    // simulate customer moving — their profile becomes 'תל אביב', but the
    // booking row was already stamped with cityKey of 'רמת גן'.
    const profileNowCity = cityKey('תל אביב');
    expect(bookingSnapshotCity).toBe('ramat-gan');
    expect(profileNowCity).toBe('tel-aviv');
    expect(bookingSnapshotCity).not.toBe(profileNowCity);
  });
});
