/**
 * server/routes/executive.ts
 * Phase 12.15 — Executive Oversight & Network Health
 *
 * GET /api/executive/network-risk        — aggregated risk snapshot
 * GET /api/executive/automation          — governance automation effectiveness
 * GET /api/executive/breach-trends       — SLA breach timeline (last 30 days)
 * GET /api/executive/policy-impact/:id   — before/after dispute outcomes for a policy
 *
 * Auth: admin (x-admin-secret / decoded.admin) OR franchise_owner
 */

import { Router, Request, Response } from 'express';
import { db }     from '../db';
import { sql }    from 'drizzle-orm';
import { logger } from '../lib/logger';
import { auth as firebaseAuth } from '../lib/firebase-admin';

const router = Router();

// ─── Auth ──────────────────────────────────────────────────────────────────────

async function requireExec(req: Request, res: Response, next: Function) {
  try {
    const secret = req.headers['x-admin-secret'];
    if (secret && (secret === process.env.ADMIN_SECRET || secret === process.env.PETWASH_ADMIN_SECRET)) return next();

    const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'unauthorized' });

    const decoded = await firebaseAuth.verifyIdToken(token, true);
    if (decoded.admin) return next();

    const r = await db.execute(sql.raw(`
      SELECT role FROM user_profiles
      WHERE firebase_uid = '${String(decoded.uid ?? '').replace(/'/g, "''").slice(0, 200)}'
        AND is_active = true LIMIT 1
    `));
    const role = (r.rows[0] as any)?.role ?? '';
    if (['franchise_owner', 'manager'].includes(role)) return next();

    return res.status(403).json({ error: 'insufficient_role' });
  } catch {
    return res.status(401).json({ error: 'auth_failed' });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown) { return v == null ? 0 : Number(v); }

// ─── GET /network-risk ────────────────────────────────────────────────────────

router.get('/network-risk', requireExec, async (_req: Request, res: Response) => {
  try {
    const [disputes, slaStates, escalations, pendingApproval, recentExecs] = await Promise.all([
      // Disputes by status
      db.execute(sql.raw(`
        SELECT status, COUNT(*) AS cnt FROM booking_disputes
        GROUP BY status
      `)),

      // SLA states distribution
      db.execute(sql.raw(`
        SELECT sla_status, COUNT(*) AS cnt FROM case_sla_states
        GROUP BY sla_status
      `)),

      // Escalations last 7 days
      db.execute(sql.raw(`
        SELECT COUNT(*) AS cnt FROM case_escalation_log
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `)),

      // Disputes awaiting second approval
      db.execute(sql.raw(`
        SELECT COUNT(*) AS cnt FROM booking_disputes
        WHERE second_approval_required = true
          AND status NOT IN ('resolved', 'closed')
      `)),

      // Policy executions last 24h
      db.execute(sql.raw(`
        SELECT COUNT(*) AS cnt FROM policy_executions
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `)),
    ]);

    // Summarise dispute status
    const disputeMap: Record<string, number> = {};
    for (const r of disputes.rows as any[]) {
      disputeMap[r.status] = toNum(r.cnt);
    }

    // Summarise SLA states
    const slaMap: Record<string, number> = {};
    for (const r of slaStates.rows as any[]) {
      slaMap[r.sla_status] = toNum(r.cnt);
    }

    const totalDisputes = Object.values(disputeMap).reduce((a, b) => a + b, 0);
    const totalSla      = Object.values(slaMap).reduce((a, b) => a + b, 0);

    res.json({
      disputes: {
        total:    totalDisputes,
        open:     disputeMap['open'] ?? 0,
        inReview: disputeMap['in_review'] ?? 0,
        resolved: disputeMap['resolved'] ?? 0,
        other:    totalDisputes - ((disputeMap['open'] ?? 0) + (disputeMap['in_review'] ?? 0) + (disputeMap['resolved'] ?? 0)),
      },
      sla: {
        total:      totalSla,
        withinSla:  slaMap['within_sla'] ?? 0,
        atRisk:     slaMap['at_risk'] ?? 0,
        breached:   slaMap['breached'] ?? 0,
        breachRate: totalSla > 0 ? Math.round(((slaMap['breached'] ?? 0) / totalSla) * 100) : 0,
      },
      escalations7d:      toNum((escalations.rows[0] as any)?.cnt ?? 0),
      pendingL2Approval:  toNum((pendingApproval.rows[0] as any)?.cnt ?? 0),
      policyFires24h:     toNum((recentExecs.rows[0] as any)?.cnt ?? 0),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error('[Executive] network-risk error', { error: err.message });
    res.status(500).json({ error: 'network_risk_error' });
  }
});

// ─── GET /automation ──────────────────────────────────────────────────────────

router.get('/automation', requireExec, async (req: Request, res: Response) => {
  try {
    const days = Math.min(Math.max(1, parseInt(String(req.query.days ?? '30'), 10)), 365);

    const [byTrigger, overall, byPolicy] = await Promise.all([
      // Per trigger event
      db.execute(sql.raw(`
        SELECT trigger_event, COUNT(*) AS fires FROM policy_executions
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY trigger_event ORDER BY fires DESC
      `)),

      // Auto-approve vs require_approval count
      db.execute(sql.raw(`
        SELECT
          COUNT(*) AS total_executions,
          COUNT(DISTINCT case_ref_id) AS unique_cases,
          SUM(CASE WHEN actions_taken::text LIKE '%auto_approve%' THEN 1 ELSE 0 END) AS auto_approved,
          SUM(CASE WHEN actions_taken::text LIKE '%require_approval%' THEN 1 ELSE 0 END) AS flagged_for_review
        FROM policy_executions
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `)),

      // Top policies by execution count
      db.execute(sql.raw(`
        SELECT pe.policy_id, gp.name AS policy_name, gp.policy_type,
               COUNT(*) AS fires,
               SUM(CASE WHEN pe.actions_taken::text LIKE '%auto_approve%' THEN 1 ELSE 0 END) AS auto_approved
        FROM policy_executions pe
        LEFT JOIN governance_policies gp ON gp.id = pe.policy_id
        WHERE pe.created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY pe.policy_id, gp.name, gp.policy_type
        ORDER BY fires DESC
        LIMIT 10
      `)),
    ]);

    const ov = overall.rows[0] as any;
    const totalFires   = toNum(ov?.total_executions ?? 0);
    const autoApproved = toNum(ov?.auto_approved ?? 0);
    const flagged      = toNum(ov?.flagged_for_review ?? 0);
    const uniqueCases  = toNum(ov?.unique_cases ?? 0);

    res.json({
      periodDays:        days,
      totalExecutions:   totalFires,
      uniqueCasesHandled: uniqueCases,
      autoApproved,
      flaggedForReview:  flagged,
      autoResolutionRate: totalFires > 0 ? Math.round((autoApproved / totalFires) * 100) : 0,
      flaggedRate:        totalFires > 0 ? Math.round((flagged / totalFires) * 100) : 0,
      byTrigger: (byTrigger.rows as any[]).map(r => ({
        triggerEvent: r.trigger_event,
        fires:        toNum(r.fires),
      })),
      topPolicies: (byPolicy.rows as any[]).map(r => ({
        policyId:    toNum(r.policy_id),
        policyName:  r.policy_name ?? '(deleted)',
        policyType:  r.policy_type ?? 'unknown',
        fires:       toNum(r.fires),
        autoApproved: toNum(r.auto_approved),
      })),
    });
  } catch (err: any) {
    logger.error('[Executive] automation error', { error: err.message });
    res.status(500).json({ error: 'automation_error' });
  }
});

// ─── GET /breach-trends ───────────────────────────────────────────────────────

router.get('/breach-trends', requireExec, async (req: Request, res: Response) => {
  try {
    const days = Math.min(Math.max(7, parseInt(String(req.query.days ?? '30'), 10)), 90);

    const [byDay, byType, cumulative] = await Promise.all([
      // Breaches per day
      db.execute(sql.raw(`
        SELECT
          DATE(breach_detected_at) AS day,
          case_type,
          COUNT(*) AS breaches
        FROM case_sla_states
        WHERE sla_status = 'breached'
          AND breach_detected_at IS NOT NULL
          AND breach_detected_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(breach_detected_at), case_type
        ORDER BY day ASC
      `)),

      // Total breaches per case type
      db.execute(sql.raw(`
        SELECT case_type, COUNT(*) AS total_breaches,
               AVG(age_hours) AS avg_age_hours
        FROM case_sla_states
        WHERE sla_status = 'breached'
        GROUP BY case_type ORDER BY total_breaches DESC
      `)),

      // Breaches vs at-risk last 30 days vs prior 30 days (trend direction)
      db.execute(sql.raw(`
        SELECT
          SUM(CASE WHEN breach_detected_at >= NOW() - INTERVAL '${days} days' AND sla_status = 'breached' THEN 1 ELSE 0 END) AS current_period,
          SUM(CASE WHEN breach_detected_at >= NOW() - INTERVAL '${days * 2} days'
                    AND breach_detected_at <  NOW() - INTERVAL '${days} days'
                    AND sla_status = 'breached' THEN 1 ELSE 0 END) AS prior_period
        FROM case_sla_states WHERE breach_detected_at IS NOT NULL
      `)),
    ]);

    const trend    = cumulative.rows[0] as any;
    const current  = toNum(trend?.current_period ?? 0);
    const prior    = toNum(trend?.prior_period ?? 0);
    const trendPct = prior > 0 ? Math.round(((current - prior) / prior) * 100) : null;

    // Build daily series — pivot by case_type for chart
    const dayMap: Record<string, Record<string, number>> = {};
    for (const r of byDay.rows as any[]) {
      const day = String(r.day).split('T')[0];
      if (!dayMap[day]) dayMap[day] = {};
      dayMap[day][r.case_type] = toNum(r.breaches);
    }

    const series = Object.entries(dayMap).map(([day, types]) => ({ day, ...types }));

    res.json({
      periodDays:       days,
      currentPeriod:    current,
      priorPeriod:      prior,
      trendPct,
      trendDirection:   trendPct === null ? 'new_data' : trendPct > 0 ? 'worsening' : trendPct < 0 ? 'improving' : 'stable',
      byDay:            series,
      byCaseType: (byType.rows as any[]).map(r => ({
        caseType:     r.case_type,
        totalBreaches: toNum(r.total_breaches),
        avgAgeHours:   Math.round(Number(r.avg_age_hours ?? 0) * 10) / 10,
      })),
    });
  } catch (err: any) {
    logger.error('[Executive] breach-trends error', { error: err.message });
    res.status(500).json({ error: 'breach_trends_error' });
  }
});

// ─── GET /policy-impact/:policyId ─────────────────────────────────────────────

router.get('/policy-impact/:policyId', requireExec, async (req: Request, res: Response) => {
  try {
    const policyId = parseInt(req.params.policyId, 10);
    if (isNaN(policyId)) return res.status(400).json({ error: 'invalid_id' });

    // Load policy
    const policyR = await db.execute(sql.raw(`
      SELECT id, name, policy_type, is_active, created_at FROM governance_policies WHERE id = ${policyId} LIMIT 1
    `));
    if (!policyR.rows.length) return res.status(404).json({ error: 'policy_not_found' });
    const policy = policyR.rows[0] as any;

    // Load versions to find impact pivot points
    const versionsR = await db.execute(sql.raw(`
      SELECT id, version_number, change_type, changed_at, changed_by
      FROM policy_versions WHERE policy_id = ${policyId}
      ORDER BY version_number ASC
    `));
    const versions = versionsR.rows as any[];

    // Find first activation (created/updated) point for the "went live" date
    const activationVersion = versions.find(v => v.change_type === 'created') ?? versions[0];
    if (!activationVersion) {
      return res.status(404).json({ error: 'no_version_history' });
    }

    const pivotDate = activationVersion.changed_at;

    // Policy executions before/after pivot
    const [before, after] = await Promise.all([
      db.execute(sql.raw(`
        SELECT COUNT(*) AS total_fires,
               SUM(CASE WHEN actions_taken::text LIKE '%auto_approve%' THEN 1 ELSE 0 END) AS auto_approved,
               SUM(CASE WHEN actions_taken::text LIKE '%require_approval%' THEN 1 ELSE 0 END) AS flagged
        FROM policy_executions
        WHERE policy_id = ${policyId}
          AND created_at < '${pivotDate}'::timestamptz
      `)),
      db.execute(sql.raw(`
        SELECT COUNT(*) AS total_fires,
               SUM(CASE WHEN actions_taken::text LIKE '%auto_approve%' THEN 1 ELSE 0 END) AS auto_approved,
               SUM(CASE WHEN actions_taken::text LIKE '%require_approval%' THEN 1 ELSE 0 END) AS flagged
        FROM policy_executions
        WHERE policy_id = ${policyId}
          AND created_at >= '${pivotDate}'::timestamptz
      `)),
    ]);

    // Dispute resolution rates around pivot (all disputes near the time of first version)
    const [disputesBefore, disputesAfter] = await Promise.all([
      db.execute(sql.raw(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
               SUM(CASE WHEN second_approval_required = true THEN 1 ELSE 0 END) AS needed_l2
        FROM booking_disputes
        WHERE created_at < '${pivotDate}'::timestamptz
          AND created_at >= '${pivotDate}'::timestamptz - INTERVAL '30 days'
      `)),
      db.execute(sql.raw(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
               SUM(CASE WHEN second_approval_required = true THEN 1 ELSE 0 END) AS needed_l2
        FROM booking_disputes
        WHERE created_at >= '${pivotDate}'::timestamptz
          AND created_at < '${pivotDate}'::timestamptz + INTERVAL '30 days'
      `)),
    ]);

    const bRow  = before.rows[0] as any;
    const aRow  = after.rows[0] as any;
    const dbRow = disputesBefore.rows[0] as any;
    const daRow = disputesAfter.rows[0] as any;

    const dbTotal = toNum(dbRow?.total ?? 0);
    const daTotal = toNum(daRow?.total ?? 0);

    res.json({
      policy: {
        id:        toNum(policy.id),
        name:      policy.name,
        policyType: policy.policy_type,
        isActive:  Boolean(policy.is_active),
      },
      pivotDate,
      versions: versions.map(v => ({
        versionNumber: toNum(v.version_number),
        changeType:    v.change_type,
        changedAt:     v.changed_at,
        changedBy:     v.changed_by,
      })),
      policyExecutions: {
        before: {
          totalFires:  toNum(bRow?.total_fires ?? 0),
          autoApproved: toNum(bRow?.auto_approved ?? 0),
          flagged:      toNum(bRow?.flagged ?? 0),
        },
        after: {
          totalFires:  toNum(aRow?.total_fires ?? 0),
          autoApproved: toNum(aRow?.auto_approved ?? 0),
          flagged:      toNum(aRow?.flagged ?? 0),
        },
      },
      disputes: {
        before: {
          total:         dbTotal,
          resolved:      toNum(dbRow?.resolved ?? 0),
          neededL2:      toNum(dbRow?.needed_l2 ?? 0),
          resolutionRate: dbTotal > 0 ? Math.round((toNum(dbRow?.resolved ?? 0) / dbTotal) * 100) : null,
        },
        after: {
          total:         daTotal,
          resolved:      toNum(daRow?.resolved ?? 0),
          neededL2:      toNum(daRow?.needed_l2 ?? 0),
          resolutionRate: daTotal > 0 ? Math.round((toNum(daRow?.resolved ?? 0) / daTotal) * 100) : null,
        },
      },
    });
  } catch (err: any) {
    logger.error('[Executive] policy-impact error', { error: err.message });
    res.status(500).json({ error: 'policy_impact_error' });
  }
});

export default router;
