/**
 * server/routes/admin-live-ops.ts
 * Mounted at /api/admin/live-ops (admin-gated, NOT feature-flagged).
 *
 * The CEO's "one screen to review all live bookings + operations + money" view.
 * Bookings live in FOUR separate tables (the unified `bookings` table, plus the
 * per-vertical sitter/walk/marketplace-request tables). The existing /admin/bridge
 * cockpit only reads `bookings` AND is double-gated behind BRIDGE_MVP_ENABLED, so
 * the CEO can't see it. This endpoint reads every source, normalizes them into one
 * shape, and returns KPIs + a merged recent-activity feed + an open-alerts count.
 *
 * Every source is wrapped in its own try/catch: if one table is unreachable the
 * screen degrades gracefully (that platform shows `available:false`) instead of
 * 500-ing the whole review screen. READ-ONLY — no writes, no money movement.
 */

import { Router, type Request, type Response } from 'express';
import { desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { bookings, sitterBookings, walkBookings, bookingRequests } from '@shared/schema';
import { adminAlerts } from '@shared/schema-admin-alerts';
import { logger } from '../lib/logger';

const router = Router();

// Statuses that mean a booking is currently "live" (occupying time/capacity).
const ACTIVE_STATUSES = ['pending', 'pending_provider', 'confirmed', 'accepted', 'in_progress', 'started'];

interface NormalizedBooking {
  platform: string;        // human label
  platformKey: string;     // machine key
  refId: string;           // public reference
  status: string;
  paymentStatus: string | null;
  amountIls: number;       // shekels (normalized from cents/decimal)
  customerId: string | null;
  providerId: string | null;
  createdAt: string | null;
  traceUrl: string | null; // where an admin can open the full trace
}

type SourceResult = {
  key: string;
  label: string;
  available: boolean;
  total: number;
  active: number;
  today: number;
  revenueTodayIls: number;
  reason?: string;
  rows: NormalizedBooking[];
  // KPIs (today count, today revenue, active-now count) are computed via SQL
  // aggregates over the FULL dataset — NOT derived from the capped `rows`
  // feed. This flag says whether the aggregate query succeeded; when false
  // the UI-level numbers may only reflect the capped recent rows.
  aggregatesFromDb: boolean;
};

function startOfTodayIsrael(): Date {
  // The UI labels this "today" (היום), so it must be the Israel civil day,
  // not the UTC day. A UTC cutoff would count bookings from 00:00-03:00 IL
  // (which are still yesterday's UTC day) as "yesterday" in the KPIs.
  // Build the Asia/Jerusalem YYYY-MM-DD, then re-parse as start-of-day at
  // the current IL offset.
  const now = new Date();
  const ilDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  // en-CA yields YYYY-MM-DD. Compute the current IL offset (in minutes) from
  // the difference between UTC and Asia/Jerusalem for `now`, then treat
  // 00:00 IL as (00:00 UTC minus offset).
  const ilNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const offsetMs = ilNow.getTime() - now.getTime();
  // Midnight IL on `ilDate` in UTC = midnight-in-that-date-treated-as-UTC minus offset.
  const midnightUtc = new Date(`${ilDate}T00:00:00.000Z`);
  return new Date(midnightUtc.getTime() - offsetMs);
}

router.get('/', async (_req: Request, res: Response) => {
  const since = startOfTodayIsrael();
  const sources: SourceResult[] = [];

  // ── Source 1: unified `bookings` table (K9000 wash, shop, unified flows) ─────
  try {
    const [rows, agg] = await Promise.all([
      db.select({
        refId: bookings.bookingNumber,
        platformId: bookings.platformId,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        total: bookings.total,
        userId: bookings.userId,
        providerId: bookings.providerId,
        createdAt: bookings.createdAt,
      }).from(bookings).orderBy(desc(bookings.createdAt)).limit(200),
      db.select({
        totalRows:     sql<number>`count(*)::int`,
        todayCount:    sql<number>`count(*) filter (where ${bookings.createdAt} >= ${since})::int`,
        todayRevenue:  sql<number>`coalesce(sum(${bookings.total}) filter (where ${bookings.createdAt} >= ${since}), 0)::float`,
        activeCount:   sql<number>`count(*) filter (where lower(${bookings.status}) = any(${ACTIVE_STATUSES}::text[]))::int`,
      }).from(bookings),
    ]);
    const norm: NormalizedBooking[] = rows.map((b) => ({
      platform: 'PetWash (unified)',
      platformKey: b.platformId || 'unified',
      refId: b.refId,
      status: b.status,
      paymentStatus: b.paymentStatus ?? null,
      amountIls: Number(b.total ?? 0),
      customerId: b.userId ?? null,
      providerId: b.providerId ?? null,
      createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
      traceUrl: `/booking-trace/${b.refId}`,
    }));
    sources.push(summarizeWithAgg('unified', 'PetWash (unified)', norm, agg[0]));
  } catch (err: any) {
    logger.error('[LiveOps] unified bookings source failed', { error: err?.message });
    sources.push({ key: 'unified', label: 'PetWash (unified)', available: false, total: 0, active: 0, today: 0, revenueTodayIls: 0, reason: 'bookings table not reachable', rows: [], aggregatesFromDb: false });
  }

  // ── Source 2: pet-sitting (sitter_bookings) ─────────────────────────────────
  try {
    const [rows, agg] = await Promise.all([
      db.select({
        refId: sitterBookings.bookingId,
        status: sitterBookings.status,
        paymentStatus: sitterBookings.paymentStatus,
        cents: sitterBookings.totalChargeCents,
        ownerId: sitterBookings.ownerId,
        sitterId: sitterBookings.sitterId,
        createdAt: sitterBookings.createdAt,
      }).from(sitterBookings).orderBy(desc(sitterBookings.createdAt)).limit(200),
      db.select({
        totalRows:    sql<number>`count(*)::int`,
        todayCount:   sql<number>`count(*) filter (where ${sitterBookings.createdAt} >= ${since})::int`,
        todayRevenue: sql<number>`coalesce(sum(${sitterBookings.totalChargeCents}) filter (where ${sitterBookings.createdAt} >= ${since}), 0)::float / 100.0`,
        activeCount:  sql<number>`count(*) filter (where lower(${sitterBookings.status}) = any(${ACTIVE_STATUSES}::text[]))::int`,
      }).from(sitterBookings),
    ]);
    const norm: NormalizedBooking[] = rows.map((b) => ({
      platform: 'Pet Sitting',
      platformKey: 'sitter-suite',
      refId: b.refId,
      status: b.status ?? 'pending',
      paymentStatus: b.paymentStatus ?? null,
      amountIls: Math.round((b.cents ?? 0)) / 100,
      customerId: b.ownerId ?? null,
      providerId: b.sitterId != null ? String(b.sitterId) : null,
      createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
      traceUrl: null,
    }));
    sources.push(summarizeWithAgg('sitter-suite', 'Pet Sitting', norm, agg[0]));
  } catch (err: any) {
    logger.error('[LiveOps] sitter source failed', { error: err?.message });
    sources.push({ key: 'sitter-suite', label: 'Pet Sitting', available: false, total: 0, active: 0, today: 0, revenueTodayIls: 0, reason: 'sitter_bookings not reachable', rows: [], aggregatesFromDb: false });
  }

  // ── Source 3: dog-walking (walk_bookings) ───────────────────────────────────
  try {
    const [rows, agg] = await Promise.all([
      db.select({
        refId: walkBookings.bookingId,
        status: walkBookings.status,
        totalCost: walkBookings.totalCost,
        ownerId: walkBookings.ownerId,
        walkerId: walkBookings.walkerId,
        createdAt: walkBookings.createdAt,
      }).from(walkBookings).orderBy(desc(walkBookings.createdAt)).limit(200),
      db.select({
        totalRows:    sql<number>`count(*)::int`,
        todayCount:   sql<number>`count(*) filter (where ${walkBookings.createdAt} >= ${since})::int`,
        todayRevenue: sql<number>`coalesce(sum(${walkBookings.totalCost}) filter (where ${walkBookings.createdAt} >= ${since}), 0)::float`,
        activeCount:  sql<number>`count(*) filter (where lower(${walkBookings.status}) = any(${ACTIVE_STATUSES}::text[]))::int`,
      }).from(walkBookings),
    ]);
    const norm: NormalizedBooking[] = rows.map((b) => ({
      platform: 'Dog Walking',
      platformKey: 'walk-my-pet',
      refId: b.refId,
      status: b.status ?? 'pending',
      paymentStatus: null,
      amountIls: Number(b.totalCost ?? 0),
      customerId: b.ownerId ?? null,
      providerId: b.walkerId ?? null,
      createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
      traceUrl: null,
    }));
    sources.push(summarizeWithAgg('walk-my-pet', 'Dog Walking', norm, agg[0]));
  } catch (err: any) {
    logger.error('[LiveOps] walk source failed', { error: err?.message });
    sources.push({ key: 'walk-my-pet', label: 'Dog Walking', available: false, total: 0, active: 0, today: 0, revenueTodayIls: 0, reason: 'walk_bookings not reachable', rows: [], aggregatesFromDb: false });
  }

  // ── Source 4: marketplace requests (booking_requests: trainer/driver/etc.) ───
  try {
    const [rows, agg] = await Promise.all([
      db.select({
        refId: bookingRequests.requestId,
        providerType: bookingRequests.providerType,
        serviceType: bookingRequests.serviceType,
        status: bookingRequests.status,
        cents: bookingRequests.totalCents,
        ownerId: bookingRequests.ownerId,
        providerId: bookingRequests.providerId,
        createdAt: bookingRequests.createdAt,
      }).from(bookingRequests).orderBy(desc(bookingRequests.createdAt)).limit(200),
      db.select({
        totalRows:    sql<number>`count(*)::int`,
        todayCount:   sql<number>`count(*) filter (where ${bookingRequests.createdAt} >= ${since})::int`,
        todayRevenue: sql<number>`coalesce(sum(${bookingRequests.totalCents}) filter (where ${bookingRequests.createdAt} >= ${since}), 0)::float / 100.0`,
        activeCount:  sql<number>`count(*) filter (where lower(${bookingRequests.status}) = any(${ACTIVE_STATUSES}::text[]))::int`,
      }).from(bookingRequests),
    ]);
    const norm: NormalizedBooking[] = rows.map((b) => ({
      platform: `Marketplace — ${b.providerType ?? b.serviceType ?? 'request'}`,
      platformKey: 'booking-requests',
      refId: b.refId,
      status: String(b.status ?? 'pending'),
      paymentStatus: null,
      amountIls: Math.round((b.cents ?? 0)) / 100,
      customerId: b.ownerId ?? null,
      providerId: b.providerId ?? null,
      createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
      traceUrl: null,
    }));
    sources.push(summarizeWithAgg('booking-requests', 'Marketplace requests', norm, agg[0]));
  } catch (err: any) {
    logger.error('[LiveOps] booking_requests source failed', { error: err?.message });
    sources.push({ key: 'booking-requests', label: 'Marketplace requests', available: false, total: 0, active: 0, today: 0, revenueTodayIls: 0, reason: 'booking_requests not reachable', rows: [], aggregatesFromDb: false });
  }

  // ── Open alerts (traffic light) ─────────────────────────────────────────────
  let openAlerts = 0;
  let criticalAlerts = 0;
  let alertsAvailable = true;
  try {
    const [{ open, critical }] = await db
      .select({
        open: sql<number>`count(*) filter (where ${adminAlerts.status} in ('open','acknowledged'))`,
        critical: sql<number>`count(*) filter (where ${adminAlerts.status} in ('open','acknowledged') and ${adminAlerts.severity} = 'critical')`,
      })
      .from(adminAlerts);
    openAlerts = Number(open ?? 0);
    criticalAlerts = Number(critical ?? 0);
  } catch (err: any) {
    logger.error('[LiveOps] alerts count failed', { error: err?.message });
    alertsAvailable = false;
  }

  // ── Roll-up KPIs across all sources ─────────────────────────────────────────
  const kpis = {
    bookingsToday: sources.reduce((s, x) => s + x.today, 0),
    revenueTodayIls: Math.round(sources.reduce((s, x) => s + x.revenueTodayIls, 0) * 100) / 100,
    activeNow: sources.reduce((s, x) => s + x.active, 0),
    openAlerts,
    criticalAlerts,
    alertsAvailable,
  };

  // ── Merged recent activity feed (latest 50 across all sources) ──────────────
  const recent = sources
    .flatMap((s) => s.rows)
    .filter((r) => r.createdAt)
    .sort((a, b) => (a.createdAt! < b.createdAt! ? 1 : -1))
    .slice(0, 50);

  res.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    kpis,
    platforms: sources.map(({ rows, ...meta }) => meta), // per-platform tiles (no row dump)
    recent,
    links: {
      money: '/admin/payments',
      alerts: '/admin/alerts',
      health: '/admin/ops-monitor',
    },
  });
});

function summarizeWithAgg(
  key: string,
  label: string,
  rows: NormalizedBooking[],
  agg: { totalRows: number; todayCount: number; todayRevenue: number; activeCount: number } | undefined,
): SourceResult {
  // KPIs come from the SQL aggregate (whole dataset). The `rows` array is only
  // the capped tail for the activity feed. Before this the "today" numbers
  // were counted off the capped rows, silently under-reporting for any table
  // with > 200 rows in the window (audit CRIT #7).
  if (agg) {
    return {
      key,
      label,
      available: true,
      total: Number(agg.totalRows ?? 0),
      active: Number(agg.activeCount ?? 0),
      today: Number(agg.todayCount ?? 0),
      revenueTodayIls: Math.round(Number(agg.todayRevenue ?? 0) * 100) / 100,
      rows,
      aggregatesFromDb: true,
    };
  }
  // Fallback: aggregate query returned nothing — degrade to row-derived numbers.
  return {
    key,
    label,
    available: true,
    total: rows.length,
    active: rows.filter((r) => ACTIVE_STATUSES.includes((r.status || '').toLowerCase())).length,
    today: 0,
    revenueTodayIls: 0,
    rows,
    aggregatesFromDb: false,
  };
}

export default router;
