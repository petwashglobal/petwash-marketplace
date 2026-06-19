/**
 * Station Health Score + Bay Intelligence — READ-ONLY admin observability.
 *
 * CEO "Business OS" spec §2 (per-station Health Score 0–100) and §3
 * (per-bay left-vs-right intelligence). Pure SELECT aggregation over
 * tables that ALREADY exist — no schema, no money math, no runtime change.
 *
 * What this does:
 *   - GET /api/admin/station-health
 *     Returns one entry per physical station (anchored on station_bays.stationId,
 *     which is the kiosk varchar id), each with:
 *       { stationId, name, status, score, band, factors{...},
 *         unavailableFactors[], bays:[{ side, washes, revenueIls, faults,
 *         qrRedemptions, nayaxPayments, failedSessions, downtime, lastWashAt,
 *         lastFaultAt, ... }] }
 *
 * Honesty rules (platform skill §2 — no fake data):
 *   - The score is computed ONLY from factors backed by real tables.
 *   - Factors with no backing table are returned as null AND listed in
 *     `unavailableFactors` — they are NOT invented and do NOT move the score.
 *   - Every per-bay number is a real COUNT/SUM over bay_sessions / bay_faults /
 *     station_bays. Nothing is synthesised.
 *
 * Real signals used (all keyed on the bay tables' stationId / bayId):
 *   - station_bays      : side, status (downtime), shampoo/conditioner level,
 *                         lastHeartbeat
 *   - bay_sessions      : washes today, revenue today, failed sessions,
 *                         source (qr redemptions vs nayax card), last wash
 *   - bay_faults        : open faults by severity, last fault
 *   - kiosk_machines    : human name (+ Hebrew), lastMaintenanceDate, status
 *
 * Factors NOT available as a per-station table (declared, never faked):
 *   - refunds        : refund rows are not keyed to a station/bay
 *   - cleaningChecklist : no cleaning-checklist table exists
 *
 * Money note: revenue is reported in ILS for display only (amount_cents / 100).
 * No balance, escrow, payout, or refund math is performed or mutated.
 *
 * Mounted under /api/admin/* so it inherits the full admin security stack
 * (validateFirebaseToken + adminLimiter + requireRole/requireAdmin). A
 * second inline requireAdmin gate is applied here for defence-in-depth.
 */
import { Router, type Request, type Response } from 'express';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { requireAdmin } from '../adminAuth';
import { stationBays, baySessions, bayFaults, kioskMachines } from '@shared/schema';
import { logger } from '../lib/logger';

const router = Router();

// ── Score weights (only real factors carry weight) ───────────────────────────
// Each factor produces a 0..1 health sub-score; the station score is the
// weighted average of the AVAILABLE factors, renormalised so missing factors
// never silently drag the score down.
const WEIGHTS = {
  faults: 0.30,        // open faults, severity-weighted
  availability: 0.25,  // bays not offline / maintenance / fault
  reliability: 0.20,   // 1 - (failed sessions / attempts) today
  liveness: 0.15,      // recent heartbeat + recent activity
  consumables: 0.10,   // shampoo + conditioner levels (bay telemetry)
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function band(score: number): 'excellent' | 'healthy' | 'attention' | 'critical' {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'healthy';
  if (score >= 50) return 'attention';
  return 'critical';
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const FAILED_STATUSES = ['timed_out', 'aborted', 'fault'];
const DOWN_STATUSES = ['offline', 'maintenance', 'fault'];
// bay_sessions.source values that represent a QR/wallet redemption vs a direct
// Nayax card tap (schema comment on bay_sessions.source).
const QR_REDEMPTION_SOURCES = ['wash_package', 'wallet_balance', 'gift_credit', 'loyalty_benefit', 'promo_coupon'];

router.get('/', requireAdmin, async (_req: Request, res: Response) => {
  const generatedAt = new Date().toISOString();
  const sinceToday = new Date(Date.now() - DAY_MS); // rolling 24h "today"
  const factorErrors: string[] = [];

  // Per-check try/catch: one failing aggregate must not blank the whole report.
  const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      factorErrors.push(label);
      logger.error(`[station-health] aggregate failed: ${label}`, err);
      return fallback;
    }
  };

  // 1) All bays (the station + bay registry; the anchor for everything).
  const bays = await safe('bays', () => db.select({
    id: stationBays.id,
    stationId: stationBays.stationId,
    stationCode: stationBays.stationCode,
    side: stationBays.side,
    bayLabel: stationBays.bayLabel,
    bayLabelHe: stationBays.bayLabelHe,
    status: stationBays.status,
    shampooLevelPct: stationBays.shampooLevelPct,
    conditionerLevelPct: stationBays.conditionerLevelPct,
    lastHeartbeat: stationBays.lastHeartbeat,
    lastSessionAt: stationBays.lastSessionAt,
    lastFaultAt: stationBays.lastFaultAt,
    isActive: stationBays.isActive,
  }).from(stationBays), [] as any[]);

  if (bays.length === 0) {
    return res.json({
      wired: true,
      generatedAt,
      stationCount: 0,
      stations: [],
      unavailableFactors: ['refunds', 'cleaningChecklist'],
      factorErrors,
      note: 'No station bays found. Health is computed from the station_bays / bay_sessions / bay_faults tables; until bays are registered there is nothing to score.',
    });
  }

  const stationIds = Array.from(new Set(bays.map((b: any) => b.stationId)));
  const bayIds = bays.map((b: any) => b.id);

  // 2) Per-bay session aggregates for the rolling 24h window.
  const sessionAgg = await safe('sessions', () => db.select({
    bayId: baySessions.bayId,
    washes: sql<number>`count(*) filter (where ${baySessions.status} = 'completed')`,
    attempts: sql<number>`count(*)`,
    failed: sql<number>`count(*) filter (where ${baySessions.status} in ('timed_out','aborted','fault'))`,
    revenueCents: sql<number>`coalesce(sum(${baySessions.amountCents}) filter (where ${baySessions.status} = 'completed'), 0)`,
    nayaxPayments: sql<number>`count(*) filter (where ${baySessions.source} = 'terminal_card')`,
    qrRedemptions: sql<number>`count(*) filter (where ${baySessions.source} in ('wash_package','wallet_balance','gift_credit','loyalty_benefit','promo_coupon'))`,
    lastWashAt: sql<string | null>`max(${baySessions.startedAt})`,
  })
    .from(baySessions)
    .where(and(inArray(baySessions.bayId, bayIds), gte(baySessions.startedAt, sinceToday)))
    .groupBy(baySessions.bayId),
    [] as any[]);

  const sessionByBay = new Map<string, any>();
  for (const r of sessionAgg as any[]) sessionByBay.set(r.bayId, r);

  // 3) Per-bay OPEN fault counts by severity.
  const faultAgg = await safe('faults', () => db.select({
    bayId: bayFaults.bayId,
    critical: sql<number>`count(*) filter (where ${bayFaults.severity} = 'critical')`,
    error: sql<number>`count(*) filter (where ${bayFaults.severity} = 'error')`,
    warning: sql<number>`count(*) filter (where ${bayFaults.severity} = 'warning')`,
    total: sql<number>`count(*)`,
    lastFaultAt: sql<string | null>`max(${bayFaults.reportedAt})`,
  })
    .from(bayFaults)
    .where(and(inArray(bayFaults.bayId, bayIds), eq(bayFaults.status, 'open')))
    .groupBy(bayFaults.bayId),
    [] as any[]);

  const faultByBay = new Map<string, any>();
  for (const r of faultAgg as any[]) faultByBay.set(r.bayId, r);

  // 4) Station name + last-maintenance from kiosk_machines (kioskId == bay stationId).
  const kiosks = await safe('kiosks', () => db.select({
    kioskId: kioskMachines.kioskId,
    name: kioskMachines.name,
    nameHe: kioskMachines.nameHe,
    status: kioskMachines.status,
    lastMaintenanceDate: kioskMachines.lastMaintenanceDate,
  }).from(kioskMachines).where(inArray(kioskMachines.kioskId, stationIds)), [] as any[]);

  const kioskById = new Map<string, any>();
  for (const k of kiosks as any[]) kioskById.set(k.kioskId, k);

  // ── Assemble per-station results ────────────────────────────────────────────
  const baysByStation = new Map<string, any[]>();
  for (const b of bays as any[]) {
    if (!baysByStation.has(b.stationId)) baysByStation.set(b.stationId, []);
    baysByStation.get(b.stationId)!.push(b);
  }

  const now = Date.now();
  const HEARTBEAT_FRESH_MS = 30 * 60 * 1000; // 30 min

  const stations = stationIds.map((stationId) => {
    const stationBaysList = baysByStation.get(stationId) || [];
    const kiosk = kioskById.get(stationId);

    // Build per-bay intelligence (left vs right).
    const bayOut = stationBaysList.map((b: any) => {
      const s = sessionByBay.get(b.id);
      const f = faultByBay.get(b.id);
      const revenueCents = Number(s?.revenueCents ?? 0);
      const isDown = DOWN_STATUSES.includes(b.status);
      return {
        bayId: b.id,
        side: b.side,                                   // "left" | "right"
        label: b.bayLabel ?? null,
        labelHe: b.bayLabelHe ?? null,
        status: b.status,
        downtime: isDown,                               // true if offline/maintenance/fault
        washes: Number(s?.washes ?? 0),                 // completed, last 24h
        attempts: Number(s?.attempts ?? 0),             // all sessions, last 24h
        failedSessions: Number(s?.failed ?? 0),         // timed_out/aborted/fault, last 24h
        revenueIls: Math.round(revenueCents) / 100,     // display only, last 24h
        nayaxPayments: Number(s?.nayaxPayments ?? 0),   // source = terminal_card
        qrRedemptions: Number(s?.qrRedemptions ?? 0),   // wallet/package/gift/loyalty/promo
        openFaults: Number(f?.total ?? 0),
        openFaultsBySeverity: {
          critical: Number(f?.critical ?? 0),
          error: Number(f?.error ?? 0),
          warning: Number(f?.warning ?? 0),
        },
        shampooLevelPct: b.shampooLevelPct ?? null,
        conditionerLevelPct: b.conditionerLevelPct ?? null,
        lastWashAt: s?.lastWashAt ?? b.lastSessionAt ?? null,
        lastFaultAt: f?.lastFaultAt ?? b.lastFaultAt ?? null,
        lastHeartbeat: b.lastHeartbeat ?? null,
      };
    });

    // ── Factor sub-scores (0..1), computed only from real data ──
    const bayCount = bayOut.length;

    // a) Faults: severity-weighted penalty. critical=1.0, error=0.5, warning=0.2.
    const faultPenaltyUnits = bayOut.reduce((acc, b) =>
      acc + b.openFaultsBySeverity.critical * 1.0
          + b.openFaultsBySeverity.error * 0.5
          + b.openFaultsBySeverity.warning * 0.2, 0);
    // Normalise against bay count: ~1 critical-equivalent per bay => score 0.
    const faultsScore = clamp01(1 - faultPenaltyUnits / Math.max(1, bayCount));

    // b) Availability: fraction of bays NOT in a down state.
    const downBays = bayOut.filter(b => b.downtime).length;
    const availabilityScore = clamp01(bayCount > 0 ? (bayCount - downBays) / bayCount : 0);

    // c) Reliability: 1 - failed/attempts across the station today.
    const totalAttempts = bayOut.reduce((a, b) => a + b.attempts, 0);
    const totalFailed = bayOut.reduce((a, b) => a + b.failedSessions, 0);
    const reliabilityAvailable = totalAttempts > 0;
    const reliabilityScore = reliabilityAvailable
      ? clamp01(1 - totalFailed / totalAttempts)
      : null;

    // d) Liveness: any heartbeat in last 30 min across bays.
    const freshHeartbeat = bayOut.some(b =>
      b.lastHeartbeat && (now - new Date(b.lastHeartbeat).getTime()) < HEARTBEAT_FRESH_MS);
    const anyHeartbeat = bayOut.some(b => b.lastHeartbeat);
    const livenessAvailable = anyHeartbeat;
    const livenessScore = livenessAvailable ? (freshHeartbeat ? 1 : 0.3) : null;

    // e) Consumables: avg of shampoo + conditioner levels where reported.
    const levelVals: number[] = [];
    for (const b of bayOut) {
      if (typeof b.shampooLevelPct === 'number') levelVals.push(b.shampooLevelPct);
      if (typeof b.conditionerLevelPct === 'number') levelVals.push(b.conditionerLevelPct);
    }
    const consumablesAvailable = levelVals.length > 0;
    const consumablesScore = consumablesAvailable
      ? clamp01(levelVals.reduce((a, v) => a + v, 0) / levelVals.length / 100)
      : null;

    // ── Weighted score over AVAILABLE factors only (renormalised) ──
    const parts: Array<{ key: string; w: number; v: number | null }> = [
      { key: 'faults', w: WEIGHTS.faults, v: faultsScore },
      { key: 'availability', w: WEIGHTS.availability, v: availabilityScore },
      { key: 'reliability', w: WEIGHTS.reliability, v: reliabilityScore },
      { key: 'liveness', w: WEIGHTS.liveness, v: livenessScore },
      { key: 'consumables', w: WEIGHTS.consumables, v: consumablesScore },
    ];
    const present = parts.filter(p => p.v !== null);
    const weightSum = present.reduce((a, p) => a + p.w, 0);
    const score = weightSum > 0
      ? Math.round(present.reduce((a, p) => a + p.w * (p.v as number), 0) / weightSum * 100)
      : 0;

    // Last-maintenance factor: reported for transparency but NOT scored
    // (no agreed maintenance-cadence SLA to score against).
    const lastMaintenanceDate = kiosk?.lastMaintenanceDate ?? null;
    const daysSinceMaintenance = lastMaintenanceDate
      ? Math.floor((now - new Date(lastMaintenanceDate).getTime()) / DAY_MS)
      : null;

    const usedFactors = present.map(p => p.key);
    const stationUnavailable = [
      ...parts.filter(p => p.v === null).map(p => p.key),
      'refunds',          // no refund table keyed to station/bay
      'cleaningChecklist', // no cleaning-checklist table exists
      'lastMaintenanceDate', // reported only; not scored (no SLA cadence)
    ];

    return {
      stationId,
      stationCode: stationBaysList[0]?.stationCode ?? null,
      name: kiosk?.name ?? stationBaysList[0]?.stationCode ?? stationId,
      nameHe: kiosk?.nameHe ?? null,
      stationStatus: kiosk?.status ?? null,
      score,
      band: band(score),
      bayCount,
      factors: {
        faults: { score: round2(faultsScore), available: true, penaltyUnits: round2(faultPenaltyUnits) },
        availability: { score: round2(availabilityScore), available: true, downBays, bayCount },
        reliability: { score: reliabilityScore === null ? null : round2(reliabilityScore), available: reliabilityAvailable, attempts: totalAttempts, failed: totalFailed },
        liveness: { score: livenessScore, available: livenessAvailable, freshHeartbeat },
        consumables: { score: consumablesScore === null ? null : round2(consumablesScore), available: consumablesAvailable, samples: levelVals.length },
        revenueTodayIls: round2(bayOut.reduce((a, b) => a + b.revenueIls, 0)),
        washesToday: bayOut.reduce((a, b) => a + b.washes, 0),
        openFaults: bayOut.reduce((a, b) => a + b.openFaults, 0),
        lastMaintenanceDate,
        daysSinceMaintenance,
      },
      usedFactors,
      unavailableFactors: stationUnavailable,
      bays: bayOut.sort((a, b) => (a.side > b.side ? 1 : -1)), // left before right
    };
  })
  // Show worst-first so attention/critical surface at the top.
  .sort((a, b) => a.score - b.score);

  return res.json({
    wired: true,
    generatedAt,
    stationCount: stations.length,
    // Factors that have NO backing table anywhere (global honesty disclosure).
    unavailableFactors: ['refunds', 'cleaningChecklist'],
    factorErrors, // names of any per-check aggregate that threw (empty = all OK)
    bands: { excellent: '90-100', healthy: '70-89', attention: '50-69', critical: '0-49' },
    weights: WEIGHTS,
    window: 'rolling-24h',
    stations,
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default router;
