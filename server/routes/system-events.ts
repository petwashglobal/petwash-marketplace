/**
 * /api/admin/system-events
 *
 * Query and resolve stamped system events.
 * Secured by RBAC — super-admin only.
 */

import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { requireSuperAdmin } from '../middleware/gates';
import { SystemEventService } from '../services/SystemEventService';
import { logger } from '../lib/logger';

const router = Router();

/* ── GET /api/admin/system-events ──────────────────────────────────────── */
router.get('/', requireSuperAdmin, async (req, res) => {
  try {
    const limit     = Math.min(parseInt(String(req.query.limit  ?? '200'), 10), 1000);
    const severity  = req.query.severity  as string | undefined;
    const source    = req.query.source    as string | undefined;
    const platform  = req.query.platform  as string | undefined;
    const unresolved = req.query.unresolved === 'true';
    const since     = req.query.since ? new Date(req.query.since as string) : undefined;

    const events = await db.execute(sql`
      SELECT
        id, event_type, severity, source, platform,
        message, detail, booking_id, user_uid, provider_uid,
        resolved, resolved_at, resolved_by, created_at
      FROM system_events
      WHERE
        (${severity ?? null}::text  IS NULL OR severity  = ${severity  ?? null})
        AND (${source   ?? null}::text  IS NULL OR source    = ${source   ?? null})
        AND (${platform ?? null}::text  IS NULL OR platform  = ${platform ?? null})
        AND (NOT ${unresolved} OR resolved = FALSE)
        AND (${since ? since.toISOString() : null}::timestamptz IS NULL OR created_at >= ${since ? since.toISOString() : null}::timestamptz)
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    /* Summary counts */
    const summary = await db.execute(sql`
      SELECT
        severity,
        COUNT(*) AS total,
        SUM(CASE WHEN resolved = FALSE THEN 1 ELSE 0 END) AS unresolved
      FROM system_events
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY severity
      ORDER BY severity
    `);

    res.json({
      events:  events.rows,
      summary: summary.rows,
      meta: { limit, severity, source, platform, unresolved, since },
    });
  } catch (err: any) {
    logger.error('[SystemEvents] GET failed', { error: err?.message });
    res.status(500).json({ error: 'Failed to fetch system events' });
  }
});

/* ── POST /api/admin/system-events/:id/resolve ─────────────────────────── */
router.post('/:id/resolve', requireSuperAdmin, async (req, res) => {
  try {
    const id        = parseInt(req.params.id, 10);
    const resolvedBy = (req as any).user?.uid ?? 'admin';

    await SystemEventService.resolve(id, resolvedBy);
    res.json({ ok: true, id, resolvedBy });
  } catch (err: any) {
    logger.error('[SystemEvents] RESOLVE failed', { error: err?.message });
    res.status(500).json({ error: 'Failed to resolve event' });
  }
});

/* ── POST /api/admin/system-events/resolve-bulk ────────────────────────── */
router.post('/resolve-bulk', requireSuperAdmin, async (req, res) => {
  try {
    const { ids, severity, source } = req.body as {
      ids?: number[];
      severity?: string;
      source?: string;
    };
    const resolvedBy = (req as any).user?.uid ?? 'admin';

    if (ids?.length) {
      await db.execute(sql`
        UPDATE system_events
        SET resolved = TRUE, resolved_at = NOW(), resolved_by = ${resolvedBy}
        WHERE id = ANY(${ids}::bigint[])
      `);
      return res.json({ ok: true, resolved: ids.length });
    }

    if (severity || source) {
      const result = await db.execute(sql`
        UPDATE system_events
        SET resolved = TRUE, resolved_at = NOW(), resolved_by = ${resolvedBy}
        WHERE resolved = FALSE
          AND (${severity ?? null}::text IS NULL OR severity = ${severity ?? null})
          AND (${source   ?? null}::text IS NULL OR source   = ${source   ?? null})
      `);
      return res.json({ ok: true, resolved: (result as any).rowCount ?? 0 });
    }

    res.status(400).json({ error: 'Provide ids[], severity, or source to resolve' });
  } catch (err: any) {
    logger.error('[SystemEvents] RESOLVE-BULK failed', { error: err?.message });
    res.status(500).json({ error: 'Failed to bulk-resolve events' });
  }
});

/* ── GET /api/admin/system-events/live ─────────────────────────────────── */
/* Last 50 unresolved critical/error events — for live admin dashboard */
router.get('/live', requireSuperAdmin, async (req, res) => {
  try {
    const events = await db.execute(sql`
      SELECT id, event_type, severity, source, platform, message, booking_id, created_at
      FROM system_events
      WHERE resolved = FALSE
        AND severity IN ('critical', 'error', 'warn')
        AND created_at >= NOW() - INTERVAL '6 hours'
      ORDER BY
        CASE severity WHEN 'critical' THEN 1 WHEN 'error' THEN 2 ELSE 3 END,
        created_at DESC
      LIMIT 50
    `);
    res.json({ events: events.rows, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch live events' });
  }
});

export default router;
