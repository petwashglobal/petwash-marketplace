import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import {
  checkFinancialAuthority,
  getApprovalRule,
  logFinancialApproval,
  canUserApproveFinancialAction,
  explainFinancialApproval,
  type ApprovalRule,
} from '../lib/financial-approvals';

const router = Router();

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const ALLOWED_MACHINE_IPS_FA = (process.env.ALLOWED_MACHINE_IPS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function getClientIpFA(req: Request): string {
  return (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

function getActingRole(req: Request): string {
  // Admin secret = admin — enforce IP allowlist when configured
  if (req.headers['x-admin-secret'] === process.env.ADMIN_SECRET) {
    if (ALLOWED_MACHINE_IPS_FA.length > 0) {
      const clientIp = getClientIpFA(req);
      if (!ALLOWED_MACHINE_IPS_FA.includes(clientIp)) return 'agent'; // fall through to token auth
    }
    return 'admin';
  }
  // Decoded Firebase token roles
  const decoded = (req as any).decodedToken;
  if (decoded?.executive) return 'executive';
  if (decoded?.admin) return 'admin';
  if (decoded?.franchise_owner) return 'franchise_owner';
  if (decoded?.manager) return 'manager';
  if (decoded?.role === 'executive') return 'executive';
  if (decoded?.role === 'franchise_owner') return 'franchise_owner';
  if (decoded?.role === 'manager') return 'manager';
  return 'agent';
}

function getActingUid(req: Request): string | null {
  return (req as any).decodedToken?.uid ?? null;
}

// ---------------------------------------------------------------------------
// T161 — Matrix CRUD
// ---------------------------------------------------------------------------

// GET /api/financial-approvals/matrix
router.get('/matrix', async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT * FROM financial_approval_matrix ORDER BY case_type, min_amount_cents
    `);
    return res.json({ rules: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/financial-approvals/matrix
router.post('/matrix', async (req: Request, res: Response) => {
  try {
    const {
      case_type, action_type, owner_scope = 'global', owner_id = null,
      min_amount_cents = 0, max_amount_cents = null,
      required_role, second_approval_role = null,
    } = req.body;

    if (!case_type || !action_type || !required_role) {
      return res.status(400).json({ error: 'case_type, action_type, required_role required' });
    }

    const result = await db.execute(sql`
      INSERT INTO financial_approval_matrix
        (case_type, action_type, owner_scope, owner_id, min_amount_cents, max_amount_cents,
         required_role, second_approval_role)
      VALUES
        (${case_type}, ${action_type}, ${owner_scope}, ${owner_id},
         ${min_amount_cents}, ${max_amount_cents}, ${required_role}, ${second_approval_role})
      RETURNING *
    `);
    return res.status(201).json({ rule: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/financial-approvals/matrix/:id
router.patch('/matrix/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      required_role, second_approval_role, min_amount_cents, max_amount_cents,
      is_active, owner_scope, owner_id,
    } = req.body;

    const result = await db.execute(sql`
      UPDATE financial_approval_matrix SET
        required_role = COALESCE(${required_role ?? null}, required_role),
        second_approval_role = CASE WHEN ${second_approval_role !== undefined ? 'true' : 'false'}::boolean THEN ${second_approval_role ?? null} ELSE second_approval_role END,
        min_amount_cents = COALESCE(${min_amount_cents ?? null}, min_amount_cents),
        max_amount_cents = CASE WHEN ${max_amount_cents !== undefined ? 'true' : 'false'}::boolean THEN ${max_amount_cents ?? null} ELSE max_amount_cents END,
        is_active = COALESCE(${is_active ?? null}, is_active),
        owner_scope = COALESCE(${owner_scope ?? null}, owner_scope),
        owner_id = CASE WHEN ${owner_id !== undefined ? 'true' : 'false'}::boolean THEN ${owner_id ?? null} ELSE owner_id END
      WHERE id = ${id}
      RETURNING *
    `);
    if (!result.rows[0]) return res.status(404).json({ error: 'Rule not found' });
    return res.json({ rule: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/financial-approvals/matrix/:id  (soft deactivate)
router.delete('/matrix/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.execute(sql`UPDATE financial_approval_matrix SET is_active = false WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T162 / T168 — Authority check (dry run)
// ---------------------------------------------------------------------------

// POST /api/financial-approvals/check
router.post('/check', async (req: Request, res: Response) => {
  try {
    const {
      case_type, action_type, amount_cents,
      user_role, owner_scope = 'global', owner_id = null,
    } = req.body;

    if (!case_type || !action_type || amount_cents === undefined || !user_role) {
      return res.status(400).json({ error: 'case_type, action_type, amount_cents, user_role required' });
    }

    const decision = await checkFinancialAuthority(
      case_type, action_type, amount_cents, user_role, owner_scope, owner_id
    );
    return res.json(decision);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T167 — Executive approval queue
// ---------------------------------------------------------------------------

// GET /api/financial-approvals/queue
router.get('/queue', async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'pending';

    // Pending refund approvals
    const refundsRaw = await db.execute(sql`
      SELECT
        ra.id,
        'refund'                          AS "caseType",
        ra.refund_request_id              AS "caseRefId",
        'approve'                         AS "actionType",
        ra.amount_cents                   AS "amountCents",
        ROUND(ra.amount_cents::numeric / 100, 2) AS "amountILS",
        ra.requested_by_uid               AS "requestedBy",
        ra.status                         AS "currentStatus",
        'global'                          AS "ownerScope",
        NULL                              AS "ownerId",
        ROUND(EXTRACT(EPOCH FROM (NOW() - ra.created_at))/3600, 1) AS "ageHours",
        ra.booking_id                     AS "bookingId",
        fal.id                            AS "logId",
        fal.second_approved_by_uid        AS "secondApprovedBy",
        fal.approval_rule_id              AS "approvalRuleId"
      FROM refund_approvals ra
      LEFT JOIN financial_approval_log fal
        ON fal.case_ref_id = ra.refund_request_id AND fal.case_type = 'refund'
      WHERE ra.status = ${status}
    `);

    // Pending payout batches
    const payoutsRaw = await db.execute(sql`
      SELECT
        pb.id,
        'payout_release'                  AS "caseType",
        pb.batch_id                       AS "caseRefId",
        'release'                         AS "actionType",
        pb.total_net_cents                AS "amountCents",
        ROUND(pb.total_net_cents::numeric / 100, 2) AS "amountILS",
        pb.created_by_uid                 AS "requestedBy",
        pb.status                         AS "currentStatus",
        'global'                          AS "ownerScope",
        NULL                              AS "ownerId",
        ROUND(EXTRACT(EPOCH FROM (NOW() - pb.created_at))/3600, 1) AS "ageHours",
        NULL                              AS "bookingId",
        fal.id                            AS "logId",
        fal.second_approved_by_uid        AS "secondApprovedBy",
        fal.approval_rule_id              AS "approvalRuleId"
      FROM payout_batches pb
      LEFT JOIN financial_approval_log fal
        ON fal.case_ref_id = pb.batch_id AND fal.case_type = 'payout_release'
      WHERE pb.status IN ('pending', 'held')
        AND ${status} = 'pending'
      UNION ALL
      SELECT
        pb.id,
        'payout_release'                  AS "caseType",
        pb.batch_id                       AS "caseRefId",
        'release'                         AS "actionType",
        pb.total_net_cents                AS "amountCents",
        ROUND(pb.total_net_cents::numeric / 100, 2) AS "amountILS",
        pb.created_by_uid                 AS "requestedBy",
        pb.status                         AS "currentStatus",
        'global'                          AS "ownerScope",
        NULL                              AS "ownerId",
        ROUND(EXTRACT(EPOCH FROM (NOW() - pb.created_at))/3600, 1) AS "ageHours",
        NULL                              AS "bookingId",
        fal.id                            AS "logId",
        fal.second_approved_by_uid        AS "secondApprovedBy",
        fal.approval_rule_id              AS "approvalRuleId"
      FROM payout_batches pb
      LEFT JOIN financial_approval_log fal
        ON fal.case_ref_id = pb.batch_id AND fal.case_type = 'payout_release'
      WHERE pb.status = 'released'
        AND ${status} = 'approved'
    `);

    // Today's approvals from log
    const todayRaw = await db.execute(sql`
      SELECT * FROM financial_approval_log
      WHERE DATE(created_at) = CURRENT_DATE
      ORDER BY created_at DESC
    `);

    // Determine required roles for each item
    const enrichRow = async (row: any) => {
      const rule = await getApprovalRule(
        row.caseType, row.actionType, row.ownerScope, row.ownerId, row.amountCents ?? 0
      );
      return {
        ...row,
        requiredRole: rule?.required_role ?? 'unknown',
        secondApprovalRequired: !!(rule?.second_approval_role),
        secondApprovalRole: rule?.second_approval_role ?? null,
      };
    };

    const refunds = await Promise.all((refundsRaw.rows as any[]).map(enrichRow));
    const payouts = await Promise.all((payoutsRaw.rows as any[]).map(enrichRow));

    return res.json({
      pending: status === 'pending' ? [...refunds, ...payouts] : [],
      approvedToday: todayRaw.rows.filter((r: any) => r.status === 'approved'),
      rejectedToday: todayRaw.rows.filter((r: any) => r.status === 'rejected'),
      executedToday: todayRaw.rows.filter((r: any) => r.status === 'executed'),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T167 — Approve / Reject individual financial actions
// ---------------------------------------------------------------------------

// POST /api/financial-approvals/approve
router.post('/approve', async (req: Request, res: Response) => {
  try {
    const {
      case_type, case_ref_id, action_type, amount_cents,
      owner_scope = 'global', owner_id = null, note = null,
    } = req.body;

    if (!case_type || !case_ref_id || !action_type || amount_cents === undefined) {
      return res.status(400).json({ error: 'case_type, case_ref_id, action_type, amount_cents required' });
    }

    const actingRole = getActingRole(req);
    const actingUid = getActingUid(req);

    const decision = await checkFinancialAuthority(
      case_type, action_type, amount_cents, actingRole, owner_scope, owner_id
    );

    if (!decision.allowed) {
      return res.status(403).json({
        error: 'Insufficient authority',
        ...decision,
      });
    }

    const status = decision.secondApprovalRequired ? 'pending' : 'approved';

    const logId = await logFinancialApproval({
      case_type,
      case_ref_id,
      action_type,
      amount_cents,
      owner_scope,
      owner_id,
      requested_by_uid: actingUid,
      approved_by_uid: actingUid,
      approval_rule_id: decision.matchedRule?.id ?? null,
      status,
      note,
    });

    // If approved and no second approval required, execute the underlying action
    if (status === 'approved') {
      await executeFinancialAction(case_type, case_ref_id, action_type, actingUid, logId);
    }

    return res.json({
      logId,
      status,
      decision,
      message: decision.secondApprovalRequired
        ? `First approval recorded. Awaiting second approval from '${decision.secondApprovalRole}'`
        : 'Approved and executed',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/financial-approvals/second-approve/:logId
router.post('/second-approve/:logId', async (req: Request, res: Response) => {
  try {
    const logId = parseInt(req.params.logId, 10);
    const actingRole = getActingRole(req);
    const actingUid = getActingUid(req);
    const { note = null } = req.body;

    const logRaw = await db.execute(sql`
      SELECT fal.*, fam.second_approval_role
      FROM financial_approval_log fal
      LEFT JOIN financial_approval_matrix fam ON fam.id = fal.approval_rule_id
      WHERE fal.id = ${logId}
    `);
    const logRow = logRaw.rows[0] as any;
    if (!logRow) return res.status(404).json({ error: 'Approval log entry not found' });
    if (logRow.status !== 'pending') return res.status(409).json({ error: 'Not awaiting second approval' });

    const requiredSecondRole = logRow.second_approval_role;
    if (requiredSecondRole) {
      const ROLE_HIERARCHY: Record<string, number> = {
        agent: 1, manager: 2, franchise_owner: 3, admin: 4, executive: 5,
      };
      if ((ROLE_HIERARCHY[actingRole] ?? 0) < (ROLE_HIERARCHY[requiredSecondRole] ?? 99)) {
        return res.status(403).json({
          error: `Role '${actingRole}' cannot provide second approval — requires '${requiredSecondRole}'`,
        });
      }
    }

    await db.execute(sql`
      UPDATE financial_approval_log SET
        status = 'approved',
        second_approved_by_uid = ${actingUid},
        approved_at = NOW(),
        note = COALESCE(${note}, note)
      WHERE id = ${logId}
    `);

    await executeFinancialAction(
      logRow.case_type, logRow.case_ref_id, logRow.action_type, actingUid, logId
    );

    return res.json({ logId, status: 'approved', message: 'Second approval granted and executed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/financial-approvals/reject
router.post('/reject', async (req: Request, res: Response) => {
  try {
    const {
      case_type, case_ref_id, action_type, amount_cents,
      owner_scope = 'global', owner_id = null, note = null,
      log_id = null,
    } = req.body;

    const actingUid = getActingUid(req);

    if (log_id) {
      await db.execute(sql`
        UPDATE financial_approval_log SET status = 'rejected', note = COALESCE(${note}, note)
        WHERE id = ${parseInt(log_id, 10)}
      `);
    } else {
      if (!case_type || !case_ref_id || !action_type || amount_cents === undefined) {
        return res.status(400).json({ error: 'case_type, case_ref_id, action_type, amount_cents required' });
      }
      await logFinancialApproval({
        case_type, case_ref_id, action_type, amount_cents,
        owner_scope, owner_id, requested_by_uid: actingUid,
        approved_by_uid: null, status: 'rejected', note,
      });
    }

    // Mark underlying item as rejected
    if (case_type === 'refund') {
      await db.execute(sql`
        UPDATE refund_approvals SET status = 'rejected', reviewed_by_uid = ${actingUid}, reviewed_at = NOW()
        WHERE refund_request_id = ${case_ref_id}
      `);
    }

    return res.json({ ok: true, status: 'rejected' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T164 — Payout release gate
// ---------------------------------------------------------------------------

// POST /api/financial-approvals/payout-release-gate
router.post('/payout-release-gate', async (req: Request, res: Response) => {
  try {
    const { settlement_id, amount_cents, owner_scope = 'global', owner_id = null } = req.body;
    if (!settlement_id || amount_cents === undefined) {
      return res.status(400).json({ error: 'settlement_id and amount_cents required' });
    }

    const actingRole = getActingRole(req);
    const actingUid = getActingUid(req);
    const decision = await checkFinancialAuthority(
      'payout_release', 'release', amount_cents, actingRole, owner_scope, owner_id
    );

    if (!decision.allowed) {
      // Hold the settlement
      await db.execute(sql`
        UPDATE station_settlements SET
          payout_hold_reason = ${decision.reason},
          second_release_approval_required = true
        WHERE id = ${settlement_id}
      `);
      return res.status(403).json({ error: 'Insufficient authority to release payout', ...decision });
    }

    if (decision.secondApprovalRequired) {
      await db.execute(sql`
        UPDATE station_settlements SET
          payout_release_requested_at = NOW(),
          payout_hold_reason = ${decision.reason},
          second_release_approval_required = true
        WHERE id = ${settlement_id}
      `);
      const logId = await logFinancialApproval({
        case_type: 'payout_release',
        case_ref_id: String(settlement_id),
        action_type: 'release',
        amount_cents,
        owner_scope,
        owner_id,
        requested_by_uid: actingUid,
        approved_by_uid: actingUid,
        approval_rule_id: decision.matchedRule?.id ?? null,
        status: 'pending',
      });
      return res.json({
        held: true,
        logId,
        decision,
        message: `Payout held — awaiting second approval from '${decision.secondApprovalRole}'`,
      });
    }

    // Immediate release authorized
    await db.execute(sql`
      UPDATE station_settlements SET
        status = 'settled',
        payout_release_approved_at = NOW(),
        payout_release_approved_by = ${actingUid},
        second_release_approval_required = false
      WHERE id = ${settlement_id}
    `);
    await logFinancialApproval({
      case_type: 'payout_release',
      case_ref_id: String(settlement_id),
      action_type: 'release',
      amount_cents,
      owner_scope,
      owner_id,
      requested_by_uid: actingUid,
      approved_by_uid: actingUid,
      approval_rule_id: decision.matchedRule?.id ?? null,
      status: 'executed',
    });
    return res.json({ released: true, decision });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T165 — Dispute reserve
// ---------------------------------------------------------------------------

// POST /api/financial-approvals/reserve
router.post('/reserve', async (req: Request, res: Response) => {
  try {
    const { settlement_id, reason } = req.body;
    if (!settlement_id) return res.status(400).json({ error: 'settlement_id required' });

    await db.execute(sql`
      UPDATE station_settlements SET
        held_in_reserve = true,
        reserve_reason = ${reason ?? 'Dispute open'},
        status = 'pending'
      WHERE id = ${settlement_id}
    `);
    return res.json({ ok: true, held: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/financial-approvals/release-reserve
router.post('/release-reserve', async (req: Request, res: Response) => {
  try {
    const { settlement_id } = req.body;
    if (!settlement_id) return res.status(400).json({ error: 'settlement_id required' });

    await db.execute(sql`
      UPDATE station_settlements SET
        held_in_reserve = false,
        reserve_reason = NULL
      WHERE id = ${settlement_id}
    `);
    return res.json({ ok: true, released: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/financial-approvals/reserve-summary
router.get('/reserve-summary', async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN held_in_reserve = false AND status = 'settled' AND payout_hold_reason IS NULL THEN station_amount_cents ELSE 0 END), 0) AS gross_payable_cents,
        COALESCE(SUM(CASE WHEN held_in_reserve = true THEN station_amount_cents ELSE 0 END), 0)                                                        AS held_in_reserve_cents,
        COALESCE(SUM(CASE WHEN payout_hold_reason IS NOT NULL AND held_in_reserve = false THEN station_amount_cents ELSE 0 END), 0)                    AS blocked_by_hold_cents,
        COALESCE(SUM(CASE WHEN status = 'settled' AND payout_release_approved_at IS NOT NULL THEN station_amount_cents ELSE 0 END), 0)                 AS released_cents,
        COUNT(*) FILTER (WHERE held_in_reserve = true)                                                                                                  AS reserve_count,
        COUNT(*) FILTER (WHERE payout_hold_reason IS NOT NULL)                                                                                          AS hold_count
      FROM station_settlements
    `);
    return res.json(result.rows[0] ?? {});
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// T166 — Approval log
// ---------------------------------------------------------------------------

// GET /api/financial-approvals/log
router.get('/log', async (req: Request, res: Response) => {
  try {
    const caseType = (req.query.case_type as string) || null;
    const statusFilter = (req.query.status as string) || null;
    const limitN = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
    const offsetN = parseInt((req.query.offset as string) || '0', 10);

    // Build filters only for values that are actually set — avoids null-param binding issues
    let result;
    if (caseType && statusFilter) {
      result = await db.execute(sql`
        SELECT fal.*, fam.required_role, fam.second_approval_role
        FROM financial_approval_log fal
        LEFT JOIN financial_approval_matrix fam ON fam.id = fal.approval_rule_id
        WHERE fal.case_type = ${caseType} AND fal.status = ${statusFilter}
        ORDER BY fal.created_at DESC LIMIT ${limitN} OFFSET ${offsetN}
      `);
    } else if (caseType) {
      result = await db.execute(sql`
        SELECT fal.*, fam.required_role, fam.second_approval_role
        FROM financial_approval_log fal
        LEFT JOIN financial_approval_matrix fam ON fam.id = fal.approval_rule_id
        WHERE fal.case_type = ${caseType}
        ORDER BY fal.created_at DESC LIMIT ${limitN} OFFSET ${offsetN}
      `);
    } else if (statusFilter) {
      result = await db.execute(sql`
        SELECT fal.*, fam.required_role, fam.second_approval_role
        FROM financial_approval_log fal
        LEFT JOIN financial_approval_matrix fam ON fam.id = fal.approval_rule_id
        WHERE fal.status = ${statusFilter}
        ORDER BY fal.created_at DESC LIMIT ${limitN} OFFSET ${offsetN}
      `);
    } else {
      result = await db.execute(sql`
        SELECT fal.*, fam.required_role, fam.second_approval_role
        FROM financial_approval_log fal
        LEFT JOIN financial_approval_matrix fam ON fam.id = fal.approval_rule_id
        ORDER BY fal.created_at DESC LIMIT ${limitN} OFFSET ${offsetN}
      `);
    }
    return res.json({ log: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Internal helper — execute the approved financial action
// ---------------------------------------------------------------------------

async function executeFinancialAction(
  caseType: string,
  caseRefId: string,
  actionType: string,
  actingUid: string | null,
  logId: number
) {
  if (caseType === 'refund' && actionType === 'approve') {
    await db.execute(sql`
      UPDATE refund_approvals
      SET status = 'approved', reviewed_by_uid = ${actingUid}, reviewed_at = NOW()
      WHERE refund_request_id = ${caseRefId} AND status = 'pending'
    `);
    await db.execute(sql`
      UPDATE financial_approval_log SET status = 'executed', executed_at = NOW() WHERE id = ${logId}
    `);
  } else if (caseType === 'payout_release' && actionType === 'release') {
    await db.execute(sql`
      UPDATE station_settlements SET
        status = 'settled',
        payout_release_approved_at = NOW(),
        payout_release_approved_by = ${actingUid},
        second_release_approval_required = false
      WHERE id = ${parseInt(caseRefId, 10)}
    `);
    await db.execute(sql`
      UPDATE financial_approval_log SET status = 'executed', executed_at = NOW() WHERE id = ${logId}
    `);
  } else if (caseType === 'dispute_close' && actionType === 'approve') {
    await db.execute(sql`
      UPDATE booking_disputes SET status = 'closed', resolved_at = NOW()
      WHERE id = ${caseRefId} AND status != 'closed'
    `);
    await db.execute(sql`
      UPDATE financial_approval_log SET status = 'executed', executed_at = NOW() WHERE id = ${logId}
    `);
  }
}

export default router;
