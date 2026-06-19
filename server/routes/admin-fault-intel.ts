/**
 * Fault Cost Tracking (§11) + Predictive Maintenance (§12)
 * — READ-ONLY admin operations intelligence.
 *
 * CEO "Business OS" spec. Pure SELECT aggregation over tables that ALREADY
 * exist (bay_faults, bay_sessions, station_bays, nayax_transactions,
 * kiosk_machines). NO schema change, NO money math change, NO K9000/Nayax
 * runtime touch. Every consequential number is a real COUNT/SUM; any input
 * we cannot back with a real column is returned as null WITH a note, never
 * fabricated (platform skill §2 — no fake data).
 *
 * Endpoints (both mounted under /api/admin/* so they inherit the full admin
 * security stack — validateFirebaseToken + adminLimiter + requireRole — and a
 * second inline requireAdmin gate is applied here for defence-in-depth):
 *
 *   GET /api/admin/fault-cost
 *     For each fault (bay_faults) compute:
 *       - downtime hours        : (resolvedAt ?? now) − reportedAt
 *       - avg washes/hour       : derived from that bay's completed bay_sessions
 *                                 over a 30-day lookback (real)
 *       - estimated lost washes : downtimeHours × avg washes/hour  (estimate)
 *       - avg revenue/wash      : completed bay_sessions revenue / completed
 *                                 washes for that bay (real, ILS display only)
 *       - estimated lost revenue: lost washes × avg revenue/wash   (estimate)
 *       - repeat-fault count    : how many faults of the same faultCode on the
 *                                 same bay (real)
 *     Returns per-fault rows + per-station/bay totals + a grand total.
 *     If a cost input is unavailable for a bay (e.g. the bay has zero
 *     historical completed washes, so no rate/price can be derived) the
 *     estimate fields are null with an explanatory note — never a guessed ₪.
 *
 *   GET /api/admin/predictive-maintenance
 *     Per-bay early-warning signals BEFORE a hard failure, each explained:
 *       - usage_drop        : last-24h washes << its 7-day daily average
 *       - failed_sessions   : many failed (timed_out/aborted/fault) sessions 24h
 *       - repeated_faults   : multiple faults on the bay in the last 7 days
 *       - no_nayax_recently : bay's Nayax terminal silent while bay is "ready"
 *       - low_consumables   : shampoo/conditioner level below threshold
 *       - stale_heartbeat   : no IoT heartbeat in the freshness window
 *     risk = low | medium | high, derived ONLY from how many signals fire
 *     (weighted by severity). Read-only; each flag carries its own reason.
 *
 * Money note: revenue figures are ILS for display only (amount_cents / 100).
 * No balance, escrow, payout, or refund math is performed or mutated. The
 * "lost revenue" number is an explicit ESTIMATE label, not a ledger entry.
 */
import { Router, type Request, type Response } from 'express';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { requireAdmin } from '../adminAuth';
import { stationBays, baySessions, bayFaults, nayaxTransactions, kioskMachines } from '@shared/schema';
import { logger } from '../lib/logger';

const router = Router();

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const FAILED_STATUSES = ['timed_out', 'aborted', 'fault'];
const DOWN_STATUSES = ['offline', 'maintenance', 'fault'];

// Caps so a runaway table never returns an unbounded payload.
const MAX_FAULT_ROWS = 500;
const MAX_BAYS = 200;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Per-query try/catch helper: one failing aggregate must never 500 the report.
async function safe<T>(label: string, errors: string[], fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    errors.push(label);
    logger.error(`[fault-intel] aggregate failed: ${label}`, err);
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §11 — FAULT COST TRACKING
// ─────────────────────────────────────────────────────────────────────────────
router.get('/fault-cost', requireAdmin, async (req: Request, res: Response) => {
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];
  const now = Date.now();

  // Lookback for deriving each bay's "normal" washes/hour + revenue/wash.
  const lookbackDays = Math.min(Math.max(Number(req.query.lookbackDays) || 30, 7), 90);
  const sinceLookback = new Date(now - lookbackDays * DAY_MS);

  // 1) Faults. Default to OPEN + recently-resolved so the cost view is
  //    actionable; allow ?status=all to include the full history.
  const statusFilter = String(req.query.status || 'open');
  const faultWhere =
    statusFilter === 'all'
      ? undefined
      : statusFilter === 'open'
        ? eq(bayFaults.status, 'open')
        : eq(bayFaults.status, statusFilter);

  const faults = await safe('faults', errors, () => {
    const base = db
      .select({
        id: bayFaults.id,
        bayId: bayFaults.bayId,
        stationId: bayFaults.stationId,
        side: bayFaults.side,
        faultCode: bayFaults.faultCode,
        severity: bayFaults.severity,
        description: bayFaults.description,
        descriptionHe: bayFaults.descriptionHe,
        status: bayFaults.status,
        reportedAt: bayFaults.reportedAt,
        resolvedAt: bayFaults.resolvedAt,
      })
      .from(bayFaults);
    const filtered = faultWhere ? base.where(faultWhere) : base;
    return filtered.orderBy(sql`${bayFaults.reportedAt} desc`).limit(MAX_FAULT_ROWS);
  }, [] as any[]);

  if (faults.length === 0) {
    return res.json({
      wired: true,
      generatedAt,
      lookbackDays,
      statusFilter,
      faultCount: 0,
      faults: [],
      stationTotals: [],
      grandTotal: { faults: 0, downtimeHours: 0, estLostWashes: null, estLostRevenueIls: null },
      errors,
      note: 'No faults match the filter. Cost is derived from bay_faults joined to each bay\'s historical bay_sessions; with no faults there is nothing to cost.',
    });
  }

  const bayIds = Array.from(new Set(faults.map((f: any) => f.bayId)));
  const stationIds = Array.from(new Set(faults.map((f: any) => f.stationId)));

  // 2) Per-bay historical baseline (real): completed washes, completed revenue,
  //    and the active span used to derive washes/hour. We bound the active span
  //    by min(lookback window, first→last completed session) so a bay that has
  //    only existed for 3 days isn't divided by 30.
  const baseline = await safe('baseline', errors, () => db
    .select({
      bayId: baySessions.bayId,
      completedWashes: sql<number>`count(*) filter (where ${baySessions.status} = 'completed')`,
      completedRevenueCents: sql<number>`coalesce(sum(${baySessions.amountCents}) filter (where ${baySessions.status} = 'completed'), 0)`,
      firstAt: sql<string | null>`min(${baySessions.startedAt}) filter (where ${baySessions.status} = 'completed')`,
      lastAt: sql<string | null>`max(${baySessions.startedAt}) filter (where ${baySessions.status} = 'completed')`,
    })
    .from(baySessions)
    .where(and(inArray(baySessions.bayId, bayIds), gte(baySessions.startedAt, sinceLookback)))
    .groupBy(baySessions.bayId),
    [] as any[]);

  const baseByBay = new Map<string, any>();
  for (const r of baseline as any[]) baseByBay.set(r.bayId, r);

  // 3) Repeat-fault count per (bay, faultCode) — real history regardless of
  //    the status filter, so "this keeps happening" is honest.
  const repeats = await safe('repeats', errors, () => db
    .select({
      bayId: bayFaults.bayId,
      faultCode: bayFaults.faultCode,
      cnt: sql<number>`count(*)`,
    })
    .from(bayFaults)
    .where(inArray(bayFaults.bayId, bayIds))
    .groupBy(bayFaults.bayId, bayFaults.faultCode),
    [] as any[]);

  const repeatByKey = new Map<string, number>();
  for (const r of repeats as any[]) repeatByKey.set(`${r.bayId}::${r.faultCode}`, Number(r.cnt));

  // 4) Bay labels for display.
  const bayMeta = await safe('bayMeta', errors, () => db
    .select({
      id: stationBays.id,
      side: stationBays.side,
      bayLabel: stationBays.bayLabel,
      bayLabelHe: stationBays.bayLabelHe,
      stationCode: stationBays.stationCode,
    })
    .from(stationBays)
    .where(inArray(stationBays.id, bayIds)),
    [] as any[]);
  const bayMetaById = new Map<string, any>();
  for (const b of bayMeta as any[]) bayMetaById.set(b.id, b);

  // 5) Station names.
  const kiosks = await safe('kiosks', errors, () => db
    .select({ kioskId: kioskMachines.kioskId, name: kioskMachines.name, nameHe: kioskMachines.nameHe })
    .from(kioskMachines)
    .where(inArray(kioskMachines.kioskId, stationIds)),
    [] as any[]);
  const kioskById = new Map<string, any>();
  for (const k of kiosks as any[]) kioskById.set(k.kioskId, k);

  // Derive each bay's washes/hour + revenue/wash from real baseline data.
  // Returns nulls (with the reason captured at row level) when the bay has no
  // completed-wash history to derive from — we never invent a rate or price.
  function bayRates(bayId: string): { washesPerHour: number | null; revenuePerWashIls: number | null; reason: string | null } {
    const b = baseByBay.get(bayId);
    const completed = Number(b?.completedWashes ?? 0);
    if (!b || completed === 0) {
      return { washesPerHour: null, revenuePerWashIls: null, reason: 'no_completed_wash_history' };
    }
    const revCents = Number(b.completedRevenueCents ?? 0);
    const revenuePerWashIls = revCents > 0 ? round2(revCents / 100 / completed) : null;

    // Active span (hours): clamp to the lookback window, floor at 1h so a
    // single-session bay doesn't produce an absurd rate.
    const first = b.firstAt ? new Date(b.firstAt).getTime() : null;
    const last = b.lastAt ? new Date(b.lastAt).getTime() : null;
    let spanHours: number | null = null;
    if (first && last) {
      const observed = (last - first) / HOUR_MS;
      const windowHours = lookbackDays * 24;
      spanHours = Math.max(1, Math.min(observed, windowHours));
    }
    const washesPerHour = spanHours ? round2(completed / spanHours) : null;
    return {
      washesPerHour,
      revenuePerWashIls,
      reason: washesPerHour === null ? 'insufficient_span_to_derive_rate' : null,
    };
  }

  // Build per-fault rows.
  const rows = (faults as any[]).map((f) => {
    const reportedAtMs = f.reportedAt ? new Date(f.reportedAt).getTime() : null;
    const endMs = f.resolvedAt ? new Date(f.resolvedAt).getTime() : now;
    const downtimeHours = reportedAtMs ? round2(Math.max(0, endMs - reportedAtMs) / HOUR_MS) : null;
    const stillOpen = !f.resolvedAt;

    const rates = bayRates(f.bayId);
    const meta = bayMetaById.get(f.bayId);

    // Estimates — only when both downtime and a real rate exist.
    let estLostWashes: number | null = null;
    let estLostRevenueIls: number | null = null;
    let estimateNote: string | null = null;
    if (downtimeHours === null) {
      estimateNote = 'no_reported_at_timestamp';
    } else if (rates.washesPerHour === null) {
      estimateNote = rates.reason ?? 'no_usage_baseline';
    } else {
      estLostWashes = round2(downtimeHours * rates.washesPerHour);
      if (rates.revenuePerWashIls === null) {
        estimateNote = 'no_revenue_baseline_for_bay';
      } else {
        estLostRevenueIls = round2(estLostWashes * rates.revenuePerWashIls);
      }
    }

    return {
      faultId: f.id,
      stationId: f.stationId,
      stationName: kioskById.get(f.stationId)?.name ?? meta?.stationCode ?? f.stationId,
      stationNameHe: kioskById.get(f.stationId)?.nameHe ?? null,
      bayId: f.bayId,
      side: f.side,
      bayLabel: meta?.bayLabel ?? null,
      bayLabelHe: meta?.bayLabelHe ?? null,
      faultCode: f.faultCode,
      severity: f.severity,
      description: f.description ?? null,
      descriptionHe: f.descriptionHe ?? null,
      status: f.status,
      stillOpen,
      reportedAt: f.reportedAt ?? null,
      resolvedAt: f.resolvedAt ?? null,
      downtimeHours,
      // baseline inputs (real)
      avgWashesPerHour: rates.washesPerHour,
      avgRevenuePerWashIls: rates.revenuePerWashIls,
      // estimates (clearly labelled; null when an input is missing)
      estLostWashes,
      estLostRevenueIls,
      estimateNote,
      // repeat signal (real)
      repeatFaultCount: repeatByKey.get(`${f.bayId}::${f.faultCode}`) ?? 1,
    };
  });

  // Per-station totals.
  const stationMap = new Map<string, any>();
  for (const r of rows) {
    let s = stationMap.get(r.stationId);
    if (!s) {
      s = {
        stationId: r.stationId,
        stationName: r.stationName,
        stationNameHe: r.stationNameHe,
        faults: 0,
        downtimeHours: 0,
        estLostWashes: 0,
        estLostRevenueIls: 0,
        hasUnknownEstimate: false,
      };
      stationMap.set(r.stationId, s);
    }
    s.faults += 1;
    if (r.downtimeHours !== null) s.downtimeHours += r.downtimeHours;
    if (r.estLostWashes !== null) s.estLostWashes += r.estLostWashes; else s.hasUnknownEstimate = true;
    if (r.estLostRevenueIls !== null) s.estLostRevenueIls += r.estLostRevenueIls; else s.hasUnknownEstimate = true;
  }
  const stationTotals = Array.from(stationMap.values())
    .map((s) => ({
      ...s,
      downtimeHours: round2(s.downtimeHours),
      estLostWashes: round2(s.estLostWashes),
      estLostRevenueIls: round2(s.estLostRevenueIls),
    }))
    .sort((a, b) => b.estLostRevenueIls - a.estLostRevenueIls);

  // Grand total.
  const grandTotal = {
    faults: rows.length,
    downtimeHours: round2(rows.reduce((a, r) => a + (r.downtimeHours ?? 0), 0)),
    estLostWashes: round2(rows.reduce((a, r) => a + (r.estLostWashes ?? 0), 0)),
    estLostRevenueIls: round2(rows.reduce((a, r) => a + (r.estLostRevenueIls ?? 0), 0)),
    faultsWithUnknownEstimate: rows.filter((r) => r.estLostRevenueIls === null).length,
  };

  return res.json({
    wired: true,
    generatedAt,
    lookbackDays,
    statusFilter,
    capped: faults.length >= MAX_FAULT_ROWS,
    faultCount: rows.length,
    faults: rows,
    stationTotals,
    grandTotal,
    errors,
    methodology: {
      downtimeHours: 'reportedAt → (resolvedAt or now)',
      avgWashesPerHour: 'completed bay_sessions / active span hours, per bay, over lookback (real)',
      avgRevenuePerWashIls: 'completed bay_sessions revenue / completed washes, per bay (real, display ILS)',
      estLostWashes: 'downtimeHours × avgWashesPerHour (ESTIMATE)',
      estLostRevenueIls: 'estLostWashes × avgRevenuePerWashIls (ESTIMATE)',
      nullPolicy: 'when a bay has no completed-wash history, rate/price/estimate are null with estimateNote — never fabricated ₪',
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §12 — PREDICTIVE MAINTENANCE (early-warning signals)
// ─────────────────────────────────────────────────────────────────────────────
const CONSUMABLE_LOW_PCT = 20;
const HEARTBEAT_FRESH_MS = 30 * 60 * 1000; // 30 min
const USAGE_DROP_RATIO = 0.4;              // 24h washes < 40% of 7-day daily avg
const FAILED_SESSIONS_THRESHOLD = 3;       // failed sessions in 24h
const REPEAT_FAULT_THRESHOLD = 3;          // faults on bay in 7 days
const NAYAX_SILENT_MS = 24 * HOUR_MS;      // no Nayax tx in 24h

router.get('/predictive-maintenance', requireAdmin, async (_req: Request, res: Response) => {
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];
  const now = Date.now();
  const since24h = new Date(now - DAY_MS);
  const since7d = new Date(now - 7 * DAY_MS);

  // 1) Bays — the anchor.
  const bays = await safe('bays', errors, () => db
    .select({
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
      nayaxTerminalId: stationBays.nayaxTerminalId,
    })
    .from(stationBays)
    .limit(MAX_BAYS),
    [] as any[]);

  if (bays.length === 0) {
    return res.json({
      wired: true,
      generatedAt,
      bayCount: 0,
      bays: [],
      summary: { high: 0, medium: 0, low: 0 },
      errors,
      note: 'No station bays registered. Predictive signals are computed per bay from bay_sessions / bay_faults / station_bays / nayax_transactions.',
    });
  }

  const bayIds = bays.map((b: any) => b.id);
  const stationIds = Array.from(new Set(bays.map((b: any) => b.stationId)));
  const terminalIds = Array.from(new Set(bays.map((b: any) => b.nayaxTerminalId).filter(Boolean))) as string[];

  // 2) 24h washes (completed) + failed sessions per bay.
  const agg24 = await safe('agg24', errors, () => db
    .select({
      bayId: baySessions.bayId,
      washes24: sql<number>`count(*) filter (where ${baySessions.status} = 'completed')`,
      failed24: sql<number>`count(*) filter (where ${baySessions.status} in ('timed_out','aborted','fault'))`,
    })
    .from(baySessions)
    .where(and(inArray(baySessions.bayId, bayIds), gte(baySessions.startedAt, since24h)))
    .groupBy(baySessions.bayId),
    [] as any[]);
  const agg24ByBay = new Map<string, any>();
  for (const r of agg24 as any[]) agg24ByBay.set(r.bayId, r);

  // 3) 7-day completed washes (for the daily-average baseline).
  const agg7 = await safe('agg7', errors, () => db
    .select({
      bayId: baySessions.bayId,
      washes7: sql<number>`count(*) filter (where ${baySessions.status} = 'completed')`,
    })
    .from(baySessions)
    .where(and(inArray(baySessions.bayId, bayIds), gte(baySessions.startedAt, since7d)))
    .groupBy(baySessions.bayId),
    [] as any[]);
  const agg7ByBay = new Map<string, any>();
  for (const r of agg7 as any[]) agg7ByBay.set(r.bayId, r);

  // 4) Faults raised in last 7 days per bay.
  const fault7 = await safe('fault7', errors, () => db
    .select({
      bayId: bayFaults.bayId,
      faults7: sql<number>`count(*)`,
      openNow: sql<number>`count(*) filter (where ${bayFaults.status} = 'open')`,
    })
    .from(bayFaults)
    .where(and(inArray(bayFaults.bayId, bayIds), gte(bayFaults.reportedAt, since7d)))
    .groupBy(bayFaults.bayId),
    [] as any[]);
  const fault7ByBay = new Map<string, any>();
  for (const r of fault7 as any[]) fault7ByBay.set(r.bayId, r);

  // 5) Last Nayax transaction per terminal (terminal → bay via station_bays).
  //    Only attempt if any bay actually carries a terminal id.
  const nayaxByTerminal = new Map<string, string | null>();
  let nayaxAvailable = false;
  if (terminalIds.length > 0) {
    const lastTx = await safe('nayax', errors, () => db
      .select({
        terminalId: nayaxTransactions.terminalId,
        lastAt: sql<string | null>`max(${nayaxTransactions.createdAt})`,
      })
      .from(nayaxTransactions)
      .where(inArray(nayaxTransactions.terminalId, terminalIds))
      .groupBy(nayaxTransactions.terminalId),
      [] as any[]);
    nayaxAvailable = true;
    for (const r of lastTx as any[]) nayaxByTerminal.set(r.terminalId, r.lastAt ?? null);
  }

  // Station names.
  const kiosks = await safe('kiosks', errors, () => db
    .select({ kioskId: kioskMachines.kioskId, name: kioskMachines.name, nameHe: kioskMachines.nameHe })
    .from(kioskMachines)
    .where(inArray(kioskMachines.kioskId, stationIds)),
    [] as any[]);
  const kioskById = new Map<string, any>();
  for (const k of kiosks as any[]) kioskById.set(k.kioskId, k);

  // Build per-bay signals. Each signal carries a weight; risk derives from the
  // weighted sum (critical=2, normal=1): >=3 high, >=1 medium, else low.
  const out = (bays as any[]).map((b) => {
    const a24 = agg24ByBay.get(b.id);
    const a7 = agg7ByBay.get(b.id);
    const f7 = fault7ByBay.get(b.id);
    const washes24 = Number(a24?.washes24 ?? 0);
    const failed24 = Number(a24?.failed24 ?? 0);
    const washes7 = Number(a7?.washes7 ?? 0);
    const faults7 = Number(f7?.faults7 ?? 0);
    const dailyAvg7 = washes7 / 7;
    const isDown = DOWN_STATUSES.includes(b.status);

    const signals: Array<{ signal: string; level: 'warning' | 'critical'; reason: string; reasonHe: string }> = [];

    // usage_drop — only meaningful once there is a real 7-day baseline.
    if (dailyAvg7 >= 2 && washes24 < dailyAvg7 * USAGE_DROP_RATIO) {
      signals.push({
        signal: 'usage_drop',
        level: 'warning',
        reason: `Last 24h washes (${washes24}) are well below the 7-day daily average (${round2(dailyAvg7)}). A sudden usage drop on a working bay can mean a silent fault.`,
        reasonHe: `שטיפות ב-24 שעות (${washes24}) נמוכות בהרבה מהממוצע היומי של 7 ימים (${round2(dailyAvg7)}). ירידה פתאומית בשימוש עלולה להעיד על תקלה שקטה.`,
      });
    }

    // failed_sessions
    if (failed24 >= FAILED_SESSIONS_THRESHOLD) {
      signals.push({
        signal: 'failed_sessions',
        level: 'critical',
        reason: `${failed24} sessions failed (timed-out / aborted / fault) in the last 24h. Repeated failures precede a hard fault.`,
        reasonHe: `${failed24} מפגשים נכשלו (פג-זמן / בוטל / תקלה) ב-24 השעות האחרונות. כשלים חוזרים מקדימים תקלה מלאה.`,
      });
    }

    // repeated_faults
    if (faults7 >= REPEAT_FAULT_THRESHOLD) {
      signals.push({
        signal: 'repeated_faults',
        level: 'critical',
        reason: `${faults7} faults raised on this bay in the last 7 days. A recurring fault pattern indicates a degrading component.`,
        reasonHe: `${faults7} תקלות נרשמו בתא זה ב-7 הימים האחרונים. דפוס תקלות חוזר מצביע על רכיב מתדרדר.`,
      });
    }

    // no_nayax_recently — only if this bay has a terminal AND the bay is
    // expected to be transacting (ready/busy), and Nayax data is available.
    let nayaxLastAt: string | null = null;
    if (nayaxAvailable && b.nayaxTerminalId) {
      nayaxLastAt = nayaxByTerminal.get(b.nayaxTerminalId) ?? null;
      const expectActive = !isDown; // ready / busy / cleanup
      const silent = !nayaxLastAt || (now - new Date(nayaxLastAt).getTime()) > NAYAX_SILENT_MS;
      if (expectActive && silent) {
        signals.push({
          signal: 'no_nayax_recently',
          level: 'warning',
          reason: nayaxLastAt
            ? `No Nayax transaction on this bay's terminal since ${nayaxLastAt} while the bay is "${b.status}". A live bay with no card traffic can mean a dead reader.`
            : `No Nayax transaction ever recorded for this bay's terminal while the bay is "${b.status}". Verify the card reader is online.`,
          reasonHe: `אין עסקת Nayax על קורא התא בעוד התא במצב "${b.status}". תא פעיל ללא תנועת כרטיסים עלול להעיד על קורא תקול.`,
        });
      }
    }

    // low_consumables
    const lowLevels: string[] = [];
    if (typeof b.shampooLevelPct === 'number' && b.shampooLevelPct <= CONSUMABLE_LOW_PCT) lowLevels.push(`shampoo ${b.shampooLevelPct}%`);
    if (typeof b.conditionerLevelPct === 'number' && b.conditionerLevelPct <= CONSUMABLE_LOW_PCT) lowLevels.push(`conditioner ${b.conditionerLevelPct}%`);
    if (lowLevels.length > 0) {
      signals.push({
        signal: 'low_consumables',
        level: 'warning',
        reason: `Low consumables (${lowLevels.join(', ')}). Refill before the bay runs dry mid-wash.`,
        reasonHe: `מפלס מתכלים נמוך (${lowLevels.join(', ')}). מומלץ למלא לפני שהתא מתרוקן באמצע שטיפה.`,
      });
    }

    // stale_heartbeat — only if we've ever seen a heartbeat (else "never" is
    // not a degradation signal, just an un-provisioned bay).
    if (b.lastHeartbeat && (now - new Date(b.lastHeartbeat).getTime()) > HEARTBEAT_FRESH_MS) {
      signals.push({
        signal: 'stale_heartbeat',
        level: 'warning',
        reason: `No IoT heartbeat since ${b.lastHeartbeat}. A bay that stops reporting may be losing connectivity or power.`,
        reasonHe: `אין דיווח IoT מאז ${b.lastHeartbeat}. תא שמפסיק לדווח עלול לאבד קישוריות או חשמל.`,
      });
    }

    // Risk from weighted signal sum.
    const weight = signals.reduce((a, s) => a + (s.level === 'critical' ? 2 : 1), 0);
    const risk: 'low' | 'medium' | 'high' = weight >= 3 ? 'high' : weight >= 1 ? 'medium' : 'low';

    const unavailableSignals: string[] = [];
    if (!nayaxAvailable || !b.nayaxTerminalId) unavailableSignals.push('no_nayax_recently');
    if (!b.lastHeartbeat) unavailableSignals.push('stale_heartbeat');
    if (typeof b.shampooLevelPct !== 'number' && typeof b.conditionerLevelPct !== 'number') unavailableSignals.push('low_consumables');

    return {
      bayId: b.id,
      stationId: b.stationId,
      stationName: kioskById.get(b.stationId)?.name ?? b.stationCode ?? b.stationId,
      stationNameHe: kioskById.get(b.stationId)?.nameHe ?? null,
      side: b.side,
      bayLabel: b.bayLabel ?? null,
      bayLabelHe: b.bayLabelHe ?? null,
      status: b.status,
      risk,
      signalCount: signals.length,
      signals,
      metrics: {
        washes24h: washes24,
        failed24h: failed24,
        washes7d: washes7,
        dailyAvg7d: round2(dailyAvg7),
        faults7d: faults7,
        shampooLevelPct: typeof b.shampooLevelPct === 'number' ? b.shampooLevelPct : null,
        conditionerLevelPct: typeof b.conditionerLevelPct === 'number' ? b.conditionerLevelPct : null,
        lastHeartbeat: b.lastHeartbeat ?? null,
        nayaxLastAt,
      },
      unavailableSignals,
    };
  })
  // Worst first.
  .sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    if (order[a.risk] !== order[b.risk]) return order[a.risk] - order[b.risk];
    return b.signalCount - a.signalCount;
  });

  const summary = {
    high: out.filter((b) => b.risk === 'high').length,
    medium: out.filter((b) => b.risk === 'medium').length,
    low: out.filter((b) => b.risk === 'low').length,
  };

  return res.json({
    wired: true,
    generatedAt,
    bayCount: out.length,
    summary,
    bays: out,
    errors,
    thresholds: {
      usageDropRatio: USAGE_DROP_RATIO,
      failedSessions24h: FAILED_SESSIONS_THRESHOLD,
      repeatFaults7d: REPEAT_FAULT_THRESHOLD,
      nayaxSilentHours: NAYAX_SILENT_MS / HOUR_MS,
      consumableLowPct: CONSUMABLE_LOW_PCT,
      heartbeatFreshMinutes: HEARTBEAT_FRESH_MS / 60000,
    },
    riskRule: 'weighted signal sum (critical=2, warning=1): >=3 high, >=1 medium, else low',
  });
});

export default router;
