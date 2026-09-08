/**
 * The authority gate for admin wallet routes that MOVE VALUE.
 *
 * Census 2026-09-08 (docs/security/money-authority-census-2026-09-08.md): nine
 * admin wallet routes move real money, none consulted checkFinancialAuthority,
 * none had step-up, and eight had no cap of any kind. `/admin/wallet/adjust`
 * accepted { userId, amountCents, type } behind a bare customClaims.admin
 * check — one admin, any wallet, any amount, no second approver, no ceiling.
 *
 * Everything hardened in #2317 governs /api/financial-approvals/* and stops
 * there. This applies the same matrix to the routes that actually mint value.
 *
 * WHY THIS IS A DIFFERENT SHAPE FROM #2317. There, the amount was derivable
 * from a settlement and the caller was lying about it, so the fix was to stop
 * asking the caller. Here the amount IS the admin's intent — there is nothing
 * to derive. The control is a ceiling on that intent, chosen by the acting
 * role's authority band.
 *
 * ── Two refusals, deliberately distinct ─────────────────────────────────────
 *
 *   INSUFFICIENT_FINANCIAL_AUTHORITY  this role may not move this much, ever.
 *   SECOND_APPROVAL_REQUIRED          this amount needs a second approver.
 *
 * The second is a REFUSAL here, not a queued two-phase execution. The generic
 * two-phase rail lives in /api/financial-approvals/* and does not yet execute
 * wallet actions; pretending otherwise by writing a pending row nothing can
 * approve would be a worse lie than an honest "no". Refusing is fail-closed and
 * leaves the real two-phase path to be built deliberately.
 *
 * ── The bands must EXIST ────────────────────────────────────────────────────
 *
 * checkFinancialAuthority blocks when no rule matches. Nothing in the codebase
 * seeded financial_approval_matrix — the only writer is the admin CRUD route —
 * so wiring this gate WITHOUT shipping bands would have failed every one of
 * these routes closed the moment it deployed. Migration
 * 0150_financial_approval_matrix_wallet_bands.sql ships them, and ships FIRST
 * — see that migration's header for the ordering.
 */
import type { Request } from 'express';
import { checkFinancialAuthority, logFinancialApproval, type ApprovalDecision } from './financial-approvals';
import { getActingRole, getActingUid } from './financialActingRole';
import { logger } from './logger';

export interface WalletAuthorityRequest {
  /** Matrix case_type, e.g. 'wallet_adjust'. Must have seeded bands. */
  caseType: string;
  /** Matrix action_type, e.g. 'credit' | 'debit' | 'release' | 'refund'. */
  actionType: string;
  /** The amount the admin intends to move, in agorot. Always positive. */
  amountCents: number;
  /** What the money is being moved against — wallet/user/booking id. Audit only. */
  caseRefId: string;
}

export type WalletAuthorityOutcome =
  | { ok: true; role: string; decision: ApprovalDecision }
  | { ok: false; status: number; code: string; message: string; details?: Record<string, unknown> };

/**
 * Decide whether this caller may move this much, right now.
 *
 * Never throws: an auth failure from getActingRole becomes a 401 outcome, so a
 * route can answer without a try/catch of its own.
 */
export async function checkWalletMoneyAuthority(
  req: Request,
  input: WalletAuthorityRequest,
): Promise<WalletAuthorityOutcome> {
  let role: string;
  try {
    role = getActingRole(req);
  } catch (err: any) {
    return { ok: false, status: err?.status === 401 ? 401 : 403, code: 'AUTH_REQUIRED', message: 'Authentication required' };
  }

  // A non-positive amount must never reach the matrix: min_amount_cents <= 0
  // would select the lowest band for what is really a malformed request.
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, status: 400, code: 'INVALID_AMOUNT', message: 'amountCents must be a positive integer' };
  }

  const decision = await checkFinancialAuthority(
    input.caseType,
    input.actionType,
    input.amountCents,
    role,
  );

  if (!decision.allowed) {
    logger.warn('[WalletAuthority] refused — insufficient authority', {
      caseType: input.caseType, actionType: input.actionType,
      amountCents: input.amountCents, role, requiredRole: decision.requiredRole,
      caseRefId: input.caseRefId,
    });
    return {
      ok: false, status: 403,
      code: decision.matchedRule ? 'INSUFFICIENT_FINANCIAL_AUTHORITY' : 'NO_APPROVAL_RULE',
      message: decision.reason,
      details: { requiredRole: decision.requiredRole, userRole: role, amountCents: input.amountCents },
    };
  }

  if (decision.secondApprovalRequired) {
    logger.warn('[WalletAuthority] refused — second approval required', {
      caseType: input.caseType, actionType: input.actionType,
      amountCents: input.amountCents, role, secondApprovalRole: decision.secondApprovalRole,
      caseRefId: input.caseRefId,
    });
    return {
      ok: false, status: 403, code: 'SECOND_APPROVAL_REQUIRED',
      message: `This amount requires a second approver (${decision.secondApprovalRole}). Raise it through the financial-approvals queue.`,
      details: { secondApprovalRole: decision.secondApprovalRole, amountCents: input.amountCents },
    };
  }

  return { ok: true, role, decision };
}

/**
 * Record that an authorised wallet action executed, against the rule that
 * allowed it. Best-effort: the money has already moved by the time this runs,
 * so a logging failure must not turn a completed action into an error the
 * operator will retry.
 */
export async function recordWalletAuthorityExecution(
  req: Request,
  input: WalletAuthorityRequest,
  outcome: Extract<WalletAuthorityOutcome, { ok: true }>,
  note?: string,
): Promise<void> {
  try {
    await logFinancialApproval({
      case_type: input.caseType,
      case_ref_id: input.caseRefId,
      action_type: input.actionType,
      amount_cents: input.amountCents,
      requested_by_uid: getActingUid(req),
      approved_by_uid: getActingUid(req),
      approval_rule_id: outcome.decision.matchedRule?.id ?? null,
      status: 'executed',
      note: note ?? null,
    });
  } catch (err: any) {
    logger.error('[WalletAuthority] execution audit row FAILED to write', {
      caseType: input.caseType, caseRefId: input.caseRefId, error: err?.message,
    });
  }
}
