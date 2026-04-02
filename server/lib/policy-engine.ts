/**
 * server/lib/policy-engine.ts
 * Phase 12.13 — Governance & Automation Layer
 * Phase 12.14 — Trust, Explainability & Safety
 *
 * Pure policy evaluation engine. Loads active governance_policies from the DB,
 * evaluates conditions against a CaseContext, and returns the actions to execute.
 *
 * Phase 12.14 additions:
 *   - explainConditions()   — per-condition breakdown (key → expected → actual → pass/fail)
 *   - EvaluatedPolicy now includes whyMatched: ConditionResult[]
 *   - runActions writes why_matched JSONB to policy_executions
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

/**
 * Per-condition explainability record.
 * Describes a single condition check outcome.
 */
export interface ConditionResult {
  key:      string;          // condition key, e.g. 'amount_gte'
  expected: unknown;         // configured threshold/value
  actual:   unknown;         // value from the case context
  passed:   boolean;         // did this condition pass?
  note?:    string;          // human-readable description
}

export interface EvaluatedPolicy {
  policyId:    number;
  policyType:  string;
  name:        string;
  actions:     PolicyAction[];
  whyMatched:  ConditionResult[];   // Phase 12.14 — per-condition breakdown
}

export interface EngineResult {
  matched:      EvaluatedPolicy[];
  autoApproved: boolean;
  requireLevel: 0 | 1 | 2;          // 0 = no extra requirement, 1 = manager, 2 = franchise_owner
  message?:     string;
}

// ─── Explainability Engine ────────────────────────────────────────────────────

/**
 * Phase 12.14: Evaluate conditions with full per-condition breakdown.
 * Returns { matched: boolean, results: ConditionResult[] }
 *
 * Unknown/unrecognised condition keys are flagged as skipped (passed: true, note: 'unknown key').
 */
export function explainConditions(
  conditions: Record<string, unknown>,
  ctx: CaseContext,
): { matched: boolean; results: ConditionResult[] } {
  const results: ConditionResult[] = [];
  let allPassed = true;

  for (const [key, value] of Object.entries(conditions)) {
    let passed = true;
    let actual: unknown = undefined;
    let note: string | undefined;

    switch (key) {

      case 'closure_codes': {
        actual = ctx.closureCode ?? null;
        if (!ctx.closureCode) {
          passed = false;
          note = 'No closure code present on case';
        } else if (!Array.isArray(value)) {
          passed = false;
          note = 'closure_codes must be an array';
        } else if (!(value as string[]).includes(ctx.closureCode)) {
          passed = false;
          note = `"${ctx.closureCode}" not in allowed list [${(value as string[]).join(', ')}]`;
        } else {
          note = `"${ctx.closureCode}" is in allowed list`;
        }
        break;
      }

      case 'sla_status': {
        actual = ctx.slaStatus ?? null;
        passed = ctx.slaStatus === value;
        note = passed
          ? `SLA status matches "${value}"`
          : `SLA status is "${ctx.slaStatus ?? 'unknown'}", expected "${value}"`;
        break;
      }

      case 'amount_gte': {
        const thresholdILS = Number(value);
        const thresholdCents = thresholdILS * 100;
        actual = ctx.amountCents != null ? ctx.amountCents / 100 : null;   // display in ILS
        passed = (ctx.amountCents ?? 0) >= thresholdCents;
        note = passed
          ? `Amount ${actual} ILS ≥ ${thresholdILS} ILS`
          : `Amount ${actual ?? 0} ILS < ${thresholdILS} ILS`;
        break;
      }

      case 'amount_lt': {
        const thresholdILS = Number(value);
        const thresholdCents = thresholdILS * 100;
        actual = ctx.amountCents != null ? ctx.amountCents / 100 : null;
        passed = (ctx.amountCents ?? 0) < thresholdCents;
        note = passed
          ? `Amount ${actual ?? 0} ILS < ${thresholdILS} ILS`
          : `Amount ${actual} ILS ≥ ${thresholdILS} ILS`;
        break;
      }

      case 'amount_lte': {
        const thresholdILS = Number(value);
        const thresholdCents = thresholdILS * 100;
        actual = ctx.amountCents != null ? ctx.amountCents / 100 : null;
        passed = (ctx.amountCents ?? 0) <= thresholdCents;
        note = passed
          ? `Amount ${actual ?? 0} ILS ≤ ${thresholdILS} ILS`
          : `Amount ${actual} ILS > ${thresholdILS} ILS`;
        break;
      }

      case 'handler_role': {
        actual = ctx.handlerRole ?? null;
        const allowed = Array.isArray(value) ? value as string[] : [String(value)];
        passed = Boolean(ctx.handlerRole) && allowed.includes(ctx.handlerRole!);
        note = passed
          ? `Handler role "${ctx.handlerRole}" is in [${allowed.join(', ')}]`
          : `Handler role "${ctx.handlerRole ?? 'none'}" not in [${allowed.join(', ')}]`;
        break;
      }

      case 'reopen_count_gte': {
        actual = ctx.reopenCount ?? 0;
        passed = (ctx.reopenCount ?? 0) >= Number(value);
        note = passed
          ? `Reopen count ${actual} ≥ ${value}`
          : `Reopen count ${actual} < ${value}`;
        break;
      }

      case 'station_id': {
        actual = ctx.stationId ?? null;
        passed = ctx.stationId === String(value);
        note = passed
          ? `Station matches "${value}"`
          : `Station is "${ctx.stationId ?? 'none'}", expected "${value}"`;
        break;
      }

      case 'franchise_id': {
        actual = ctx.franchiseId ?? null;
        passed = ctx.franchiseId === String(value);
        note = passed
          ? `Franchise matches "${value}"`
          : `Franchise is "${ctx.franchiseId ?? 'none'}", expected "${value}"`;
        break;
      }

      default: {
        // Unknown key — forward-compat: treat as pass but flag it
        actual = undefined;
        passed = true;
        note = `Unknown condition key "${key}" — skipped (forward-compat)`;
        break;
      }
    }

    results.push({ key, expected: value, actual, passed, note });
    if (!passed) allPassed = false;
  }

  return { matched: allPassed, results };
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

export async function loadActivePolicies(
  policyType: string | null,
  ctx: CaseContext,
  onlyActive = true,
): Promise<RawPolicy[]> {
  const typeCondition   = policyType ? sql`AND policy_type = ${policyType}` : sql``;
  const activeCondition = onlyActive ? sql`AND is_active = true`            : sql``;

  const r = await db.execute(sql`
    SELECT id, policy_type, name, case_types, conditions, actions, priority, scope_type, scope_id
    FROM governance_policies
    WHERE 1=1
      ${activeCondition}
      ${typeCondition}
    ORDER BY priority ASC, id ASC
  `);

  return (r.rows as any[])
    .filter(row => {
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
 *
 * Phase 12.14: Each matched policy now includes whyMatched (ConditionResult[]).
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
      const { matched: didMatch, results } = explainConditions(policy.conditions, ctx);
      if (!didMatch) continue;
      matched.push({
        policyId:   policy.id,
        policyType: policy.policy_type,
        name:       policy.name,
        actions:    policy.actions,
        whyMatched: results,
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
      if (autoApproved) break;
    }

    return { matched, autoApproved, requireLevel, message };
  } catch (err: any) {
    logger.error('[PolicyEngine] evaluatePolicies error', { error: err.message, triggerEvent, ctx });
    return { matched: [], autoApproved: false, requireLevel: 0 };
  }
}

// ─── Action Executor ──────────────────────────────────────────────────────────

/**
 * Execute actions from matched policies against a real case.
 * Side-effects: adds notes, logs escalation events, writes execution log with why_matched.
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
            const noteText     = String(action.note ?? 'Governance policy note').slice(0, 1000);
            const fullNoteText = `[Policy: ${policy.name}] ${noteText}`;
            await db.execute(sql`
              INSERT INTO case_notes (case_type, case_ref_id, author_uid, author_role, note_text)
              VALUES (
                ${ctx.caseType}, ${ctx.caseRefId},
                'system', 'system',
                ${fullNoteText}
              )
            `);
            actionsTaken.push(`add_note`);
            break;
          }

          case 'escalate': {
            const toRole    = String(action.to_role ?? 'franchise_owner');
            const msg       = String(action.message ?? 'Auto-escalated by governance policy').slice(0, 500);
            const escalNote = `[Policy: ${policy.name}] ${msg}`;
            await db.execute(sql`
              INSERT INTO case_escalation_log (case_type, case_ref_id, event_type, note)
              VALUES (
                ${ctx.caseType}, ${ctx.caseRefId},
                'auto_escalated',
                ${escalNote}
              )
            `);
            actionsTaken.push(`escalate:${toRole}`);
            break;
          }

          case 'require_approval':
          case 'auto_approve': {
            actionsTaken.push(action.type);
            break;
          }

          case 'route_to_role': {
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

    // Log execution record — Phase 12.14: include why_matched
    if (actionsTaken.length > 0) {
      try {
        const actionsTakenJson = JSON.stringify(actionsTaken);
        const whyMatchedJson   = JSON.stringify(policy.whyMatched ?? []);
        await db.execute(sql`
          INSERT INTO policy_executions
            (policy_id, case_type, case_ref_id, trigger_event, actions_taken, why_matched)
          VALUES (
            ${policy.policyId},
            ${ctx.caseType}, ${ctx.caseRefId},
            ${triggerEvent},
            ${actionsTakenJson},
            ${whyMatchedJson}::jsonb
          )
        `);
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
