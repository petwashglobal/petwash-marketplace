/**
 * Phase 12.24 — Policy Execution Discipline & Controlled Rollout
 *
 * Evaluates rollout effectiveness by correlating intervention outcomes (12.22)
 * with the rollout's scope. No new financial formulas. No new scoring paths.
 *
 * Core principles:
 * 1. Policies are NEVER edited in place → always versioned (policy_configs table)
 * 2. Every change is a DRAFT before activation
 * 3. Activation can be scoped (station / franchise / ownership / global)
 * 4. Every rollout is reversible (rollback sets end_date + rolled_back status)
 * 5. Every rollout is measurable (hooks into 12.22 outcomes)
 */

import { computeOutcomeSummary, type CaseOutcome } from './outcome-measurement';

// ---------------------------------------------------------------------------
// Pre-defined policy keys (the known knobs that can be changed)
// ---------------------------------------------------------------------------

export const KNOWN_POLICY_KEYS: Record<string, { label: string; description: string; defaultConfig: Record<string, unknown> }> = {
  approval_threshold: {
    label: 'Approval threshold',
    description: 'Minimum settlement amount (ILS) requiring manual approval before payout',
    defaultConfig: { min_amount_ils: 5000, auto_approve_below: 1000 },
  },
  reserve_hold_days: {
    label: 'Reserve hold period',
    description: 'Maximum days reserve can be held before triggering reserve_aged_31plus flag',
    defaultConfig: { warning_days: 21, critical_days: 31 },
  },
  friction_cost_limit: {
    label: 'Friction cost limit',
    description: 'Maximum acceptable friction cost as % of gross revenue before board flag fires',
    defaultConfig: { warning_pct: 15, critical_pct: 25 },
  },
  intervention_escalation_days: {
    label: 'Intervention escalation',
    description: 'Days before an open intervention case is auto-escalated',
    defaultConfig: { days_to_escalate: 14 },
  },
  expansion_score_threshold: {
    label: 'Expansion score threshold',
    description: 'Minimum composite score (0–100) required for approve_expansion decision',
    defaultConfig: { min_score: 65, hold_below: 45 },
  },
  payout_failure_limit: {
    label: 'Payout failure limit',
    description: 'Maximum payout failure rate (%) before payout_failure flag fires',
    defaultConfig: { warning_pct: 5, critical_pct: 15 },
  },
};

// ---------------------------------------------------------------------------
// Rollout evaluation — reads from 12.22 outcomes, scoped to rollout
// ---------------------------------------------------------------------------

export interface RolloutEvaluation {
  rolloutId: number;
  scopeType: string;
  scopeKey: string | null;
  sampleSize: number;
  resolvedCount: number;
  successRate: number | null;
  avgMarginDelta: number | null;
  avgFrictionDelta: number | null;
  hasBaseline: boolean;  // whether any cases in scope have baselines
  note: string;
}

function filterByScopeKey(outcome: CaseOutcome, scopeType: string, scopeKey: string | null): boolean {
  if (scopeType === 'global') return true;
  if (scopeType === 'station')    return outcome.entityType === 'station' && String(outcome.entityId) === String(scopeKey);
  if (scopeType === 'franchise')  return outcome.entityType === 'network';
  if (scopeType === 'ownership')  return outcome.entityType === 'station';  // all stations fall under ownership
  return true;
}

export function evaluateRollout(
  outcomes: Awaited<ReturnType<typeof computeOutcomeSummary>>,
  rollout: { id: number; scope_type: string; scope_key: string | null },
): RolloutEvaluation {
  const relevant = outcomes.caseOutcomes.filter(c =>
    filterByScopeKey(c, rollout.scope_type, rollout.scope_key)
  );

  const withBaseline   = relevant.filter(c => c.hasBaseline);
  const resolved       = relevant.filter(c => c.status === 'resolved' && c.hasBaseline);
  const improved       = resolved.filter(c => c.verdict === 'improved');

  const successRate = resolved.length > 0
    ? Math.round((improved.length / resolved.length) * 100)
    : null;

  const validMargin   = resolved.filter(c => c.marginDelta.delta !== null);
  const validFriction = resolved.filter(c => c.frictionDelta.delta !== null);

  const avg = (arr: CaseOutcome[], key: 'marginDelta' | 'frictionDelta') => {
    if (!arr.length) return null;
    const sum = arr.reduce((s, c) => s + (c[key].delta as number), 0);
    return Math.round((sum / arr.length) * 100) / 100;
  };

  let note: string;
  if (relevant.length === 0) {
    note = 'No cases in scope for this rollout.';
  } else if (withBaseline.length === 0) {
    note = 'Cases found in scope but none have economic baselines. Measurement requires new cases created after baseline capture was enabled.';
  } else if (resolved.length === 0) {
    note = `${withBaseline.length} case(s) in scope have baselines but none are resolved. Check back after cases are closed.`;
  } else {
    note = `${resolved.length} resolved case(s) with baselines. ${improved.length} improved.`;
  }

  return {
    rolloutId: rollout.id,
    scopeType: rollout.scope_type,
    scopeKey: rollout.scope_key,
    sampleSize: relevant.length,
    resolvedCount: resolved.length,
    successRate,
    avgMarginDelta: avg(validMargin, 'marginDelta'),
    avgFrictionDelta: avg(validFriction, 'frictionDelta'),
    hasBaseline: withBaseline.length > 0,
    note,
  };
}
