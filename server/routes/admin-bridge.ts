/**
 * PetWash Bridge — read-only admin/operator cockpit (MVP).
 *
 * The Bridge is the internal control panel over the PetWash operating system
 * for Nir and (later) the office manager. This MVP is intentionally READ-ONLY:
 * no mutations, no destructive actions, no writes to HubSpot or the DB from the
 * UI. Every queue view is audited via logAuditEvent.
 *
 * Flag: BRIDGE_MVP_ENABLED (server) — env keys cannot contain dots, so the
 * requested `ff.bridge.mvp.enabled` is realised as BRIDGE_MVP_ENABLED here and
 * VITE_BRIDGE_MVP_ENABLED on the client route gate. Defaults OFF.
 *
 * Mounted at /api/admin/bridge behind validateFirebaseToken + adminLimiter +
 * requireAdmin (see server/routes.ts), inheriting the global /api/admin guard
 * chain (requireRole + requireStaffApproved + requireMfaEnrolled).
 *
 * Panels:
 *   - providerApplications  WIRED — reuses AdminProviderReviewService.
 *   - bookingIntake         placeholder — admin booking-list endpoint pending (PR-2).
 *   - customerLookup        placeholder — admin user-search endpoint pending (PR-2).
 *   - hubspotTasks          placeholder — HubSpot integration is write-only today;
 *                           no read path / no local mirror (blocker, see reason).
 *   - alerts                placeholder — station_alerts feed not wired into Bridge yet.
 *   - auditEvents           placeholder — domain_events feed not wired into Bridge yet.
 */

import { Router, type Request, type Response } from 'express';
import { desc, ilike, or, and, gte, inArray } from 'drizzle-orm';
import { db } from '../db';
import { bookings, users, auditEvents } from '@shared/schema';
import { requireAdmin } from '../adminAuth';
import { adminProviderReviewService } from '../services/AdminProviderReviewService';
import { logAuditEvent } from '../middleware/auditLogger';
import { logger } from '../lib/logger';

const BRIDGE_MVP_ENABLED = process.env.BRIDGE_MVP_ENABLED === 'true';

type Wired<T> = ({ wired: true } & T) | { wired: false; reason: string };

const router = Router();

// Feature gate: when the flag is off, the cockpit does not exist.
router.use((_req: Request, res: Response, next) => {
  if (!BRIDGE_MVP_ENABLED) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  next();
});

// Every route is admin-gated (defence in depth on top of the global chain).
router.use(requireAdmin);

/**
 * GET /api/admin/bridge/summary
 * Single read-only fetch powering the cockpit. Read-only by contract.
 */
router.get('/summary', async (req: Request, res: Response) => {
  const actor = (req as any).user || {};

  // Audit the view (fire-and-forget — never block the read on the audit write).
  logAuditEvent(req, 'bridge.summary.viewed', { type: 'bridge', id: 'summary' }, {
    actorUid: actor.uid,
    actorEmail: actor.email,
  }).catch((err) => logger.error('[Bridge] audit log failed', err));

  // Panel 1 — Provider applications queue (WIRED, reuses existing service).
  let providerApplications: Wired<{
    stats: { total: number; pending: number; underReview: number; approved: number; rejected: number; onHold: number };
    recent: Array<{
      id: number;
      providerId: string;
      platform: string;
      status: string;
      priority: string;
      createdAt: string | null;
    }>;
    reviewPath: string;
  }>;
  try {
    const [stats, queue] = await Promise.all([
      adminProviderReviewService.getQueueStatistics(),
      adminProviderReviewService.getQueue(undefined, undefined, 10),
    ]);
    providerApplications = {
      wired: true,
      stats: {
        total: stats.total,
        pending: stats.pending,
        underReview: stats.underReview,
        approved: stats.approved,
        rejected: stats.rejected,
        onHold: stats.onHold,
      },
      recent: queue.map((q) => ({
        id: q.id,
        providerId: q.providerId,
        platform: q.platform,
        status: q.status ?? 'pending',
        priority: q.priority ?? 'normal',
        createdAt: q.createdAt ? new Date(q.createdAt).toISOString() : null,
      })),
      reviewPath: '/admin/provider-review',
    };
  } catch (err: any) {
    logger.error('[Bridge] provider applications panel failed', { error: err?.message ?? String(err) });
    providerApplications = { wired: false, reason: 'provider_approval_queue not reachable' };
  }

  // Panel 2 — Booking intake queue (WIRED, read-only over the bookings table).
  let bookingIntake: Wired<{
    recent: Array<{
      id: string;
      bookingNumber: string;
      userId: string;
      providerId: string | null;
      status: string;
      paymentStatus: string | null;
      total: string;
      currency: string | null;
      startTime: string | null;
      createdAt: string | null;
    }>;
    tracePathPrefix: string;
  }>;
  try {
    const rows = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        userId: bookings.userId,
        providerId: bookings.providerId,
        status: bookings.status,
        paymentStatus: bookings.paymentStatus,
        total: bookings.total,
        currency: bookings.currency,
        startTime: bookings.startTime,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .orderBy(desc(bookings.createdAt))
      .limit(10);
    bookingIntake = {
      wired: true,
      recent: rows.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        userId: b.userId,
        providerId: b.providerId ?? null,
        status: b.status,
        paymentStatus: b.paymentStatus ?? null,
        total: b.total,
        currency: b.currency ?? 'ILS',
        startTime: b.startTime ? new Date(b.startTime).toISOString() : null,
        createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
      })),
      tracePathPrefix: '/booking-trace/',
    };
  } catch (err: any) {
    logger.error('[Bridge] booking intake panel failed', { error: err?.message ?? String(err) });
    bookingIntake = { wired: false, reason: 'bookings table not reachable' };
  }

  // Panels 3,5,6 — honest placeholders. No fabricated data (platform §2: no fake data).
  // (customer lookup is a search-driven panel served by GET /lookup, below.)
  const hubspotTasks: Wired<never> = {
    wired: false,
    reason: 'HubSpot integration is write-only (contacts + notes); no task read path and no local hubspot_* mirror. Blocker: needs id persistence + read endpoint.',
  };
  const alerts: Wired<never> = {
    wired: false,
    reason: 'Placeholder — station_alerts / domain_events alert feed not wired into Bridge yet.',
  };
  const auditEvents: Wired<never> = {
    wired: false,
    reason: 'Placeholder — domain_events audit feed not wired into Bridge yet.',
  };

  res.json({
    generatedAt: new Date().toISOString(),
    readOnly: true,
    providerApplications,
    bookingIntake,
    hubspotTasks,
    alerts,
    auditEvents,
  });
});

/**
 * GET /api/admin/bridge/lookup?q=<term>
 * Read-only customer/contact search by email, phone, first/last name.
 * Requires a search term (no bulk dump). Every search is audited.
 */
router.get('/lookup', async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) {
    return res.status(400).json({ error: 'QUERY_TOO_SHORT', message: 'Provide at least 2 characters.' });
  }

  const actor = (req as any).user || {};
  logAuditEvent(req, 'bridge.customer.lookup', { type: 'user_search', id: q.slice(0, 64) }, {
    actorUid: actor.uid,
    actorEmail: actor.email,
  }).catch((err) => logger.error('[Bridge] audit log failed', err));

  try {
    const like = `%${q}%`;
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        firstName: users.firstName,
        lastName: users.lastName,
        city: users.city,
        loyaltyTier: users.loyaltyTier,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(or(
        ilike(users.email, like),
        ilike(users.phone, like),
        ilike(users.firstName, like),
        ilike(users.lastName, like),
      ))
      .limit(20);

    res.json({
      query: q,
      count: rows.length,
      results: rows.map((u) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        firstName: u.firstName,
        lastName: u.lastName,
        city: u.city,
        loyaltyTier: u.loyaltyTier,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
      })),
    });
  } catch (err: any) {
    logger.error('[Bridge] customer lookup failed', { error: err?.message ?? String(err) });
    res.status(500).json({ error: 'LOOKUP_FAILED', message: String(err?.message ?? err).slice(0, 200) });
  }
});

/**
 * GET /api/admin/bridge/signup-activity?hours=24&limit=200
 * Read-only signup/login funnel from audit_events (the SIGNUP_* actionTypes
 * emitted by the auth flow). Powers the Bridge "Signup Activity" panel so Nir
 * can see new signups, failures, and OTP problems. No mutations.
 */
router.get('/signup-activity', async (req: Request, res: Response) => {
  const actor = (req as any).user || {};
  logAuditEvent(req, 'bridge.signup_activity.viewed', { type: 'bridge', id: 'signup-activity' }, {
    actorUid: actor.uid,
    actorEmail: actor.email,
  }).catch((err) => logger.error('[Bridge] audit log failed', err));

  try {
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 720);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const SIGNUP_ACTIONS = ['SIGNUP_OTP_SENT', 'SIGNUP_AUTH_VERIFIED', 'SIGNUP_SESSION_CREATED', 'SIGNUP_FAILED'];

    const rows = await db
      .select()
      .from(auditEvents)
      .where(and(inArray(auditEvents.actionType, SIGNUP_ACTIONS), gte(auditEvents.createdAt, since)))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);

    const count = (t: string) => rows.filter((r) => r.actionType === t).length;
    res.json({
      since: since.toISOString(),
      hours,
      count: rows.length,
      summary: {
        otpSent: count('SIGNUP_OTP_SENT'),
        verified: count('SIGNUP_AUTH_VERIFIED'),
        sessionsCreated: count('SIGNUP_SESSION_CREATED'),
        failed: count('SIGNUP_FAILED'),
        newSignups: rows.filter(
          (r) => r.actionType === 'SIGNUP_SESSION_CREATED' && (r.metadata as any)?.isNewUser === true,
        ).length,
      },
      events: rows.map((r) => ({
        id: r.id,
        actionType: r.actionType,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
        actorUserId: r.actorUserId,
        ip: r.ip,
        severity: r.severity,
        metadata: r.metadata,
      })),
    });
  } catch (err: any) {
    logger.error('[Bridge] signup-activity failed', { error: err?.message ?? String(err) });
    res.status(500).json({ error: 'SIGNUP_ACTIVITY_FAILED', message: String(err?.message ?? err).slice(0, 200) });
  }
});

export default router;
