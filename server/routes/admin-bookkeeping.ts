/**
 * Station bookkeeping — per-station + per-bay financials for the Control Tower
 * (CEO 2026-07-24: "K9000 dual bay info for bookkeeping ... maps, station id").
 *
 *   GET /api/admin/octopus/bookkeeping?period=today|week|month
 *
 * Real numbers only, from nayax_transaction_events (the bay ledger), grouped
 * by machine_id and joined to the canonical station registry. VAT is split out
 * (gross − net) so the figures are book-ready. A station with no events yet
 * shows zeros with the honest bays it's waiting on — never a fabricated total.
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { requireSuperAdmin } from '../middleware/gates';
import { logger } from '../lib/logger';
import { STATION_REGISTRY, buildMachineIndex, stationMapLinks } from '../lib/stationRegistry';

const router = Router();

const PERIODS: Record<string, string> = { today: '1 day', week: '7 days', month: '30 days' };

router.get('/bookkeeping', requireSuperAdmin, async (req: Request, res: Response) => {
  const period = String(req.query.period || 'month');
  const interval = PERIODS[period] || PERIODS.month;

  // Per-machine financials from the bay ledger (approved sales only).
  let byMachine: Record<string, { grossCents: number; netCents: number; vatCents: number; washes: number; lastAt: string | null }> = {};
  try {
    const rows = (await db.execute(sql`
      SELECT machine_id,
             COALESCE(SUM(amount_gross), 0)::numeric              AS gross,
             COALESCE(SUM(COALESCE(amount_net, amount_gross)), 0)::numeric AS net,
             COUNT(*)::int                                        AS washes,
             MAX(transaction_time)                                AS last_at
      FROM nayax_transaction_events
      WHERE approval_status = 'approved'
        AND event_type = 'transaction'
        AND created_at >= NOW() - ${interval}::interval
      GROUP BY machine_id
    `)).rows as any[];
    for (const r of rows) {
      const grossCents = Math.round(Number(r.gross) * 100);
      const netCents = Math.round(Number(r.net) * 100);
      byMachine[String(r.machine_id)] = {
        grossCents,
        netCents,
        vatCents: Math.max(0, grossCents - netCents),
        washes: Number(r.washes ?? 0),
        lastAt: r.last_at ?? null,
      };
    }
  } catch (err: any) {
    logger.warn('[Bookkeeping] bay ledger query failed', { err: err?.message });
  }

  const idx = buildMachineIndex();
  // Any machine that reported events but isn't in the registry yet (e.g. the
  // Green Kfar Saba bays once they go live) — surface it so nothing is lost.
  const known = new Set([...idx.keys()]);
  const orphanMachines = Object.keys(byMachine).filter((m) => !known.has(m));

  const stations = STATION_REGISTRY.map((s) => {
    const bays = s.bays.map((b) => {
      const f = byMachine[b.machineId] || { grossCents: 0, netCents: 0, vatCents: 0, washes: 0, lastAt: null };
      return { ...b, ...f };
    });
    const totals = bays.reduce(
      (acc, b) => ({
        grossCents: acc.grossCents + b.grossCents,
        netCents: acc.netCents + b.netCents,
        vatCents: acc.vatCents + b.vatCents,
        washes: acc.washes + b.washes,
      }),
      { grossCents: 0, netCents: 0, vatCents: 0, washes: 0 },
    );
    return {
      code: s.code, nameHe: s.nameHe, nameEn: s.nameEn, address: s.address, city: s.city,
      lat: s.lat, lng: s.lng, hoursHe: s.hoursHe, open: s.open,
      maps: stationMapLinks(s),
      awaitingBayIds: s.bays.length === 0, // dual-bay whose machine ids aren't recorded yet
      bays, totals,
    };
  });

  res.json({
    ok: true,
    period,
    generatedAt: new Date().toISOString(),
    currency: 'ILS',
    vatNote: 'סכומי מע״מ מחושבים כהפרש ברוטו−נטו לכל תא. הדיווח החודשי ל־SUMIT הוא מקור האמת הפיסקלי.',
    stations,
    orphanMachines: orphanMachines.map((m) => ({ machineId: m, ...byMachine[m] })),
    // HR / staff module is not built yet — honest flag, never a fake roster.
    staff: { built: false, note: 'מודול HR/צוות טרם נבנה — יתווסף עם רשומות עובדים אמיתיות.' },
  });
});

export default router;
