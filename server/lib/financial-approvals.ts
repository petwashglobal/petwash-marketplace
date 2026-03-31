import { db } from '../db';
import { sql } from 'drizzle-orm';

// Role hierarchy — higher index = higher authority
const ROLE_HIERARCHY: Record<string, number> = {
  agent: 1,
  manager: 2,
  franchise_owner: 3,
  admin: 4,
  executive: 5,
};

export interface ApprovalRule {
  id: number;
  case_type: string;
  action_type: string;
  owner_scope: string;
  owner_id: string | null;
  min_amount_cents: number;
  max_amount_cents: number | null;
  required_role: string;
  second_approval_role: string | null;
  is_active: boolean;
}

export interface ApprovalDecision {
  allowed: boolean;
  requiredRole: string;
  secondApprovalRequired: boolean;
  secondApprovalRole: string | null;
  reason: string;
  matchedRule: ApprovalRule | null;
}

export async function getApprovalRule(
  caseType: string,
  actionType: string,
  ownerScope: string,
  ownerId: string | null,
  amountCents: number
): Promise<ApprovalRule | null> {
  // owner-specific rule beats global; narrower amount range beats wider
  const result = await db.execute(sql`
    SELECT *
    FROM financial_approval_matrix
    WHERE case_type = ${caseType}
      AND action_type = ${actionType}
      AND is_active = true
      AND min_amount_cents <= ${amountCents}
      AND (max_amount_cents IS NULL OR max_amount_cents >= ${amountCents})
      AND (
        (owner_scope = ${ownerScope} AND owner_id = ${ownerId})
        OR (owner_scope = 'global' AND owner_id IS NULL)
      )
    ORDER BY
      CASE WHEN owner_id IS NOT NULL THEN 0 ELSE 1 END,
      (max_amount_cents - min_amount_cents) ASC NULLS LAST
    LIMIT 1
  `);
  const row = result.rows[0] as ApprovalRule | undefined;
  return row ?? null;
}

export function canUserApproveFinancialAction(userRole: string, rule: ApprovalRule): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[rule.required_role] ?? 99;
  return userLevel >= requiredLevel;
}

export function requiresSecondApproval(rule: ApprovalRule): boolean {
  return !!rule.second_approval_role;
}

export function explainFinancialApproval(rule: ApprovalRule, userRole: string): ApprovalDecision {
  const allowed = canUserApproveFinancialAction(userRole, rule);
  const secondApprovalRequired = requiresSecondApproval(rule);

  let reason: string;
  if (!allowed) {
    reason = `Role '${userRole}' is below required '${rule.required_role}' for this action`;
  } else if (secondApprovalRequired) {
    reason = `Approved by ${userRole}. Second approval required from '${rule.second_approval_role}'`;
  } else {
    reason = `Approved by ${userRole} — no second approval needed`;
  }

  return {
    allowed,
    requiredRole: rule.required_role,
    secondApprovalRequired,
    secondApprovalRole: rule.second_approval_role,
    reason,
    matchedRule: rule,
  };
}

export async function checkFinancialAuthority(
  caseType: string,
  actionType: string,
  amountCents: number,
  userRole: string,
  ownerScope = 'global',
  ownerId: string | null = null
): Promise<ApprovalDecision> {
  const rule = await getApprovalRule(caseType, actionType, ownerScope, ownerId, amountCents);

  if (!rule) {
    return {
      allowed: false,
      requiredRole: 'unknown',
      secondApprovalRequired: false,
      secondApprovalRole: null,
      reason: `No approval rule found for ${caseType}/${actionType} at amount ${amountCents} — action blocked`,
      matchedRule: null,
    };
  }

  return explainFinancialApproval(rule, userRole);
}

export async function logFinancialApproval(entry: {
  case_type: string;
  case_ref_id: string;
  action_type: string;
  amount_cents: number;
  owner_scope?: string;
  owner_id?: string | null;
  requested_by_uid?: string | null;
  approved_by_uid?: string | null;
  second_approved_by_uid?: string | null;
  approval_rule_id?: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  note?: string | null;
}): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO financial_approval_log
      (case_type, case_ref_id, action_type, amount_cents, owner_scope, owner_id,
       requested_by_uid, approved_by_uid, second_approved_by_uid,
       approval_rule_id, status, note)
    VALUES
      (${entry.case_type}, ${entry.case_ref_id}, ${entry.action_type}, ${entry.amount_cents},
       ${entry.owner_scope ?? 'global'}, ${entry.owner_id ?? null},
       ${entry.requested_by_uid ?? null}, ${entry.approved_by_uid ?? null},
       ${entry.second_approved_by_uid ?? null},
       ${entry.approval_rule_id ?? null}, ${entry.status}, ${entry.note ?? null})
    RETURNING id
  `);
  return (result.rows[0] as any).id as number;
}
