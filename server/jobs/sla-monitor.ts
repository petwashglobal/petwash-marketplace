/**
 * server/jobs/sla-monitor.ts
 * Phase 12.10 — SLA Breach Detection & Escalation
 *
 * Called every 5 minutes from BackgroundJobProcessor.
 *
 * For each active case (disputes / mismatches / refunds):
 *   1. Compute SLA status: within_sla | at_risk | breached
 *   2. Upsert into case_sla_states (persisted — not frontend-only)
 *   3. On first breach detection:
 *      a. Log 'sla_breached' event in case_escalation_log
 *      b. Find franchise owner for the case's station
 *      c. Reassign (auto-escalate) to franchise owner, fallback platform_admin
 *      d. Log 'auto_escalated' event
 *      e. Emit notification hook (placeholder)
 *
 * SLA budgets match case-queue.ts:
 *   dispute open=48h  under_review=72h  mismatch=24h  refund=120h
 *   at_risk threshold = 80% of budget
 *
 * State transitions are append-only; previous assignments are preserved
 * via is_active=false in case_assignments.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { applyGovernance } from '../lib/policy-engine';

// ─── SLA constants ────────────────────────────────────────────────────────────

const SLA = {
  DISPUTE_OPEN:         48,
  DISPUTE_UNDER_REVIEW: 72,
  MISMATCH:             24,
  REFUND:               120,
  AT_RISK_PCT:          0.80,
};

// T113 — Role-based SLA budgets (manager = stricter)
const SLA_BY_ROLE: Record<string, Record<'agent' | 'manager', number>> = {
  dispute:  { agent: 48,  manager: 24 },
  mismatch: { agent: 24,  manager: 12 },
  refund:   { agent: 120, manager: 48 },
};

async function getOwnerRole(caseType: string, caseRefId: string): Promise<'agent' | 'manager'> {
  try {
    const r = await db.execute(sql.raw(`
      SELECT tm.role
      FROM case_assignments ca
      JOIN team_members tm ON tm.user_uid = ca.assigned_to_uid
      WHERE ca.case_type   = '${safe(caseType)}'
        AND ca.case_ref_id = '${safe(caseRefId)}'
        AND ca.is_active   = true
      LIMIT 1
    `));
    const role = (r.rows[0] as any)?.role;
    return role === 'manager' ? 'manager' : 'agent';
  } catch { return 'agent'; }
}

function roleBudget(caseType: string, baseBudget: number, role: 'agent' | 'manager'): number {
  const cfg = SLA_BY_ROLE[caseType];
  if (!cfg) return baseBudget;
  return cfg[role];
}

// ─── Notification hook ────────────────────────────────────────────────────────
// Phase 12.11: replace console/logger with real push/email/in-app delivery.

function notifyHook(
  event: 'assigned' | 'escalated' | 'breached',
  caseType: string,
  caseRefId: string,
  toUid: string,
): void {
  logger.info('[SLANotify]', { event, caseType, caseRefId, toUid });
  // TODO Phase 12.11: push to notification system
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safe = (s: unknown) => String(s ?? '').replace(/'/g, "''");

async function getCurrentAssignment(caseType: string, caseRefId: string): Promise<string | null> {
  try {
    const r = await db.execute(sql.raw(`
      SELECT assigned_to_uid FROM case_assignments
      WHERE case_type = '${safe(caseType)}' AND case_ref_id = '${safe(caseRefId)}' AND is_active = true
      LIMIT 1
    `));
    return (r.rows[0] as any)?.assigned_to_uid ?? null;
  } catch { return null; }
}

/**
 * Find the franchise owner UID for the station associated with this case.
 * Fallback: null (caller will use 'platform_admin').
 */
async function findFranchiseOwner(caseType: string, caseRefId: string): Promise<string | null> {
  try {
    let q: string;
    if (caseType === 'dispute') {
      q = `
        SELECT fo.owner_user_id
        FROM booking_disputes bd
        JOIN bookings b ON b.id = bd.booking_id
        JOIN stations st ON st.id = b.station_id
        JOIN franchise_owners fo ON fo.id = st.franchise_id
        WHERE bd.id::text = '${safe(caseRefId)}' AND fo.status = 'active'
        LIMIT 1`;
    } else if (caseType === 'mismatch') {
      const sid = caseRefId.replace('mismatch-', '');
      q = `
        SELECT fo.owner_user_id
        FROM station_settlements ss
        JOIN stations st ON st.id = ss.station_id
        JOIN franchise_owners fo ON fo.id = st.franchise_id
        WHERE ss.id::text = '${safe(sid)}' AND fo.status = 'active'
        LIMIT 1`;
    } else {
      const bid = caseRefId.replace('refund-', '');
      q = `
        SELECT fo.owner_user_id
        FROM bookings b
        JOIN stations st ON st.id = b.station_id
        JOIN franchise_owners fo ON fo.id = st.franchise_id
        WHERE b.id::text = '${safe(bid)}' AND fo.status = 'active'
        LIMIT 1`;
    }
    const r = await db.execute(sql.raw(q));
    return (r.rows[0] as any)?.owner_user_id ?? null;
  } catch (err: any) {
    logger.error('[SLAMonitor] findFranchiseOwner', { error: err.message });
    return null;
  }
}

async function doEscalate(
  caseType: string,
  caseRefId: string,
  fromUid: string | null,
  toUid: string,
  slaBudgetHours: number,
  ageHours: number,
): Promise<void> {
  // Deactivate current assignment
  await db.execute(sql.raw(`
    UPDATE case_assignments SET is_active = false
    WHERE case_type = '${safe(caseType)}' AND case_ref_id = '${safe(caseRefId)}' AND is_active = true
  `));

  // Insert escalation assignment
  await db.execute(sql.raw(`
    INSERT INTO case_assignments
      (case_type, case_ref_id, assigned_to_uid, assigned_by_uid, note, is_active)
    VALUES (
      '${safe(caseType)}',
      '${safe(caseRefId)}',
      '${safe(toUid)}',
      'system',
      'Auto-escalated: SLA of ${slaBudgetHours}h exceeded at ${Math.round(ageHours)}h',
      true
    )
  `));

  // Log escalation event
  await db.execute(sql.raw(`
    INSERT INTO case_escalation_log (case_type, case_ref_id, event_type, from_uid, to_uid, note)
    VALUES (
      '${safe(caseType)}',
      '${safe(caseRefId)}',
      'auto_escalated',
      ${fromUid ? `'${safe(fromUid)}'` : 'NULL'},
      '${safe(toUid)}',
      'SLA ${slaBudgetHours}h exceeded — auto-escalated at ${Math.round(ageHours)}h'
    )
  `));

  // Stamp escalation on sla_states
  await db.execute(sql.raw(`
    UPDATE case_sla_states
    SET escalated_at = NOW(), escalated_to_uid = '${safe(toUid)}'
    WHERE case_type = '${safe(caseType)}' AND case_ref_id = '${safe(caseRefId)}'
  `));

  notifyHook('escalated', caseType, caseRefId, toUid);
  logger.info('[SLAMonitor] Escalated', { caseType, caseRefId, from: fromUid, to: toUid });
}

// ─── Per-case SLA processing ──────────────────────────────────────────────────

interface CaseRecord {
  caseType:       string;
  caseRefId:      string;
  ageHours:       number;
  slaBudgetHours: number;
}

async function processCases(cases: CaseRecord[]): Promise<{ newBreaches: number; escalated: number }> {
  let newBreaches = 0, escalated = 0;

  for (const c of cases) {
    const { caseType, caseRefId, ageHours } = c;

    // T113: adjust budget for current owner's role (manager = stricter)
    const ownerRole     = await getOwnerRole(caseType, caseRefId);
    const slaBudgetHours = roleBudget(caseType, c.slaBudgetHours, ownerRole);

    const slaStatus: 'within_sla' | 'at_risk' | 'breached' =
      ageHours >= slaBudgetHours                  ? 'breached'   :
      ageHours >= slaBudgetHours * SLA.AT_RISK_PCT ? 'at_risk'   :
                                                     'within_sla';

    // Get previous persisted state
    const prev = await db.execute(sql.raw(`
      SELECT sla_status, escalated_at
      FROM case_sla_states
      WHERE case_type = '${safe(caseType)}' AND case_ref_id = '${safe(caseRefId)}'
      LIMIT 1
    `));
    const prevStatus    = (prev.rows[0] as any)?.sla_status  ?? null;
    const alreadyEscalated = (prev.rows[0] as any)?.escalated_at != null;

    // Upsert SLA state
    await db.execute(sql.raw(`
      INSERT INTO case_sla_states
        (case_type, case_ref_id, sla_status, sla_budget_hours, age_hours, breach_detected_at, checked_at)
      VALUES (
        '${safe(caseType)}', '${safe(caseRefId)}', '${slaStatus}',
        ${slaBudgetHours}, ${Math.round(ageHours * 100) / 100},
        ${slaStatus === 'breached' ? 'NOW()' : 'NULL'},
        NOW()
      )
      ON CONFLICT (case_type, case_ref_id) DO UPDATE SET
        sla_status       = EXCLUDED.sla_status,
        sla_budget_hours = EXCLUDED.sla_budget_hours,
        age_hours        = EXCLUDED.age_hours,
        breach_detected_at = CASE
          WHEN case_sla_states.breach_detected_at IS NULL AND EXCLUDED.sla_status = 'breached'
          THEN NOW()
          ELSE case_sla_states.breach_detected_at
        END,
        checked_at = NOW()
    `));

    // First at-risk transition: run governance warning playbooks
    if (slaStatus === 'at_risk' && prevStatus === 'within_sla') {
      try {
        await applyGovernance('sla_at_risk', { caseType, caseRefId, slaStatus: 'at_risk' }, 'escalation_rule');
      } catch (govErr: any) {
        logger.warn('[SlaMonitor] governance at_risk hook error', { caseRefId, error: govErr.message });
      }
    }

    // First breach: log + escalate
    if (slaStatus === 'breached' && prevStatus !== 'breached') {
      newBreaches++;
      notifyHook('breached', caseType, caseRefId, 'platform');

      // Breach event
      await db.execute(sql.raw(`
        INSERT INTO case_escalation_log (case_type, case_ref_id, event_type, note)
        VALUES (
          '${safe(caseType)}', '${safe(caseRefId)}', 'sla_breached',
          'SLA ${slaBudgetHours}h exceeded at ${Math.round(ageHours)}h'
        )
      `));

      if (!alreadyEscalated) {
        const currentAssignee = await getCurrentAssignment(caseType, caseRefId);
        const franchiseOwner  = await findFranchiseOwner(caseType, caseRefId);
        const escalateTo      = franchiseOwner ?? 'platform_admin';

        if (currentAssignee !== escalateTo) {
          await doEscalate(caseType, caseRefId, currentAssignee, escalateTo, slaBudgetHours, ageHours);
          escalated++;
        }
      }

      // Phase 12.13: Run governance escalation playbooks for the breach
      try {
        await applyGovernance('sla_breached', { caseType, caseRefId, slaStatus: 'breached' }, 'escalation_rule');
      } catch (govErr: any) {
        logger.warn('[SlaMonitor] governance breach hook error', { caseRefId, error: govErr.message });
      }
    }
  }

  return { newBreaches, escalated };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runSlaMonitor(): Promise<void> {
  const t0 = Date.now();
  let checked = 0, breaches = 0, escalated = 0;

  try {
    // ── Disputes ──────────────────────────────────────────────────────────
    const dRows = await db.execute(sql.raw(`
      SELECT
        bd.id::text                                                     AS case_ref_id,
        EXTRACT(EPOCH FROM (NOW() - bd.created_at)) / 3600             AS age_hours,
        CASE WHEN bd.status = 'under_review' THEN ${SLA.DISPUTE_UNDER_REVIEW}
             ELSE ${SLA.DISPUTE_OPEN} END                              AS sla_budget_hours
      FROM booking_disputes bd
      WHERE bd.status IN ('open', 'under_review')
      LIMIT 2000
    `));
    const disputeCases: CaseRecord[] = (dRows.rows as any[]).map(r => ({
      caseType: 'dispute', caseRefId: String(r.case_ref_id),
      ageHours: Number(r.age_hours), slaBudgetHours: Number(r.sla_budget_hours),
    }));
    const dr = await processCases(disputeCases);
    checked += disputeCases.length; breaches += dr.newBreaches; escalated += dr.escalated;

    // ── Mismatches ────────────────────────────────────────────────────────
    const mRows = await db.execute(sql.raw(`
      SELECT
        'mismatch-' || ss.id::text                                     AS case_ref_id,
        EXTRACT(EPOCH FROM (NOW() - ss.created_at)) / 3600             AS age_hours,
        ${SLA.MISMATCH}                                                AS sla_budget_hours
      FROM station_settlements ss
      WHERE ss.total_amount_cents
              != (ss.platform_amount_cents + ss.station_amount_cents + COALESCE(ss.franchise_amount_cents, 0))
      LIMIT 2000
    `));
    const mismatchCases: CaseRecord[] = (mRows.rows as any[]).map(r => ({
      caseType: 'mismatch', caseRefId: String(r.case_ref_id),
      ageHours: Number(r.age_hours), slaBudgetHours: Number(r.sla_budget_hours),
    }));
    const mr = await processCases(mismatchCases);
    checked += mismatchCases.length; breaches += mr.newBreaches; escalated += mr.escalated;

    // ── Refunds ───────────────────────────────────────────────────────────
    const rRows = await db.execute(sql.raw(`
      SELECT
        'refund-' || b.id::text                                        AS case_ref_id,
        EXTRACT(EPOCH FROM (NOW() - b.refund_requested_at)) / 3600    AS age_hours,
        ${SLA.REFUND}                                                  AS sla_budget_hours
      FROM bookings b
      WHERE b.refund_status IN ('pending', 'processing')
        AND b.refund_requested_at IS NOT NULL
      LIMIT 2000
    `));
    const refundCases: CaseRecord[] = (rRows.rows as any[]).map(r => ({
      caseType: 'refund', caseRefId: String(r.case_ref_id),
      ageHours: Number(r.age_hours), slaBudgetHours: Number(r.sla_budget_hours),
    }));
    const rr = await processCases(refundCases);
    checked += refundCases.length; breaches += rr.newBreaches; escalated += rr.escalated;

    logger.info('[SLAMonitor] Complete', { checked, newBreaches: breaches, escalated, ms: Date.now() - t0 });
  } catch (err: any) {
    logger.error('[SLAMonitor] Run failed', { error: err.message, ms: Date.now() - t0 });
  }
}
