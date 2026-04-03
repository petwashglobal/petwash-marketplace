/**
 * server/routes/case-queue.ts
 * Phase 12.8 — Case Queue / Exception Management Layer
 *
 * Mounted at /api/case-queue
 *
 * GET /summary     — counts per queue + SLA-breached total
 * GET /disputes    — open/under_review disputes with aging + SLA
 * GET /mismatches  — settlement reconciliation mismatches with aging + SLA
 * GET /refunds     — pending refund requests with aging + SLA
 *
 * Access control (same pattern as booking-trace):
 *   admin            → all records
 *   franchise_owner  → records for their stations
 *   station_operator → records for their station(s)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db }       from '../db';
import { sql, SQL } from 'drizzle-orm';
import { logger }   from '../lib/logger';
import { auth }     from '../lib/firebase-admin';

const router = Router();

const ADMIN_SEC = process.env.ADMIN_SECRET || process.env.PETWASH_ADMIN_SECRET;

type CallerRole = 'admin' | 'franchise_owner' | 'station_operator';

interface CallerContext {
  role: CallerRole;
  uid: string | null;
  franchiseIds: number[];
  stationIds:   number[];
}

type SlaStatus    = 'on_track' | 'at_risk' | 'breached';
type Severity     = 'critical' | 'high' | 'medium' | 'low';
type CaseOwner    = 'platform' | 'franchise_owner' | 'system' | 'none';

const toNum  = (v: unknown): number  => Number(v ?? 0);
const toStr  = (v: unknown): string  => v != null ? String(v) : '';
const toDate = (v: unknown): string | null => v ? (v as Date).toISOString() : null;
const toILS  = (v: unknown): number  => v != null && v !== '' ? Math.round(Number(v)) / 100 : 0;

// ─── SLA + Severity helpers ───────────────────────────────────────────────────

const DISPUTE_SLA: Record<string, number> = {
  open:         48,
  under_review: 72,
};
const MISMATCH_SLA = 24;
const REFUND_SLA   = 120;

function disputeSla(status: string, ageHours: number): SlaStatus {
  const sla = DISPUTE_SLA[status] ?? 48;
  if (ageHours >= sla)           return 'breached';
  if (ageHours >= sla * 0.8)     return 'at_risk';
  return 'on_track';
}

function mismatchSla(ageHours: number): SlaStatus {
  if (ageHours >= MISMATCH_SLA)        return 'breached';
  if (ageHours >= MISMATCH_SLA * 0.83) return 'at_risk';
  return 'on_track';
}

function refundSla(ageHours: number): SlaStatus {
  if (ageHours >= REFUND_SLA)        return 'breached';
  if (ageHours >= REFUND_SLA * 0.8)  return 'at_risk';
  return 'on_track';
}

function severity(slaStatus: SlaStatus, amountILS?: number): Severity {
  if (slaStatus === 'breached') return 'critical';
  if (slaStatus === 'at_risk')  return 'high';
  if (amountILS != null && amountILS >= 500) return 'high';
  return 'medium';
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

async function requireCaseViewer(req: Request, res: Response, next: NextFunction) {
  try {
    // P1-FIX: timing-safe comparison (was ===)
    const { isValidAdminSecret } = require('../lib/admin-secret');
    if (isValidAdminSecret(req, 'ADMIN_SECRET') || isValidAdminSecret(req, 'PETWASH_ADMIN_SECRET')) {
      (req as any).callerCtx = { role: 'admin', uid: null, franchiseIds: [], stationIds: [] } as CallerContext;
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    const decoded = await auth.verifyIdToken(authHeader.slice(7), true);
    const uid     = decoded.uid;

    if (decoded.admin) {
      (req as any).callerCtx = { role: 'admin', uid, franchiseIds: [], stationIds: [] } as CallerContext;
      return next();
    }

    const foRows = await db.execute(sql`
      SELECT id FROM franchise_owners WHERE owner_user_id = ${uid} AND status = 'active'
    `);
    if (foRows.rows.length) {
      const ids = (foRows.rows as any[]).map(r => toNum(r.id));
      (req as any).callerCtx = { role: 'franchise_owner', uid, franchiseIds: ids, stationIds: [] } as CallerContext;
      return next();
    }

    const opRows = await db.execute(sql`
      SELECT station_id FROM station_operators WHERE user_id = ${uid} AND is_active = true
    `);
    if (opRows.rows.length) {
      const ids = (opRows.rows as any[]).map(r => toNum(r.station_id));
      (req as any).callerCtx = { role: 'station_operator', uid, franchiseIds: [], stationIds: ids } as CallerContext;
      return next();
    }

    return res.status(403).json({ error: 'access_denied' });
  } catch (err: any) {
    logger.error('[CaseQueue] auth error', { error: err.message });
    return res.status(401).json({ error: 'authentication_failed' });
  }
}

// ─── Scope WHERE clause ───────────────────────────────────────────────────────

function stationScope(ctx: CallerContext): SQL {
  if (ctx.role === 'admin') return sql``;
  if (ctx.role === 'franchise_owner' && ctx.franchiseIds.length) {
    const idList = sql.join(ctx.franchiseIds.map(id => sql`${id}`), sql`, `);
    return sql`AND st.franchise_id IN (${idList})`;
  }
  if (ctx.role === 'station_operator' && ctx.stationIds.length) {
    const idList = sql.join(ctx.stationIds.map(id => sql`${id}`), sql`, `);
    return sql`AND st.id IN (${idList})`;
  }
  return sql`AND 1=0`;
}

// ─── GET /api/case-queue/disputes ─────────────────────────────────────────────

router.get('/disputes', requireCaseViewer, async (req: Request, res: Response) => {
  try {
    const ctx   = (req as any).callerCtx as CallerContext;
    const scope = stationScope(ctx);

    const rows = await db.execute(sql`
      SELECT
        bd.id                                                          AS dispute_id,
        bd.reason,
        bd.description,
        bd.status,
        bd.admin_notes,
        bd.resolved_by,
        bd.resolved_at,
        bd.created_at,
        COALESCE(bd.closure_requested, false)                          AS closure_requested,
        COALESCE(bd.closure_approved,  false)                         AS closure_approved,
        bd.closure_reason_code,
        b.id                                                           AS booking_id,
        b.booking_number,
        b.total::float                                                 AS total,
        b.currency,
        b.refund_status,
        st.id                                                          AS station_id,
        st.name                                                        AS station_name,
        COALESCE(st.station_code, '')                                  AS station_code,
        EXTRACT(EPOCH FROM (NOW() - bd.created_at)) / 3600            AS age_hours
      FROM booking_disputes bd
      JOIN bookings b  ON b.id  = bd.booking_id
      LEFT JOIN stations st ON st.id = b.station_id
      WHERE bd.status IN ('open', 'under_review')
        ${scope}
      ORDER BY bd.created_at ASC
      LIMIT 500
    `);

    const cases = (rows.rows as any[]).map(r => {
      const ageHours   = toNum(r.age_hours);
      const slaStatus  = disputeSla(toStr(r.status), ageHours);
      const sev        = severity(slaStatus, toNum(r.total));
      const owner: CaseOwner = 'platform';
      return {
        caseType:      'dispute',
        caseId:        toStr(r.dispute_id),
        bookingId:     toStr(r.booking_id),
        bookingNumber: toStr(r.booking_number),
        stationId:     r.station_id ? toNum(r.station_id) : null,
        stationName:   toStr(r.station_name),
        stationCode:   toStr(r.station_code),
        reason:        toStr(r.reason),
        description:   r.description ? toStr(r.description) : null,
        status:             toStr(r.status),
        total:              toNum(r.total),
        currency:           toStr(r.currency) || 'ILS',
        ageHours:           Math.round(ageHours * 10) / 10,
        slaStatus,
        slaBudgetHours:     DISPUTE_SLA[toStr(r.status)] ?? 48,
        severity:           sev,
        currentOwner:       owner,
        openedAt:           toDate(r.created_at),
        resolvedAt:         toDate(r.resolved_at),
        closureRequested:   Boolean(r.closure_requested),
        closureApproved:    Boolean(r.closure_approved),
        closureReasonCode:  r.closure_reason_code ? toStr(r.closure_reason_code) : null,
      };
    });

    res.json({ cases, total: cases.length });
  } catch (err: any) {
    logger.error('[CaseQueue] disputes error', { error: err.message });
    res.status(500).json({ error: 'queue_error' });
  }
});

// ─── GET /api/case-queue/mismatches ──────────────────────────────────────────

router.get('/mismatches', requireCaseViewer, async (req: Request, res: Response) => {
  try {
    const ctx   = (req as any).callerCtx as CallerContext;
    const scope = stationScope(ctx);

    const rows = await db.execute(sql`
      SELECT
        ss.id                                                          AS settlement_id,
        ss.status                                                      AS settlement_status,
        ss.total_amount_cents,
        ss.platform_amount_cents,
        ss.station_amount_cents,
        COALESCE(ss.franchise_amount_cents, 0)                        AS franchise_amount_cents,
        ss.settled_at,
        ss.created_at,
        b.id                                                           AS booking_id,
        b.booking_number,
        b.currency,
        st.id                                                          AS station_id,
        st.name                                                        AS station_name,
        COALESCE(st.station_code, '')                                  AS station_code,
        ABS(
          ss.total_amount_cents
          - (ss.platform_amount_cents + ss.station_amount_cents + COALESCE(ss.franchise_amount_cents, 0))
        )                                                              AS mismatch_cents,
        EXTRACT(EPOCH FROM (NOW() - ss.created_at)) / 3600            AS age_hours
      FROM station_settlements ss
      JOIN bookings b  ON b.id  = ss.booking_id
      LEFT JOIN stations st ON st.id = ss.station_id
      WHERE ss.total_amount_cents
              != (ss.platform_amount_cents + ss.station_amount_cents + COALESCE(ss.franchise_amount_cents, 0))
        ${scope}
      ORDER BY mismatch_cents DESC, ss.created_at ASC
      LIMIT 500
    `);

    const cases = (rows.rows as any[]).map(r => {
      const ageHours      = toNum(r.age_hours);
      const mismatchCents = toNum(r.mismatch_cents);
      const mismatchILS   = toILS(mismatchCents);
      const slaStatus     = mismatchSla(ageHours);
      const sev           = severity(slaStatus, mismatchILS);
      const owner: CaseOwner = toStr(r.settlement_status) === 'pending' ? 'system' : 'platform';
      return {
        caseType:         'mismatch',
        caseId:           `mismatch-${toNum(r.settlement_id)}`,
        settlementId:     toNum(r.settlement_id),
        settlementStatus: toStr(r.settlement_status),
        bookingId:        toStr(r.booking_id),
        bookingNumber:    toStr(r.booking_number),
        stationId:        r.station_id ? toNum(r.station_id) : null,
        stationName:      toStr(r.station_name),
        stationCode:      toStr(r.station_code),
        totalAmount:      toILS(r.total_amount_cents),
        platformAmount:   toILS(r.platform_amount_cents),
        stationAmount:    toILS(r.station_amount_cents),
        franchiseAmount:  toILS(r.franchise_amount_cents),
        mismatchCents,
        mismatchILS,
        currency:         toStr(r.currency) || 'ILS',
        ageHours:         Math.round(ageHours * 10) / 10,
        slaStatus,
        slaBudgetHours:   MISMATCH_SLA,
        severity:         sev,
        currentOwner:     owner,
        openedAt:         toDate(r.created_at),
        settledAt:        toDate(r.settled_at),
      };
    });

    res.json({ cases, total: cases.length });
  } catch (err: any) {
    logger.error('[CaseQueue] mismatches error', { error: err.message });
    res.status(500).json({ error: 'queue_error' });
  }
});

// ─── GET /api/case-queue/refunds ──────────────────────────────────────────────

router.get('/refunds', requireCaseViewer, async (req: Request, res: Response) => {
  try {
    const ctx   = (req as any).callerCtx as CallerContext;
    const scope = stationScope(ctx);

    const rows = await db.execute(sql`
      SELECT
        b.id                                                           AS booking_id,
        b.booking_number,
        b.refund_amount::float                                         AS refund_amount,
        b.refund_amount_cents,
        b.refund_status,
        b.refund_reason,
        b.refund_requested_at,
        b.refund_processed_at,
        b.total::float                                                 AS total,
        b.currency,
        st.id                                                          AS station_id,
        st.name                                                        AS station_name,
        COALESCE(st.station_code, '')                                  AS station_code,
        EXTRACT(EPOCH FROM (NOW() - b.refund_requested_at)) / 3600    AS age_hours
      FROM bookings b
      LEFT JOIN stations st ON st.id = b.station_id
      WHERE b.refund_status IN ('pending', 'processing')
        AND b.refund_requested_at IS NOT NULL
        ${scope}
      ORDER BY b.refund_requested_at ASC
      LIMIT 500
    `);

    const cases = (rows.rows as any[]).map(r => {
      const ageHours  = toNum(r.age_hours);
      const amount    = toNum(r.refund_amount);
      const slaStatus = refundSla(ageHours);
      const sev       = severity(slaStatus, amount);
      return {
        caseType:      'refund',
        caseId:        `refund-${toStr(r.booking_id)}`,
        bookingId:     toStr(r.booking_id),
        bookingNumber: toStr(r.booking_number),
        stationId:     r.station_id ? toNum(r.station_id) : null,
        stationName:   toStr(r.station_name),
        stationCode:   toStr(r.station_code),
        refundAmount:  amount,
        refundStatus:  toStr(r.refund_status),
        refundReason:  r.refund_reason ? toStr(r.refund_reason) : null,
        total:         toNum(r.total),
        currency:      toStr(r.currency) || 'ILS',
        ageHours:      Math.round(ageHours * 10) / 10,
        slaStatus,
        slaBudgetHours:  REFUND_SLA,
        severity:      sev,
        currentOwner:  'platform' as CaseOwner,
        openedAt:      toDate(r.refund_requested_at),
        processedAt:   toDate(r.refund_processed_at),
      };
    });

    res.json({ cases, total: cases.length });
  } catch (err: any) {
    logger.error('[CaseQueue] refunds error', { error: err.message });
    res.status(500).json({ error: 'queue_error' });
  }
});

// ─── GET /api/case-queue/summary ─────────────────────────────────────────────

router.get('/summary', requireCaseViewer, async (req: Request, res: Response) => {
  try {
    const ctx   = (req as any).callerCtx as CallerContext;
    const scope = stationScope(ctx);

    const [dRows, mRows, rRows] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)                                                        AS total,
          COUNT(*) FILTER (WHERE
            (bd.status = 'open'         AND EXTRACT(EPOCH FROM (NOW()-bd.created_at))/3600 >= 48) OR
            (bd.status = 'under_review' AND EXTRACT(EPOCH FROM (NOW()-bd.created_at))/3600 >= 72)
          )                                                               AS breached,
          COUNT(*) FILTER (WHERE
            (bd.status = 'open'         AND EXTRACT(EPOCH FROM (NOW()-bd.created_at))/3600 >= 38.4) OR
            (bd.status = 'under_review' AND EXTRACT(EPOCH FROM (NOW()-bd.created_at))/3600 >= 57.6)
          )                                                               AS at_risk_or_breached
        FROM booking_disputes bd
        JOIN bookings b ON b.id = bd.booking_id
        LEFT JOIN stations st ON st.id = b.station_id
        WHERE bd.status IN ('open', 'under_review')
          ${scope}
      `),
      db.execute(sql`
        SELECT
          COUNT(*)                                                        AS total,
          COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW()-ss.created_at))/3600 >= 24) AS breached,
          COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW()-ss.created_at))/3600 >= 19.9) AS at_risk_or_breached
        FROM station_settlements ss
        JOIN bookings b ON b.id = ss.booking_id
        LEFT JOIN stations st ON st.id = ss.station_id
        WHERE ss.total_amount_cents != (ss.platform_amount_cents + ss.station_amount_cents + COALESCE(ss.franchise_amount_cents, 0))
          ${scope}
      `),
      db.execute(sql`
        SELECT
          COUNT(*)                                                        AS total,
          COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW()-b.refund_requested_at))/3600 >= 120) AS breached,
          COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW()-b.refund_requested_at))/3600 >= 96) AS at_risk_or_breached
        FROM bookings b
        LEFT JOIN stations st ON st.id = b.station_id
        WHERE b.refund_status IN ('pending', 'processing')
          AND b.refund_requested_at IS NOT NULL
          ${scope}
      `),
    ]);

    const d = dRows.rows[0] as any;
    const m = mRows.rows[0] as any;
    const r = rRows.rows[0] as any;

    const disputes   = { total: toNum(d.total), breached: toNum(d.breached), atRiskOrBreached: toNum(d.at_risk_or_breached) };
    const mismatches = { total: toNum(m.total), breached: toNum(m.breached), atRiskOrBreached: toNum(m.at_risk_or_breached) };
    const refunds    = { total: toNum(r.total), breached: toNum(r.breached), atRiskOrBreached: toNum(r.at_risk_or_breached) };

    res.json({
      disputes,
      mismatches,
      refunds,
      totalActiveCases: disputes.total + mismatches.total + refunds.total,
      totalBreached:    disputes.breached + mismatches.breached + refunds.breached,
    });
  } catch (err: any) {
    logger.error('[CaseQueue] summary error', { error: err.message });
    res.status(500).json({ error: 'summary_error' });
  }
});

// ─── GET /api/case-queue/escalated ───────────────────────────────────────────

router.get('/escalated', requireCaseViewer, async (req: Request, res: Response) => {
  try {
    const ctx   = (req as any).callerCtx as CallerContext;
    const scope = stationScope(ctx);

    const dRows = await db.execute(sql`
      SELECT
        'dispute'                                                       AS case_type,
        bd.id::text                                                     AS case_ref_id,
        b.id                                                            AS booking_id,
        b.booking_number,
        b.total::float                                                  AS amount,
        b.currency,
        st.id                                                           AS station_id,
        st.name                                                         AS station_name,
        COALESCE(st.station_code, '')                                   AS station_code,
        bd.reason                                                       AS label,
        bd.status,
        css.age_hours,
        css.sla_budget_hours,
        css.breach_detected_at,
        css.escalated_at,
        css.escalated_to_uid,
        (css.age_hours - css.sla_budget_hours)                         AS overdue_hours,
        ca.assigned_to_uid,
        bd.created_at                                                   AS opened_at
      FROM booking_disputes bd
      JOIN bookings b ON b.id = bd.booking_id
      LEFT JOIN stations st ON st.id = b.station_id
      JOIN case_sla_states css
        ON css.case_type = 'dispute' AND css.case_ref_id = bd.id::text
      LEFT JOIN case_assignments ca
        ON ca.case_type = 'dispute' AND ca.case_ref_id = bd.id::text AND ca.is_active = true
      WHERE css.sla_status = 'breached'
        AND bd.status NOT IN ('resolved', 'rejected', 'closed')
        ${scope}
      LIMIT 500
    `);

    const mRows = await db.execute(sql`
      SELECT
        'mismatch'                                                      AS case_type,
        'mismatch-' || ss.id::text                                     AS case_ref_id,
        b.id                                                            AS booking_id,
        b.booking_number,
        ABS(ss.total_amount_cents - (ss.platform_amount_cents + ss.station_amount_cents + COALESCE(ss.franchise_amount_cents,0)))::float / 100 AS amount,
        b.currency,
        st.id                                                           AS station_id,
        st.name                                                         AS station_name,
        COALESCE(st.station_code, '')                                   AS station_code,
        'Settlement mismatch'                                           AS label,
        ss.status,
        css.age_hours,
        css.sla_budget_hours,
        css.breach_detected_at,
        css.escalated_at,
        css.escalated_to_uid,
        (css.age_hours - css.sla_budget_hours)                         AS overdue_hours,
        ca.assigned_to_uid,
        ss.created_at                                                   AS opened_at
      FROM station_settlements ss
      JOIN bookings b ON b.id = ss.booking_id
      LEFT JOIN stations st ON st.id = ss.station_id
      JOIN case_sla_states css
        ON css.case_type = 'mismatch' AND css.case_ref_id = 'mismatch-' || ss.id::text
      LEFT JOIN case_assignments ca
        ON ca.case_type = 'mismatch' AND ca.case_ref_id = 'mismatch-' || ss.id::text AND ca.is_active = true
      WHERE css.sla_status = 'breached'
        ${scope}
      LIMIT 500
    `);

    const rRows = await db.execute(sql`
      SELECT
        'refund'                                                        AS case_type,
        'refund-' || b.id::text                                        AS case_ref_id,
        b.id                                                            AS booking_id,
        b.booking_number,
        b.refund_amount::float                                          AS amount,
        b.currency,
        st.id                                                           AS station_id,
        st.name                                                         AS station_name,
        COALESCE(st.station_code, '')                                   AS station_code,
        COALESCE(b.refund_reason, 'Refund request')                    AS label,
        b.refund_status                                                 AS status,
        css.age_hours,
        css.sla_budget_hours,
        css.breach_detected_at,
        css.escalated_at,
        css.escalated_to_uid,
        (css.age_hours - css.sla_budget_hours)                         AS overdue_hours,
        ca.assigned_to_uid,
        b.refund_requested_at                                           AS opened_at
      FROM bookings b
      LEFT JOIN stations st ON st.id = b.station_id
      JOIN case_sla_states css
        ON css.case_type = 'refund' AND css.case_ref_id = 'refund-' || b.id::text
      LEFT JOIN case_assignments ca
        ON ca.case_type = 'refund' AND ca.case_ref_id = 'refund-' || b.id::text AND ca.is_active = true
      WHERE css.sla_status = 'breached'
        AND b.refund_status IN ('pending', 'processing')
        ${scope}
      LIMIT 500
    `);

    const mapRow = (r: any) => ({
      caseType:         toStr(r.case_type),
      caseId:           toStr(r.case_ref_id),
      bookingId:        toStr(r.booking_id),
      bookingNumber:    toStr(r.booking_number),
      stationId:        r.station_id ? toNum(r.station_id) : null,
      stationName:      toStr(r.station_name),
      stationCode:      toStr(r.station_code),
      label:            toStr(r.label),
      status:           toStr(r.status),
      amount:           toNum(r.amount),
      currency:         toStr(r.currency) || 'ILS',
      ageHours:         Math.round(toNum(r.age_hours) * 10) / 10,
      slaBudgetHours:   toNum(r.sla_budget_hours),
      overdueHours:     Math.max(0, Math.round(toNum(r.overdue_hours) * 10) / 10),
      breachDetectedAt: toDate(r.breach_detected_at),
      escalatedAt:      toDate(r.escalated_at),
      escalatedToUid:   r.escalated_to_uid ? toStr(r.escalated_to_uid) : null,
      assignedToUid:    r.assigned_to_uid ? toStr(r.assigned_to_uid) : null,
      openedAt:         toDate(r.opened_at),
      severity:         'critical' as const,
      slaStatus:        'breached' as const,
    });

    const allCases = [
      ...(dRows.rows as any[]).map(mapRow),
      ...(mRows.rows as any[]).map(mapRow),
      ...(rRows.rows as any[]).map(mapRow),
    ].sort((a, b) => b.overdueHours - a.overdueHours);

    res.json({ cases: allCases, total: allCases.length });
  } catch (err: any) {
    logger.error('[CaseQueue] escalated error', { error: err.message });
    res.status(500).json({ error: 'escalated_error' });
  }
});

export default router;
