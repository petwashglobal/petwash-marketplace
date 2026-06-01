import type { Request, Response } from 'express';
import {
  evaluateOperatingAction,
  type ApprovalFact,
  type BankMatchStatus,
  type CreditType,
  type OperatingActionType,
  type OperatingActorRole,
  type OperatingDecision,
  type OperatingFacts,
  type OperatingInput,
  type OperatingMoneyFacts,
  type TaxClassification,
} from '../../shared/petwash-operating-system';

export const PETWASH_OPERATING_CONTROL_BLOCKED = 'PETWASH_OPERATING_CONTROL_BLOCKED';

const APPROVERS = new Set(['NIR', 'ACCOUNTANT', 'LEGAL', 'FINANCE', 'PROVIDER_MANAGER', 'SUPPORT', 'ENGINEERING']);
const APPROVAL_STATUSES = new Set(['approved', 'denied', 'pending']);
const ACTOR_ROLES = new Set([
  'system',
  'ai_agent',
  'support',
  'provider_manager',
  'finance',
  'accountant',
  'legal',
  'nir',
  'admin',
]);
const BANK_MATCH_STATUSES = new Set(['missing', 'pending_match', 'matched', 'exception_open', 'closed']);
const TAX_CLASSIFICATIONS = new Set(['patur', 'murshe', 'chevra', 'private_individual', 'unknown']);
const CREDIT_TYPES = new Set([
  'PAID_GIFT_CARD',
  'E_GIFT_CARD',
  'STORE_CREDIT',
  'REFUND_CREDIT',
  'PROMOTIONAL_CREDIT',
  'BIRTHDAY_CREDIT',
  'LOYALTY_CREDIT',
  'GOODWILL_CREDIT',
]);

type RecordLike = Record<string, unknown>;

export interface OperatingControlDefaults {
  actionType: OperatingActionType;
  targetId: string;
  route: string;
  taxClassification?: TaxClassification;
  creditType?: CreditType;
  paidOrFree?: 'paid' | 'free';
  bankMatchStatus?: BankMatchStatus;
  facts?: Partial<OperatingFacts>;
  money?: OperatingMoneyFacts;
  approvals?: ApprovalFact[];
}

export interface OperatingControlGateResult {
  allowed: boolean;
  status: number;
  payload?: {
    error: typeof PETWASH_OPERATING_CONTROL_BLOCKED;
    code: typeof PETWASH_OPERATING_CONTROL_BLOCKED;
    route: string;
    actionType: OperatingActionType;
    targetId: string;
    riskLevel: OperatingDecision['riskLevel'];
    blockers: OperatingDecision['blockers'];
    requiredApprovals: OperatingDecision['requiredApprovals'];
    requiredEvidence: OperatingDecision['requiredEvidence'];
    nextActions: string[];
    decision: OperatingDecision;
  };
  input: OperatingInput;
  decision: OperatingDecision;
}

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readBodyControl(req: Request): RecordLike {
  const body = isRecord(req.body) ? req.body : {};
  return isRecord(body.operatingControl) ? body.operatingControl : {};
}

function asBooleanFacts(value: unknown): Partial<OperatingFacts> {
  if (!isRecord(value)) return {};
  const out: Partial<OperatingFacts> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'boolean') {
      (out as Record<string, boolean>)[key] = raw;
    }
  }
  return out;
}

function asMoneyFacts(value: unknown): OperatingMoneyFacts {
  if (!isRecord(value)) return {};
  const out: OperatingMoneyFacts = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      (out as Record<string, number>)[key] = raw;
    } else if (key === 'discountFundedBy' && typeof raw === 'string') {
      const allowed = ['PET_WASH', 'PROVIDER', 'SUPPLIER', 'FRANCHISEE', 'SHARED'];
      if (allowed.includes(raw)) out.discountFundedBy = raw as OperatingMoneyFacts['discountFundedBy'];
    } else if (key === 'providerAgreementAllowsDiscountReduction' && typeof raw === 'boolean') {
      out.providerAgreementAllowsDiscountReduction = raw;
    }
  }
  return out;
}

function asApprovals(value: unknown): ApprovalFact[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!isRecord(raw)) return [];
    const approver = raw.approver;
    const actorId = raw.actorId;
    const status = raw.status;
    if (
      typeof approver !== 'string' ||
      typeof actorId !== 'string' ||
      typeof status !== 'string' ||
      !APPROVERS.has(approver) ||
      !APPROVAL_STATUSES.has(status)
    ) {
      return [];
    }
    return [{
      approver: approver as ApprovalFact['approver'],
      actorId,
      status: status as ApprovalFact['status'],
    }];
  });
}

function asTaxClassification(value: unknown): TaxClassification | undefined {
  return typeof value === 'string' && TAX_CLASSIFICATIONS.has(value)
    ? value as TaxClassification
    : undefined;
}

function asCreditType(value: unknown): CreditType | undefined {
  return typeof value === 'string' && CREDIT_TYPES.has(value) ? value as CreditType : undefined;
}

function asBankMatchStatus(value: unknown): BankMatchStatus | undefined {
  return typeof value === 'string' && BANK_MATCH_STATUSES.has(value) ? value as BankMatchStatus : undefined;
}

function asPaidOrFree(value: unknown): 'paid' | 'free' | undefined {
  return value === 'paid' || value === 'free' ? value : undefined;
}

function normalizeActorRole(rawRole: unknown): OperatingActorRole {
  if (typeof rawRole !== 'string') return 'admin';
  const role = rawRole.toLowerCase().trim();
  if (role === 'owner' || role === 'founder' || role === 'nir') return 'nir';
  if (role === 'super_admin' || role === 'admin' || role === 'executive') return 'admin';
  if (role === 'finance_admin' || role === 'finance') return 'finance';
  if (role === 'provider_manager') return 'provider_manager';
  if (role === 'legal' || role === 'accountant' || role === 'support' || role === 'ai_agent' || role === 'system') {
    return role as OperatingActorRole;
  }
  return ACTOR_ROLES.has(role) ? role as OperatingActorRole : 'admin';
}

function readActor(req: Request): OperatingInput['actor'] {
  const anyReq = req as Request & {
    user?: { uid?: string; id?: string; email?: string; role?: string; customClaims?: { role?: string } };
    firebaseUser?: { uid?: string; email?: string; role?: string; customClaims?: { role?: string } };
    userRole?: string;
  };
  const firebaseUser = anyReq.firebaseUser;
  const user = anyReq.user;
  const id = firebaseUser?.uid ?? user?.uid ?? user?.id ?? firebaseUser?.email ?? user?.email ?? 'admin-secret';
  const role = normalizeActorRole(
    anyReq.userRole ??
      firebaseUser?.role ??
      firebaseUser?.customClaims?.role ??
      user?.role ??
      user?.customClaims?.role,
  );
  return { id, role };
}

export function buildOperatingControlInput(req: Request, defaults: OperatingControlDefaults): OperatingInput {
  const control = readBodyControl(req);
  const controlFacts = asBooleanFacts(control.facts);
  const controlMoney = asMoneyFacts(control.money);
  return {
    actionType: defaults.actionType,
    actor: readActor(req),
    targetId: defaults.targetId,
    taxClassification: asTaxClassification(control.taxClassification) ?? defaults.taxClassification,
    creditType: asCreditType(control.creditType) ?? defaults.creditType,
    paidOrFree: asPaidOrFree(control.paidOrFree) ?? defaults.paidOrFree,
    bankMatchStatus: asBankMatchStatus(control.bankMatchStatus) ?? defaults.bankMatchStatus,
    facts: {
      ...(defaults.facts ?? {}),
      ...controlFacts,
    },
    money: {
      ...(defaults.money ?? {}),
      ...controlMoney,
    },
    approvals: [
      ...(defaults.approvals ?? []),
      ...asApprovals(control.approvals),
    ],
  };
}

export function evaluateOperatingControlGate(req: Request, defaults: OperatingControlDefaults): OperatingControlGateResult {
  const input = buildOperatingControlInput(req, defaults);
  const decision = evaluateOperatingAction(input);
  if (decision.allowed) {
    return { allowed: true, status: 200, input, decision };
  }
  const nextActions = Array.from(new Set(decision.blockers.map((blocker) => blocker.nextAction)));
  return {
    allowed: false,
    status: 409,
    input,
    decision,
    payload: {
      error: PETWASH_OPERATING_CONTROL_BLOCKED,
      code: PETWASH_OPERATING_CONTROL_BLOCKED,
      route: defaults.route,
      actionType: defaults.actionType,
      targetId: defaults.targetId,
      riskLevel: decision.riskLevel,
      blockers: decision.blockers,
      requiredApprovals: decision.requiredApprovals,
      requiredEvidence: decision.requiredEvidence,
      nextActions,
      decision,
    },
  };
}

export function assertOperatingControl(req: Request, res: Response, defaults: OperatingControlDefaults): boolean {
  const result = evaluateOperatingControlGate(req, defaults);
  if (result.allowed) return true;
  res.status(result.status).json(result.payload);
  return false;
}
