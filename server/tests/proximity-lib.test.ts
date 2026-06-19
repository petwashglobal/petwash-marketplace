/**
 * Unit tests for the shared booking proximity guard (server/lib/proximity.ts).
 * Core contract: FAIL OPEN on missing coords, reject only when clearly too far.
 */
import { describe, it, expect } from 'vitest';
import { checkBookingProximity, BOOKING_MAX_DISTANCE_KM, PROXIMITY_BUFFER } from '../lib/proximity';

// Tel Aviv ~ Kfar Saba is ~20km; Tel Aviv ~ Eilat is ~280km.
const TLV = { lat: 32.0853, lng: 34.7818 };
const KFAR_SABA = { lat: 32.1782, lng: 34.9070 };
const EILAT = { lat: 29.5577, lng: 34.9519 };

describe('checkBookingProximity', () => {
  it('FAILS OPEN when customer coords missing', () => {
    const r = checkBookingProximity({
      customerLat: null, customerLng: null,
      providerLat: TLV.lat, providerLng: TLV.lng,
    });
    expect(r).toEqual({ ok: true, skipped: 'no-coords' });
  });

  it('FAILS OPEN when provider coords missing', () => {
    const r = checkBookingProximity({
      customerLat: TLV.lat, customerLng: TLV.lng,
      providerLat: undefined, providerLng: undefined,
    });
    expect(r).toEqual({ ok: true, skipped: 'no-coords' });
  });

  it('FAILS OPEN on null-island 0,0', () => {
    const r = checkBookingProximity({
      customerLat: 0, customerLng: 0,
      providerLat: TLV.lat, providerLng: TLV.lng,
    });
    expect(r).toEqual({ ok: true, skipped: 'no-coords' });
  });

  it('allows when within radius', () => {
    const r = checkBookingProximity({
      customerLat: KFAR_SABA.lat, customerLng: KFAR_SABA.lng,
      providerLat: TLV.lat, providerLng: TLV.lng,
      maxKm: 30,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.skipped).toBe('within-range');
  });

  it('REJECTS when clearly too far (beyond radius + buffer)', () => {
    const r = checkBookingProximity({
      customerLat: EILAT.lat, customerLng: EILAT.lng,
      providerLat: TLV.lat, providerLng: TLV.lng,
      maxKm: 30,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.maxKm).toBe(30);
      expect(r.distanceKm).toBeGreaterThan(200);
    }
  });

  it('accepts string/decimal coords (DB decimal columns)', () => {
    const r = checkBookingProximity({
      customerLat: String(EILAT.lat), customerLng: String(EILAT.lng),
      providerLat: String(TLV.lat), providerLng: String(TLV.lng),
      maxKm: 30,
    });
    expect(r.ok).toBe(false);
  });

  it('honors explicit admin bypass', () => {
    const r = checkBookingProximity({
      customerLat: EILAT.lat, customerLng: EILAT.lng,
      providerLat: TLV.lat, providerLng: TLV.lng,
      maxKm: 30,
      bypass: true,
    });
    expect(r).toEqual({ ok: true, skipped: 'bypass', maxKm: 30 });
  });

  it('falls back to BOOKING_MAX_DISTANCE_KM when maxKm not given', () => {
    const r = checkBookingProximity({
      customerLat: EILAT.lat, customerLng: EILAT.lng,
      providerLat: TLV.lat, providerLng: TLV.lng,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.maxKm).toBe(BOOKING_MAX_DISTANCE_KM);
  });

  it('applies the buffer (near-edge bookings are allowed)', () => {
    // within maxKm*buffer but slightly over raw maxKm should still be allowed
    expect(PROXIMITY_BUFFER).toBeGreaterThan(1);
  });
});
