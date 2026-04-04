/**
 * server/routes/case-reports.ts
 * Phase 12.11 — Case Performance Reporting
 *
 * Mounted at /api/reports
 *
 * GET /case-performance  — operational metrics by handler + team
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';
import { timingSafeAdminSecretMatch } from '../middleware/adminAuth';

const router = Router();
const ADMIN_SEC = process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET;

const toNum = (v: unknown): number => Number(v ?? 0);
const toStr = (v: unknown): string => v != null ? String(v) : '';

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (timingSafeAdminSecretMatch(req)) {
      (req as any).callerRole = 'admin';
      return next();
    }
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'authentication_required' });
    const decoded = await auth.verifyIdToken(authHeader.slice(7), true);
    if (!decoded.admin) {
      const foRows = await db.execute(sql`
        SELECT id FROM franchise_owners WHERE owner_user_id = ${decoded.uid} AND status = 'active'
      `);
      if (!foRows.rows.length) return res.status(403).json({ error: 'access_denied' });
    }
    (req as any).callerRole = 'admin';
    return next();
  } catch (err: any) {
    return res.status(401).json({ error: 'authentication_failed' });
  }
}

// ─── GET /case-performance ────────────────────────────────────────────────────

router.get('/case-performance', requireAuth, async (req: Request, res: Response) => {
  try {
    // ── Per-handler stats ──────────────────────────────────────────────────
    const handlerRows = await db.execute(sql`
      WITH all_assignments AS (
        SELECT
          ca.assigned_to_uid                              AS handler_uid,
          ca.case_type,
          ca.is_active,
          ca.assigned_at,
          -- resolve closed time from dispute/etc
          CASE
            WHEN ca.case_type = 'dispute' THEN (
              SELECT bd.resolved_at FROM booking_disputes bd
              WHERE bd.id::text = ca.case_ref_id LIMIT 1
            )
            ELSE NULL
          END                                             AS resolved_at
        FROM case_assignments ca
        WHERE ca.assigned_to_uid IS NOT NULL
      ),
      handler_stats AS (
        SELECT
          handler_uid,
          COUNT(*)::int                                   AS total_handled,
          COUNT(CASE WHEN is_active = true THEN 1 END)::int  AS currently_owned,
          COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END)::int AS resolved_count,
          AVG(
            CASE WHEN resolved_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (resolved_at - assigned_at)) / 3600
            END
          )                                               AS avg_resolution_hours
        FROM all_assignments
        GROUP BY handler_uid
      ),
      breach_stats AS (
        SELECT
          ca.assigned_to_uid                              AS handler_uid,
          COUNT(CASE WHEN css.sla_status = 'breached' THEN 1 END)::int AS breached_count,
          COUNT(*)::int                                   AS total_with_sla
        FROM case_assignments ca
        JOIN case_sla_states css
          ON css.case_type  = ca.case_type
         AND css.case_ref_id = ca.case_ref_id
        WHERE ca.assigned_to_uid IS NOT NULL
        GROUP BY ca.assigned_to_uid
      ),
      reopen_stats AS (
        SELECT
          cel.from_uid                                    AS handler_uid,
          COUNT(*)::int                                   AS reopen_count
        FROM case_escalation_log cel
        WHERE cel.event_type = 'reopened'
          AND cel.from_uid IS NOT NULL
        GROUP BY cel.from_uid
      ),
      approval_stats AS (
        SELECT
          ca.assigned_to_uid                              AS handler_uid,
          COUNT(CASE WHEN bd.closure_requested = true THEN 1 END)::int  AS closure_requested,
          COUNT(CASE WHEN bd.closure_approved  = true THEN 1 END)::int  AS closure_approved
        FROM case_assignments ca
        JOIN booking_disputes bd ON bd.id::text = ca.case_ref_id AND ca.case_type = 'dispute'
        WHERE ca.assigned_to_uid IS NOT NULL
        GROUP BY ca.assigned_to_uid
      )
      SELECT
        hs.handler_uid,
        tm.name   AS team_name,
        tm2.role  AS team_role,
        hs.total_handled,
        hs.currently_owned,
        hs.resolved_count,
        ROUND(hs.avg_resolution_hours::numeric, 1)       AS avg_resolution_hours,
        COALESCE(bs.breached_count, 0)                   AS breached_count,
        COALESCE(bs.total_with_sla, 0)                   AS total_with_sla,
        COALESCE(rs.reopen_count, 0)                     AS reopen_count,
        COALESCE(as2.closure_requested, 0)               AS closure_requested,
        COALESCE(as2.closure_approved, 0)                AS closure_approved
      FROM handler_stats hs
      LEFT JOIN team_members tm2 ON tm2.user_uid = hs.handler_uid
      LEFT JOIN teams tm ON tm.id = tm2.team_id
      LEFT JOIN breach_stats bs   ON bs.handler_uid  = hs.handler_uid
      LEFT JOIN reopen_stats rs   ON rs.handler_uid  = hs.handler_uid
      LEFT JOIN approval_stats as2 ON as2.handler_uid = hs.handler_uid
      ORDER BY hs.total_handled DESC
      LIMIT 100
    `);

    const byHandler = (handlerRows.rows as any[]).map(r => ({
      handlerUid:           toStr(r.handler_uid),
      teamName:             r.team_name ? toStr(r.team_name) : null,
      teamRole:             r.team_role ? toStr(r.team_role) : null,
      totalHandled:         toNum(r.total_handled),
      currentlyOwned:       toNum(r.currently_owned),
      resolvedCount:        toNum(r.resolved_count),
      avgResolutionHours:   r.avg_resolution_hours != null ? Number(r.avg_resolution_hours) : null,
      breachedCount:        toNum(r.breached_count),
      slaBreachRate:        toNum(r.total_with_sla) > 0
        ? Math.round((toNum(r.breached_count) / toNum(r.total_with_sla)) * 100)
        : 0,
      reopenCount:          toNum(r.reopen_count),
      closureRequested:     toNum(r.closure_requested),
      closureApproved:      toNum(r.closure_approved),
      closureApprovalRate:  toNum(r.closure_requested) > 0
        ? Math.round((toNum(r.closure_approved) / toNum(r.closure_requested)) * 100)
        : null,
    }));

    // ── Per-team stats ─────────────────────────────────────────────────────
    const teamRows = await db.execute(sql`
      SELECT
        t.id                                              AS team_id,
        t.name                                            AS team_name,
        t.type                                            AS team_type,
        COUNT(DISTINCT tm.user_uid)::int                  AS member_count,
        COUNT(DISTINCT ca.id)::int                        AS total_assignments,
        COUNT(DISTINCT CASE WHEN ca.is_active THEN ca.id END)::int AS active_assignments,
        COUNT(DISTINCT CASE WHEN css.sla_status = 'breached' THEN css.case_ref_id END)::int AS breached_cases
      FROM teams t
      LEFT JOIN team_members tm ON tm.team_id = t.id
      LEFT JOIN case_assignments ca ON ca.assigned_to_uid = tm.user_uid
      LEFT JOIN case_sla_states css
        ON css.case_type  = ca.case_type
       AND css.case_ref_id = ca.case_ref_id
      GROUP BY t.id, t.name, t.type
      ORDER BY t.name
    `);

    const byTeam = (teamRows.rows as any[]).map(r => ({
      teamId:            toNum(r.team_id),
      teamName:          toStr(r.team_name),
      teamType:          toStr(r.team_type),
      memberCount:       toNum(r.member_count),
      totalAssignments:  toNum(r.total_assignments),
      activeAssignments: toNum(r.active_assignments),
      breachedCases:     toNum(r.breached_cases),
    }));

    res.json({ byHandler, byTeam });
  } catch (err: any) {
    logger.error('[CaseReports] performance error', { error: err.message });
    res.status(500).json({ error: 'report_error' });
  }
});

export default router;
