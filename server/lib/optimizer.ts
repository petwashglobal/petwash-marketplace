/**
 * Phase 12.25 — Autonomous Optimization (Controlled)
 *
 * Generates improvement proposals from measured outcomes (12.22) and learned
 * patterns (12.23). Never executes changes. All changes go through 12.24.
 *
 * HARD GATE: zero proposals if resolvedWithBaseline < 3.
 *
 * Field names match learning-policy.ts exactly:
 *   signalCalibration[].flagType, totalFired, currentlyActive, successRate
 *   decisionEffectiveness[].decision, resolvedWithBaseline, successRate
 *   frictionFeedback.approvalDelayIls, failedPayoutIls, reserveAgedIls, frictionResolutionRate
 *   dataMaturity.resolvedWithBaseline, measurementReadiness
 *   chronicEntities[].riskLevel, entityName, totalCases, openCases
 */

import { computePolicyFeedback } from './learning-policy';

type ActiveConfig = { policyKey: string; config: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Arithmetic helpers
// ---------------------------------------------------------------------------

function relax(v: number):   number { return Math.round(v * 1.15); }
function tighten(v: number): number { return Math.round(v * 0.85); }
function clampMin(v: number, min: number): number { return v < min ? min : v; }

// ---------------------------------------------------------------------------
// stableKey — deterministic proposal ID prevents duplicate inserts
// Same inputs always produce the same key. If conditions haven't changed,
// the INSERT will be skipped (proposal_key UNIQUE).
// ---------------------------------------------------------------------------

export function stableKey(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter(x => x !== null && x !== undefined && String(x).trim() !== '')
    .map(x => String(x).trim().replace(/\s+/g, '_').toLowerCase())
    .join('__');
}

// ---------------------------------------------------------------------------
// Proposal type
// ---------------------------------------------------------------------------

export interface OptimizerProposal {
  proposal_key: string;
  policy_key: string;
  proposal_type: 'relax' | 'tighten' | 'playbook';
  current_config: Record<string, unknown>;
  proposed_config: Record<string, unknown>;
  rationale: {
    summary: string;
    findingIds: string[];
    detail: string[];
  };
  confidence: 'low' | 'medium' | 'high';
  evidence_count: number;
}

function isReady(feedback: Awaited<ReturnType<typeof computePolicyFeedback>>): boolean {
  return (feedback?.dataMaturity?.resolvedWithBaseline ?? 0) >= 3;
}

// ---------------------------------------------------------------------------
// 6 proposal rules — spec-exact logic, real field names
// ---------------------------------------------------------------------------

export async function generateOptimizationProposals(
  activeConfigs: ActiveConfig[]
): Promise<OptimizerProposal[]> {
  const feedback = await computePolicyFeedback();

  if (!isReady(feedback)) return [];

  const proposals: OptimizerProposal[] = [];

  const approval      = activeConfigs.find(c => c.policyKey === 'approval_threshold');
  const escalation    = activeConfigs.find(c => c.policyKey === 'intervention_escalation_days');
  const reserveHold   = activeConfigs.find(c => c.policyKey === 'reserve_hold_days');
  const expansionScore = activeConfigs.find(c => c.policyKey === 'expansion_score_threshold');
  const payoutFailure = activeConfigs.find(c => c.policyKey === 'payout_failure_limit');
  const frictionLimit = activeConfigs.find(c => c.policyKey === 'friction_cost_limit');

  // RULE 1 — Approval delay + resolution rate shows threshold too conservative
  if (
    approval &&
    (feedback.frictionFeedback.approvalDelayIls ?? 0) > 0 &&
    (feedback.frictionFeedback.frictionResolutionRate ?? 0) > 50
  ) {
    proposals.push({
      proposal_key: stableKey(['approval_threshold', 'relax', 'global', approval.config.thresholdIls]),
      policy_key: 'approval_threshold',
      proposal_type: 'relax',
      current_config: approval.config,
      proposed_config: {
        ...approval.config,
        thresholdIls: relax(Number(approval.config.thresholdIls ?? 0)),
      },
      rationale: {
        summary: 'Approval delays are creating friction without outcome improvement strong enough to justify the current threshold.',
        findingIds: ['FRICTION_APPROVAL_DELAY'],
        detail: [
          `approvalDelayIls=${feedback.frictionFeedback.approvalDelayIls}`,
          `frictionResolutionRate=${feedback.frictionFeedback.frictionResolutionRate}`,
        ],
      },
      confidence: 'medium',
      evidence_count: feedback.dataMaturity.resolvedWithBaseline,
    });
  }

  // RULE 2 — Chronic high-risk entities → escalation too slow
  if (
    escalation &&
    Array.isArray(feedback.chronicEntities) &&
    feedback.chronicEntities.some(e => e.riskLevel === 'high')
  ) {
    const highRisk = feedback.chronicEntities.filter(e => e.riskLevel === 'high');
    proposals.push({
      proposal_key: stableKey(['intervention_escalation_days', 'tighten', 'global', escalation.config.days]),
      policy_key: 'intervention_escalation_days',
      proposal_type: 'tighten',
      current_config: escalation.config,
      proposed_config: {
        ...escalation.config,
        days: clampMin(tighten(Number(escalation.config.days ?? 0)), 1),
      },
      rationale: {
        summary: 'Chronic unresolved entities indicate escalation timing is too slow.',
        findingIds: ['CHRONIC_ENTITY_PRESSURE'],
        detail: highRisk.map(e => `${e.entityName}: totalCases=${e.totalCases}, openCases=${e.openCases}`),
      },
      confidence: 'medium',
      evidence_count: highRisk.length,
    });
  }

  // RULE 3 — Network health signal active + poor success → tighten expansion gate
  const networkHealthSignal = Array.isArray(feedback.signalCalibration)
    ? feedback.signalCalibration.find(s => s.flagType === 'network_health_low')
    : null;

  if (
    expansionScore &&
    networkHealthSignal &&
    (networkHealthSignal.totalFired ?? 0) >= 2 &&
    ((networkHealthSignal.successRate ?? 0) < 50 || networkHealthSignal.currentlyActive)
  ) {
    proposals.push({
      proposal_key: stableKey(['expansion_score_threshold', 'tighten', 'global', expansionScore.config.minimumScore]),
      policy_key: 'expansion_score_threshold',
      proposal_type: 'tighten',
      current_config: expansionScore.config,
      proposed_config: {
        ...expansionScore.config,
        minimumScore: relax(Number(expansionScore.config.minimumScore ?? 0)),
      },
      rationale: {
        summary: 'Expansion gate should be stricter because weak network health continues to surface.',
        findingIds: ['SIGNAL_NETWORK_HEALTH_LOW'],
        detail: [
          `totalFired=${networkHealthSignal.totalFired}`,
          `successRate=${networkHealthSignal.successRate}`,
          `currentlyActive=${networkHealthSignal.currentlyActive}`,
        ],
      },
      confidence: (networkHealthSignal as any).confidence ?? 'medium',
      evidence_count: networkHealthSignal.totalFired ?? 0,
    });
  }

  // RULE 4 — Failed payout ILS present → tighten payout failure tolerance
  if (payoutFailure && (feedback.frictionFeedback.failedPayoutIls ?? 0) > 0) {
    proposals.push({
      proposal_key: stableKey(['payout_failure_limit', 'tighten', 'global', payoutFailure.config.maxFailureRatePct]),
      policy_key: 'payout_failure_limit',
      proposal_type: 'tighten',
      current_config: payoutFailure.config,
      proposed_config: {
        ...payoutFailure.config,
        maxFailureRatePct: clampMin(tighten(Number(payoutFailure.config.maxFailureRatePct ?? 0)), 1),
      },
      rationale: {
        summary: 'Payout failures remain present and current tolerance is too loose.',
        findingIds: ['TREASURY_FAILURE_PRESSURE'],
        detail: [`failedPayoutIls=${feedback.frictionFeedback.failedPayoutIls}`],
      },
      confidence: 'medium',
      evidence_count: feedback.dataMaturity.resolvedWithBaseline,
    });
  }

  // RULE 5 — Aged reserve ILS + chronic entities → tighten reserve hold discipline
  if (
    reserveHold &&
    (feedback.frictionFeedback.reserveAgedIls ?? 0) > 0 &&
    Array.isArray(feedback.chronicEntities) &&
    feedback.chronicEntities.length > 0
  ) {
    proposals.push({
      proposal_key: stableKey(['reserve_hold_days', 'tighten', 'global', reserveHold.config.days]),
      policy_key: 'reserve_hold_days',
      proposal_type: 'tighten',
      current_config: reserveHold.config,
      proposed_config: {
        ...reserveHold.config,
        days: clampMin(tighten(Number(reserveHold.config.days ?? 0)), 3),
      },
      rationale: {
        summary: 'Reserve ageing remains elevated and release discipline should tighten.',
        findingIds: ['AGED_RESERVE_PRESSURE', 'CHRONIC_ENTITY_PRESSURE'],
        detail: [
          `reserveAgedIls=${feedback.frictionFeedback.reserveAgedIls}`,
          `chronicEntities=${feedback.chronicEntities.length}`,
        ],
      },
      confidence: 'medium',
      evidence_count: feedback.chronicEntities.length,
    });
  }

  // RULE 6 — No decision with ≥70% success rate → playbook review required
  const effectiveness = Array.isArray(feedback.decisionEffectiveness)
    ? feedback.decisionEffectiveness
    : [];

  const bestDecision = effectiveness.find(
    d => (d.successRate ?? 0) >= 70 && (d.resolvedWithBaseline ?? 0) >= 3
  );

  if (!bestDecision) {
    proposals.push({
      proposal_key: stableKey(['playbook_review', 'global', 'effectiveness_low']),
      policy_key: frictionLimit?.policyKey ?? 'friction_cost_limit',
      proposal_type: 'playbook',
      current_config: frictionLimit?.config ?? {},
      proposed_config: {
        ...(frictionLimit?.config ?? {}),
        playbookReviewRequired: true,
      },
      rationale: {
        summary: 'No measured intervention decision currently shows strong enough effectiveness to standardize confidently.',
        findingIds: ['DECISION_EFFECTIVENESS_WEAK'],
        detail: effectiveness.map(d =>
          `${d.decision}: resolvedWithBaseline=${d.resolvedWithBaseline}, successRate=${d.successRate}`
        ),
      },
      confidence: 'low',
      evidence_count: effectiveness.reduce((sum, d) => sum + (d.resolvedWithBaseline ?? 0), 0),
    });
  }

  return proposals;
}
