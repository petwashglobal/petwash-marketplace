/**
 * JOB EVIDENCE — cross-examine a provider job before a Pet Wash admin approves
 * the payout (CEO rule, 2026-09-13: "providers can lie; match data, cross-exam
 * always").
 *
 * PURE. Everything here works on a normalised JobEvidence object so each rule is
 * testable without a database; loaders live in jobEvidenceLoader.ts.
 *
 * Verdicts:
 *   clear    — no finding
 *   review   — only warnings: a human should look before pressing yes
 *   blocked  — at least one hard finding: approval needs an explicit override
 *              with a written reason (a human still decides — never the machine)
 *
 * Rules never assign blame and never move money. They report facts with the
 * numbers that produced them.
 */

export type EvidenceSeverity = 'block' | 'warn';

export interface EvidenceFinding {
  code: string;
  severity: EvidenceSeverity;
  detail: string;
}

export interface GeoPoint { lat: number; lng: number; at: Date }

export interface JobEvidence {
  kind: 'walk' | 'booking_request';
  jobId: string;
  providerUid: string | null;
  ownerUid: string | null;
  providerPhoneHash?: string | null;
  ownerPhoneHash?: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  /** Booked service length in minutes (walks). */
  bookedMinutes?: number | null;
  serviceLocation?: { lat: number; lng: number } | null;
  actualStart?: Date | null;
  actualEnd?: Date | null;
  providerCompletedAt?: Date | null;
  gpsPoints?: GeoPoint[];
  /** Totals the provider's app REPORTED (never trusted on their own). */
  claimedDistanceMeters?: number | null;
  claimedDurationMinutes?: number | null;
  photoTimes?: Array<Date | null>;
  customerConfirmedAt?: Date | null;
  autoApproved?: boolean;
  openDispute?: boolean;
  /**
   * Gross model (2026-09-14): the provider's own invoice/receipt number to the
   * customer. When `providerInvoiceRequired` is true and this is empty, the
   * payout is blocked (docs/finance/00-platform-role-model.md §0.6.2.b).
   */
  providerInvoiceNumber?: string | null;
  providerInvoiceRequired?: boolean;
}

export interface EvidenceReport {
  jobId: string;
  kind: JobEvidence['kind'];
  verdict: 'clear' | 'review' | 'blocked';
  findings: EvidenceFinding[];
  measured: {
    gpsPoints: number;
    gpsDistanceMeters: number | null;
    gpsSpanMinutes: number | null;
    checkInDistanceMeters: number | null;
    maxSpeedKmh: number | null;
  };
}

/** Great-circle distance in meters. */
export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;
const valid = (d: Date | null | undefined): d is Date => d instanceof Date && !Number.isNaN(d.getTime());

export const EVIDENCE_THRESHOLDS = {
  checkInWarnMeters: 300,
  checkInBlockMeters: 1000,
  walkMinShareBlock: 0.5,
  walkMinShareWarn: 0.8,
  minGpsPointsWalk: 3,
  minPointsPer10Min: 1,
  distanceInflationFactor: 1.5,
  distanceInflationSlackMeters: 200,
  durationInflationSlackMinutes: 10,
  maxWalkingSpeedKmh: 25,
  photoEarlyMinutes: 60,
  photoLateMinutes: 120,
} as const;

export function evaluateJobEvidence(ev: JobEvidence): EvidenceReport {
  const T = EVIDENCE_THRESHOLDS;
  const findings: EvidenceFinding[] = [];
  const block = (code: string, detail: string) => findings.push({ code, severity: 'block', detail });
  const warn = (code: string, detail: string) => findings.push({ code, severity: 'warn', detail });

  // ── Who: provider must not be the customer ──────────────────────────────────
  if (ev.providerUid && ev.ownerUid && ev.providerUid === ev.ownerUid) {
    block('SELF_BOOKING_SAME_ACCOUNT', 'the provider and the customer are the same account');
  }
  if (ev.providerPhoneHash && ev.ownerPhoneHash && ev.providerPhoneHash === ev.ownerPhoneHash) {
    block('SELF_BOOKING_SAME_PHONE', 'the provider and the customer share the same verified phone number');
  }

  // ── Disputes ────────────────────────────────────────────────────────────────
  if (ev.openDispute) block('OPEN_DISPUTE', 'an open dispute exists on this job');

  // ── When: completion can't precede the booked start ────────────────────────
  const completedAt = valid(ev.providerCompletedAt) ? ev.providerCompletedAt : valid(ev.actualEnd) ? ev.actualEnd : null;
  if (completedAt && valid(ev.scheduledStart) && completedAt.getTime() < ev.scheduledStart.getTime()) {
    block('COMPLETED_BEFORE_START', `marked complete ${Math.round(minutesBetween(completedAt, ev.scheduledStart))} min before the booked start`);
  }
  if (completedAt && valid(ev.actualStart) && completedAt.getTime() < ev.actualStart.getTime()) {
    block('COMPLETED_BEFORE_ACTUAL_START', 'completion time is earlier than the recorded start time');
  }

  // ── GPS track (walks) ───────────────────────────────────────────────────────
  const pts = (ev.gpsPoints ?? []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && valid(p.at))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  let gpsDistance: number | null = null;
  let gpsSpan: number | null = null;
  let maxSpeed: number | null = null;
  if (pts.length >= 2) {
    gpsDistance = 0;
    maxSpeed = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = haversineMeters(pts[i - 1], pts[i]);
      gpsDistance += d;
      const hrs = (pts[i].at.getTime() - pts[i - 1].at.getTime()) / 3_600_000;
      if (hrs > 0 && d > 50) maxSpeed = Math.max(maxSpeed, d / 1000 / hrs);
    }
    gpsSpan = minutesBetween(pts[0].at, pts[pts.length - 1].at);
  }

  if (ev.kind === 'walk') {
    if (pts.length < T.minGpsPointsWalk) {
      block('NO_GPS_TRACK', `only ${pts.length} GPS point(s) recorded for the walk`);
    } else if (gpsSpan !== null && gpsSpan > 0 && pts.length / (gpsSpan / 10) < T.minPointsPer10Min) {
      warn('SPARSE_GPS_TRACK', `${pts.length} GPS points over ${Math.round(gpsSpan)} min`);
    }

    // Real duration: recorded start/end, else the GPS span. The app's claim is compared, never used.
    const measuredMinutes = valid(ev.actualStart) && valid(ev.actualEnd)
      ? minutesBetween(ev.actualStart, ev.actualEnd)
      : gpsSpan;
    if (ev.bookedMinutes && ev.bookedMinutes > 0 && measuredMinutes !== null) {
      const share = measuredMinutes / ev.bookedMinutes;
      if (share < T.walkMinShareBlock) {
        block('WALK_TOO_SHORT', `walk lasted ${Math.round(measuredMinutes)} of ${ev.bookedMinutes} booked minutes (${Math.round(share * 100)}%)`);
      } else if (share < T.walkMinShareWarn) {
        warn('WALK_SHORT', `walk lasted ${Math.round(measuredMinutes)} of ${ev.bookedMinutes} booked minutes (${Math.round(share * 100)}%)`);
      }
    }

    if (ev.claimedDistanceMeters != null && gpsDistance !== null
        && ev.claimedDistanceMeters > gpsDistance * T.distanceInflationFactor + T.distanceInflationSlackMeters) {
      warn('CLAIMED_DISTANCE_INFLATED', `app reported ${Math.round(ev.claimedDistanceMeters)} m, GPS track measures ${Math.round(gpsDistance)} m`);
    }
    if (ev.claimedDurationMinutes != null && gpsSpan !== null
        && ev.claimedDurationMinutes > gpsSpan + T.durationInflationSlackMinutes) {
      warn('CLAIMED_DURATION_INFLATED', `app reported ${Math.round(ev.claimedDurationMinutes)} min, GPS track spans ${Math.round(gpsSpan)} min`);
    }
    if (maxSpeed !== null && maxSpeed > T.maxWalkingSpeedKmh) {
      warn('IMPOSSIBLE_WALKING_SPEED', `a GPS segment moved at ${Math.round(maxSpeed)} km/h — faster than walking`);
    }
  }

  // ── Where: first presence vs the service location ──────────────────────────
  let checkInDistance: number | null = null;
  if (ev.serviceLocation && pts.length > 0) {
    checkInDistance = haversineMeters(ev.serviceLocation, pts[0]);
    if (checkInDistance > T.checkInBlockMeters) {
      block('CHECK_IN_FAR_FROM_ADDRESS', `first GPS point is ${Math.round(checkInDistance)} m from the service address`);
    } else if (checkInDistance > T.checkInWarnMeters) {
      warn('CHECK_IN_AWAY_FROM_ADDRESS', `first GPS point is ${Math.round(checkInDistance)} m from the service address`);
    }
  }

  // ── Photos: taken inside the job window ────────────────────────────────────
  const windowStart = valid(ev.actualStart) ? ev.actualStart : ev.scheduledStart;
  const windowEnd = valid(ev.actualEnd) ? ev.actualEnd : valid(ev.providerCompletedAt) ? ev.providerCompletedAt : ev.scheduledEnd;
  if (valid(windowStart) && valid(windowEnd)) {
    const outside = (ev.photoTimes ?? []).filter((t): t is Date => valid(t)).filter((t) =>
      t.getTime() < windowStart.getTime() - T.photoEarlyMinutes * 60_000
      || t.getTime() > windowEnd.getTime() + T.photoLateMinutes * 60_000);
    if (outside.length > 0) {
      warn('PHOTO_OUTSIDE_JOB_WINDOW', `${outside.length} photo(s) timestamped outside the job window`);
    }
  }

  // ── The provider's own invoice (gross model) ───────────────────────────────
  if (ev.providerInvoiceRequired && !String(ev.providerInvoiceNumber ?? '').trim()) {
    block('PROVIDER_INVOICE_MISSING', 'the provider has not recorded their own tax invoice / receipt to the customer for this job');
  }

  // ── Customer confirmation ──────────────────────────────────────────────────
  if (!valid(ev.customerConfirmedAt) || ev.autoApproved) {
    warn('NO_CUSTOMER_CONFIRMATION', ev.autoApproved
      ? 'completed automatically after 24h of customer silence — the customer never confirmed'
      : 'the customer has not confirmed the job');
  }

  const verdict: EvidenceReport['verdict'] = findings.some((f) => f.severity === 'block')
    ? 'blocked'
    : findings.length ? 'review' : 'clear';

  return {
    jobId: ev.jobId,
    kind: ev.kind,
    verdict,
    findings,
    measured: {
      gpsPoints: pts.length,
      gpsDistanceMeters: gpsDistance === null ? null : Math.round(gpsDistance),
      gpsSpanMinutes: gpsSpan === null ? null : Math.round(gpsSpan),
      checkInDistanceMeters: checkInDistance === null ? null : Math.round(checkInDistance),
      maxSpeedKmh: maxSpeed === null ? null : Math.round(maxSpeed),
    },
  };
}
