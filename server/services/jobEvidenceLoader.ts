/**
 * Loads the real data behind a provider job into the pure JobEvidence shape
 * (server/services/jobEvidence.ts). READ-ONLY.
 *
 *   WALK-*           → walk_bookings + walk_gps_tracking + walker_profiles
 *   anything else    → booking_requests (sitter / walker / trainer marketplace)
 *
 * Phone numbers are compared by the stored HMAC (users.phone_hash), falling back
 * to the E.164 value only inside this process — no phone ever leaves in a report.
 */
import { pool } from '../db';
import { israelMidnightUtc } from '../lib/israelPeriods';
import { evaluateJobEvidence, type EvidenceReport, type GeoPoint, type JobEvidence } from './jobEvidence';

const num = (v: unknown): number | null => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n;
};
const date = (v: unknown): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

async function phoneKeys(uids: Array<string | null>): Promise<Map<string, string>> {
  const ids = uids.filter((u): u is string => !!u);
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { rows } = await pool.query(
    `SELECT id, COALESCE(NULLIF(phone_hash, ''), NULLIF(phone_e164, ''), NULLIF(phone, '')) AS k
       FROM users WHERE id = ANY($1::text[])`, [ids]);
  for (const r of rows) if (r.k) out.set(String(r.id), String(r.k));
  return out;
}

async function hasOpenDispute(bookingId: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM booking_disputes
        WHERE booking_id = $1 AND status IN ('open', 'under_review', 'pending', 'escalated') LIMIT 1`, [bookingId]);
    return rows.length > 0;
  } catch {
    return false; // table absent in this environment — reported by the payout gate instead
  }
}

/** Scheduled start in Israel local time from a date + "HH:MM". */
export function israelLocalDateTime(ymd: string, hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd)) || !m) return null;
  const midnight = israelMidnightUtc(String(ymd));
  return new Date(midnight.getTime() + (Number(m[1]) * 60 + Number(m[2])) * 60_000);
}

export async function loadWalkEvidence(bookingId: string): Promise<JobEvidence | null> {
  const { rows } = await pool.query(
    // Timestamps are stored as UTC in `timestamp without time zone` columns. Read
    // them AT TIME ZONE 'UTC' so the instant never depends on the process TZ.
    `SELECT wb.*, w.user_id AS walker_uid,
            wb.actual_start_time AT TIME ZONE 'UTC' AS actual_start_utc,
            wb.actual_end_time   AT TIME ZONE 'UTC' AS actual_end_utc,
            to_char(wb.scheduled_date, 'YYYY-MM-DD') AS scheduled_ymd,
            to_jsonb(wb)->>'provider_invoice_number' AS provider_invoice_no
       FROM walk_bookings wb LEFT JOIN walker_profiles w ON w.walker_id = wb.walker_id
      WHERE wb.booking_id = $1 LIMIT 1`, [bookingId]);
  const b = rows[0];
  if (!b) return null;
  const { rows: gps } = await pool.query(
    `SELECT latitude, longitude, recorded_at AT TIME ZONE 'UTC' AS recorded_at FROM walk_gps_tracking
      WHERE booking_id = $1 ORDER BY recorded_at ASC LIMIT 5000`, [bookingId]);
  const phones = await phoneKeys([b.walker_uid ?? null, b.owner_id ?? null]);
  const ymd = String(b.scheduled_ymd ?? '');
  const scheduledStart = israelLocalDateTime(ymd, b.scheduled_start_time);
  const bookedMinutes = num(b.duration_minutes);
  const vital = (b.vital_data_summary ?? {}) as { photos?: Array<{ timestamp?: string }> };
  const lat = num(b.pickup_latitude);
  const lng = num(b.pickup_longitude);
  return {
    kind: 'walk',
    jobId: bookingId,
    providerUid: b.walker_uid ?? null,
    ownerUid: b.owner_id ?? null,
    providerPhoneHash: b.walker_uid ? phones.get(b.walker_uid) ?? null : null,
    ownerPhoneHash: b.owner_id ? phones.get(b.owner_id) ?? null : null,
    scheduledStart,
    scheduledEnd: scheduledStart && bookedMinutes ? new Date(scheduledStart.getTime() + bookedMinutes * 60_000) : null,
    bookedMinutes,
    serviceLocation: lat !== null && lng !== null ? { lat, lng } : null,
    actualStart: date(b.actual_start_utc),
    actualEnd: date(b.actual_end_utc),
    providerCompletedAt: date(b.actual_end_utc),
    gpsPoints: gps
      .map((p: any): GeoPoint => ({ lat: Number(p.latitude), lng: Number(p.longitude), at: date(p.recorded_at) as Date }))
      .filter((p: GeoPoint) => p.at),
    claimedDistanceMeters: num(b.total_distance_meters),
    claimedDurationMinutes: num(b.actual_duration_minutes),
    photoTimes: Array.isArray(vital.photos) ? vital.photos.map((ph) => date(ph?.timestamp)) : [],
    providerInvoiceNumber: b.provider_invoice_no ?? null,
    providerInvoiceRequired: true,
    // Walks have no customer confirm step today — reported as such, not assumed.
    customerConfirmedAt: null,
    autoApproved: false,
    openDispute: await hasOpenDispute(bookingId),
  };
}

export async function loadBookingRequestEvidence(requestId: string): Promise<JobEvidence | null> {
  const { rows } = await pool.query(
    `SELECT owner_id, provider_id,
            start_date AT TIME ZONE 'UTC' AS start_date, end_date AT TIME ZONE 'UTC' AS end_date,
            service_started_at AT TIME ZONE 'UTC' AS service_started_at,
            service_completed_at AT TIME ZONE 'UTC' AS service_completed_at,
            provider_completed_at AT TIME ZONE 'UTC' AS provider_completed_at,
            customer_latitude, customer_longitude, photo_updates,
            owner_confirmed_at AT TIME ZONE 'UTC' AS owner_confirmed_at,
            customer_approved_at AT TIME ZONE 'UTC' AS customer_approved_at,
            auto_approved_at AT TIME ZONE 'UTC' AS auto_approved_at, status_history,
            to_jsonb(br)->>'provider_invoice_number' AS provider_invoice_no
       FROM booking_requests br WHERE request_id = $1 LIMIT 1`, [requestId]);
  const b = rows[0];
  if (!b) return null;
  const phones = await phoneKeys([b.provider_id ?? null, b.owner_id ?? null]);
  const history = Array.isArray(b.status_history) ? b.status_history : [];
  const autoApproved = !!b.auto_approved_at
    || history.some((h: any) => h?.actorType === 'system' && h?.status === 'completed');
  const photos = Array.isArray(b.photo_updates) ? b.photo_updates : [];
  const lat = num(b.customer_latitude);
  const lng = num(b.customer_longitude);
  return {
    kind: 'booking_request',
    jobId: requestId,
    providerUid: b.provider_id ?? null,
    ownerUid: b.owner_id ?? null,
    providerPhoneHash: b.provider_id ? phones.get(b.provider_id) ?? null : null,
    ownerPhoneHash: b.owner_id ? phones.get(b.owner_id) ?? null : null,
    scheduledStart: date(b.start_date),
    scheduledEnd: date(b.end_date),
    serviceLocation: lat !== null && lng !== null ? { lat, lng } : null,
    actualStart: date(b.service_started_at),
    actualEnd: date(b.service_completed_at),
    providerCompletedAt: date(b.provider_completed_at),
    gpsPoints: [],
    photoTimes: photos.map((p: any) => date(p?.timestamp)),
    // A 24h auto-complete stamps ownerConfirmedAt too — only an explicit customer approval counts.
    customerConfirmedAt: autoApproved ? null : date(b.customer_approved_at) ?? date(b.owner_confirmed_at),
    autoApproved,
    providerInvoiceNumber: b.provider_invoice_no ?? null,
    providerInvoiceRequired: true,
    openDispute: await hasOpenDispute(requestId),
  };
}

/** Evidence report for any provider job id. null = job not found. */
export async function buildJobEvidenceReport(jobId: string): Promise<EvidenceReport | null> {
  const ev = /^WALK-/i.test(jobId) ? await loadWalkEvidence(jobId) : await loadBookingRequestEvidence(jobId);
  return ev ? evaluateJobEvidence(ev) : null;
}
