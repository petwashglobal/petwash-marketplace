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
import { buildMachineIndex, stationMapLinks, loadStations, invalidateStationCache } from '../lib/stationRegistry';
import { z } from 'zod';

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

  // Stations come from the DB now (migration 0163); the code array is the fallback.
  const stationList = await loadStations();
  const idx = buildMachineIndex(stationList);
  // Any machine that reported events but isn't in the registry yet (e.g. the
  // Green Kfar Saba bays once they go live) — surface it so nothing is lost.
  const known = new Set([...idx.keys()]);
  const orphanMachines = Object.keys(byMachine).filter((m) => !known.has(m));

  const stations = stationList.map((s) => {
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
    // HR / staff module SHIPPED (migration 0102 + /api/admin/staff).
    staff: { built: true, note: 'ניהול הצוות זמין במסך «צוות ו־HR».', href: '/admin/staff' },
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Stations — add or edit WITHOUT a deploy (2026-09-18).
// The list used to be a two-row array in server/lib/stationRegistry.ts, so a
// new city meant a code change. Now it is the station_registry table, and this
// is the door: super-admin only, every field validated, bays keyed by the Nayax
// machine id that bay income joins on.
// ─────────────────────────────────────────────────────────────────────────────
const bayInput = z.object({
  machineId: z.string().trim().min(1).max(32),
  terminalId: z.string().trim().max(32).optional(),
  label: z.string().trim().max(64).default(''),
});
const stationInput = z.object({
  code: z.string().trim().regex(/^[A-Z0-9-]{4,32}$/, 'code like PWS-IL-TLV-001'),
  nameHe: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(240),
  city: z.string().trim().min(1).max(80),
  postalCode: z.string().trim().max(16).optional(),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  hoursHe: z.string().trim().max(120).default(''),
  accessHe: z.string().trim().max(500).optional(),
  accessEn: z.string().trim().max(500).optional(),
  open: z.boolean().default(true),
  bays: z.array(bayInput).max(8).default([]),
});

router.get('/stations', requireSuperAdmin, async (_req: Request, res: Response) => {
  const stations = await loadStations({ force: true });
  res.json({ ok: true, stations, source: 'station_registry (falls back to the built-in list)' });
});

router.post('/stations', requireSuperAdmin, async (req: Request, res: Response) => {
  const parsed = stationInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'Invalid station', details: parsed.error.flatten() });
  }
  const s = parsed.data;
  // A machine id may belong to ONE station — bay income joins on it, so a
  // duplicate would split or double-count a bay's money.
  let clashRow: { station_id?: string } | undefined;
  if (s.bays.length > 0) {
    // ANY overlap, not an exact set match.
    const ids = sql.join(s.bays.map((b) => sql`${b.machineId}`), sql`, `);
    const clash = await db.execute(sql`
      SELECT station_id FROM station_registry
      WHERE station_id <> ${s.code}
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(bays, '[]'::jsonb)) AS b
          WHERE b->>'machineId' IN (${ids})
        )
      LIMIT 1
    `);
    clashRow = ((clash as any)?.rows ?? [])[0];
  }
  if (clashRow) {
    return res.status(409).json({ ok: false, error: `A bay machine id already belongs to ${clashRow.station_id}`, code: 'MACHINE_ID_TAKEN' });
  }
  try {
    await db.execute(sql`
      INSERT INTO station_registry (
        station_id, station_name, station_name_he, address, city, country, postal_code,
        coordinates, ownership_type, operating_status, is_active, bays, hours_he, access_he, access_en, updated_at
      ) VALUES (
        ${s.code}, ${s.nameEn}, ${s.nameHe}, ${s.address}, ${s.city}, 'IL', ${s.postalCode ?? null},
        ${JSON.stringify({ lat: s.lat, lng: s.lng })}::jsonb, 'corporate', ${s.open ? 'active' : 'inactive'}, ${s.open},
        ${JSON.stringify(s.bays)}::jsonb, ${s.hoursHe}, ${s.accessHe ?? null}, ${s.accessEn ?? null}, NOW()
      )
      ON CONFLICT (station_id) DO UPDATE SET
        station_name = EXCLUDED.station_name, station_name_he = EXCLUDED.station_name_he,
        address = EXCLUDED.address, city = EXCLUDED.city, postal_code = EXCLUDED.postal_code,
        coordinates = EXCLUDED.coordinates, operating_status = EXCLUDED.operating_status,
        is_active = EXCLUDED.is_active, bays = EXCLUDED.bays, hours_he = EXCLUDED.hours_he,
        access_he = EXCLUDED.access_he, access_en = EXCLUDED.access_en, updated_at = NOW()
    `);
    invalidateStationCache();
    const stations = await loadStations({ force: true });
    logger.info('[Stations] saved', { code: s.code, city: s.city, bays: s.bays.length, actor: (req as any).user?.uid ?? null });
    res.json({ ok: true, saved: s.code, stations });
  } catch (err: any) {
    logger.error('[Stations] save failed', { code: s.code, error: err?.message });
    res.status(500).json({ ok: false, error: 'Could not save the station.' });
  }
});

export default router;
