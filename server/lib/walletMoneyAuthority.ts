/**
 * Authority for admin actions that MINT OR MOVE WALLET VALUE.
 *
 * WHY THIS EXISTS. The census (docs/security/money-authority-census-2026-09-08.md)
 * found nine admin wallet routes that move real value. None consulted
 * checkFinancialAuthority, none had step-up, and eight had no ceiling at all.
 * POST /admin/wallet/adjust takes { userId, amountCents, type } behind a bare
 * customClaims.admin check: one admin could credit any wallet any amount, with
 * no second approver and no cap.
 *
 * WHY NOT JUST MOUNT checkFinancialAuthority. Because
 * financial_approval_matrix SHIPS EMPTY — there is no seed migration in the
 * repo, only the admin route that creates rules. getApprovalRule() returns
 * nothing, and checkFinancialAuthority fails closed with "No approval rule
 * found — action blocked". Mounting it bare would not harden these routes, it
 * would switch them off, including a support agent's ability to refund a
 * customer. Correct posture, wrong blast radius.
 *
 * SO: THE MATRIX WINS WHEN IT HAS AN OPINION, AND A CEILING APPLIES WHEN IT
 * DOES NOT.
 *
 *   rule found     -> the matrix decides, exactly as everywhere else
 *   no rule        -> allowed only up to a per-route ceiling; above it, blocked
 *
 * That removes "unlimited" without switching anything off below the ceiling,
 * and the moment real bands are seeded the matrix supersedes the fallback with
 * no code change.
 *
 * THE CEILINGS ARE A PLACEHOLDER, NOT A POLICY. Each caller passes its own,
 * and every value is env-tunable. The support tier reuses the ₪500 the
 * codebase had already chosen for support/credit; the full-admin default is a
 * conservative stand-in chosen so it is far above ordinary operations and far
 * below "unlimited". Replace them by seeding the matrix — that is the real
 * policy surface, and it is the CEO's to set, not this file's.
 */
import { getApprovalRule, explainFinancialApproval, type ApprovalDecision } from './financial-approvals';
import { logger } from './logger';

/** ₪500 in agorot — the ceiling support/credit already enforced. */
export const SUPPORT_TIER_CEILING_CENTS = Number(
  process.env.WALLET_SUPPORT_CEILING_CENTS ?? 50_000,
);

/** Stand-in for full-admin wallet actions until the matrix carries real bands. */
export const ADMIN_TIER_CEILING_CENTS = Number(
  process.env.WALLET_ADMIN_CEILING_CENTS ?? 200_000,
);

const SUPPORTED_CURRENCIES = new Set(['ILS', 'USD', 'EUR', 'GBP', 'AUD', 'CAD']);

export type WalletAuthorityResult =
  | { ok: true; decision: ApprovalDecision | null; via: 'matrix' | 'ceiling' }
  | { ok: false; status: number; code: string; error: string };

export interface WalletMoneyActionInput {
  caseType: string;
  actionType: string;
  /** The admin's CHOSEN amount. Unlike a settlement release there is nothing
   *  to derive — the amount is the intent, so it is bound, not looked up. */
  amountCents: unknown;
  currency?: string;
  actingRole: string;
  /** Ceiling that applies only while the matrix has no rule for this action. */
  fallbackCeilingCents: number;
  ownerScope?: string;
  ownerId?: string | null;
}

export async function authoriseWalletMoneyAction(
  input: WalletMoneyActionInput,
): Promise<WalletAuthorityResult> {
  const currency = String(input.currency ?? 'ILS').trim().toUpperCase();
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    return { ok: false, status: 400, code: 'CURRENCY_UNSUPPORTED', error: `Unsupported currency '${currency}'` };
  }

  // A money amount that is not a positive whole number of minor units is an
  // error, never a zero — zero would sail under every ceiling.
  const amountCents = Number(input.amountCents);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return { ok: false, status: 400, code: 'AMOUNT_INVALID', error: 'amountCents must be a positive whole number of minor units' };
  }

  const ownerScope = input.ownerScope ?? 'company';
  const ownerId = input.ownerId ?? null;

  const rule = await getApprovalRule(
    input.caseType, input.actionType, ownerScope, ownerId, amountCents,
  ).catch((err) => {
    logger.error('[WalletMoneyAuthority] approval-rule lookup failed', {
      caseType: input.caseType, actionType: input.actionType, err: err?.message,
    });
    return null;
  });

  if (rule) {
    const decision = explainFinancialApproval(rule, input.actingRole);
    if (!decision.allowed) {
      return {
        ok: false, status: 403, code: 'INSUFFICIENT_AUTHORITY',
        error: decision.reason || 'Insufficient authority for this amount',
      };
    }
    return { ok: true, decision, via: 'matrix' };
  }

  // No rule: the ceiling is the only thing standing between one admin and an
  // unbounded mint.
  if (amountCents > input.fallbackCeilingCents) {
    logger.error('[WalletMoneyAuthority] blocked — above the fallback ceiling and no matrix rule exists', {
      caseType: input.caseType, actionType: input.actionType,
      amountCents, ceilingCents: input.fallbackCeilingCents, actingRole: input.actingRole,
    });
    return {
      ok: false, status: 403, code: 'ABOVE_UNAPPROVED_CEILING',
      error:
        `This amount exceeds the ${input.fallbackCeilingCents} minor-unit ceiling that applies while no `
        + `approval rule exists for ${input.caseType}/${input.actionType}. Seed an approval-matrix rule `
        + 'to authorise larger amounts through the normal second-approval path.',
    };
  }

  return { ok: true, decision: null, via: 'ceiling' };
}
