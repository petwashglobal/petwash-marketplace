/**
 * server/routes/manager.ts
 * Phase 12.12 — Manager Control & Operational Reporting
 *
 * Mounted at /api/manager
 *
 * GET /approvals            — T121: pending closure approvals queue
 * GET /sla-breaches         — T122: SLA breach view grouped by user/team/station
 * GET /workload             — T123: per-user and per-team workload heatmap
 * GET /resolution-analytics — T124: resolution code breakdown by team/station/franchise
 * GET /reopen-stats         — T125: reopen rate per handler + per reopen_code
 * GET /performance-comparison — T126: avg resolution time, breach rate, reopen rate by station/franchise/team
 *
 * Auth: admin (x-admin-secret or decoded.admin) OR active franchise_owner
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth } from '../lib/firebase-admin';
import { isValidAdminSecret } from '../lib/admin-secret';

const router = Router();

const toNum  = (v: unknown): number  => Number(v ?? 0);
const toStr  = (v: unknown): string  => v != null ? String(v) : '';
const toFlt  = (v: unknown): number  => v != null ? parseFloat(String(v)) : 0;

// ─── Auth middleware ───────────────────────────────────────────────────────────

async function requireManager(req: Request, res: Response, next: NextFunction) {
  try {
    if (isValidAdminSecret(req)) {
      (req as any).callerRole = 'admin';
      return next();
    }
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'authentication_required' });
    const decoded = await auth.verifyIdToken(header.slice(7), true);
    if (decoded.admin) {
      (req as any).callerRole = 'admin';
      return next();
    }
    // Accept active franchise_owner OR team manager
    const foRows = await db.execute(sql`
      SELECT id FROM franchise_owners WHERE owner_user_id = ${decoded.uid} AND status = 'active'
    `);
    if (foRows.rows.length) {
      (req as any).callerRole = 'franchise_owner';
      (req as any).callerUid  = decoded.uid;
      return next();
    }
    const tmRows = await db.execute(sql`
      SELECT id FROM team_members WHERE user_uid = ${decoded.uid} AND role = 'manager' LIMIT 1
    `);
    if (tmRows.rows.length) {
      (req as any).callerRole = 'team_manager';
      (req as any).callerUid  = decoded.uid;
      return next();
    }
    return res.status(403).json({ error: 'manager_access_required' });
  } catch (err: any) {
    return res.status(401).json({ error: 'authentication_failed' });
  }
}

// ─── T121 GET /approvals ──────────────────────────────────────────────────────
/**
 * Disputes where closure_requested = true and not yet approved.
 * Sorted oldest-first so most-urgent appear at top.
 */
router.get('/approvals', requireManager, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        d.id                                                        AS dispute_id,
        d.booking_id,
        b.booking_number,
        s.name                                                      AS station_name,
        ca.assigned_to_uid                                         AS handler_uid,
        ca.assigned_team_id                                        AS team_id,
        t.name                                                      AS team_name,
        d.closure_reason_code,
        rc.label                                                    AS closure_reason_label,
        COALESCE(d.closure_requested_at, d.created_at)             AS requested_at,
        ROUND(
          EXTRACT(EPOCH FROM (NOW() - COALESCE(d.closure_requested_at, d.created_at))) / 3600,
          1
        )                                                           AS age_hours
      FROM booking_disputes d
      LEFT JOIN bookings b       ON b.id = d.booking_id
      LEFT JOIN stations s       ON s.id = b.station_id
      LEFT JOIN case_assignments ca
             ON ca.case_type = 'dispute'
            AND ca.case_ref_id = d.id
            AND ca.is_active = true
      LEFT JOIN teams t          ON t.id = ca.assigned_team_id
      LEFT JOIN resolution_codes rc ON rc.code = d.closure_reason_code
      WHERE d.closure_requested = true
        AND (d.closure_approved = false OR d.closure_approved IS NULL)
        AND d.status != 'closed'
      ORDER BY age_hours DESC
    `);

    const approvals = (rows.rows as any[]).map(r => ({
      disputeId:          toStr(r.dispute_id),
      bookingId:          toStr(r.booking_id),
      bookingNumber:      toStr(r.booking_number),
      stationName:        toStr(r.station_name),
      handlerUid:         r.handler_uid ? toStr(r.handler_uid) : null,
      teamId:             r.team_id ? toNum(r.team_id) : null,
      teamName:           r.team_name ? toStr(r.team_name) : null,
      closureReasonCode:  toStr(r.closure_reason_code),
      closureReasonLabel: toStr(r.closure_reason_label),
      requestedAt:        r.requested_at ? String(r.requested_at) : null,
      ageHours:           toFlt(r.age_hours),
    }));

    res.json({ approvals, total: approvals.length });
  } catch (err: any) {
    logger.error('[Manager] approvals error', { error: err.message });
    res.status(500).json({ error: 'approvals_fetch_error' });
  }
});

// ─── T122 GET /sla-breaches ───────────────────────────────────────────────────
/**
 * SLA breach summary grouped by user, team, and station.
 * Only active cases with a known SLA state are included.
 */
router.get('/sla-breaches', requireManager, async (_req: Request, res: Response) => {
  try {
    // Per-user breach stats
    const byUserRows = await db.execute(sql`
      SELECT
        ca.assigned_to_uid                                         AS uid,
        COUNT(*)::int                                              AS total_cases,
        COUNT(CASE WHEN ss.sla_status = 'breached' THEN 1 END)::int AS breached_cases,
        ROUND(
          COUNT(CASE WHEN ss.sla_status = 'breached' THEN 1 END)::numeric
          / NULLIF(COUNT(*), 0) * 100,
          1
        )::float                                                   AS breach_rate,
        ROUND(AVG(ss.age_hours)::numeric, 1)::float               AS avg_age_hours
      FROM case_assignments ca
      LEFT JOIN case_sla_states ss
        ON ss.case_type = ca.case_type
       AND ss.case_ref_id = ca.case_ref_id
      WHERE ca.is_active = true
        AND ca.assigned_to_uid IS NOT NULL
      GROUP BY ca.assigned_to_uid
      HAVING COUNT(CASE WHEN ss.sla_status = 'breached' THEN 1 END) > 0
         OR  COUNT(CASE WHEN ss.sla_status = 'at_risk'  THEN 1 END) > 0
      ORDER BY breached_cases DESC, breach_rate DESC
    `);

    // Per-team breach stats
    const byTeamRows = await db.execute(sql`
      SELECT
        t.id                                                       AS team_id,
        t.name                                                     AS team_name,
        COUNT(*)::int                                              AS total_cases,
        COUNT(CASE WHEN ss.sla_status = 'breached' THEN 1 END)::int AS breached_cases,
        ROUND(
          COUNT(CASE WHEN ss.sla_status = 'breached' THEN 1 END)::numeric
          / NULLIF(COUNT(*), 0) * 100,
          1
        )::float                                                   AS breach_rate,
        ROUND(AVG(ss.age_hours)::numeric, 1)::float               AS avg_age_hours
      FROM case_assignments ca
      JOIN case_sla_states ss
        ON ss.case_type = ca.case_type
       AND ss.case_ref_id = ca.case_ref_id
      JOIN teams t ON t.id = ca.assigned_team_id
      WHERE ca.is_active = true
        AND ca.assigned_team_id IS NOT NULL
      GROUP BY t.id, t.name
      ORDER BY breached_cases DESC, breach_rate DESC
    `);

    // Per-station breach stats (dispute cases only, joined through bookings)
    const byStationRows = await db.execute(sql`
      SELECT
        s.id::text                                                 AS station_id,
        s.name                                                     AS station_name,
        COUNT(*)::int                                              AS total_cases,
        COUNT(CASE WHEN ss.sla_status = 'breached' THEN 1 END)::int AS breached_cases,
        ROUND(
          COUNT(CASE WHEN ss.sla_status = 'breached' THEN 1 END)::numeric
          / NULLIF(COUNT(*), 0) * 100,
          1
        )::float                                                   AS breach_rate,
        ROUND(AVG(ss.age_hours)::numeric, 1)::float               AS avg_age_hours
      FROM case_assignments ca
      JOIN case_sla_states ss
        ON ss.case_type = ca.case_type
       AND ss.case_ref_id = ca.case_ref_id
      JOIN booking_disputes d ON d.id = ca.case_ref_id AND ca.case_type = 'dispute'
      JOIN bookings bk ON bk.id = d.booking_id
      JOIN stations s ON s.id = bk.station_id
      WHERE ca.is_active = true
      GROUP BY s.id, s.name
      ORDER BY breached_cases DESC, breach_rate DESC
    `);

    res.json({
      byUser:    (byUserRows.rows as any[]).map(r => ({
        uid:           toStr(r.uid),
        totalCases:    toNum(r.total_cases),
        breachedCases: toNum(r.breached_cases),
        breachRate:    toFlt(r.breach_rate),
        avgAgeHours:   toFlt(r.avg_age_hours),
      })),
      byTeam:    (byTeamRows.rows as any[]).map(r => ({
        teamId:        toNum(r.team_id),
        teamName:      toStr(r.team_name),
        totalCases:    toNum(r.total_cases),
        breachedCases: toNum(r.breached_cases),
        breachRate:    toFlt(r.breach_rate),
        avgAgeHours:   toFlt(r.avg_age_hours),
      })),
      byStation: (byStationRows.rows as any[]).map(r => ({
        stationId:     toStr(r.station_id),
        stationName:   toStr(r.station_name),
        totalCases:    toNum(r.total_cases),
        breachedCases: toNum(r.breached_cases),
        breachRate:    toFlt(r.breach_rate),
        avgAgeHours:   toFlt(r.avg_age_hours),
      })),
    });
  } catch (err: any) {
    logger.error('[Manager] sla-breaches error', { error: err.message });
    res.status(500).json({ error: 'sla_breaches_fetch_error' });
  }
});

// ─── T123 GET /workload ───────────────────────────────────────────────────────
/**
 * Per-user and per-team active workload.
 * Color thresholds: green < 5, yellow 5–10, red > 10 active cases.
 */
router.get('/workload', requireManager, async (_req: Request, res: Response) => {
  try {
    const byUserRows2 = await db.execute(sql`
      SELECT
        ca.assigned_to_uid                                                 AS uid,
        COUNT(*)::int                                                      AS active_cases,
        ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - ca.assigned_at))/3600)::numeric, 1)::float
                                                                           AS avg_age_hours,
        COUNT(CASE WHEN ss.sla_status = 'breached' THEN 1 END)::int       AS breached_count
      FROM case_assignments ca
      LEFT JOIN case_sla_states ss
             ON ss.case_type = ca.case_type
            AND ss.case_ref_id = ca.case_ref_id
      WHERE ca.is_active = true
        AND ca.assigned_to_uid IS NOT NULL
      GROUP BY ca.assigned_to_uid
      ORDER BY active_cases DESC, breached_count DESC
    `);

    const byTeamRows = await db.execute(sql`
      SELECT
        t.id                                                               AS team_id,
        t.name                                                             AS team_name,
        COUNT(*)::int                                                      AS active_cases,
        ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - ca.assigned_at))/3600)::numeric, 1)::float
                                                                           AS avg_age_hours,
        COUNT(CASE WHEN ss.sla_status = 'breached' THEN 1 END)::int       AS breached_count
      FROM case_assignments ca
      JOIN teams t ON t.id = ca.assigned_team_id
      LEFT JOIN case_sla_states ss
             ON ss.case_type = ca.case_type
            AND ss.case_ref_id = ca.case_ref_id
      WHERE ca.is_active = true
        AND ca.assigned_team_id IS NOT NULL
      GROUP BY t.id, t.name
      ORDER BY active_cases DESC, breached_count DESC
    `);

    res.json({
      byUser: (byUserRows2.rows as any[]).map(r => ({
        uid:          toStr(r.uid),
        activeCases:  toNum(r.active_cases),
        avgAgeHours:  toFlt(r.avg_age_hours),
        breachedCount: toNum(r.breached_count),
      })),
      byTeam: (byTeamRows.rows as any[]).map(r => ({
        teamId:        toNum(r.team_id),
        teamName:      toStr(r.team_name),
        activeCases:   toNum(r.active_cases),
        avgAgeHours:   toFlt(r.avg_age_hours),
        breachedCount: toNum(r.breached_count),
      })),
    });
  } catch (err: any) {
    logger.error('[Manager] workload error', { error: err.message });
    res.status(500).json({ error: 'workload_fetch_error' });
  }
});

// ─── T124 GET /resolution-analytics ──────────────────────────────────────────
/**
 * Resolution code usage breakdown — overall + by team + by station.
 * Only counts disputes that were actually closed with a code.
 */
router.get('/resolution-analytics', requireManager, async (_req: Request, res: Response) => {
  try {
    // Overall by code
    const overallRows = await db.execute(sql`
      SELECT
        d.closure_reason_code                                      AS code,
        rc.label,
        COUNT(*)::int                                              AS total_count,
        ROUND(
          COUNT(*)::numeric
          / NULLIF((SELECT COUNT(*) FROM booking_disputes WHERE closure_reason_code IS NOT NULL), 0)
          * 100,
          1
        )::float                                                   AS percentage
      FROM booking_disputes d
      JOIN resolution_codes rc ON rc.code = d.closure_reason_code
      WHERE d.closure_reason_code IS NOT NULL
      GROUP BY d.closure_reason_code, rc.label
      ORDER BY total_count DESC
    `);

    // By team
    const byTeamRows = await db.execute(sql`
      SELECT
        t.id                                                       AS team_id,
        t.name                                                     AS team_name,
        d.closure_reason_code                                      AS code,
        rc.label,
        COUNT(*)::int                                              AS count
      FROM booking_disputes d
      JOIN resolution_codes rc ON rc.code = d.closure_reason_code
      JOIN case_assignments ca
        ON ca.case_ref_id = d.id
       AND ca.case_type = 'dispute'
      JOIN teams t ON t.id = ca.assigned_team_id
      WHERE d.closure_reason_code IS NOT NULL
      GROUP BY t.id, t.name, d.closure_reason_code, rc.label
      ORDER BY t.name, count DESC
    `);

    // By station
    const byStationRows = await db.execute(sql`
      SELECT
        s.id::text                                                 AS station_id,
        s.name                                                     AS station_name,
        d.closure_reason_code                                      AS code,
        rc.label,
        COUNT(*)::int                                              AS count
      FROM booking_disputes d
      JOIN resolution_codes rc ON rc.code = d.closure_reason_code
      JOIN bookings bk ON bk.id = d.booking_id
      JOIN stations s  ON s.id  = bk.station_id
      WHERE d.closure_reason_code IS NOT NULL
      GROUP BY s.id, s.name, d.closure_reason_code, rc.label
      ORDER BY s.name, count DESC
    `);

    // By franchise
    const byFranchiseRows = await db.execute(sql`
      SELECT
        fo.id::text                                                AS franchise_id,
        fo.business_name                                           AS franchise_name,
        d.closure_reason_code                                      AS code,
        rc.label,
        COUNT(*)::int                                              AS count
      FROM booking_disputes d
      JOIN resolution_codes rc ON rc.code = d.closure_reason_code
      JOIN bookings bk ON bk.id = d.booking_id
      JOIN stations s  ON s.id  = bk.station_id
      JOIN franchise_owners fo ON fo.id = s.franchise_id
      WHERE d.closure_reason_code IS NOT NULL
      GROUP BY fo.id, fo.business_name, d.closure_reason_code, rc.label
      ORDER BY fo.business_name, count DESC
    `);

    res.json({
      overall:     (overallRows.rows as any[]).map(r => ({
        code:       toStr(r.code),
        label:      toStr(r.label),
        totalCount: toNum(r.total_count),
        percentage: toFlt(r.percentage),
      })),
      byTeam:      (byTeamRows.rows as any[]).map(r => ({
        teamId:     toNum(r.team_id),
        teamName:   toStr(r.team_name),
        code:       toStr(r.code),
        label:      toStr(r.label),
        count:      toNum(r.count),
      })),
      byStation:   (byStationRows.rows as any[]).map(r => ({
        stationId:   toStr(r.station_id),
        stationName: toStr(r.station_name),
        code:        toStr(r.code),
        label:       toStr(r.label),
        count:       toNum(r.count),
      })),
      byFranchise: (byFranchiseRows.rows as any[]).map(r => ({
        franchiseId:   toStr(r.franchise_id),
        franchiseName: toStr(r.franchise_name),
        code:          toStr(r.code),
        label:         toStr(r.label),
        count:         toNum(r.count),
      })),
    });
  } catch (err: any) {
    logger.error('[Manager] resolution-analytics error', { error: err.message });
    res.status(500).json({ error: 'resolution_analytics_fetch_error' });
  }
});

// ─── T125 GET /reopen-stats ───────────────────────────────────────────────────
/**
 * Reopen tracking.
 * Per-user: cases assigned to handler that were later reopened vs total closed.
 * Per reopen_code: which reopen reasons are most used.
 */
router.get('/reopen-stats', requireManager, async (_req: Request, res: Response) => {
  try {
    // Per-user reopen rate
    // handler = last active assigned_to_uid at time of reopen (from_uid in escalation log)
    const byUserRows = await db.execute(sql`
      WITH reopened AS (
        SELECT
          from_uid                       AS handler_uid,
          COUNT(DISTINCT case_ref_id)::int AS reopen_count
        FROM case_escalation_log
        WHERE event_type = 'reopened'
          AND case_type  = 'dispute'
          AND from_uid IS NOT NULL
        GROUP BY from_uid
      ),
      closed_by_handler AS (
        SELECT
          ca.assigned_to_uid             AS handler_uid,
          COUNT(DISTINCT d.id)::int      AS closed_count
        FROM case_assignments ca
        JOIN booking_disputes d
          ON d.id = ca.case_ref_id
         AND ca.case_type = 'dispute'
        WHERE d.status = 'closed'
          AND ca.assigned_to_uid IS NOT NULL
        GROUP BY ca.assigned_to_uid
      )
      SELECT
        cbh.handler_uid,
        cbh.closed_count,
        COALESCE(r.reopen_count, 0)      AS reopen_count,
        ROUND(
          COALESCE(r.reopen_count, 0)::numeric
          / NULLIF(cbh.closed_count, 0) * 100,
          1
        )::float                          AS reopen_rate_pct
      FROM closed_by_handler cbh
      LEFT JOIN reopened r ON r.handler_uid = cbh.handler_uid
      ORDER BY reopen_rate_pct DESC NULLS LAST, reopen_count DESC
    `);

    // Per reopen_code: extract code from escalation log note
    // note format: "Reopened [code]: ..." or "Reopened [code]"
    // Uses SUBSTRING(... FROM pattern) — PostgreSQL POSIX ERE, no backslash ambiguity
    const byCodeRows = await db.execute(sql`
      SELECT
        COALESCE(
          SUBSTRING(note FROM 'Reopened \\[([^\\]]+)\\]'),
          note
        ) AS reopen_code,
        COUNT(*)::int AS count
      FROM case_escalation_log
      WHERE event_type = 'reopened'
        AND note LIKE 'Reopened [%'
      GROUP BY 1
      ORDER BY count DESC
    `);

    res.json({
      byUser: (byUserRows.rows as any[]).map(r => ({
        handlerUid:    toStr(r.handler_uid),
        closedCount:   toNum(r.closed_count),
        reopenCount:   toNum(r.reopen_count),
        reopenRatePct: toFlt(r.reopen_rate_pct),
      })),
      byCode: (byCodeRows.rows as any[]).map(r => ({
        reopenCode: toStr(r.reopen_code),
        count:      toNum(r.count),
      })),
    });
  } catch (err: any) {
    logger.error('[Manager] reopen-stats error', { error: err.message });
    res.status(500).json({ error: 'reopen_stats_fetch_error' });
  }
});

// ─── T126 GET /performance-comparison ────────────────────────────────────────
/**
 * Side-by-side performance: avg resolution time, breach rate, reopen rate.
 * Grouped by station, franchise, and team.
 */
router.get('/performance-comparison', requireManager, async (_req: Request, res: Response) => {
  try {
    // By station
    const byStationRows = await db.execute(sql`
      WITH station_cases AS (
        SELECT
          s.id::text      AS station_id,
          s.name          AS station_name,
          d.id            AS dispute_id,
          d.status,
          d.resolved_at,
          ca.assigned_at,
          ss.sla_status
        FROM booking_disputes d
        JOIN bookings bk ON bk.id = d.booking_id
        JOIN stations s  ON s.id  = bk.station_id
        LEFT JOIN case_assignments ca
               ON ca.case_ref_id = d.id
              AND ca.case_type = 'dispute'
        LEFT JOIN case_sla_states ss
               ON ss.case_ref_id = d.id
              AND ss.case_type = 'dispute'
      ),
      reopens AS (
        SELECT DISTINCT case_ref_id FROM case_escalation_log WHERE event_type = 'reopened'
      )
      SELECT
        sc.station_id,
        sc.station_name,
        COUNT(*)::int                                                        AS total_cases,
        COUNT(CASE WHEN sc.status = 'closed' THEN 1 END)::int               AS closed_cases,
        ROUND(
          AVG(CASE WHEN sc.resolved_at IS NOT NULL AND sc.assigned_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (sc.resolved_at - sc.assigned_at)) / 3600
          END)::numeric, 1
        )::float                                                             AS avg_resolution_hours,
        ROUND(
          COUNT(CASE WHEN sc.sla_status = 'breached' THEN 1 END)::numeric
          / NULLIF(COUNT(*), 0) * 100,
          1
        )::float                                                             AS breach_rate,
        ROUND(
          COUNT(CASE WHEN r.case_ref_id IS NOT NULL THEN 1 END)::numeric
          / NULLIF(COUNT(CASE WHEN sc.status = 'closed' THEN 1 END), 0) * 100,
          1
        )::float                                                             AS reopen_rate
      FROM station_cases sc
      LEFT JOIN reopens r ON r.case_ref_id = sc.dispute_id
      GROUP BY sc.station_id, sc.station_name
      ORDER BY breach_rate DESC NULLS LAST
    `);

    // By franchise
    const byFranchiseRows = await db.execute(sql`
      WITH franchise_cases AS (
        SELECT
          fo.id::text     AS franchise_id,
          fo.business_name AS franchise_name,
          d.id             AS dispute_id,
          d.status,
          d.resolved_at,
          ca.assigned_at,
          ss.sla_status
        FROM booking_disputes d
        JOIN bookings bk ON bk.id = d.booking_id
        JOIN stations s  ON s.id  = bk.station_id
        JOIN franchise_owners fo ON fo.id = s.franchise_id
        LEFT JOIN case_assignments ca
               ON ca.case_ref_id = d.id
              AND ca.case_type = 'dispute'
        LEFT JOIN case_sla_states ss
               ON ss.case_ref_id = d.id
              AND ss.case_type = 'dispute'
      ),
      reopens AS (
        SELECT DISTINCT case_ref_id FROM case_escalation_log WHERE event_type = 'reopened'
      )
      SELECT
        fc.franchise_id,
        fc.franchise_name,
        COUNT(*)::int                                                        AS total_cases,
        COUNT(CASE WHEN fc.status = 'closed' THEN 1 END)::int               AS closed_cases,
        ROUND(
          AVG(CASE WHEN fc.resolved_at IS NOT NULL AND fc.assigned_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (fc.resolved_at - fc.assigned_at)) / 3600
          END)::numeric, 1
        )::float                                                             AS avg_resolution_hours,
        ROUND(
          COUNT(CASE WHEN fc.sla_status = 'breached' THEN 1 END)::numeric
          / NULLIF(COUNT(*), 0) * 100,
          1
        )::float                                                             AS breach_rate,
        ROUND(
          COUNT(CASE WHEN r.case_ref_id IS NOT NULL THEN 1 END)::numeric
          / NULLIF(COUNT(CASE WHEN fc.status = 'closed' THEN 1 END), 0) * 100,
          1
        )::float                                                             AS reopen_rate
      FROM franchise_cases fc
      LEFT JOIN reopens r ON r.case_ref_id = fc.dispute_id
      GROUP BY fc.franchise_id, fc.franchise_name
      ORDER BY breach_rate DESC NULLS LAST
    `);

    // By team
    const byTeamRows = await db.execute(sql`
      WITH team_cases AS (
        SELECT
          t.id            AS team_id,
          t.name          AS team_name,
          d.id            AS dispute_id,
          d.status,
          d.resolved_at,
          ca.assigned_at,
          ss.sla_status
        FROM case_assignments ca
        JOIN teams t ON t.id = ca.assigned_team_id
        JOIN booking_disputes d
          ON d.id = ca.case_ref_id
         AND ca.case_type = 'dispute'
        LEFT JOIN case_sla_states ss
               ON ss.case_ref_id = d.id
              AND ss.case_type = 'dispute'
      ),
      reopens AS (
        SELECT DISTINCT case_ref_id FROM case_escalation_log WHERE event_type = 'reopened'
      )
      SELECT
        tc.team_id,
        tc.team_name,
        COUNT(*)::int                                                        AS total_cases,
        COUNT(CASE WHEN tc.status = 'closed' THEN 1 END)::int               AS closed_cases,
        ROUND(
          AVG(CASE WHEN tc.resolved_at IS NOT NULL AND tc.assigned_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (tc.resolved_at - tc.assigned_at)) / 3600
          END)::numeric, 1
        )::float                                                             AS avg_resolution_hours,
        ROUND(
          COUNT(CASE WHEN tc.sla_status = 'breached' THEN 1 END)::numeric
          / NULLIF(COUNT(*), 0) * 100,
          1
        )::float                                                             AS breach_rate,
        ROUND(
          COUNT(CASE WHEN r.case_ref_id IS NOT NULL THEN 1 END)::numeric
          / NULLIF(COUNT(CASE WHEN tc.status = 'closed' THEN 1 END), 0) * 100,
          1
        )::float                                                             AS reopen_rate
      FROM team_cases tc
      LEFT JOIN reopens r ON r.case_ref_id = tc.dispute_id
      GROUP BY tc.team_id, tc.team_name
      ORDER BY breach_rate DESC NULLS LAST
    `);

    const mapPerf = (r: any) => ({
      totalCases:          toNum(r.total_cases),
      closedCases:         toNum(r.closed_cases),
      avgResolutionHours:  r.avg_resolution_hours != null ? toFlt(r.avg_resolution_hours) : null,
      breachRate:          toFlt(r.breach_rate),
      reopenRate:          r.reopen_rate != null ? toFlt(r.reopen_rate) : null,
    });

    res.json({
      byStation:   (byStationRows.rows as any[]).map(r => ({
        stationId:   toStr(r.station_id),
        stationName: toStr(r.station_name),
        ...mapPerf(r),
      })),
      byFranchise: (byFranchiseRows.rows as any[]).map(r => ({
        franchiseId:   toStr(r.franchise_id),
        franchiseName: toStr(r.franchise_name),
        ...mapPerf(r),
      })),
      byTeam:      (byTeamRows.rows as any[]).map(r => ({
        teamId:   toNum(r.team_id),
        teamName: toStr(r.team_name),
        ...mapPerf(r),
      })),
    });
  } catch (err: any) {
    logger.error('[Manager] performance-comparison error', { error: err.message });
    res.status(500).json({ error: 'performance_comparison_fetch_error' });
  }
});

export default router;
