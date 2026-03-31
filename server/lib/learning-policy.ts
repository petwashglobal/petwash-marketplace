/**
 * Phase 12.23 — Learning, Policy Refinement & Capital Feedback
 *
 * Reads ONLY from:
 * 1. computeOutcomeSummary() — Phase 12.22 measured outcomes (the authoritative source)
 * 2. computeStationEconomics() / aggregateNetworkEconomics() — Phase 12.19 friction data
 * 3. buildExpansionDecisionPack() — Phase 12.20 board flags (which are currently active)
 *
 * No new financial formulas. No retrospective number invention.
 * Confidence degrades honestly as sample size decreases.
 */

import { computeOutcomeSummary, type OutcomeSummary, type CaseOutcome } from './outcome-measurement';
import { computeStationEconomics, aggregateNetworkEconomics, ownershipComparison } from './unit-economics';
import { buildExpansionDecisionPack, toStationRow, toNetworkRow, toOwnershipRow } from './expansion-decision';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConfidenceLevel = 'confident' | 'directional' | 'insufficient_data';
export type PolicyAction    = 'tighten' | 'relax' | 'retire' | 'retain' | 'review' | 'monitor' | 'escalate';

const CONFIDENT_THRESHOLD   = 10;   // resolved+baseline cases needed for "confident"
const DIRECTIONAL_THRESHOLD = 3;    // resolved+baseline cases needed for "directional"

export interface SignalCalibration {
  flagType: string;
  label: string;
  totalFired: number;
  resolvedWithBaseline: number;
  successRate: number | null;
  avgResolutionDays: number | null;
  currentlyActive: boolean;
  confidence: ConfidenceLevel;
  recommendation: string;
  suggestedAction: PolicyAction;
}

export interface DecisionEffectiveness {
  decision: string;
  label: string;
  rank: number;
  totalCases: number;
  successRate: number | null;
  avgResolutionDays: number | null;
  avgMarginImprovement: number | null;
  confidence: ConfidenceLevel;
  assessment: string;
}

export interface ChronicEntity {
  entityType: string;
  entityId: string;
  entityName: string;
  totalCases: number;
  openCases: number;
  resolvedCases: number;
  lastCaseDate: string;
  riskLevel: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface PolicyRecommendation {
  id: string;
  area: 'signal_threshold' | 'decision_playbook' | 'capital_rules' | 'entity_escalation' | 'approval_friction' | 'data_quality';
  priority: 'critical' | 'high' | 'medium' | 'low';
  finding: string;
  recommendation: string;
  rationale: string;
  confidence: ConfidenceLevel;
  evidenceCount: number;
}

export interface FrictionFeedback {
  totalFrictionIls: number;
  approvalDelayIls: number;
  reserveAgedIls: number;
  failedPayoutIls: number;
  openCasesLinkedToFriction: number;
  resolvedCasesLinkedToFriction: number;
  frictionResolutionRate: number | null;
  thresholdAssessment: string;
}

export interface DataMaturity {
  totalCases: number;
  casesWithBaseline: number;
  resolvedCases: number;
  resolvedWithBaseline: number;
  baselineCoverageRate: number;
  measurementReadiness: 'accumulating' | 'directional' | 'sufficient';
  estimatedCasesUntilConfident: number | null;
  maturityNote: string;
}

export interface PolicyFeedbackReport {
  generatedAt: string;
  dataMaturity: DataMaturity;
  signalCalibration: SignalCalibration[];
  decisionEffectiveness: DecisionEffectiveness[];
  chronicEntities: ChronicEntity[];
  policyRecommendations: PolicyRecommendation[];
  frictionFeedback: FrictionFeedback;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidence(resolvedWithBaseline: number): ConfidenceLevel {
  if (resolvedWithBaseline >= CONFIDENT_THRESHOLD)   return 'confident';
  if (resolvedWithBaseline >= DIRECTIONAL_THRESHOLD) return 'directional';
  return 'insufficient_data';
}

const DECISION_LABELS: Record<string, string> = {
  approve_expansion: 'Approve expansion',
  freeze_capex:      'Freeze capex',
  restructure:       'Restructure',
  review_franchise:  'Review franchise',
  monitor:           'Monitor',
  no_action:         'No action',
  no_decision:       'No decision yet',
};

const FLAG_LABELS: Record<string, string> = {
  treasury_critical:   'Treasury critical',
  margin_collapse:     'Margin collapse',
  cash_blocked:        'Cash blocked',
  reserve_aged_31plus: 'Reserve aged 31+ days',
  approval_backlog:    'Approval backlog',
  payout_failure:      'Payout failure',
  network_health_low:  'Network health low',
};

// Friction-linked flag types — flags that arise directly from operational friction
const FRICTION_FLAG_TYPES = new Set([
  'treasury_critical', 'cash_blocked', 'reserve_aged_31plus', 'approval_backlog', 'payout_failure',
]);

// ---------------------------------------------------------------------------
// Build signal calibration
// ---------------------------------------------------------------------------

function buildSignalCalibration(
  outcomes: CaseOutcome[],
  activeFlags: Set<string>,
): SignalCalibration[] {
  const map = new Map<string, {
    totalFired: number;
    resolvedWithBaseline: number;
    successes: number;
    resolutionDays: number[];
  }>();

  for (const o of outcomes) {
    if (!o.triggerFlag) continue;
    if (!map.has(o.triggerFlag)) map.set(o.triggerFlag, { totalFired: 0, resolvedWithBaseline: 0, successes: 0, resolutionDays: [] });
    const entry = map.get(o.triggerFlag)!;
    entry.totalFired++;
    if (o.hasBaseline && o.status === 'resolved') {
      entry.resolvedWithBaseline++;
      if (o.verdict === 'improved') entry.successes++;
      if (o.resolutionDays !== null) entry.resolutionDays.push(o.resolutionDays);
    }
  }

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;

  return [...map.entries()].map(([flagType, e]) => {
    const conf = confidence(e.resolvedWithBaseline);
    const rate = e.resolvedWithBaseline > 0 ? Math.round((e.successes / e.resolvedWithBaseline) * 100) : null;
    const isActive = activeFlags.has(flagType);

    // Recommendation logic (deterministic)
    let recommendation: string;
    let suggestedAction: PolicyAction;

    if (conf === 'insufficient_data') {
      recommendation = 'Accumulating data. Keep current threshold and observe outcomes.';
      suggestedAction = 'monitor';
    } else if (rate !== null && rate >= 70) {
      recommendation = 'High effectiveness. Signal is well-calibrated. Retain current threshold.';
      suggestedAction = 'retain';
    } else if (rate !== null && rate >= 40) {
      recommendation = 'Mixed results. Review response playbook — threshold may be correct but execution needs refinement.';
      suggestedAction = 'review';
    } else if (rate !== null && rate < 40 && e.totalFired >= 5) {
      recommendation = 'Low effectiveness with high volume. Signal fires too often or playbook is misaligned. Consider raising threshold.';
      suggestedAction = 'relax';
    } else if (rate !== null && rate < 40) {
      recommendation = 'Low effectiveness. Revisit response playbook before adjusting threshold.';
      suggestedAction = 'review';
    } else {
      recommendation = 'No resolved cases with baseline. Cannot assess.';
      suggestedAction = 'monitor';
    }

    return {
      flagType,
      label: FLAG_LABELS[flagType] ?? flagType,
      totalFired: e.totalFired,
      resolvedWithBaseline: e.resolvedWithBaseline,
      successRate: rate,
      avgResolutionDays: avg(e.resolutionDays),
      currentlyActive: isActive,
      confidence: conf,
      recommendation,
      suggestedAction,
    };
  }).sort((a, b) => b.totalFired - a.totalFired);
}

// ---------------------------------------------------------------------------
// Build decision effectiveness ranking
// ---------------------------------------------------------------------------

function buildDecisionRanking(byDecision: OutcomeSummary['byDecision']): DecisionEffectiveness[] {
  // Rank: resolved-with-baseline first, then success rate, then total volume
  const sorted = [...byDecision].sort((a, b) => {
    if (a.resolvedWithBaseline !== b.resolvedWithBaseline) return b.resolvedWithBaseline - a.resolvedWithBaseline;
    const ra = a.successRate ?? -1;
    const rb = b.successRate ?? -1;
    if (ra !== rb) return rb - ra;
    return b.totalCases - a.totalCases;
  });

  return sorted.map((row, idx) => {
    const conf = confidence(row.resolvedWithBaseline);
    let assessment: string;

    if (conf === 'insufficient_data') {
      assessment = 'Insufficient resolved cases with baselines. Accumulating data.';
    } else if (row.successRate !== null && row.successRate >= 70) {
      assessment = idx === 0 ? 'Most effective. Standardize as default for applicable signals.' : 'Strong performer. Document playbook.';
    } else if (row.successRate !== null && row.successRate >= 40) {
      assessment = 'Moderate effectiveness. Refine execution guidance.';
    } else {
      assessment = 'Low effectiveness. Playbook revision required.';
    }

    return {
      decision: row.decision,
      label: DECISION_LABELS[row.decision] ?? row.decision,
      rank: idx + 1,
      totalCases: row.totalCases,
      successRate: row.successRate,
      avgResolutionDays: row.avgResolutionDays,
      avgMarginImprovement: row.avgMarginImprovement,
      confidence: conf,
      assessment,
    };
  });
}

// ---------------------------------------------------------------------------
// Build chronic entities
// ---------------------------------------------------------------------------

function buildChronicEntities(outcomes: CaseOutcome[]): ChronicEntity[] {
  const map = new Map<string, {
    entityType: string; entityId: string; entityName: string;
    cases: CaseOutcome[];
  }>();

  for (const o of outcomes) {
    const key = `${o.entityType}:${o.entityId}`;
    if (!map.has(key)) map.set(key, { entityType: o.entityType, entityId: o.entityId, entityName: o.entityName, cases: [] });
    map.get(key)!.cases.push(o);
  }

  return [...map.values()]
    .filter(e => e.cases.length >= 2)
    .map(e => {
      const open     = e.cases.filter(c => c.status === 'open' || c.status === 'in_progress' || c.status === 'escalated').length;
      const resolved = e.cases.filter(c => c.status === 'resolved').length;
      const sorted   = [...e.cases].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const allUnresolved = open >= e.cases.length;
      const hasEscalated  = e.cases.some(c => c.status === 'escalated');

      const riskLevel: 'high' | 'medium' | 'low' =
        hasEscalated || allUnresolved ? 'high' :
        open > 0                      ? 'medium' : 'low';

      let recommendation: string;
      if (riskLevel === 'high') {
        recommendation = `${e.cases.length} cases — no resolution. Consider immediate restructure or escalation to board.`;
      } else if (riskLevel === 'medium') {
        recommendation = `${open} open case(s) still unresolved. Review whether prior decisions had lasting effect.`;
      } else {
        recommendation = `${resolved} case(s) resolved. Monitor to confirm no recurrence.`;
      }

      return {
        entityType: e.entityType,
        entityId: e.entityId,
        entityName: e.entityName,
        totalCases: e.cases.length,
        openCases: open,
        resolvedCases: resolved,
        lastCaseDate: sorted[0].createdAt,
        riskLevel,
        recommendation,
      };
    })
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.riskLevel] - order[b.riskLevel] || b.totalCases - a.totalCases;
    });
}

// ---------------------------------------------------------------------------
// Build policy recommendations
// ---------------------------------------------------------------------------

function buildPolicyRecommendations(
  outcomes: CaseOutcome[],
  signalCal: SignalCalibration[],
  decisionRank: DecisionEffectiveness[],
  chronicEntities: ChronicEntity[],
  frictionFeedback: FrictionFeedback,
  maturity: DataMaturity,
): PolicyRecommendation[] {
  const recs: PolicyRecommendation[] = [];
  let idSeq = 1;
  const id = (prefix: string) => `REC-${prefix}-${String(idSeq++).padStart(3, '0')}`;

  // R1: Data quality — no baselines
  if (maturity.casesWithBaseline === 0 && maturity.totalCases > 0) {
    recs.push({
      id: id('DQ'),
      area: 'data_quality',
      priority: 'high',
      finding: `${maturity.totalCases} case(s) have no economic baseline — outcome measurement is not possible for these cases.`,
      recommendation: 'Create new intervention cases via the auto-generate function to capture economic snapshots going forward. Do not backfill old cases.',
      rationale: 'Baselines are only captured at case creation. Retrospective invention is prohibited.',
      confidence: 'confident',
      evidenceCount: maturity.totalCases,
    });
  }

  // R2: Chronic entities
  const highRiskChronic = chronicEntities.filter(e => e.riskLevel === 'high');
  if (highRiskChronic.length > 0) {
    recs.push({
      id: id('ESC'),
      area: 'entity_escalation',
      priority: 'critical',
      finding: `${highRiskChronic.length} entity(ies) have 2+ intervention cases with no resolution: ${highRiskChronic.map(e => e.entityName).join(', ')}.`,
      recommendation: 'Move from monitor to restructure decision. Repeated unresolved cases indicate a systemic issue that individual interventions cannot fix.',
      rationale: 'Single-case interventions are not sufficient when the same entity recurs. Structural action is needed.',
      confidence: 'directional',
      evidenceCount: highRiskChronic.reduce((s, e) => s + e.totalCases, 0),
    });
  }

  // R3: Signals still active with open cases
  const activeWithOpen = signalCal.filter(s => s.currentlyActive && s.totalFired > 0);
  if (activeWithOpen.length > 0) {
    const openOnActive = outcomes.filter(o => o.triggerFlag && activeWithOpen.some(s => s.flagType === o.triggerFlag) && o.status !== 'resolved').length;
    if (openOnActive > 0) {
      recs.push({
        id: id('SIG'),
        area: 'signal_threshold',
        priority: 'high',
        finding: `${activeWithOpen.length} signal type(s) currently active in the board pack with ${openOnActive} unresolved case(s): ${activeWithOpen.map(s => s.label).join(', ')}.`,
        recommendation: 'Prioritize resolution of open cases linked to currently firing signals. Active signal + open case = unaddressed operational risk.',
        rationale: 'A signal that fires continuously means the root condition has not been corrected by the intervention.',
        confidence: 'directional',
        evidenceCount: openOnActive,
      });
    }
  }

  // R4: Decision playbook — low effectiveness where measurable
  const weakDecisions = decisionRank.filter(d => d.successRate !== null && d.successRate < 40 && d.confidence !== 'insufficient_data');
  if (weakDecisions.length > 0) {
    recs.push({
      id: id('DEC'),
      area: 'decision_playbook',
      priority: 'medium',
      finding: `${weakDecisions.length} decision type(s) with success rate below 40%: ${weakDecisions.map(d => d.label).join(', ')}.`,
      recommendation: 'Revise the response playbook for these decision types. The decision may be correct in timing but wrong in execution guidance.',
      rationale: 'Low success rate with adequate sample = the response after the decision is not producing improvement.',
      confidence: weakDecisions[0].confidence,
      evidenceCount: weakDecisions.reduce((s, d) => s + d.resolvedWithBaseline, 0),
    });
  }

  // R5: Approval friction with open cases
  if (frictionFeedback.approvalDelayIls > 0 && frictionFeedback.openCasesLinkedToFriction > 0) {
    recs.push({
      id: id('FRI'),
      area: 'approval_friction',
      priority: frictionFeedback.approvalDelayIls > 10000 ? 'high' : 'medium',
      finding: `₪${Math.round(frictionFeedback.approvalDelayIls).toLocaleString()} in approval delay friction with ${frictionFeedback.openCasesLinkedToFriction} unresolved friction-linked case(s).`,
      recommendation: 'Review approval thresholds for the flagged settlement amounts. High delay friction with unresolved cases suggests the threshold is creating drag without commensurate protection.',
      rationale: 'Approval delay cost that co-exists with open cases means the process is creating friction without resolving the underlying signal.',
      confidence: 'directional',
      evidenceCount: frictionFeedback.openCasesLinkedToFriction,
    });
  }

  // R6: No resolved+baseline cases — all measurement is blocked
  if (maturity.resolvedWithBaseline === 0 && maturity.totalCases >= 3) {
    recs.push({
      id: id('DQ'),
      area: 'data_quality',
      priority: 'medium',
      finding: 'No resolved cases with economic baselines exist. Success rates and effectiveness rankings cannot be computed.',
      recommendation: 'Resolve at least one intervention case that was created with an economic snapshot to activate outcome measurement.',
      rationale: 'The measurement system is built and waiting. It needs one complete cycle (create with snapshot → resolve) to produce meaningful rates.',
      confidence: 'confident',
      evidenceCount: maturity.totalCases,
    });
  }

  // R7: Capital rules — if network grade is D or E with no expansion decision
  const networkCases = outcomes.filter(o => o.entityType === 'network');
  const noExpansionDecision = networkCases.filter(o => !o.decision || o.decision === 'no_decision');
  if (networkCases.length > 0 && noExpansionDecision.length === networkCases.length) {
    recs.push({
      id: id('CAP'),
      area: 'capital_rules',
      priority: 'medium',
      finding: `${networkCases.length} network-level case(s) have no capital decision recorded.`,
      recommendation: 'Set an explicit capital policy for network-grade cases (approve_expansion, freeze_capex, or restructure). Leaving capital decisions implicit blocks the measurement chain.',
      rationale: 'Network cases without capital decisions cannot be measured for effectiveness since the decision field is the core classification variable.',
      confidence: 'confident',
      evidenceCount: noExpansionDecision.length,
    });
  }

  // Sort: critical → high → medium → low
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// ---------------------------------------------------------------------------
// Build friction feedback
// ---------------------------------------------------------------------------

async function buildFrictionFeedback(outcomes: CaseOutcome[]): Promise<FrictionFeedback> {
  const stationEconomics = await computeStationEconomics();
  const network = aggregateNetworkEconomics(stationEconomics);

  const safeIls = (v: unknown) => (Number.isFinite(v as number) ? (v as number) : 0) / 100;
  const totalFrictionIls   = safeIls(network.frictionCostCents);
  const approvalDelayIls   = safeIls(network.approvalDelayedCents);
  const reserveAgedIls     = safeIls(network.reserveAgedCents);
  const failedPayoutIls    = safeIls(network.failedPayoutCents);

  // Cases linked to friction flags
  const frictionCases = outcomes.filter(o => o.triggerFlag && FRICTION_FLAG_TYPES.has(o.triggerFlag));
  const openFriction  = frictionCases.filter(o => o.status !== 'resolved').length;
  const resolvFriction = frictionCases.filter(o => o.status === 'resolved').length;
  const frictionResolutionRate = frictionCases.length > 0
    ? Math.round((resolvFriction / frictionCases.length) * 100)
    : null;

  // Threshold assessment
  let thresholdAssessment: string;
  if (approvalDelayIls === 0) {
    thresholdAssessment = 'No approval delay friction detected. Thresholds appear well-calibrated.';
  } else if (openFriction > 0 && approvalDelayIls > 5000) {
    thresholdAssessment = `₪${Math.round(approvalDelayIls).toLocaleString()} in approval delay with ${openFriction} unresolved friction case(s). ` +
      'Threshold may be triggering unnecessary holds. Review minimum amount thresholds for hold decisions.';
  } else if (openFriction === 0 && approvalDelayIls > 0) {
    thresholdAssessment = 'Approval delay friction present but all friction cases are resolved. Threshold is functional — continue monitoring cost trend.';
  } else {
    thresholdAssessment = 'Monitor approval delay cost. No structural intervention needed at current levels.';
  }

  return {
    totalFrictionIls,
    approvalDelayIls,
    reserveAgedIls,
    failedPayoutIls,
    openCasesLinkedToFriction: openFriction,
    resolvedCasesLinkedToFriction: resolvFriction,
    frictionResolutionRate,
    thresholdAssessment,
  };
}

// ---------------------------------------------------------------------------
// Build data maturity
// ---------------------------------------------------------------------------

function buildDataMaturity(summary: OutcomeSummary): DataMaturity {
  const rate = summary.totalCases > 0
    ? Math.round((summary.casesWithBaseline / summary.totalCases) * 100)
    : 0;

  const readiness: DataMaturity['measurementReadiness'] =
    summary.resolvedWithBaseline >= CONFIDENT_THRESHOLD   ? 'sufficient' :
    summary.resolvedWithBaseline >= DIRECTIONAL_THRESHOLD ? 'directional' : 'accumulating';

  const until = readiness === 'sufficient' ? null : CONFIDENT_THRESHOLD - summary.resolvedWithBaseline;

  const maturityNote = readiness === 'sufficient'
    ? 'Sufficient data for confident policy recommendations. Analysis is statistically meaningful.'
    : readiness === 'directional'
    ? 'Directional analysis available. Policy recommendations are indicative but not yet conclusive. Continue accumulating resolved cases with baselines.'
    : 'System is accumulating data. Policy recommendations are structural/logical only — not yet outcome-driven. ' +
      `Need ${until} more resolved case(s) with economic baseline for directional analysis.`;

  return {
    totalCases: summary.totalCases,
    casesWithBaseline: summary.casesWithBaseline,
    resolvedCases: summary.resolvedCases,
    resolvedWithBaseline: summary.resolvedWithBaseline,
    baselineCoverageRate: rate,
    measurementReadiness: readiness,
    estimatedCasesUntilConfident: until,
    maturityNote,
  };
}

// ---------------------------------------------------------------------------
// Main: compute full policy feedback report
// ---------------------------------------------------------------------------

export async function computePolicyFeedback(): Promise<PolicyFeedbackReport> {
  // Pull the three source systems in parallel
  const [summary, stationEconomics] = await Promise.all([
    computeOutcomeSummary(),
    computeStationEconomics(),
  ]);

  // Build board pack to identify currently active flags
  const networkEconomics = aggregateNetworkEconomics(stationEconomics);
  const ownershipBlocks  = ownershipComparison(stationEconomics);
  const stationRows  = stationEconomics.map(toStationRow);
  const networkRows  = networkEconomics.map(toNetworkRow);
  const ownershipRows = [ownershipBlocks.company_owned, ownershipBlocks.franchise_owned].map(toOwnershipRow);
  const pack = buildExpansionDecisionPack({ stationRows, networkRows, ownershipRows });

  const activeFlags = new Set(pack.boardFlags.map(f => f.flagType));

  // Build all layers
  const maturity         = buildDataMaturity(summary);
  const signalCal        = buildSignalCalibration(summary.caseOutcomes, activeFlags);
  const decisionRank     = buildDecisionRanking(summary.byDecision);
  const chronicEntities  = buildChronicEntities(summary.caseOutcomes);
  const frictionFeedback = await buildFrictionFeedback(summary.caseOutcomes);
  const policyRecs       = buildPolicyRecommendations(
    summary.caseOutcomes, signalCal, decisionRank, chronicEntities, frictionFeedback, maturity,
  );

  return {
    generatedAt: new Date().toISOString(),
    dataMaturity: maturity,
    signalCalibration: signalCal,
    decisionEffectiveness: decisionRank,
    chronicEntities,
    policyRecommendations: policyRecs,
    frictionFeedback,
  };
}
