/**
 * Hourly job watchdog: cross-examines recently completed provider jobs and puts
 * suspicious ones into the admin alert center. Read-only. Real Postgres (pglite).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const pg = new PGlite();
const alerts: any[] = [];
const resolved: Array<{ prefix: string; keys: string[] }> = [];
vi.mock('../db', () => ({ pool: { query: (text: string, params?: unknown[]) => pg.query(text, params as any[]) } }));
vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../services/AlertEngine', () => ({
  createOrUpdateAlert: vi.fn(async (a: any) => { alerts.push(a); }),
  resolveClearedByPrefix: vi.fn(async (prefix: string, keys: string[]) => { resolved.push({ prefix, keys }); return 0; }),
}));

import { runJobEvidenceWatchdog, shouldAlert } from '../services/jobEvidenceWatchdog';

beforeAll(async () => {
  await pg.exec(`
    CREATE TABLE users (id text PRIMARY KEY, phone text, phone_hash text, phone_e164 text);
    CREATE TABLE walker_profiles (walker_id text PRIMARY KEY, user_id text NOT NULL);
    CREATE TABLE walk_bookings (
      booking_id text PRIMARY KEY, owner_id text, walker_id text, status text, scheduled_date date, scheduled_start_time text,
      duration_minutes int, pickup_latitude numeric(10,7), pickup_longitude numeric(10,7),
      actual_start_time timestamp, actual_end_time timestamp, actual_duration_minutes int,
      total_distance_meters int, vital_data_summary jsonb);
    CREATE TABLE walk_gps_tracking (id serial PRIMARY KEY, booking_id text, latitude numeric(10,7), longitude numeric(10,7), recorded_at timestamp);
    CREATE TABLE booking_disputes (id serial PRIMARY KEY, booking_id text, status text);
    CREATE TABLE booking_requests (
      request_id text PRIMARY KEY, owner_id text, provider_id text, status text, updated_at timestamp,
      start_date timestamp, end_date timestamp, service_started_at timestamp, service_completed_at timestamp,
      provider_completed_at timestamp, customer_latitude numeric(10,7), customer_longitude numeric(10,7), photo_updates jsonb,
      owner_confirmed_at timestamp, customer_approved_at timestamp, auto_approved_at timestamp, status_history jsonb);

    INSERT INTO users VALUES ('walker-uid', null, 'H-W', null), ('owner-uid', null, 'H-O', null);
    INSERT INTO walker_profiles VALUES ('WALKER-1', 'walker-uid');

    -- honest walk (today)
    INSERT INTO walk_bookings VALUES ('WALK-OK', 'owner-uid', 'WALKER-1', 'completed', (now() AT TIME ZONE 'Asia/Jerusalem')::date, to_char(now() AT TIME ZONE 'Asia/Jerusalem' - interval '2 hours', 'HH24:MI'), 60,
      32.1782, 34.9076, now() AT TIME ZONE 'UTC' - interval '2 hours', now() AT TIME ZONE 'UTC' - interval '1 hour', 60, 2000, null);
    INSERT INTO walk_gps_tracking (booking_id, latitude, longitude, recorded_at)
      SELECT 'WALK-OK', 32.1782 + LEAST(g, 60 - g) * 0.00035, 34.9076, now() AT TIME ZONE 'UTC' - interval '2 hours' + g * interval '1 minute'
        FROM generate_series(0, 60, 5) g;

    -- 10-minute "walk" of a 60-minute booking, no GPS
    INSERT INTO walk_bookings VALUES ('WALK-LIE', 'owner-uid', 'WALKER-1', 'completed', (now() AT TIME ZONE 'Asia/Jerusalem')::date, to_char(now() AT TIME ZONE 'Asia/Jerusalem' - interval '2 hours', 'HH24:MI'), 60,
      32.1782, 34.9076, now() AT TIME ZONE 'UTC' - interval '2 hours', now() AT TIME ZONE 'UTC' - interval '110 minutes', 60, 3000, null);

    -- sitter stay the customer confirmed
    INSERT INTO booking_requests VALUES ('BR-OK', 'owner-uid', 'walker-uid', 'completed', now() AT TIME ZONE 'UTC',
      now() AT TIME ZONE 'UTC' - interval '3 days', now() AT TIME ZONE 'UTC' - interval '1 day', now() AT TIME ZONE 'UTC' - interval '3 days',
      now() AT TIME ZONE 'UTC' - interval '1 day', now() AT TIME ZONE 'UTC' - interval '1 day', null, null, '[]',
      now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC', null, '[]');

    -- old job outside the 7-day window is ignored
    INSERT INTO booking_requests VALUES ('BR-OLD', 'walker-uid', 'walker-uid', 'completed', now() AT TIME ZONE 'UTC' - interval '30 days',
      null, null, null, null, null, null, null, '[]', null, null, null, '[]');
  `);
});

describe('job watchdog', () => {
  it('alerts on the lying walk only; resolves cleared alerts', async () => {
    const r = await runJobEvidenceWatchdog();
    expect(r.checked).toBe(3);
    expect(r.blocked).toBe(1);
    expect(alerts.map((a) => a.dedupeKey)).toEqual(['job_evidence:WALK-LIE']);
    expect(alerts[0]).toMatchObject({ category: 'provider', severity: 'critical' });
    expect(alerts[0].message).toContain('WALK_TOO_SHORT');
    expect(alerts[0].message).toContain('NO_GPS_TRACK');
    expect(resolved).toEqual([{ prefix: 'job_evidence:', keys: ['job_evidence:WALK-LIE'] }]);
  });

  it('noise rule: a walk is not alerted only for missing customer confirmation', () => {
    expect(shouldAlert({ jobId: 'W', kind: 'walk', verdict: 'review', findings: [{ code: 'NO_CUSTOMER_CONFIRMATION', severity: 'warn', detail: '' }], measured: {} as any })).toBe(false);
    expect(shouldAlert({ jobId: 'B', kind: 'booking_request', verdict: 'review', findings: [{ code: 'NO_CUSTOMER_CONFIRMATION', severity: 'warn', detail: '' }], measured: {} as any })).toBe(true);
  });
});
