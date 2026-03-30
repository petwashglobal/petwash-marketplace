/**
 * server/lib/policy-engine.ts
 * Phase 12.13 — Governance & Automation Layer
 *
 * Pure policy evaluation engine. Loads active governance_policies from the DB,
 * evaluates conditions against a CaseContext, and returns the actions to execute.
 *
 * Action executor (runActions) writes the side-effects: notes, escalations,
 * re-assignments, auto-approvals, and execution log entries.
 *
 * Trigger events:
 *   'closure_requested'  — fired from case-actions.ts /closure-request
 *   'closure_approved'   — fired from case-actions.ts /closure-approve
 *   'case_created'       — fired on new case ingestion
 *   'sla_at_risk'        — fired from sla-monitor when status first flips to at_risk
 *   'sla_breached'       — fired from sla-monitor when status first flips to breached
 */

import { db }    from '../db';
import { sql }   from 'drizzle-orm';
import { logger } from './logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaseContext {
  caseType:      string;                         // 'dispute' | 'mismatch' | 'refund'
  caseRefId:     string;                         // raw dispute id, 'mismatch-{id}', 'refund-{id}'
  amountCents?:  number;                         // case amount in agorot
  closureCode?:  string;                         // closure_reason_code
  slaStatus?:    'within_sla' | 'at_risk' | 'breached';
  stationId?:    string;
  franchiseId?:  string;
  handlerRole?:  string;                         // 'agent' | 'manager' | etc.
  reopenCount?:  number;
  actorUid?:     string;                         // who triggered the event
  extra?:        Record<string, unknown>;
}

export interface PolicyAction {
  type:     string;
  [key: string]: unknown;
}

export interface EvaluatedPolicy {
  policyId:   number;
  policyType: string;
  name:       string;
  actions:    PolicyAction[];
}

export interface EngineResult {
  matched:      EvaluatedPolicy[];
  autoApproved: boolean;
  requireLevel: 0 | 1 | 2;          // 0 = no extra requirement, 1 = manager, 2 = franchise_owner
  message?:     string;
}

// ─── Condition Evaluator ──────────────────────────────────────────────────────

function matchesConditions(conditions: Record<string, unknown>, ctx: CaseContext): boolean {
  for (const [key, value] of Object.entries(conditions)) {
    switch (key) {

      case 'closure_codes': {
        if (!ctx.closureCode) return false;
        if (!Array.isArray(value)) return false;
        if (!(value as string[]).includes(ctx.closureCode)) return false;
        break;
      }

      case 'sla_status': {
        if (ctx.slaStatus !== value) return false;
        break;
      }

      case 'amount_gte': {
        const cents = ctx.amountCents ?? 0;
        const thresholdCents = Number(value) * 100;   // value is in ILS, stored in agorot
        if (cents < thresholdCents) return false;
        break;
      }

      case 'amount_lt': {
        const cents = ctx.amountCents ?? 0;
        const thresholdCents = Number(value) * 100;
        if (cents >= thresholdCents) return false;
        break;
      }

      case 'amount_lte': {
        const cents = ctx.amountCents ?? 0;
        const thresholdCents = Number(value) * 100;
        if (cents > thresholdCents) return false;
        break;
      }

      case 'handler_role': {
        if (!ctx.handlerRole) return false;
        if (Array.isArray(value)) {
          if (!(value as string[]).includes(ctx.handlerRole)) return false;
        } else {
          if (ctx.handlerRole !== value) return false;
        }
        break;
      }

      case 'reopen_count_gte': {
        if ((ctx.reopenCount ?? 0) < Number(value)) return false;
        break;
      }

      case 'station_id': {
        if (ctx.stationId !== value) return false;
        break;
      }

      case 'franchise_id': {
        if (ctx.franchiseId !== value) return false;
        break;
      }

      // Unknown condition keys are ignored (forward compat)
      default:
        break;
    }
  }
  return true;
}

// ─── Policy Loader ────────────────────────────────────────────────────────────

interface RawPolicy {
  id:          number;
  policy_type: string;
  name:        string;
  case_types:  string[] | null;
  conditions:  Record<string, unknown>;
  actions:     PolicyAction[];
  priority:    number;
  scope_type:  string;
  scope_id:    string | null;
}

async function loadActivePolicies(
  policyType: string | null,
  ctx: CaseContext,
): Promise<RawPolicy[]> {
  const typeFilter = policyType
    ? `AND policy_type = '${policyType}'`
    : '';

  const r = await db.execute(sql.raw(`
    SELECT id, policy_type, name, case_types, conditions, actions, priority, scope_type, scope_id
    FROM governance_policies
    WHERE is_active = true
      ${typeFilter}
    ORDER BY priority ASC, id ASC
  `));

  return (r.rows as any[])
    .filter(row => {
      // Case type filter: empty array means applies to all
      const types: string[] = row.case_types ?? [];
      if (types.length > 0 && !types.includes(ctx.caseType)) return false;
      return true;
    })
    .map(row => ({
      id:          Number(row.id),
      policy_type: String(row.policy_type),
      name:        String(row.name),
      case_types:  row.case_types ?? [],
      conditions:  (typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions) ?? {},
      actions:     (typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions) ?? [],
      priority:    Number(row.priority),
      scope_type:  String(row.scope_type),
      scope_id:    row.scope_id ? String(row.scope_id) : null,
    }));
}

// ─── Core Evaluator ───────────────────────────────────────────────────────────

/**
 * Evaluate ALL active policies of a given type (or all types if null)
 * against the case context. Returns matched policies in priority order.
 *
 * For approval_threshold: first-match-wins.
 * For escalation_rule / playbook: all-matching-execute.
 */
export async function evaluatePolicies(
  triggerEvent: string,
  ctx: CaseContext,
  policyTypeFilter?: string,
): Promise<EngineResult> {
  try {
    const policies = await loadActivePolicies(policyTypeFilter ?? null, ctx);
    const matched: EvaluatedPolicy[] = [];

    for (const policy of policies) {
      if (!matchesConditions(policy.conditions, ctx)) continue;
      matched.push({
        policyId:   policy.id,
        policyType: policy.policy_type,
        name:       policy.name,
        actions:    policy.actions,
      });
    }

    // Resolve approval requirement from matched threshold policies (first-match-wins)
    let autoApproved = false;
    let requireLevel: 0 | 1 | 2 = 0;
    let message: string | undefined;

    for (const p of matched) {
      if (p.policyType !== 'approval_threshold') continue;
      for (const action of p.actions) {
        if (action.type === 'auto_approve') {
          autoApproved = true;
          message = String(action.reason ?? 'Auto-approved by governance policy');
          break;
        }
        if (action.type === 'require_approval') {
          const lvl = Number(action.level ?? 1) as 1 | 2;
          if (lvl > requireLevel) {
            requireLevel = lvl;
            message = String(action.message ?? 'Approval required by governance policy');
          }
        }
      }
      if (autoApproved) break; // first auto-approve wins
    }

    return { matched, autoApproved, requireLevel, message };
  } catch (err: any) {
    logger.error('[PolicyEngine] evaluatePolicies error', { error: err.message, triggerEvent, ctx });
    // Fail open — governance failures must not block case operations
    return { matched: [], autoApproved: false, requireLevel: 0 };
  }
}

// ─── Action Executor ──────────────────────────────────────────────────────────

function safe(s: string): string {
  return String(s ?? '').replace(/'/g, "''").replace(/\\/g, '\\\\').slice(0, 500);
}

/**
 * Execute actions from matched policies against a real case.
 * Side-effects: adds notes, logs escalation events, writes execution log.
 * Returns a list of what was actually done.
 */
export async function runActions(
  triggerEvent: string,
  ctx: CaseContext,
  matched: EvaluatedPolicy[],
): Promise<string[]> {
  const done: string[] = [];

  for (const policy of matched) {
    const actionsTaken: string[] = [];

    for (const action of policy.actions) {

      try {
        switch (action.type) {

          case 'add_note': {
            const noteText = safe(String(action.note ?? 'Governance policy note'));
            await db.execute(sql.raw(`
              INSERT INTO case_notes (case_type, case_ref_id, author_uid, author_role, note_text)
              VALUES (
                '${safe(ctx.caseType)}', '${safe(ctx.caseRefId)}',
                'system', 'system',
                '[Policy: ${safe(policy.name)}] ${noteText}'
              )
            `));
            actionsTaken.push(`add_note`);
            break;
          }

          case 'escalate': {
            const toRole = String(action.to_role ?? 'franchise_owner');
            const msg    = safe(String(action.message ?? 'Auto-escalated by governance policy'));

            await db.execute(sql.raw(`
              INSERT INTO case_escalation_log (case_type, case_ref_id, event_type, note)
              VALUES (
                '${safe(ctx.caseType)}', '${safe(ctx.caseRefId)}',
                'auto_escalated',
                '[Policy: ${safe(policy.name)}] ${msg}'
              )
            `));
            actionsTaken.push(`escalate:${toRole}`);
            break;
          }

          case 'require_approval':
          case 'auto_approve': {
            // These are resolved at the engine level — no direct side-effect needed here
            actionsTaken.push(action.type);
            break;
          }

          case 'route_to_role': {
            // Record intent; actual re-assignment logic in calling route
            actionsTaken.push(`route_to_role:${String(action.role ?? 'agent')}`);
            break;
          }

          case 'route_to_team': {
            actionsTaken.push(`route_to_team:${String(action.team_id ?? '')}`);
            break;
          }

          default:
            actionsTaken.push(`unknown:${action.type}`);
        }
      } catch (actionErr: any) {
        logger.warn('[PolicyEngine] action execution error', {
          policyId: policy.policyId,
          action:   action.type,
          error:    actionErr.message,
        });
      }
    }

    // Log execution record
    if (actionsTaken.length > 0) {
      try {
        await db.execute(sql.raw(`
          INSERT INTO policy_executions
            (policy_id, case_type, case_ref_id, trigger_event, actions_taken)
          VALUES (
            ${policy.policyId},
            '${safe(ctx.caseType)}', '${safe(ctx.caseRefId)}',
            '${safe(triggerEvent)}',
            '${safe(JSON.stringify(actionsTaken))}'
          )
        `));
      } catch (_) { /* non-critical */ }

      done.push(...actionsTaken);
    }
  }

  return done;
}

/**
 * Convenience: evaluate + run in one call.
 * Returns the full EngineResult including what was done.
 */
export async function applyGovernance(
  triggerEvent: string,
  ctx: CaseContext,
  policyTypeFilter?: string,
): Promise<EngineResult & { actionsDone: string[] }> {
  const result = await evaluatePolicies(triggerEvent, ctx, policyTypeFilter);
  const actionsDone = await runActions(triggerEvent, ctx, result.matched);
  return { ...result, actionsDone };
}
