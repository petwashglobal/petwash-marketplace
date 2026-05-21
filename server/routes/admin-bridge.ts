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

  // Panels 2–6 — honest placeholders. No fabricated data (platform §2: no fake data).
  const bookingIntake: Wired<never> = {
    wired: false,
    reason: 'No admin booking-list endpoint yet — read-only GET over bookings table pending (PR-2).',
  };
  const customerLookup: Wired<never> = {
    wired: false,
    reason: 'No admin user-search endpoint yet — read-only GET over users table pending (PR-2).',
  };
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
    customerLookup,
    hubspotTasks,
    alerts,
    auditEvents,
  });
});

export default router;
