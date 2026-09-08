import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { timingSafeEqual } from 'crypto';
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

const router = Router();

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const ALLOWED_MACHINE_IPS_FA = (process.env.ALLOWED_MACHINE_IPS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function getClientIpFA(req: Request): string {
  return (req.headers['x-forwarded-for'] as string || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

// P0-SEC: getActingRole now throws an Error with { status: 401 } when neither a valid
// x-admin-secret nor a decoded Firebase token is present on the request.
// BEFORE: returned 'agent' silently — an unauthenticated caller could reach the
//         /approve and /payout-release-gate handlers with agent-level authority,
//         and /matrix POST/PATCH/DELETE with no auth check at all.
// AFTER:  calling code must catch { status: 401 } and return 401 to the client.
function getActingRole(req: Request): string {
  // P1-FIX: Use timing-safe comparison to prevent timing attacks on admin secret.
  // BEFORE: === comparison leaks timing information about secret length/prefix.
  // AFTER:  timingSafeEqual with fixed-length buffers eliminates the timing oracle.
  const adminSecretHeader = req.headers['x-admin-secret'] as string | undefined;
  const adminSecretEnv = process.env.ADMIN_SECRET;
  const adminSecretMatch = !!(
    adminSecretHeader &&
    adminSecretEnv &&
    adminSecretHeader.length === adminSecretEnv.length &&
    timingSafeEqual(Buffer.from(adminSecretHeader), Buffer.from(adminSecretEnv))
  );
  if (adminSecretMatch) {
    if (ALLOWED_MACHINE_IPS_FA.length > 0) {
      const clientIp = getClientIpFA(req);
      if (!ALLOWED_MACHINE_IPS_FA.includes(clientIp)) {
        // IP not in allowlist — fall through to token auth rather than silently downgrading
        const err: any = new Error('Authentication required');
        err.status = 401;
        throw err;
      }
    }
    return 'admin';
  }
  // Decoded Firebase token roles (set by validateFirebaseToken outer middleware)
  const decoded = (req as any).decodedToken ?? (req as any).firebaseUser;
  // P0-SEC: If no token is present, reject immediately rather than silently assigning 'agent'.
  if (!decoded) {
    const err: any = new Error('Authentication required');
    err.status = 401;
    throw err;
  }
  if (decoded?.executive || decoded?.claims?.executive) return 'executive';
  if (decoded?.admin || decoded?.claims?.admin) return 'admin';
  if (decoded?.franchise_owner || decoded?.claims?.franchise_owner) return 'franchise_owner';
  if (decoded?.manager || decoded?.claims?.manager) return 'manager';
  if (decoded?.role === 'executive' || decoded?.claims?.role === 'executive') return 'executive';
  if (decoded?.role === 'franchise_owner' || decoded?.claims?.role === 'franchise_owner') return 'franchise_owner';
  if (decoded?.role === 'manager' || decoded?.claims?.role === 'manager') return 'manager';
  // Authenticated but insufficient role — still known; let route handlers decide
  return 'agent';
}

function getActingUid(req: Request): string | null {
  const decoded = (req as any).decodedToken ?? (req as any).firebaseUser;
  return decoded?.uid ?? null;
}

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
router.post('/matrix', requireFinancialAdmin, async (req: Request, res: Response) => {
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
router.patch('/matrix/:id', requireFinancialAdmin, async (req: Request, res: Response) => {
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
router.delete('/matrix/:id', requireFinancialAdmin, async (req: Request, res: Response) => {
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

    // If approved and no second approval required, execute the underlying action
    if (status === 'approved') {
      await executeFinancialAction(canonicalAction, actingUid, logId);
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

    await db.execute(sql`
      UPDATE financial_approval_log SET
        status = 'approved',
        second_approved_by_uid = ${actingUid},
        approved_at = NOW(),
        note = COALESCE(${note}, note)
      WHERE id = ${logId}
    `);

    // Second approval re-resolves from the business object rather than trusting
    // the log row it is approving. The log records what was decided; the object
    // says what is true NOW — and between first and second approval the amount
    // or state may have moved.
    const resolvedSecond = await resolveCanonicalFinancialAction(
      logRow.case_type, logRow.case_ref_id, logRow.action_type,
    );
    if (!resolvedSecond.ok) {
      logger.error('[FinancialApprovals] second approval could not re-resolve the canonical action', {
        logId, caseType: logRow.case_type, caseRefId: logRow.case_ref_id, code: resolvedSecond.code,
      });
      return res.status(resolvedSecond.status).json({ error: resolvedSecond.error, code: resolvedSecond.code });
    }
    if (resolvedSecond.action.amountCents !== Number(logRow.amount_cents ?? 0)) {
      logger.error('[FinancialApprovals] amount moved between first and second approval', {
        logId, approvedCents: Number(logRow.amount_cents ?? 0),
        canonicalCents: resolvedSecond.action.amountCents,
      });
      return res.status(409).json({
        error: 'The amount changed since the first approval — re-request approval',
        code: 'AMOUNT_CHANGED_SINCE_APPROVAL',
        canonicalAmountCents: resolvedSecond.action.amountCents,
      });
    }

    await executeFinancialAction(resolvedSecond.action, actingUid, logId);

    return res.json({ logId, status: 'approved', message: 'Second approval granted and executed' });
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

async function canonicalSettlementAmountCents(settlementId: unknown): Promise<CanonicalAmount> {
  const row = await db.execute(sql`
    SELECT station_amount_cents FROM station_settlements WHERE id = ${settlementId} LIMIT 1
  `);
  const found = row.rows?.[0] as { station_amount_cents?: number } | undefined;
  if (!found) {
    return { ok: false, status: 404, error: 'Settlement not found', code: 'SETTLEMENT_NOT_FOUND' };
  }
  const amountCents = Number(found.station_amount_cents ?? 0);
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    return { ok: false, status: 409, error: 'Settlement has no usable payout amount', code: 'SETTLEMENT_AMOUNT_INVALID' };
  }
  return { ok: true, amountCents };
}

/**
 * For /approve the canonical figure is the PENDING approval row the server
 * itself wrote when the action was requested. The admin screen populates
 * `amount_cents` from a queue item served out of that same table, so the
 * legitimate flow already agrees with it — and approving something with no
 * pending request is refused outright, which is the bypass itself.
 */
/**
 * THE CANONICAL FINANCIAL ACTION.
 *
 * Every fact that selects an approval rule is derived HERE, from the business
 * object itself — never from the request body.
 *
 * getApprovalRule() chooses a rule by (case_type, action_type, owner_scope,
 * owner_id, amount), preferring an owner-specific rule over a global one. So
 * the amount is not the only authority input the caller was choosing: the
 * ownership context and the action identity select the rule too. A caller who
 * can send `owner_scope: 'global'` can step around a stricter owner-specific
 * rule, and a caller who can send a different `action_type` can ask to have a
 * payout evaluated as some cheaper action.
 *
 * WHY NOT financial_approval_log. An earlier version of this patch derived the
 * amount from the pending approval-log row. That was wrong twice over. The log
 * is EVIDENCE OF A DECISION, not a money source — and before this fix the
 * server wrote caller-supplied amounts into it, so yesterday's tainted row
 * would have become today's authority. It is also LEFT JOINed by /queue and is
 * legitimately absent for first approvals, so requiring one would have broken
 * the normal flow outright.
 *
 * The log is the OUTPUT of an authority decision. It is never an input.
 */
interface CanonicalFinancialAction {
  caseType: string;
  actionType: string;
  caseRefId: string;
  amountCents: number;
  currency: string;
  ownerScope: string;
  ownerId: string | null;
  currentState: string | null;
  /** Which table the facts came from — the executor needs this, see below. */
  sourceTable: 'refund_approvals' | 'payout_batches' | 'booking_disputes' | 'station_settlements';
  sourceRecordId: string;
}

type Resolved =
  | { ok: true; action: CanonicalFinancialAction }
  | { ok: false; status: number; error: string; code: string };

export async function resolveCanonicalFinancialAction(
  caseType: unknown, caseRefId: unknown, actionType: unknown,
): Promise<Resolved> {
  const ref = String(caseRefId ?? '');
  const ct = String(caseType ?? '');
  const at = String(actionType ?? '');

  const unresolved = (code: string, error: string, status = 404): Resolved =>
    ({ ok: false, status, error, code });

  // The (caseType, actionType) pair is validated by being resolvable at all:
  // an unknown or mismatched pair falls through to UNSUPPORTED below, so a
  // caller cannot relabel one operation as another to reach an easier rule.
  if (ct === 'refund' && at === 'approve') {
    const r = await db.execute(sql`
      SELECT refund_request_id, amount_cents, status
      FROM refund_approvals WHERE refund_request_id = ${ref} LIMIT 1
    `);
    const row = r.rows?.[0] as any;
    if (!row) return unresolved('REFUND_NOT_FOUND', 'Refund request not found');
    if (row.status !== 'pending') {
      return unresolved('REFUND_NOT_PENDING', `Refund is '${row.status}', not pending`, 409);
    }
    return { ok: true, action: {
      caseType: ct, actionType: at, caseRefId: ref,
      amountCents: Number(row.amount_cents ?? 0), currency: 'ILS',
      ownerScope: 'global', ownerId: null, currentState: row.status,
      sourceTable: 'refund_approvals', sourceRecordId: String(row.refund_request_id),
    } };
  }

  if (ct === 'payout_release' && at === 'release') {
    // /queue emits payout_batches.batch_id as caseRefId for this pair.
    const r = await db.execute(sql`
      SELECT batch_id, total_net_cents, status
      FROM payout_batches WHERE batch_id = ${ref} LIMIT 1
    `);
    const row = r.rows?.[0] as any;
    if (!row) return unresolved('PAYOUT_BATCH_NOT_FOUND', 'Payout batch not found');
    return { ok: true, action: {
      caseType: ct, actionType: at, caseRefId: ref,
      amountCents: Number(row.total_net_cents ?? 0), currency: 'ILS',
      ownerScope: 'global', ownerId: null, currentState: row.status,
      sourceTable: 'payout_batches', sourceRecordId: String(row.batch_id),
    } };
  }

  if (ct === 'dispute_close' && at === 'approve') {
    const r = await db.execute(sql`
      SELECT id, status FROM booking_disputes WHERE id = ${ref} LIMIT 1
    `);
    const row = r.rows?.[0] as any;
    if (!row) return unresolved('DISPUTE_NOT_FOUND', 'Dispute not found');
    return { ok: true, action: {
      caseType: ct, actionType: at, caseRefId: ref,
      amountCents: 0, currency: 'ILS',
      ownerScope: 'global', ownerId: null, currentState: row.status,
      sourceTable: 'booking_disputes', sourceRecordId: String(row.id),
    } };
  }

  return unresolved(
    'UNSUPPORTED_FINANCIAL_ACTION',
    `No canonical resolver for '${ct}/${at}' — refusing to evaluate authority on unverified facts`,
    400,
  );
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
    // owner_scope / owner_id are NOT read from the body: like the amount, they
    // select which approval rule applies (owner-specific beats global).
    const { settlement_id, amount_cents: assertedAmountCents } = req.body;
    const owner_scope = 'global';
    const owner_id: string | null = null;
    if (!settlement_id) {
      return res.status(400).json({ error: 'settlement_id required' });
    }

    // Derive the figure from the settlement. Never from the body.
    const canonical = await canonicalSettlementAmountCents(settlement_id);
    if (!canonical.ok) {
      return res.status(canonical.status).json({ error: canonical.error, code: canonical.code });
    }
    const amount_cents = canonical.amountCents;
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
async function executeFinancialAction(
  action: CanonicalFinancialAction,
  actingUid: string | null,
  logId: number
) {
  const { caseType, caseRefId, actionType, sourceTable } = action;

  if (caseType === 'payout_release' && actionType === 'release') {
    if (sourceTable !== 'station_settlements') {
      logger.error('[FinancialApprovals] refusing to execute a payout release against the wrong object', {
        caseRefId, sourceTable, logId,
        detail: 'caseRefId is a payout_batches.batch_id; the legacy executor updated station_settlements.id',
      });
      await db.execute(sql`
        UPDATE financial_approval_log
        SET status = 'approved_execution_withheld',
            note = COALESCE(note, '') || ' [execution withheld: payout batch has no settlement executor]'
        WHERE id = ${logId}
      `);
      return;
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
