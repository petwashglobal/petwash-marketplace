/**
 * Octopus Control Panel — ONE super-admin overview across every money +
 * operations surface (CEO 2026-07-23: "stats of sales, view live nayax
 * station, shop, providers, all — octopus control panel").
 *
 *   GET /api/admin/octopus/overview
 *
 * REAL SQL ONLY — every block reads live tables; a block whose table/query
 * fails returns null for that block (fail-soft, never a fake number).
 * Sales are reported PER SOURCE because the rails are separate systems:
 *   sumitCents   — purchases (SUMIT hosted rail: packages/eGift/top-ups/shop-card)
 *   kioskCents   — nayax_transaction_events (bay card taps, approved only)
 *   shopCents    — shop_orders (net+vat, non-cancelled)
 *   bookingCents — bookings (completed)
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { requireSuperAdmin } from '../middleware/gates';
import { logger } from '../lib/logger';

const router = Router();

async function block<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err: any) {
    logger.warn('[Octopus] block failed (returning null)', { name, err: err?.message });
    return null;
  }
}

router.get('/overview', requireSuperAdmin, async (_req: Request, res: Response) => {
  const [sales, stations, shop, providers] = await Promise.all([
    block('sales', async () => {
      const per = async (interval: string) => {
        const [sumit] = (await db.execute(sql`
          SELECT COALESCE(SUM(amount_cents),0)::bigint AS c FROM purchases
          WHERE status IN ('paid','activated') AND created_at >= NOW() - ${interval}::interval
        `)).rows as any[];
        const [kiosk] = (await db.execute(sql`
          SELECT COALESCE(SUM(amount_gross),0)::numeric AS ils, COUNT(*)::int AS n
          FROM nayax_transaction_events
          WHERE approval_status = 'approved' AND event_type = 'transaction'
            AND created_at >= NOW() - ${interval}::interval
        `)).rows as any[];
        const [shopR] = (await db.execute(sql`
          SELECT COALESCE(SUM(net_cents + vat_cents),0)::bigint AS c FROM shop_orders
          WHERE status NOT IN ('cancelled','refunded','payment_required')
            AND created_at >= NOW() - ${interval}::interval
        `)).rows as any[];
        const [book] = (await db.execute(sql`
          SELECT COALESCE(SUM(total_cents),0)::bigint AS c FROM bookings
          WHERE status = 'completed' AND created_at >= NOW() - ${interval}::interval
        `)).rows as any[];
        return {
          sumitCents: Number(sumit?.c ?? 0),
          kioskCents: Math.round(Number(kiosk?.ils ?? 0) * 100),
          kioskCount: Number(kiosk?.n ?? 0),
          shopCents: Number(shopR?.c ?? 0),
          bookingCents: Number(book?.c ?? 0),
        };
      };
      return { today: await per('1 day'), week: await per('7 days'), month: await per('30 days') };
    }),

    block('stations', async () => {
      // Live bay activity — per machine: last event + today's approved washes.
      const rows = (await db.execute(sql`
        SELECT machine_id,
               MAX(created_at)                                            AS last_event_at,
               COUNT(*) FILTER (WHERE approval_status = 'approved'
                                 AND created_at >= NOW() - interval '1 day')::int AS washes_today,
               COALESCE(SUM(amount_gross) FILTER (WHERE approval_status = 'approved'
                                 AND created_at >= NOW() - interval '1 day'), 0)::numeric AS ils_today
        FROM nayax_transaction_events
        GROUP BY machine_id
        ORDER BY MAX(created_at) DESC
        LIMIT 20
      `)).rows as any[];
      return rows.map((r) => ({
        machineId: String(r.machine_id),
        lastEventAt: r.last_event_at,
        washesToday: Number(r.washes_today ?? 0),
        ilsToday: Number(r.ils_today ?? 0),
      }));
    }),

    block('shop', async () => {
      const [products] = (await db.execute(sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE sku NOT LIKE 'EX-%')::int AS real_items
        FROM shop_products WHERE is_active = TRUE
      `)).rows as any[];
      const [orders] = (await db.execute(sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status IN ('paid','processing'))::int AS open
        FROM shop_orders
      `)).rows as any[];
      return {
        activeProducts: Number(products?.total ?? 0),
        realItems: Number(products?.real_items ?? 0),
        orders: Number(orders?.total ?? 0),
        openOrders: Number(orders?.open ?? 0),
      };
    }),

    block('providers', async () => {
      const [u] = (await db.execute(sql`
        SELECT COUNT(*) FILTER (WHERE verification_status = 'pending')::int AS pending,
               COUNT(*) FILTER (WHERE verification_status IN ('verified','approved'))::int AS approved,
               COUNT(*)::int AS total
        FROM providers
      `)).rows as any[];
      return { pending: Number(u?.pending ?? 0), approved: Number(u?.approved ?? 0), total: Number(u?.total ?? 0) };
    }),
  ]);

  res.json({ ok: true, generatedAt: new Date().toISOString(), sales, stations, shop, providers });
});

export default router;
