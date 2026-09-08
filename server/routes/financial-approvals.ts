import { Router, Request, Response, NextFunction } from 'express';
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
import { assertOperatingControl } from '../lib/petwashOperatingControlGateway';
import { sendSanitizedError } from '../lib/sanitizeErrorResponse';
import { logger } from '../lib/logger';
import { getActingRole, getActingUid } from '../lib/financialActingRole';

const router = Router();

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * getActingRole / getActingUid moved to server/lib/financialActingRole.ts
 * (2026-09-08) so the admin wallet money routes ask the SAME question this
 * router asks. Two copies of "what role is this caller?" on the money path is
 * how two surfaces end up disagreeing about the same person.
 *
 * Behaviour is unchanged, including the fail-closed 401 throw when neither a
 * valid x-admin-secret nor a decoded token is present.
 */

function assertFinancialExecutionControl(
  req: Request,
  res: Response,
  params: { caseType: string; caseRefId: string; actionType: string; amountCents?: number },
): boolean {
  if (params.caseType === 'refund') {
    return assertOperatingControl(req, res, {
      actionType: 'CUSTOMER_REFUND',
      route: `POST /api/financial-approvals/${params.actionType}`,
      targetId: `refund:${params.caseRefId}`,
      bankMatchStatus: 'pending_match',
      facts: {
        approvalThresholdApplied: true,
        highRiskRefund: (params.amountCents ?? 0) >= 50_000,
      },
      money: {
        amountCents: params.amountCents,
      },
    });
  }

  if (params.caseType === 'payout_release') {
    return assertOperatingControl(req, res, {
      actionType: 'PROVIDER_PAYOUT',
      route: `POST /api/financial-approvals/${params.actionType}`,
      targetId: `payout-release:${params.caseRefId}`,
      bankMatchStatus: 'pending_match',
      facts: {
        payoutApproved: true,
      },
      money: {
        amountCents: params.amountCents,
      },
    });
  }

  return true;
}

// P0-SEC: requireFinancialAdmin — per-route defense-in-depth guard.
// Applied to all write mutations on the approval matrix and all approval execution routes.
// The outer mount already requires validateFirebaseToken, but this guard also enforces
// that the caller holds admin, executive, or franchise_owner — preventing a
// customer-scoped token from triggering financial mutations.
const FINANCIAL_ALLOWED_ROLES = new Set(['admin', 'executive', 'franchise_owner']);

/**
 * POLICY MUTATION IS NARROWER THAN POLICY USE.
 *
 * requireFinancialAdmin admits franchise_owner, which is right for acting on
 * approvals. It is NOT right for editing the approval MATRIX: those routes set
 * thresholds, required roles and an arbitrary owner_scope/owner_id, so a
 * franchise owner could lower the very rule that governs their own authority —
 * or edit another owner's. A person subject to approval rules must not be able
 * to rewrite them.
 */
const POLICY_MUTATION_ROLES = new Set(['admin', 'executive']);

function requirePolicyAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const role = getActingRole(req);
    if (!POLICY_MUTATION_ROLES.has(role)) {
      logger.error('[FinancialApprovals] approval-matrix mutation refused', { role });
      return res.status(403).json({
        error: 'Editing the approval matrix requires admin or executive',
        code: 'POLICY_MUTATION_FORBIDDEN',
        userRole: role,
      });
    }
    return next();
  } catch (err: any) {
    return res.status(err?.status === 401 ? 401 : 403).json({ error: 'Authentication required' });
  }
}

function requireFinancialAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const role = getActingRole(req); // throws 401 if no token/secret
    if (!FINANCIAL_ALLOWED_ROLES.has(role)) {
      return res.status(403).json({
        error: 'Insufficient role — requires admin, executive, or franchise_owner',
        userRole: role,
      });
    }
    next();
  } catch (err: any) {
    return res.status(err.status ?? 401).json({ error: err.message ?? 'Authentication required' });
  }
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
    sendSanitizedError(res, err, 'FIN_APPROVALS_LIST_MATRIX_FAILED', { logContext: { op: 'list-matrix' } });
  }
});

// POST /api/financial-approvals/matrix
router.post('/matrix', requirePolicyAdmin, async (req: Request, res: Response) => {
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
    sendSanitizedError(res, err, 'FIN_APPROVALS_CREATE_MATRIX_RULE_FAILED', { logContext: { op: 'create-matrix-rule' } });
  }
});

// PATCH /api/financial-approvals/matrix/:id
router.patch('/matrix/:id', requirePolicyAdmin, async (req: Request, res: Response) => {
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
    sendSanitizedError(res, err, 'FIN_APPROVALS_UPDATE_MATRIX_RULE_FAILED', { logContext: { op: 'update-matrix-rule' } });
  }
});

// DELETE /api/financial-approvals/matrix/:id  (soft deactivate)
router.delete('/matrix/:id', requirePolicyAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.execute(sql`UPDATE financial_approval_matrix SET is_active = false WHERE id = ${id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    sendSanitizedError(res, err, 'FIN_APPROVALS_DEACTIVATE_MATRIX_RULE_FAILED', { logContext: { op: 'deactivate-matrix-rule' } });
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
    sendSanitizedError(res, err, 'FIN_APPROVALS_CHECK_FAILED', { logContext: { op: 'check-authority' } });
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
    sendSanitizedError(res, err, 'FIN_APPROVALS_QUEUE_FAILED', { logContext: { op: 'list-queue' } });
  }
});

// ---------------------------------------------------------------------------
// T167 — Approve / Reject individual financial actions
// ---------------------------------------------------------------------------

// POST /api/financial-approvals/approve
router.post('/approve', requireFinancialAdmin, async (req: Request, res: Response) => {
  try {
    const {
      case_type, case_ref_id, action_type, amount_cents: assertedAmountCents,
      note = null,
      // owner_scope / owner_id are deliberately NOT destructured. They are
      // rule-selection inputs and are derived from the canonical record below.
    } = req.body;

    if (!case_type || !case_ref_id || !action_type) {
      return res.status(400).json({ error: 'case_type, case_ref_id, action_type required' });
    }

    // Every authority-relevant fact comes from the business object.
    const resolved = await resolveCanonicalFinancialAction(case_type, case_ref_id, action_type);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
    }
    const canonicalAction = resolved.action;
    const amount_cents = canonicalAction.amountCents;
    if (!assertClientAmountMatches(assertedAmountCents, amount_cents, res, {
      route: 'approve', caseType: case_type, caseRefId: case_ref_id,
    })) return;

    const actingRole = getActingRole(req);
    const actingUid = getActingUid(req);

    // owner scope/id come from the canonical record, NOT the body. They select
    // the rule too — an owner-specific rule beats a global one — so a caller
    // who can send 'global' could step around a stricter owner rule.
    const decision = await checkFinancialAuthority(
      canonicalAction.caseType, canonicalAction.actionType, amount_cents,
      actingRole, canonicalAction.ownerScope, canonicalAction.ownerId,
    );

    if (!decision.allowed) {
      return res.status(403).json({
        error: 'Insufficient authority',
        ...decision,
      });
    }

    const status = decision.secondApprovalRequired ? 'pending' : 'approved';

    if (status === 'approved' && !assertFinancialExecutionControl(req, res, {
      caseType: case_type,
      caseRefId: case_ref_id,
      actionType: 'approve',
      amountCents: amount_cents,
    })) {
      return;
    }

    // The log records the canonical facts the decision was made on — it is the
    // OUTPUT of the authority decision, never an input to a later one.
    const logId = await logFinancialApproval({
      case_type: canonicalAction.caseType,
      case_ref_id: canonicalAction.caseRefId,
      action_type: canonicalAction.actionType,
      amount_cents,
      owner_scope: canonicalAction.ownerScope,
      owner_id: canonicalAction.ownerId,
      requested_by_uid: actingUid,
      approved_by_uid: actingUid,
      approval_rule_id: decision.matchedRule?.id ?? null,
      status,
      note,
    });

    // If approved and no second approval required, execute the underlying action.
    // The outcome is REPORTED — never assumed. The executor deliberately
    // withholds some actions (a payout batch has no settlement executor), and
    // telling an operator that money moved when it did not is worse than the
    // missing feature.
    let execution: ExecutionOutcome = { executed: false, code: 'AWAITING_SECOND_APPROVAL' };
    if (status === 'approved') {
      execution = await executeFinancialAction(canonicalAction, actingUid, logId);
    }

    return res.json({
      logId,
      status,
      decision,
      approved: status === 'approved',
      executed: execution.executed,
      executionCode: execution.code,
      message: decision.secondApprovalRequired
        ? `First approval recorded. Awaiting second approval from '${decision.secondApprovalRole}'`
        : execution.executed
          ? 'Approved and executed'
          : 'Approved — execution NOT performed',
    });
  } catch (err: any) {
    sendSanitizedError(res, err, 'FIN_APPROVALS_APPROVE_FAILED', { logContext: { op: 'approve' } });
  }
});

// POST /api/financial-approvals/second-approve/:logId
router.post('/second-approve/:logId', requireFinancialAdmin, async (req: Request, res: Response) => {
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

    if (!assertFinancialExecutionControl(req, res, {
      caseType: logRow.case_type,
      caseRefId: logRow.case_ref_id,
      actionType: 'second-approve',
      amountCents: Number(logRow.amount_cents ?? 0),
    })) {
      return;
    }

    /**
     * VALIDATE FIRST, MUTATE LAST.
     *
     * This used to write status='approved' and stamp second_approved_by_uid
     * BEFORE re-resolving the object. A later mismatch then returned 409 while
     * the row already said "approved" — an approval recorded for an execution
     * that was refused, and a retry that finds a non-pending row.
     */
    const resolvedSecond = await resolveCanonicalFinancialAction(
      logRow.case_type, logRow.case_ref_id, logRow.action_type,
    );
    if (!resolvedSecond.ok) {
      logger.error('[FinancialApprovals] second approval could not re-resolve the canonical action', {
        logId, caseType: logRow.case_type, caseRefId: logRow.case_ref_id, code: resolvedSecond.code,
      });
      return res.status(resolvedSecond.status).json({ error: resolvedSecond.error, code: resolvedSecond.code });
    }
    const secondAction = resolvedSecond.action;

    // The WHOLE set of authority facts, not the amount alone. An ownership or
    // currency change matters exactly as much as a figure change.
    const approvedFingerprint = [
      logRow.case_type, logRow.action_type, secondAction.sourceTable, secondAction.sourceRecordId,
      String(Number(logRow.amount_cents ?? NaN)), secondAction.currency,
      String(logRow.owner_scope ?? ''), String(logRow.owner_id ?? ''),
    ].join('|');
    const currentFingerprint = approvalFingerprint(secondAction);
    if (approvedFingerprint !== currentFingerprint) {
      logger.error('[FinancialApprovals] authority facts moved between first and second approval', {
        logId, approvedFingerprint, currentFingerprint,
      });
      return res.status(409).json({
        error: 'The facts changed since the first approval — re-request approval',
        code: 'APPROVAL_FACTS_CHANGED',
        canonicalAmountCents: secondAction.amountCents,
        canonicalCurrency: secondAction.currency,
      });
    }

    // A second approver must be a different person.
    if (logRow.approved_by_uid && actingUid && String(logRow.approved_by_uid) === String(actingUid)) {
      return res.status(403).json({
        error: 'The first approver cannot also grant the second approval',
        code: 'SELF_SECOND_APPROVAL',
      });
    }

    /**
     * Conditional transition: exactly one concurrent second approval may win.
     */
    const transition = await db.execute(sql`
      UPDATE financial_approval_log SET
        status = 'approved',
        second_approved_by_uid = ${actingUid},
        approved_at = NOW(),
        note = COALESCE(${note}, note)
      WHERE id = ${logId} AND status = 'pending'
      RETURNING id
    `);
    if ((transition.rows?.length ?? 0) !== 1) {
      return res.status(409).json({
        error: 'This approval is no longer pending — it may already have been granted',
        code: 'APPROVAL_NOT_PENDING',
      });
    }

    const execution = await executeFinancialAction(secondAction, actingUid, logId);

    return res.json({
      logId,
      status: 'approved',
      approved: true,
      executed: execution.executed,
      executionCode: execution.code,
      message: execution.executed
        ? 'Second approval granted and executed'
        : 'Second approval granted — execution NOT performed',
    });
  } catch (err: any) {
    sendSanitizedError(res, err, 'FIN_APPROVALS_SECOND_APPROVE_FAILED', { logContext: { op: 'second-approve' } });
  }
});

// POST /api/financial-approvals/reject
router.post('/reject', requireFinancialAdmin, async (req: Request, res: Response) => {
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
    sendSanitizedError(res, err, 'FIN_APPROVALS_REJECT_FAILED', { logContext: { op: 'reject' } });
  }
});

// ---------------------------------------------------------------------------
// T164 — Payout release gate
// ---------------------------------------------------------------------------


/**
 * THE AMOUNT DECIDES THE AUTHORITY, SO THE CLIENT MUST NOT SUPPLY IT.
 *
 * getApprovalRule() picks which approval band applies with
 *
 *     min_amount_cents <= :amount AND (max_amount_cents IS NULL OR max_amount_cents >= :amount)
 *
 * so the amount does not merely get recorded — it SELECTS THE RULE that
 * decides whether the acting role has authority and whether a second approval
 * is required. Both handlers below took `amount_cents` from the request body
 * and passed it straight into checkFinancialAuthority(). Declaring
 * `amount_cents: 1` on a ₪500,000 settlement selected the lowest band and
 * could clear a release that should have required a second approver.
 *
 * These resolve the figure from the server's own record instead. A supplied
 * amount is still accepted, but only as an ASSERTION to be checked: if it
 * disagrees with the canonical value the request is refused rather than
 * silently corrected, because a disagreement is either tampering or a stale
 * screen and an operator needs to see which.
 */
type CanonicalAmount =
  | { ok: true; amountCents: number }
  | { ok: false; status: number; error: string; code: string };

interface CanonicalFinancialAction {
  caseType: string;
  actionType: string;
  caseRefId: string;
  amountCents: number;
  currency: string;
  ownerScope: string;
  ownerId: string | null;
  currentState: string | null;
  sourceTable: 'refund_approvals' | 'payout_batches' | 'booking_disputes' | 'station_settlements';
  sourceRecordId: string;
}

type Resolved =
  | { ok: true; action: CanonicalFinancialAction }
  | { ok: false; status: number; error: string; code: string };

const SUPPORTED_APPROVAL_CURRENCIES = new Set(['ILS', 'USD', 'EUR', 'GBP', 'AUD', 'CAD']);

/**
 * ONE validator for every canonical amount.
 *
 * `Number(row.x ?? 0)` was the trap: a NULL or absent amount became 0, and 0
 * lands in the LOWEST approval band — recreating the exact vulnerability this
 * work exists to remove. A money fact that cannot be established is an error,
 * never a zero.
 */
function validateCanonicalMoney(
  amountRaw: unknown, currencyRaw: unknown, opts: { amountRequired: boolean },
): { ok: true; amountCents: number; currency: string } | { ok: false; code: string; error: string } {
  const currency = String(currencyRaw ?? '').trim().toUpperCase();
  if (!SUPPORTED_APPROVAL_CURRENCIES.has(currency)) {
    return { ok: false, code: 'CANONICAL_CURRENCY_INVALID', error: `Unsupported or missing currency '${currency}'` };
  }
  if (amountRaw === null || amountRaw === undefined) {
    if (!opts.amountRequired) return { ok: true, amountCents: 0, currency };
    return { ok: false, code: 'CANONICAL_AMOUNT_INVALID', error: 'Record has no amount' };
  }
  const amountCents = Number(amountRaw);
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    return { ok: false, code: 'CANONICAL_AMOUNT_INVALID', error: 'Record amount is not a valid minor-unit integer' };
  }
  return { ok: true, amountCents, currency };
}

/**
 * OWNERSHIP IS AN AUTHORITY INPUT AND MUST BE READ, NOT ASSUMED.
 *
 * getApprovalRule() prefers an owner-specific rule over a global one, so the
 * ownership context selects the rule just as the amount does. An earlier
 * version of this patch removed the caller's ability to send owner_scope and
 * then HARDCODED 'global' — which does not close the bypass, it just moves who
 * performs it. Worse, payout_batches defaults its owner_scope to 'company',
 * so 'global' was not even the right vocabulary.
 *
 * Unknown ownership on a money object FAILS CLOSED. Defaulting an unidentified
 * object to the broadest scope is how a franchise-scoped payout escapes a
 * stricter franchise rule.
 */
function ownershipOrFail(
  scopeRaw: unknown, idRaw: unknown,
): { ok: true; ownerScope: string; ownerId: string | null } | { ok: false; code: string; error: string } {
  const ownerScope = String(scopeRaw ?? '').trim();
  if (!ownerScope) {
    return { ok: false, code: 'CANONICAL_OWNER_UNKNOWN', error: 'Ownership context could not be established' };
  }
  const ownerId = idRaw === null || idRaw === undefined || String(idRaw).trim() === ''
    ? null : String(idRaw);
  return { ok: true, ownerScope, ownerId };
}

/**
 * THE CANONICAL FINANCIAL ACTION.
 *
 * Every fact that selects an approval rule — amount, currency, ownership,
 * action identity, and the object's own state — is derived HERE from the
 * business object. None of them come from the request body.
 *
 * WHY NOT financial_approval_log. The log is EVIDENCE OF A DECISION, not a
 * money source, and before this work the server wrote caller-supplied amounts
 * into it. /queue also LEFT JOINs it, so it is legitimately absent for a first
 * approval. The log is the OUTPUT of an authority decision, never an input.
 */
export async function resolveCanonicalFinancialAction(
  caseType: unknown, caseRefId: unknown, actionType: unknown,
): Promise<Resolved> {
  const ref = String(caseRefId ?? '');
  const ct = String(caseType ?? '');
  const at = String(actionType ?? '');

  const fail = (code: string, error: string, status = 404): Resolved => ({ ok: false, status, error, code });

  if (ct === 'refund' && at === 'approve') {
    const r = await db.execute(sql`
      SELECT refund_request_id, amount_cents, status, currency, booking_id, booking_type
      FROM refund_approvals WHERE refund_request_id = ${ref} LIMIT 1
    `);
    const row = r.rows?.[0] as any;
    if (!row) return fail('REFUND_NOT_FOUND', 'Refund request not found');
    if (row.status !== 'pending') {
      return fail('REFUND_NOT_PENDING', `Refund is '${row.status}', not pending`, 409);
    }
    const money = validateCanonicalMoney(row.amount_cents, row.currency ?? 'ILS', { amountRequired: true });
    if (!money.ok) return fail(money.code, money.error, 409);
    // Refunds are company-scoped unless the booking lineage says otherwise;
    // refund_approvals carries no owner column, so the scope is explicit here
    // rather than silently defaulted.
    const owner = ownershipOrFail('company', null);
    if (!owner.ok) return fail(owner.code, owner.error, 409);
    return { ok: true, action: {
      caseType: ct, actionType: at, caseRefId: ref,
      amountCents: money.amountCents, currency: money.currency,
      ownerScope: owner.ownerScope, ownerId: owner.ownerId, currentState: row.status,
      sourceTable: 'refund_approvals', sourceRecordId: String(row.refund_request_id),
    } };
  }

  if (ct === 'payout_release' && at === 'release') {
    const r = await db.execute(sql`
      SELECT batch_id, total_net_cents, status, currency, owner_scope, owner_id
      FROM payout_batches WHERE batch_id = ${ref} LIMIT 1
    `);
    const row = r.rows?.[0] as any;
    if (!row) return fail('PAYOUT_BATCH_NOT_FOUND', 'Payout batch not found');
    // Queue filtering is NOT authorization: a direct caller must not approve a
    // terminal batch.
    if (!['pending', 'held', 'awaiting_approval'].includes(String(row.status))) {
      return fail('PAYOUT_BATCH_NOT_APPROVABLE', `Payout batch is '${row.status}'`, 409);
    }
    const money = validateCanonicalMoney(row.total_net_cents, row.currency, { amountRequired: true });
    if (!money.ok) return fail(money.code, money.error, 409);
    const owner = ownershipOrFail(row.owner_scope, row.owner_id);
    if (!owner.ok) return fail(owner.code, owner.error, 409);
    return { ok: true, action: {
      caseType: ct, actionType: at, caseRefId: ref,
      amountCents: money.amountCents, currency: money.currency,
      ownerScope: owner.ownerScope, ownerId: owner.ownerId, currentState: String(row.status),
      sourceTable: 'payout_batches', sourceRecordId: String(row.batch_id),
    } };
  }

  if (ct === 'dispute_close' && at === 'approve') {
    const r = await db.execute(sql`
      SELECT id, status FROM booking_disputes WHERE id = ${ref} LIMIT 1
    `);
    const row = r.rows?.[0] as any;
    if (!row) return fail('DISPUTE_NOT_FOUND', 'Dispute not found');
    if (String(row.status) === 'closed') {
      return fail('DISPUTE_ALREADY_CLOSED', 'Dispute is already closed', 409);
    }
    const owner = ownershipOrFail('company', null);
    if (!owner.ok) return fail(owner.code, owner.error, 409);
    return { ok: true, action: {
      caseType: ct, actionType: at, caseRefId: ref,
      amountCents: 0, currency: 'ILS',
      ownerScope: owner.ownerScope, ownerId: owner.ownerId, currentState: String(row.status),
      sourceTable: 'booking_disputes', sourceRecordId: String(row.id),
    } };
  }

  return fail(
    'UNSUPPORTED_FINANCIAL_ACTION',
    `No canonical resolver for '${ct}/${at}' — refusing to evaluate authority on unverified facts`,
    400,
  );
}

/** Resolve a station settlement into the same canonical shape. */
export async function resolveCanonicalSettlement(settlementId: unknown): Promise<Resolved> {
  const r = await db.execute(sql`
    SELECT id, station_amount_cents, currency, franchise_owner_id, status
    FROM station_settlements WHERE id = ${settlementId} LIMIT 1
  `);
  const row = r.rows?.[0] as any;
  if (!row) return { ok: false, status: 404, error: 'Settlement not found', code: 'SETTLEMENT_NOT_FOUND' };
  const money = validateCanonicalMoney(row.station_amount_cents, row.currency, { amountRequired: true });
  if (!money.ok) return { ok: false, status: 409, error: money.error, code: money.code };
  // A franchise-owned settlement must select the franchise rule, not global.
  const owner = row.franchise_owner_id
    ? ownershipOrFail('franchise', String(row.franchise_owner_id))
    : ownershipOrFail('company', null);
  if (!owner.ok) return { ok: false, status: 409, error: owner.error, code: owner.code };
  return { ok: true, action: {
    caseType: 'payout_release', actionType: 'release', caseRefId: String(row.id),
    amountCents: money.amountCents, currency: money.currency,
    ownerScope: owner.ownerScope, ownerId: owner.ownerId, currentState: String(row.status),
    sourceTable: 'station_settlements', sourceRecordId: String(row.id),
  } };
}

/**
 * The complete set of facts an approval was granted against. If ANY of them
 * moves between first and second approval the decision no longer applies —
 * comparing the amount alone would miss an ownership or state change.
 */
function approvalFingerprint(a: CanonicalFinancialAction): string {
  return [a.caseType, a.actionType, a.sourceTable, a.sourceRecordId,
          String(a.amountCents), a.currency, a.ownerScope, a.ownerId ?? ''].join('|');
}

/** A supplied amount is an assertion. Refuse the request when it is wrong. */
function assertClientAmountMatches(
  supplied: unknown, canonicalCents: number, res: Response, context: Record<string, unknown>,
): boolean {
  if (supplied === undefined || supplied === null) return true;
  const asNumber = Number(supplied);
  if (asNumber === canonicalCents) return true;
  logger.error('[FinancialApprovals] client amount disagrees with the canonical amount', {
    ...context, suppliedCents: asNumber, canonicalCents,
  });
  res.status(409).json({
    error: 'Amount does not match the current record — reload and try again',
    code: 'AMOUNT_MISMATCH',
    canonicalAmountCents: canonicalCents,
  });
  return false;
}

// POST /api/financial-approvals/payout-release-gate
router.post('/payout-release-gate', requireFinancialAdmin, async (req: Request, res: Response) => {
  try {
    // Neither the amount NOR the ownership context is read from the body: both
    // select which approval rule applies, and an owner-specific rule beats a
    // global one. A franchise-owned settlement must reach the franchise rule.
    const { settlement_id, amount_cents: assertedAmountCents } = req.body;
    if (!settlement_id) {
      return res.status(400).json({ error: 'settlement_id required' });
    }

    const resolvedGate = await resolveCanonicalSettlement(settlement_id);
    if (!resolvedGate.ok) {
      return res.status(resolvedGate.status).json({ error: resolvedGate.error, code: resolvedGate.code });
    }
    const canonicalGate = resolvedGate.action;
    const amount_cents = canonicalGate.amountCents;
    const owner_scope = canonicalGate.ownerScope;
    const owner_id = canonicalGate.ownerId;
    if (!assertClientAmountMatches(assertedAmountCents, amount_cents, res, {
      route: 'payout-release-gate', settlementId: settlement_id,
    })) return;

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

    if (!assertFinancialExecutionControl(req, res, {
      caseType: 'payout_release',
      caseRefId: String(settlement_id),
      actionType: 'payout-release-gate',
      amountCents: amount_cents,
    })) {
      return;
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
    sendSanitizedError(res, err, 'FIN_APPROVALS_PAYOUT_RELEASE_GATE_FAILED', { logContext: { op: 'payout-release-gate' } });
  }
});

// ---------------------------------------------------------------------------
// T165 — Dispute reserve
// ---------------------------------------------------------------------------

// POST /api/financial-approvals/reserve
router.post('/reserve', requireFinancialAdmin, async (req: Request, res: Response) => {
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
    sendSanitizedError(res, err, 'FIN_APPROVALS_RESERVE_FAILED', { logContext: { op: 'reserve' } });
  }
});

// POST /api/financial-approvals/release-reserve
router.post('/release-reserve', requireFinancialAdmin, async (req: Request, res: Response) => {
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
    sendSanitizedError(res, err, 'FIN_APPROVALS_RELEASE_RESERVE_FAILED', { logContext: { op: 'release-reserve' } });
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
    sendSanitizedError(res, err, 'FIN_APPROVALS_RESERVE_SUMMARY_FAILED', { logContext: { op: 'reserve-summary' } });
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
    sendSanitizedError(res, err, 'FIN_APPROVALS_LOG_FAILED', { logContext: { op: 'list-log' } });
  }
});

// ---------------------------------------------------------------------------
// Internal helper — execute the approved financial action
// ---------------------------------------------------------------------------

/**
 * PAYOUT BATCH IS NOT A STATION SETTLEMENT.
 *
 * /queue emits `payout_batches.batch_id` as the caseRefId for
 * payout_release/release. This function used to do
 *
 *     WHERE id = ${parseInt(caseRefId, 10)}        on station_settlements
 *
 * Two different objects, one identifier. `parseInt('SCHED-123-…')` is NaN, but
 * `parseInt('42-abc')` is 42 — which would silently mark STATION SETTLEMENT 42
 * as released and approved, on the authority of a decision about a payout
 * batch. Scheduled batches really are created with textual ids.
 *
 * Not patched around with a different parse. Approving a payout BATCH and
 * releasing a station SETTLEMENT are distinct business operations and need
 * distinct handlers; until the batch handler exists this refuses to execute
 * rather than mutating the wrong row. The approval is still recorded, so no
 * decision is lost — the execution is what is withheld.
 *
 * Takes the resolved canonical action so the executor and the authority check
 * can never disagree about which object they are talking about.
 */
interface ExecutionOutcome { executed: boolean; code: string }

async function executeFinancialAction(
  action: CanonicalFinancialAction,
  actingUid: string | null,
  logId: number
): Promise<ExecutionOutcome> {
  const { caseType, caseRefId, actionType, sourceTable } = action;

  if (caseType === 'payout_release' && actionType === 'release') {
    if (sourceTable !== 'station_settlements') {
      /**
       * APPROVAL AND EXECUTION ARE SEPARATE FACTS.
       *
       * The approval stands and keeps its normal 'approved' status — no new
       * status vocabulary is invented here, because the schema, reports and UI
       * do not know one. What is withheld is the EXECUTION, and the caller is
       * told so explicitly rather than being shown "executed".
       */
      logger.error('[FinancialApprovals] payout batch has no executor — approval recorded, execution withheld', {
        caseRefId, sourceTable, logId,
        detail: 'caseRefId is a payout_batches.batch_id; the legacy executor updated station_settlements.id',
      });
      return { executed: false, code: 'PAYOUT_BATCH_EXECUTOR_NOT_IMPLEMENTED' };
    }
  }

  if (caseType === 'refund' && actionType === 'approve') {
    await db.execute(sql`
      UPDATE refund_approvals
      SET status = 'approved', reviewed_by_uid = ${actingUid}, reviewed_at = NOW()
      WHERE refund_request_id = ${caseRefId} AND status = 'pending'
    `);
    await db.execute(sql`
      UPDATE financial_approval_log SET status = 'executed', executed_at = NOW() WHERE id = ${logId}
    `);
    return { executed: true, code: 'EXECUTED' };
  } else if (caseType === 'payout_release' && actionType === 'release') {
    // Only reachable when the resolver produced a real station settlement —
    // the guard at the top of this function refuses every other source.
    await db.execute(sql`
      UPDATE station_settlements SET
        status = 'settled',
        payout_release_approved_at = NOW(),
        payout_release_approved_by = ${actingUid},
        second_release_approval_required = false
      WHERE id = ${caseRefId}
    `);
    await db.execute(sql`
      UPDATE financial_approval_log SET status = 'executed', executed_at = NOW() WHERE id = ${logId}
    `);
    return { executed: true, code: 'EXECUTED' };
  } else if (caseType === 'dispute_close' && actionType === 'approve') {
    await db.execute(sql`
      UPDATE booking_disputes SET status = 'closed', resolved_at = NOW()
      WHERE id = ${caseRefId} AND status != 'closed'
    `);
    await db.execute(sql`
      UPDATE financial_approval_log SET status = 'executed', executed_at = NOW() WHERE id = ${logId}
    `);
    return { executed: true, code: 'EXECUTED' };
  }

  // No branch matched: nothing ran, and the caller must not be told otherwise.
  logger.error('[FinancialApprovals] no executor for this canonical action', {
    caseType, actionType, sourceTable, logId,
  });
  return { executed: false, code: 'NO_EXECUTOR_FOR_ACTION' };
}

export default router;
