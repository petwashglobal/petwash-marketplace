/**
 * Phase 12.25 — Autonomous Optimization (Controlled)
 *
 * Generates improvement proposals by reading measured outcomes (12.22)
 * and learned patterns (12.23). Never executes changes directly.
 *
 * HARD RULES:
 * 1. Returns zero proposals if resolvedWithBaseline < 3 — no speculation on thin data
 * 2. Every proposal maps to a policy_key that exists in policy_configs (12.24)
 * 3. Proposed config always carries a typed rationale, not just a text comment
 * 4. Confidence is derived from the same sample threshold as 12.23
 *    (confident=10, directional=3, otherwise low)
 *
 * FLOW: measure (12.22) → learn (12.23) → propose (12.25) → control (12.24)
 */

import { computePolicyFeedback } from './learning-policy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OptimizerProposal {
  policy_key: string;
  proposal_type: 'relax' | 'tighten' | 'reduce' | 'raise' | 'calibrate';
  current_config: Record<string, unknown>;
  proposed_config: Record<string, unknown>;
  rationale: {
    summary: string;
    signal?: string;
    metric?: string;
    finding?: string;
  };
  confidence: 'low' | 'medium' | 'high';
  evidence_count: number;
}

type ActiveConfig = { policyKey: string; config: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Confidence mapping from evidence count (mirrors 12.23 thresholds)
// ---------------------------------------------------------------------------

const CONFIDENT_THRESHOLD    = 10;
const DIRECTIONAL_THRESHOLD  = 3;

function proposalConfidence(count: number): 'low' | 'medium' | 'high' {
  if (count >= CONFIDENT_THRESHOLD)   return 'high';
  if (count >= DIRECTIONAL_THRESHOLD) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Helper: change a numeric config value, bounded to a safe range
// ---------------------------------------------------------------------------

function nudge(value: unknown, pct: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Math.max(min, Math.min(max, Math.round(n * (1 + pct / 100))));
}

// ---------------------------------------------------------------------------
// Proposal rules
// ---------------------------------------------------------------------------

function ruleApprovalThreshold(
  fb: Awaited<ReturnType<typeof computePolicyFeedback>>,
  configs: ActiveConfig[],
  proposals: OptimizerProposal[],
): void {
  // RULE: if approval delay friction is non-zero AND more than half of
  // friction-linked cases are already resolved → threshold is too conservative,
  // raising it would reduce unnecessary delays without increasing failure risk.
  const { approvalDelayIls, frictionResolutionRate } = fb.frictionFeedback;
  if (approvalDelayIls <= 0) return;
  if ((frictionResolutionRate ?? 0) < 50) return;

  const current = configs.find(c => c.policyKey === 'approval_threshold');
  if (!current) return;

  const currentMin    = current.config.min_amount_ils as number ?? 5000;
  const currentAuto   = current.config.auto_approve_below as number ?? 1000;

  proposals.push({
    policy_key: 'approval_threshold',
    proposal_type: 'relax',
    current_config: current.config,
    proposed_config: {
      ...current.config,
      min_amount_ils:       nudge(currentMin,  +15, 1000, 50000),
      auto_approve_below:   nudge(currentAuto, +20, 200,  10000),
    },
    rationale: {
      summary: 'Approval delays are generating friction but resolution rate shows cases close successfully. Raising the threshold reduces unnecessary manual reviews.',
      metric: `₪${Math.round(approvalDelayIls).toLocaleString()} in approval delay friction`,
      finding: `${frictionResolutionRate}% of friction-linked cases resolved — threshold appears too conservative.`,
    },
    confidence: proposalConfidence(fb.dataMaturity.resolvedWithBaseline),
    evidence_count: fb.dataMaturity.resolvedWithBaseline,
  });
}

function ruleReserveHoldDays(
  fb: Awaited<ReturnType<typeof computePolicyFeedback>>,
  configs: ActiveConfig[],
  proposals: OptimizerProposal[],
): void {
  // RULE: if the reserve_aged_31plus signal fires frequently (>= 2 times)
  // AND has a low or null success rate → reserve hold period is too long,
  // tightening critical_days would surface aging reserves earlier.
  const reserveSignal = fb.signalCalibration.find(s => s.flag === 'reserve_aged_31plus');
  if (!reserveSignal) return;
  if (reserveSignal.fired < 2) return;
  if (reserveSignal.successRate !== null && reserveSignal.successRate >= 50) return;

  const current = configs.find(c => c.policyKey === 'reserve_hold_days');
  if (!current) return;

  const currentWarning  = current.config.warning_days  as number ?? 21;
  const currentCritical = current.config.critical_days as number ?? 31;

  proposals.push({
    policy_key: 'reserve_hold_days',
    proposal_type: 'tighten',
    current_config: current.config,
    proposed_config: {
      ...current.config,
      warning_days:  nudge(currentWarning,  -10, 7, 30),
      critical_days: nudge(currentCritical, -10, 14, 45),
    },
    rationale: {
      summary: 'Reserve aging signal fires frequently but interventions are not resolving well. Shorter hold periods surface issues earlier, allowing intervention before cases escalate.',
      signal: `reserve_aged_31plus fired ${reserveSignal.fired} time(s)`,
      finding: reserveSignal.successRate !== null
        ? `Only ${reserveSignal.successRate}% of reserve-aging cases improved after intervention.`
        : 'No resolved reserve-aging cases with baseline — cannot confirm effectiveness.',
    },
    confidence: proposalConfidence(reserveSignal.resolvedWithBaseline ?? 0),
    evidence_count: reserveSignal.resolvedWithBaseline ?? 0,
  });
}

function ruleInterventionEscalationDays(
  fb: Awaited<ReturnType<typeof computePolicyFeedback>>,
  configs: ActiveConfig[],
  proposals: OptimizerProposal[],
): void {
  // RULE: if there are high-risk chronic entities (same entities keep returning)
  // AND at least one has open + escalated cases → escalation is happening too late.
  const highRisk = fb.chronicEntities.filter(e => e.riskLevel === 'high');
  if (highRisk.length === 0) return;
  const hasEscalated = highRisk.some(e => e.escalatedCases > 0 && e.openCases > 0);
  if (!hasEscalated) return;

  const current = configs.find(c => c.policyKey === 'intervention_escalation_days');
  if (!current) return;

  const currentDays = current.config.days_to_escalate as number ?? 14;

  proposals.push({
    policy_key: 'intervention_escalation_days',
    proposal_type: 'reduce',
    current_config: current.config,
    proposed_config: {
      ...current.config,
      days_to_escalate: nudge(currentDays, -15, 3, 30),
    },
    rationale: {
      summary: 'High-risk chronic entities have active escalations alongside open cases. Escalation threshold appears too high — reducing it causes issues to surface before they become chronic.',
      signal: `${highRisk.length} high-risk chronic entity/entities with concurrent open + escalated cases`,
      finding: `Entities: ${highRisk.map(e => e.entityName).join(', ')}`,
    },
    confidence: proposalConfidence(highRisk.reduce((s, e) => s + e.totalCases, 0)),
    evidence_count: highRisk.reduce((s, e) => s + e.totalCases, 0),
  });
}

function ruleExpansionScoreThreshold(
  fb: Awaited<ReturnType<typeof computePolicyFeedback>>,
  configs: ActiveConfig[],
  proposals: OptimizerProposal[],
): void {
  // RULE: if the approve_expansion decision appears in ranking AND has a high
  // success rate but a low sample → threshold is likely blocking good candidates.
  // OR if no_decision dominates ranking with low success rate → threshold too low.
  const approveDecision  = fb.decisionRanking.find(d => d.decision === 'approve_expansion');
  const noDecision       = fb.decisionRanking.find(d => d.decision === 'no_decision');

  const current = configs.find(c => c.policyKey === 'expansion_score_threshold');
  if (!current) return;

  const minScore  = current.config.min_score  as number ?? 65;
  const holdBelow = current.config.hold_below as number ?? 45;

  // Sub-rule A: no_decision dominates + poor success → threshold may be too high
  if (noDecision && noDecision.rank === 1 && (noDecision.successRate ?? 100) < 40) {
    proposals.push({
      policy_key: 'expansion_score_threshold',
      proposal_type: 'relax',
      current_config: current.config,
      proposed_config: {
        ...current.config,
        min_score:  nudge(minScore,  -8, 40, 90),
        hold_below: nudge(holdBelow, -8, 25, 65),
      },
      rationale: {
        summary: '"No decision" is the most common outcome and has a poor success rate. This suggests the approval threshold is blocking cases that would benefit from intervention.',
        signal: `no_decision ranked #1 (${noDecision.resolvedWithBaseline} resolved+baseline cases)`,
        finding: `Success rate: ${noDecision.successRate !== null ? `${noDecision.successRate}%` : '—'} — below threshold for effective governance.`,
      },
      confidence: proposalConfidence(noDecision.resolvedWithBaseline),
      evidence_count: noDecision.resolvedWithBaseline,
    });
  }

  // Sub-rule B: approve_expansion appears with high success rate → threshold working but could be nudged lower
  if (approveDecision && (approveDecision.successRate ?? 0) >= 70 && approveDecision.resolvedWithBaseline >= 3) {
    proposals.push({
      policy_key: 'expansion_score_threshold',
      proposal_type: 'calibrate',
      current_config: current.config,
      proposed_config: {
        ...current.config,
        min_score:  nudge(minScore,  -5, 40, 90),
        hold_below: nudge(holdBelow, -5, 25, 65),
      },
      rationale: {
        summary: 'Expansion approvals are succeeding at a high rate. A modest threshold reduction could unlock additional qualified candidates without material increase in risk.',
        signal: `approve_expansion: ${approveDecision.successRate}% success rate (${approveDecision.resolvedWithBaseline} cases)`,
        finding: 'Current threshold performing well. Calibration is a conservative improvement.',
      },
      confidence: proposalConfidence(approveDecision.resolvedWithBaseline),
      evidence_count: approveDecision.resolvedWithBaseline,
    });
  }
}

function ruleFrictionCostLimit(
  fb: Awaited<ReturnType<typeof computePolicyFeedback>>,
  configs: ActiveConfig[],
  proposals: OptimizerProposal[],
): void {
  // RULE: if payout_failure signal fires frequently with a low success rate
  // AND friction cost is non-zero → friction cost limit is too permissive.
  const failureSignal = fb.signalCalibration.find(s => s.flag === 'payout_failure');
  if (!failureSignal) return;
  if (failureSignal.fired < 2) return;
  if ((failureSignal.successRate ?? 100) >= 40) return;  // only if poorly effective

  const current = configs.find(c => c.policyKey === 'friction_cost_limit');
  if (!current) return;

  const currentWarning  = current.config.warning_pct  as number ?? 15;
  const currentCritical = current.config.critical_pct as number ?? 25;

  proposals.push({
    policy_key: 'friction_cost_limit',
    proposal_type: 'tighten',
    current_config: current.config,
    proposed_config: {
      ...current.config,
      warning_pct:  nudge(currentWarning,  -15, 5, 25),
      critical_pct: nudge(currentCritical, -15, 10, 35),
    },
    rationale: {
      summary: 'Payout failures are recurring with a low intervention success rate. A tighter friction cost limit will trigger alerts earlier, allowing intervention before costs compound.',
      signal: `payout_failure fired ${failureSignal.fired} time(s) with ${failureSignal.successRate !== null ? `${failureSignal.successRate}%` : 'unknown'} success rate`,
      finding: 'Current friction cost limit appears too permissive — lowering it gives earlier warning.',
    },
    confidence: proposalConfidence(failureSignal.resolvedWithBaseline ?? 0),
    evidence_count: failureSignal.resolvedWithBaseline ?? 0,
  });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function generateProposals(activeConfigs: ActiveConfig[]): Promise<OptimizerProposal[]> {
  const feedback = await computePolicyFeedback();

  // HARD GATE: refuse to propose on thin data
  if (feedback.dataMaturity.resolvedWithBaseline < DIRECTIONAL_THRESHOLD) {
    return [];
  }

  const proposals: OptimizerProposal[] = [];

  ruleApprovalThreshold(feedback, activeConfigs, proposals);
  ruleReserveHoldDays(feedback, activeConfigs, proposals);
  ruleInterventionEscalationDays(feedback, activeConfigs, proposals);
  ruleExpansionScoreThreshold(feedback, activeConfigs, proposals);
  ruleFrictionCostLimit(feedback, activeConfigs, proposals);

  // De-duplicate: one proposal per policy_key (keep the highest evidence_count)
  const best = new Map<string, OptimizerProposal>();
  for (const p of proposals) {
    const existing = best.get(p.policy_key);
    if (!existing || p.evidence_count > existing.evidence_count) {
      best.set(p.policy_key, p);
    }
  }

  return Array.from(best.values());
}
