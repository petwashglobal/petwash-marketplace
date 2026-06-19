/**
 * Smart Stock Prediction (§10) + Automatic Reports (§24)
 * — READ-ONLY admin operations intelligence.
 *
 * CEO "Business OS" spec. Pure SELECT aggregation over tables that ALREADY
 * exist. NO schema change, NO new dependency, NO money math change, NO
 * K9000/Nayax/Tranzila runtime touch. Every consequential number is a real
 * COUNT/SUM; any value we cannot back with a real column is returned as null
 * WITH a note, never fabricated (platform skill §2 — no fake data).
 *
 * The repo has THREE distinct stock systems, each with different data quality:
 *
 *   1) spare_parts          — maintenance parts. HAS real movement history via
 *                             stock_transactions (transactionType='usage'). We
 *                             derive avg usage/day from REAL movement rows.
 *   2) kiosk_inventory      — vending slots. HAS real depletion history via
 *                             kiosk_sales (quantity sold). We derive avg
 *                             usage/day from REAL sales rows.
 *   3) inventory_items      — bulk consumables (shampoo/conditioner/etc.). Has
 *                             NO movement-history table at all. For these we
 *                             FALL BACK to a clearly-labelled per-wash heuristic
 *                             driven by REAL completed bay_sessions; if a
 *                             category has no per-wash mapping we return null +
 *                             note rather than guess.
 *
 * Endpoints (both mounted under /api/admin/* so they inherit the full admin
 * security stack — adminLimiter + requireRole + requireStaffApproved +
 * requireMfaEnrolled — and a second inline requireAdmin gate is applied here
 * for defence in depth):
 *
 *   GET /api/admin/stock-prediction
 *     For each tracked stock item across the three systems:
 *       - currentStock            (real column)
 *       - minStock / threshold    (real column)
 *       - avgUsagePerDay          REAL where movement/sales history exists;
 *                                 HEURISTIC (per-wash) for bulk consumables;
 *                                 null + note when neither is derivable
 *       - predictedDaysUntilEmpty currentStock / avgUsagePerDay (null when
 *                                 usage is null or zero)
 *       - reorder                 boolean: currentStock <= threshold OR the item
 *                                 will empty within the reorder lead window
 *       - usageBasis              which data path produced avgUsagePerDay, so
 *                                 the operator can see real-vs-heuristic at a
 *                                 glance.
 *
 *   GET /api/admin/reports-summary
 *     Automatic Reports digest — daily (last 24h) + weekly (last 7d) rollups
 *     computed from real tables, each metric in its own try/catch so one
 *     failing aggregate never blanks the whole report:
 *       - washSessions   completed bay_sessions
 *       - stationRevenue ILS from completed bay_sessions amount_cents (display)
 *       - kioskSales     completed kiosk_sales count + ILS
 *       - faultsOpened   bay_faults reportedAt in window
 *       - faultsResolved bay_faults resolvedAt in window
 *       - refunds        refund_approvals created in window (count + ILS)
 *       - lowStockNow    count of stock rows at/under their threshold (now)
 *
 * Money note: revenue/refund figures are ILS for DISPLAY only (cents / 100).
 * No balance, escrow, payout, or refund math is performed or mutated.
 */
import { Router, type Request, type Response } from 'express';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { requireAdmin } from '../adminAuth';
import {
  inventoryItems,
  baySessions,
  bayFaults,
  kioskInventory,
  kioskSales,
  refundApprovals,
} from '@shared/schema';
import { spareParts, stockTransactions } from '@shared/schema-enterprise';
import { logger } from '../lib/logger';

const router = Router();

const DAY_MS = 24 * 60 * 60 * 1000;

// Completed-wash statuses (a wash that actually consumed product/created value).
const COMPLETED_SESSION = ['completed', 'cleanup'];

// Caps so a runaway table never returns an unbounded payload.
const MAX_ITEMS = 300;

// ── HEURISTIC CONSTANTS (bulk consumables only) ──────────────────────────────
// inventory_items has NO movement history, so for those rows we estimate usage
// from REAL completed washes × an assumed per-wash consumption. These are
// OPERATOR-TUNABLE ESTIMATES, not measured values — surfaced explicitly in the
// response so nobody mistakes them for real telemetry. A category not listed
// here yields avgUsagePerDay = null (we refuse to guess).
//
// Units are "stock units per completed wash" matching inventory_items.unit.
const PER_WASH_USAGE_HEURISTIC: Record<string, number> = {
  shampoo: 0.05,      // ~50 ml of a ~1 unit (e.g. 1 L) bottle per wash
  conditioner: 0.04,
  disinfectant: 0.02,
  'tea tree oil': 0.01,
  towel: 1,           // one disposable/laundered towel per wash, if tracked as units
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Per-query try/catch helper: one failing aggregate must never 500 the report.
async function safe<T>(label: string, errors: string[], fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    errors.push(label);
    logger.error(`[stock-reports] aggregate failed: ${label}`, err);
    return fallback;
  }
}

interface PredictionRow {
  system: 'spare_parts' | 'kiosk_inventory' | 'inventory_items';
  id: string;
  name: string;
  category: string | null;
  location: string | null;
  currentStock: number;
  threshold: number;
  unit: string | null;
  avgUsagePerDay: number | null;
  /** REAL = derived from movement/sales history; HEURISTIC = per-wash estimate; NONE = no basis */
  usageBasis: 'real_movement' | 'real_sales' | 'heuristic_per_wash' | 'none';
  predictedDaysUntilEmpty: number | null;
  reorder: boolean;
  leadTimeDays: number | null;
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// §10 — SMART STOCK PREDICTION
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stock-prediction', requireAdmin, async (req: Request, res: Response) => {
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];
  const now = Date.now();

  // Lookback for deriving usage rate from movement/sales history (and for the
  // washes-per-day basis of the consumable heuristic).
  const lookbackDays = Math.min(Math.max(Number(req.query.lookbackDays) || 30, 7), 90);
  const sinceLookback = new Date(now - lookbackDays * DAY_MS);

  const rows: PredictionRow[] = [];

  // ── 1) SPARE PARTS — usage from REAL stock_transactions movement rows ──────
  await safe('spare_parts', errors, async () => {
    const parts = await db
      .select({
        id: spareParts.id,
        partName: spareParts.partName,
        category: spareParts.category,
        quantityInStock: spareParts.quantityInStock,
        reorderPoint: spareParts.reorderPoint,
        minimumStockLevel: spareParts.minimumStockLevel,
        leadTimeDays: spareParts.leadTimeDays,
        isActive: spareParts.isActive,
      })
      .from(spareParts)
      .where(eq(spareParts.isActive, true))
      .limit(MAX_ITEMS);

    if (parts.length === 0) return;

    // Sum REAL "usage" movements per part over the lookback window.
    const usageByPart = await db
      .select({
        sparePartId: stockTransactions.sparePartId,
        used: sql<number>`coalesce(sum(${stockTransactions.quantity}), 0)`,
      })
      .from(stockTransactions)
      .where(
        and(
          eq(stockTransactions.transactionType, 'usage'),
          gte(stockTransactions.createdAt, sinceLookback),
        ),
      )
      .groupBy(stockTransactions.sparePartId);

    const usageMap = new Map<number, number>();
    for (const u of usageByPart) usageMap.set(Number(u.sparePartId), Number(u.used) || 0);

    for (const p of parts) {
      const current = Number(p.quantityInStock) || 0;
      const threshold = Number(p.reorderPoint ?? p.minimumStockLevel) || 0;
      const leadTimeDays = p.leadTimeDays != null ? Number(p.leadTimeDays) : null;
      const usedInWindow = usageMap.get(Number(p.id)) || 0;
      const avgUsagePerDay = usedInWindow > 0 ? round2(usedInWindow / lookbackDays) : null;
      const daysLeft =
        avgUsagePerDay && avgUsagePerDay > 0 ? round2(current / avgUsagePerDay) : null;
      const emptyWithinLead =
        daysLeft != null && leadTimeDays != null ? daysLeft <= leadTimeDays : false;

      rows.push({
        system: 'spare_parts',
        id: `sp-${p.id}`,
        name: p.partName,
        category: p.category ?? null,
        location: 'Central warehouse',
        currentStock: current,
        threshold,
        unit: 'units',
        avgUsagePerDay,
        usageBasis: avgUsagePerDay != null ? 'real_movement' : 'none',
        predictedDaysUntilEmpty: daysLeft,
        reorder: current <= threshold || emptyWithinLead,
        leadTimeDays,
        note:
          avgUsagePerDay == null
            ? 'No usage movements recorded in the lookback window; days-until-empty cannot be derived.'
            : undefined,
      });
    }
  }, undefined);

  // ── 2) KIOSK INVENTORY — usage from REAL kiosk_sales depletion ─────────────
  await safe('kiosk_inventory', errors, async () => {
    const inv = await db
      .select({
        id: kioskInventory.id,
        productId: kioskInventory.productId,
        currentStock: kioskInventory.currentStock,
        minThreshold: kioskInventory.minThreshold,
      })
      .from(kioskInventory)
      .limit(MAX_ITEMS);

    if (inv.length === 0) return;

    // REAL units sold per product over the lookback (completed sales only).
    const soldByProduct = await db
      .select({
        productId: kioskSales.productId,
        sold: sql<number>`coalesce(sum(${kioskSales.quantity}), 0)`,
      })
      .from(kioskSales)
      .where(
        and(
          eq(kioskSales.status, 'completed'),
          gte(kioskSales.transactionDate, sinceLookback),
        ),
      )
      .groupBy(kioskSales.productId);

    const soldMap = new Map<number, number>();
    for (const s of soldByProduct) soldMap.set(Number(s.productId), Number(s.sold) || 0);

    for (const k of inv) {
      const current = Number(k.currentStock) || 0;
      const threshold = Number(k.minThreshold) || 0;
      const soldInWindow = soldMap.get(Number(k.productId)) || 0;
      const avgUsagePerDay = soldInWindow > 0 ? round2(soldInWindow / lookbackDays) : null;
      const daysLeft =
        avgUsagePerDay && avgUsagePerDay > 0 ? round2(current / avgUsagePerDay) : null;

      rows.push({
        system: 'kiosk_inventory',
        id: `ki-${k.id}`,
        name: `Kiosk product #${k.productId}`,
        category: 'kiosk_vending',
        location: null,
        currentStock: current,
        threshold,
        unit: 'units',
        avgUsagePerDay,
        usageBasis: avgUsagePerDay != null ? 'real_sales' : 'none',
        predictedDaysUntilEmpty: daysLeft,
        reorder: current <= threshold,
        leadTimeDays: null,
        note:
          avgUsagePerDay == null
            ? 'No completed sales recorded in the lookback window; days-until-empty cannot be derived.'
            : undefined,
      });
    }
  }, undefined);

  // ── 3) BULK CONSUMABLES (inventory_items) — HEURISTIC per-wash estimate ────
  await safe('inventory_items', errors, async () => {
    const items = await db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        category: inventoryItems.category,
        currentStock: inventoryItems.currentStock,
        minStock: inventoryItems.minStock,
        unit: inventoryItems.unit,
        location: inventoryItems.location,
      })
      .from(inventoryItems)
      .limit(MAX_ITEMS);

    if (items.length === 0) return;

    // REAL completed washes per day over the lookback — the volume driver for
    // the consumable heuristic. (No per-item movement history exists.)
    const washAgg = await db
      .select({ washes: sql<number>`count(*)` })
      .from(baySessions)
      .where(
        and(
          inArray(baySessions.status, COMPLETED_SESSION),
          gte(baySessions.startedAt, sinceLookback),
        ),
      );
    const totalWashes = Number(washAgg[0]?.washes) || 0;
    const washesPerDay = totalWashes > 0 ? totalWashes / lookbackDays : 0;

    for (const it of items) {
      const current = Number(it.currentStock) || 0;
      const threshold = Number(it.minStock) || 0;
      const catKey = String(it.category || '').toLowerCase().trim();
      const perWash = PER_WASH_USAGE_HEURISTIC[catKey];

      let avgUsagePerDay: number | null = null;
      let usageBasis: PredictionRow['usageBasis'] = 'none';
      let note: string | undefined;

      if (perWash != null && washesPerDay > 0) {
        avgUsagePerDay = round2(perWash * washesPerDay);
        usageBasis = 'heuristic_per_wash';
        note =
          `HEURISTIC: estimated from ${round2(washesPerDay)} completed washes/day × ` +
          `${perWash} ${it.unit ?? 'unit'}/wash assumed for "${catKey}". ` +
          `This is an estimate, not measured consumption — no movement history exists for bulk consumables.`;
      } else if (perWash == null) {
        note =
          `No per-wash usage mapping for category "${catKey}" and no movement history; ` +
          `days-until-empty cannot be derived.`;
      } else {
        note =
          `No completed washes in the lookback window; the per-wash heuristic yields no usage.`;
      }

      const daysLeft =
        avgUsagePerDay && avgUsagePerDay > 0 ? round2(current / avgUsagePerDay) : null;

      rows.push({
        system: 'inventory_items',
        id: `ii-${it.id}`,
        name: it.name,
        category: it.category ?? null,
        location: it.location ?? null,
        currentStock: current,
        threshold,
        unit: it.unit ?? null,
        avgUsagePerDay,
        usageBasis,
        predictedDaysUntilEmpty: daysLeft,
        reorder: current <= threshold,
        leadTimeDays: null,
        note,
      });
    }
  }, undefined);

  // Most-urgent first: items that will empty soonest, then below-threshold, then rest.
  rows.sort((a, b) => {
    const ad = a.predictedDaysUntilEmpty;
    const bd = b.predictedDaysUntilEmpty;
    if (ad != null && bd != null) return ad - bd;
    if (ad != null) return -1;
    if (bd != null) return 1;
    // both unknown: surface reorder=true first
    return Number(b.reorder) - Number(a.reorder);
  });

  const reorderCount = rows.filter((r) => r.reorder).length;

  res.json({
    wired: true,
    generatedAt,
    lookbackDays,
    itemCount: rows.length,
    reorderCount,
    items: rows,
    heuristic: {
      applied: 'inventory_items (bulk consumables) only',
      perWashUsage: PER_WASH_USAGE_HEURISTIC,
      explanation:
        'Spare-parts usage and kiosk usage are REAL (derived from stock_transactions and kiosk_sales). ' +
        'Bulk consumables have no movement history, so their usage is an explicit per-wash ESTIMATE ' +
        'driven by real completed bay_sessions. Rows with usageBasis="none" have no derivable rate.',
    },
    errors,
    note:
      rows.length === 0
        ? 'No tracked stock rows found across spare_parts, kiosk_inventory, or inventory_items.'
        : undefined,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §24 — AUTOMATIC REPORTS (daily + weekly digest)
// ─────────────────────────────────────────────────────────────────────────────
async function buildRollup(sinceMs: number) {
  const errors: string[] = [];
  const since = new Date(sinceMs);

  const washSessions = await safe('washSessions', errors, async () => {
    const r = await db
      .select({ c: sql<number>`count(*)` })
      .from(baySessions)
      .where(
        and(inArray(baySessions.status, COMPLETED_SESSION), gte(baySessions.startedAt, since)),
      );
    return Number(r[0]?.c) || 0;
  }, null as number | null);

  const stationRevenueIls = await safe('stationRevenue', errors, async () => {
    const r = await db
      .select({ cents: sql<number>`coalesce(sum(${baySessions.amountCents}), 0)` })
      .from(baySessions)
      .where(
        and(inArray(baySessions.status, COMPLETED_SESSION), gte(baySessions.startedAt, since)),
      );
    return round2((Number(r[0]?.cents) || 0) / 100);
  }, null as number | null);

  const kiosk = await safe('kioskSales', errors, async () => {
    const r = await db
      .select({
        c: sql<number>`count(*)`,
        total: sql<number>`coalesce(sum(${kioskSales.totalAmount}), 0)`,
      })
      .from(kioskSales)
      .where(and(eq(kioskSales.status, 'completed'), gte(kioskSales.transactionDate, since)));
    return { count: Number(r[0]?.c) || 0, revenueIls: round2(Number(r[0]?.total) || 0) };
  }, null as { count: number; revenueIls: number } | null);

  const faultsOpened = await safe('faultsOpened', errors, async () => {
    const r = await db
      .select({ c: sql<number>`count(*)` })
      .from(bayFaults)
      .where(gte(bayFaults.reportedAt, since));
    return Number(r[0]?.c) || 0;
  }, null as number | null);

  const faultsResolved = await safe('faultsResolved', errors, async () => {
    const r = await db
      .select({ c: sql<number>`count(*)` })
      .from(bayFaults)
      .where(and(eq(bayFaults.status, 'resolved'), gte(bayFaults.resolvedAt, since)));
    return Number(r[0]?.c) || 0;
  }, null as number | null);

  const refunds = await safe('refunds', errors, async () => {
    const r = await db
      .select({
        c: sql<number>`count(*)`,
        cents: sql<number>`coalesce(sum(${refundApprovals.amountCents}), 0)`,
      })
      .from(refundApprovals)
      .where(gte(refundApprovals.createdAt, since));
    return { count: Number(r[0]?.c) || 0, amountIls: round2((Number(r[0]?.cents) || 0) / 100) };
  }, null as { count: number; amountIls: number } | null);

  return {
    since: since.toISOString(),
    washSessions,
    stationRevenueIls,
    kiosk,
    faultsOpened,
    faultsResolved,
    refunds,
    errors,
  };
}

router.get('/reports-summary', requireAdmin, async (_req: Request, res: Response) => {
  const generatedAt = new Date().toISOString();
  const now = Date.now();
  const errors: string[] = [];

  const daily = await safe('daily', errors, () => buildRollup(now - DAY_MS), null);
  const weekly = await safe('weekly', errors, () => buildRollup(now - 7 * DAY_MS), null);

  // Current low-stock count is point-in-time (not windowed) across all systems.
  const lowStockNow = await safe('lowStock', errors, async () => {
    const counts = await Promise.all([
      db
        .select({ c: sql<number>`count(*)` })
        .from(spareParts)
        .where(
          and(
            eq(spareParts.isActive, true),
            lte(spareParts.quantityInStock, spareParts.reorderPoint),
          ),
        ),
      db
        .select({ c: sql<number>`count(*)` })
        .from(kioskInventory)
        .where(lte(kioskInventory.currentStock, kioskInventory.minThreshold)),
      db
        .select({ c: sql<number>`count(*)` })
        .from(inventoryItems)
        .where(lte(inventoryItems.currentStock, inventoryItems.minStock)),
    ]);
    return {
      spareParts: Number(counts[0][0]?.c) || 0,
      kioskInventory: Number(counts[1][0]?.c) || 0,
      inventoryItems: Number(counts[2][0]?.c) || 0,
    };
  }, null as { spareParts: number; kioskInventory: number; inventoryItems: number } | null);

  res.json({
    wired: true,
    generatedAt,
    daily,
    weekly,
    lowStockNow,
    errors,
    note:
      'Read-only digest. Revenue and refund figures are ILS for display only ' +
      '(no ledger math). Each metric is computed independently; a failed metric ' +
      'is reported in errors and returned as null, not fabricated.',
  });
});

export default router;
