/**
 * Job evidence cross-examination (CEO 2026-09-13: providers can lie — match the
 * data, cross-examine every job before a Pet Wash admin approves a payout).
 *
 * Realistic honest and dishonest jobs, Kfar Saba coordinates.
 */
import { describe, expect, it } from 'vitest';
import { evaluateJobEvidence, haversineMeters, type JobEvidence, type GeoPoint } from '../services/jobEvidence';

const HOME = { lat: 32.1782, lng: 34.9076 };           // pickup address
const start = new Date('2026-09-13T08:00:00Z');
const at = (min: number) => new Date(start.getTime() + min * 60_000);

/** A believable 60-min walk: a point every 2 min, ~80 m per point (~2.4 km/h), out and back ≈ 2.4 km. */
function honestTrack(minutes = 60, from = HOME): GeoPoint[] {
  const pts: GeoPoint[] = [];
  for (let m = 0; m <= minutes; m += 2) {
    const leg = m <= minutes / 2 ? m : minutes - m;          // out and back
    pts.push({ lat: from.lat + leg * 0.00035, lng: from.lng + leg * 0.0001, at: at(m) });
  }
  return pts;
}

function walk(over: Partial<JobEvidence> = {}): JobEvidence {
  const track = honestTrack();
  return {
    kind: 'walk', jobId: 'WALK-2026-000001',
    providerUid: 'walker-1', ownerUid: 'owner-1',
    providerPhoneHash: 'hash-walker', ownerPhoneHash: 'hash-owner',
    scheduledStart: start, scheduledEnd: at(60), bookedMinutes: 60,
    serviceLocation: HOME,
    actualStart: at(0), actualEnd: at(60), providerCompletedAt: at(60),
    gpsPoints: track, claimedDistanceMeters: 2200, claimedDurationMinutes: 60,
    photoTimes: [at(10), at(45)],
    customerConfirmedAt: at(90), autoApproved: false, openDispute: false,
    ...over,
  };
}
const codes = (ev: JobEvidence) => evaluateJobEvidence(ev).findings.map((f) => f.code).sort();

describe('the honest job is clear', () => {
  it('60-min walk, GPS all the way, check-in at the door, customer confirmed', () => {
    const r = evaluateJobEvidence(walk());
    expect(r.verdict).toBe('clear');
    expect(r.findings).toEqual([]);
    expect(r.measured.gpsPoints).toBe(31);
    expect(r.measured.checkInDistanceMeters).toBe(0);
    expect(r.measured.maxSpeedKmh).toBeLessThan(10);
  });
});

describe('lies that BLOCK approval (admin can still override with a written reason)', () => {
  it('provider booked themself (same account)', () => {
    expect(codes(walk({ ownerUid: 'walker-1' }))).toContain('SELF_BOOKING_SAME_ACCOUNT');
  });
  it('provider booked through a second account with the same phone', () => {
    const r = evaluateJobEvidence(walk({ ownerPhoneHash: 'hash-walker' }));
    expect(r.verdict).toBe('blocked');
    expect(r.findings.map((f) => f.code)).toContain('SELF_BOOKING_SAME_PHONE');
  });
  it('"completed" before the booking even started', () => {
    expect(codes(walk({ providerCompletedAt: new Date(start.getTime() - 30 * 60_000), actualEnd: null }))).toContain('COMPLETED_BEFORE_START');
  });
  it('walk with no GPS track at all', () => {
    const r = evaluateJobEvidence(walk({ gpsPoints: [{ ...HOME, at: at(0) }] }));
    expect(r.verdict).toBe('blocked');
    expect(r.findings.map((f) => f.code)).toContain('NO_GPS_TRACK');
  });
  it('booked 60 minutes, walked 20', () => {
    const r = evaluateJobEvidence(walk({ actualEnd: at(20), providerCompletedAt: at(20), gpsPoints: honestTrack(20) }));
    expect(r.findings.find((f) => f.code === 'WALK_TOO_SHORT')?.detail).toContain('20 of 60');
    expect(r.verdict).toBe('blocked');
  });
  it('checked in 3 km from the pickup address', () => {
    const far = { lat: HOME.lat + 0.027, lng: HOME.lng };      // ~3 km north
    expect(codes(walk({ gpsPoints: honestTrack(60, far) }))).toContain('CHECK_IN_FAR_FROM_ADDRESS');
  });
  it('an open dispute blocks', () => {
    expect(evaluateJobEvidence(walk({ openDispute: true })).verdict).toBe('blocked');
  });
});

describe('suspicious facts that need a human look (review)', () => {
  it('walk of 45 of 60 minutes', () => {
    const r = evaluateJobEvidence(walk({ actualEnd: at(45), providerCompletedAt: at(45), gpsPoints: honestTrack(44), claimedDurationMinutes: 45, claimedDistanceMeters: 1700 }));
    expect(r.verdict).toBe('review');
    expect(r.findings.map((f) => f.code)).toEqual(['WALK_SHORT']);
  });
  it('the app claims 6 km while the GPS measured ~2 km', () => {
    expect(codes(walk({ claimedDistanceMeters: 6000 }))).toEqual(['CLAIMED_DISTANCE_INFLATED']);
  });
  it('the app claims 120 minutes over a 60-minute track', () => {
    expect(codes(walk({ claimedDurationMinutes: 120 }))).toEqual(['CLAIMED_DURATION_INFLATED']);
  });
  it('driving the route instead of walking it', () => {
    const car: GeoPoint[] = [0, 1, 2, 3, 4].map((m) => ({ lat: HOME.lat + m * 0.01, lng: HOME.lng, at: at(m) })); // ~1.1 km/min
    const r = evaluateJobEvidence(walk({ gpsPoints: car, actualEnd: at(60) }));
    expect(r.findings.map((f) => f.code)).toContain('IMPOSSIBLE_WALKING_SPEED');
  });
  it('check-in 500 m away is a warning, not a block', () => {
    const near = { lat: HOME.lat + 0.0045, lng: HOME.lng };    // ~500 m
    expect(codes(walk({ gpsPoints: honestTrack(60, near) }))).toEqual(['CHECK_IN_AWAY_FROM_ADDRESS']);
  });
  it('a photo taken the day before', () => {
    expect(codes(walk({ photoTimes: [new Date(start.getTime() - 24 * 3_600_000)] }))).toEqual(['PHOTO_OUTSIDE_JOB_WINDOW']);
  });
  it('auto-completed after customer silence', () => {
    const r = evaluateJobEvidence(walk({ customerConfirmedAt: null, autoApproved: true }));
    expect(r.verdict).toBe('review');
    expect(r.findings[0].code).toBe('NO_CUSTOMER_CONFIRMATION');
  });
  it('sparse GPS (3 points over an hour)', () => {
    const sparse: GeoPoint[] = [0, 30, 60].map((m) => ({ lat: HOME.lat + m * 0.00003, lng: HOME.lng, at: at(m) }));
    expect(codes(walk({ gpsPoints: sparse, claimedDistanceMeters: null }))).toEqual(['SPARSE_GPS_TRACK']);
  });
});

describe('sitter / booking-request jobs (no GPS table): the checks that apply', () => {
  const booking = (over: Partial<JobEvidence> = {}): JobEvidence => ({
    kind: 'booking_request', jobId: 'BR-1', providerUid: 'sitter-1', ownerUid: 'owner-1',
    scheduledStart: start, scheduledEnd: at(48 * 60), providerCompletedAt: at(48 * 60 + 30),
    photoTimes: [at(600)], customerConfirmedAt: at(49 * 60), ...over,
  });
  it('an honest 2-day stay is clear (GPS rules do not apply)', () => {
    expect(evaluateJobEvidence(booking()).verdict).toBe('clear');
  });
  it('completed before the stay started blocks', () => {
    expect(codes(booking({ providerCompletedAt: new Date(start.getTime() - 60_000) }))).toContain('COMPLETED_BEFORE_START');
  });
});

describe('geometry', () => {
  it('haversine: Kfar Saba → Tel Aviv ≈ 17–20 km', () => {
    const d = haversineMeters(HOME, { lat: 32.0853, lng: 34.7818 });
    expect(d).toBeGreaterThan(15_000);
    expect(d).toBeLessThan(22_000);
  });
});

describe('gross model: the provider must record their own invoice', () => {
  it('required and missing → blocked', () => {
    const r = evaluateJobEvidence(walk({ providerInvoiceRequired: true, providerInvoiceNumber: null }));
    expect(r.verdict).toBe('blocked');
    expect(r.findings.map((f) => f.code)).toEqual(['PROVIDER_INVOICE_MISSING']);
  });
  it('required and recorded → clear', () => {
    expect(evaluateJobEvidence(walk({ providerInvoiceRequired: true, providerInvoiceNumber: 'INV-2026-0042' })).verdict).toBe('clear');
  });
  it('whitespace is not an invoice number', () => {
    expect(evaluateJobEvidence(walk({ providerInvoiceRequired: true, providerInvoiceNumber: '   ' })).verdict).toBe('blocked');
  });
});
