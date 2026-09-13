/**
 * The job-evidence loaders run against a real Postgres engine (pglite) with the
 * columns production uses, and feed the pure cross-examination rules.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const pg = new PGlite();
vi.mock('../db', () => ({ pool: { query: (text: string, params?: unknown[]) => pg.query(text, params as any[]) } }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { buildJobEvidenceReport, israelLocalDateTime } from '../services/jobEvidenceLoader';

beforeAll(async () => {
  await pg.exec(`
    CREATE TABLE users (id text PRIMARY KEY, phone text, phone_hash text, phone_e164 text);
    CREATE TABLE walker_profiles (walker_id text PRIMARY KEY, user_id text NOT NULL);
    CREATE TABLE walk_bookings (
      booking_id text PRIMARY KEY, owner_id text, walker_id text, scheduled_date date, scheduled_start_time text,
      duration_minutes int, pickup_latitude numeric(10,7), pickup_longitude numeric(10,7),
      actual_start_time timestamp, actual_end_time timestamp, actual_duration_minutes int,
      total_distance_meters int, vital_data_summary jsonb);
    CREATE TABLE walk_gps_tracking (id serial PRIMARY KEY, booking_id text, latitude numeric(10,7), longitude numeric(10,7), recorded_at timestamp);
    CREATE TABLE booking_disputes (id serial PRIMARY KEY, booking_id text, status text);
    CREATE TABLE booking_requests (
      request_id text PRIMARY KEY, owner_id text, provider_id text, start_date timestamp, end_date timestamp,
      service_started_at timestamp, service_completed_at timestamp, provider_completed_at timestamp,
      customer_latitude numeric(10,7), customer_longitude numeric(10,7), photo_updates jsonb,
      owner_confirmed_at timestamp, customer_approved_at timestamp, auto_approved_at timestamp, status_history jsonb);

    INSERT INTO users VALUES ('walker-uid', null, 'H-WALKER', null), ('owner-uid', null, 'H-OWNER', null),
                             ('friend-uid', null, 'H-WALKER', null);
    INSERT INTO walker_profiles VALUES ('WALKER-1', 'walker-uid');

    -- Honest walk: 13 Sep 11:00 Israel (08:00Z), 60 min, GPS every 5 min from the door
    INSERT INTO walk_bookings VALUES ('WALK-2026-000001', 'owner-uid', 'WALKER-1', '2026-09-13', '11:00', 60, 32.1782, 34.9076,
      '2026-09-13 08:00:00', '2026-09-13 09:00:00', 60, 2000, '{"photos":[{"timestamp":"2026-09-13T08:20:00Z"}]}');
    INSERT INTO walk_gps_tracking (booking_id, latitude, longitude, recorded_at)
      SELECT 'WALK-2026-000001', 32.1782 + (LEAST(g, 60 - g) * 0.00035), 34.9076, timestamp '2026-09-13 08:00:00' + g * interval '1 minute'
        FROM generate_series(0, 60, 5) g;

    -- Dishonest walk: booked by a friend with the walker's phone, 15 min, 2 GPS points far away, open dispute
    INSERT INTO walk_bookings VALUES ('WALK-2026-000002', 'friend-uid', 'WALKER-1', '2026-09-13', '11:00', 60, 32.1782, 34.9076,
      '2026-09-13 08:00:00', '2026-09-13 08:15:00', 60, 5000, null);
    INSERT INTO walk_gps_tracking (booking_id, latitude, longitude, recorded_at) VALUES
      ('WALK-2026-000002', 32.2100, 34.9076, '2026-09-13 08:00:00'), ('WALK-2026-000002', 32.2101, 34.9076, '2026-09-13 08:15:00');
    INSERT INTO booking_disputes (booking_id, status) VALUES ('WALK-2026-000002', 'open');

    -- Sitter stay auto-completed after silence
    INSERT INTO booking_requests VALUES ('BR-SIT-1', 'owner-uid', 'walker-uid', '2026-09-10 08:00', '2026-09-12 08:00',
      '2026-09-10 08:05', '2026-09-12 08:00', '2026-09-12 08:10', 32.1782, 34.9076, '[{"url":"x","timestamp":"2026-09-11T10:00:00Z"}]',
      '2026-09-13 08:10', null, null, '[{"status":"completed","actorType":"system"}]');
  `);
});

describe('loaders → rules', () => {
  it('Israel local time: 11:00 on 13 Sep (DST) = 08:00Z', () => {
    expect(israelLocalDateTime('2026-09-13', '11:00')?.toISOString()).toBe('2026-09-13T08:00:00.000Z');
  });

  it('honest walk is clear except "no customer confirmation" (walks have no confirm step today)', async () => {
    const r = await buildJobEvidenceReport('WALK-2026-000001');
    expect(r?.findings.map((f) => f.code)).toEqual(['NO_CUSTOMER_CONFIRMATION']);
    expect(r?.verdict).toBe('review');
    expect(r?.measured.gpsPoints).toBe(13);
    expect(r?.measured.checkInDistanceMeters).toBe(0);
  });

  it('dishonest walk is blocked for every lie at once', async () => {
    const r = await buildJobEvidenceReport('WALK-2026-000002');
    expect(r?.verdict).toBe('blocked');
    expect(r?.findings.map((f) => f.code)).toEqual(expect.arrayContaining([
      'SELF_BOOKING_SAME_PHONE', 'OPEN_DISPUTE', 'NO_GPS_TRACK', 'WALK_TOO_SHORT', 'CHECK_IN_FAR_FROM_ADDRESS',
    ]));
    // no phone number ever appears in a report
    expect(JSON.stringify(r)).not.toContain('H-WALKER');
  });

  it('sitter stay completed by the system after silence → review (no customer confirmation)', async () => {
    const r = await buildJobEvidenceReport('BR-SIT-1');
    expect(r?.kind).toBe('booking_request');
    expect(r?.findings.map((f) => f.code)).toEqual(['NO_CUSTOMER_CONFIRMATION']);
  });

  it('unknown job → null', async () => {
    expect(await buildJobEvidenceReport('BR-NOPE')).toBeNull();
  });
});
