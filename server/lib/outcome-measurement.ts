/**
 * Phase 12.22 — Outcome Measurement & Intervention Effectiveness
 *
 * Measures whether interventions actually improved the business.
 * "Before" = economic snapshot stored at case creation time (may be null for legacy cases).
 * "After"  = current economics from Phase 12.19 engine.
 *
 * Rules:
 * - Cases without snapshots are counted but not measured (shown as "no baseline")
 * - Cases not yet resolved are shown as "pending" with live current vs snapshot delta
 * - Only resolved cases with snapshots contribute to effectiveness rates
 * - No invented numbers. No fake averages.
 */

import { db } from '../db';
import { interventionCases } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { computeStationEconomics } from './unit-economics';
import type { StationEconomics } from './unit-economics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OutcomeVerdict = 'improved' | 'no_change' | 'deteriorated' | 'pending' | 'no_baseline';

export interface MetricDelta {
  before: number | null;
  after: number | null;
  delta: number | null;        // after - before (positive = improvement for margin; negative = improvement for friction)
  improved: boolean | null;    // null if no baseline
}

export interface CaseOutcome {
  caseId: number;
  entityType: string;
  entityId: string;
  entityName: string;
  triggerFlag: string | null;
  triggerSignal: string | null;
  decision: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionDays: number | null;

  // Before snapshot (null = no baseline captured)
  hasBaseline: boolean;

  // Per-metric deltas
  marginDelta: MetricDelta;
  frictionDelta: MetricDelta;
  reserveRiskDelta: { before: string | null; after: string | null; improved: boolean | null };
  failureRateDelta: MetricDelta;

  // Summary
  verdict: OutcomeVerdict;
  improvedMetrics: number;   // out of 4
  totalMetrics: number;      // 4 (or 0 if no baseline)
}

export interface EffectivenessByDecision {
  decision: string;
  totalCases: number;
  resolvedWithBaseline: number;
  successRate: number | null;       // null if no resolved cases with baseline
  avgResolutionDays: number | null;
  avgMarginImprovement: number | null;
  avgFrictionReduction: number | null;
}

export interface OutcomeSummary {
  totalCases: number;
  openCases: number;
  inProgressCases: number;
  escalatedCases: number;
  resolvedCases: number;
  casesWithBaseline: number;
  resolvedWithBaseline: number;
  overallSuccessRate: number | null;   // % resolved cases that improved
  avgResolutionDays: number | null;
  byDecision: EffectivenessByDecision[];
  caseOutcomes: CaseOutcome[];
}

// ---------------------------------------------------------------------------
// Reserve risk → numeric for comparison (same as expansion-decision.ts)
// ---------------------------------------------------------------------------

const RESERVE_RISK_ORDER: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 };

function reserveImproved(before: string | null, after: string | null): boolean | null {
  if (!before || !after) return null;
  const b = RESERVE_RISK_ORDER[before] ?? 0;
  const a = RESERVE_RISK_ORDER[after] ?? 0;
  return a < b;   // lower risk = better
}

// ---------------------------------------------------------------------------
// Build current economics lookup by station_id
// ---------------------------------------------------------------------------

async function buildCurrentEconomicsMap(): Promise<Map<string, StationEconomics>> {
  const stations = await computeStationEconomics();
  const map = new Map<string, StationEconomics>();
  for (const s of stations) {
    map.set(String(s.stationId), s);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Compute resolution days
// ---------------------------------------------------------------------------

function resolutionDays(createdAt: Date | string, resolvedAt: Date | string | null): number | null {
  if (!resolvedAt) return null;
  const created = new Date(createdAt).getTime();
  const resolved = new Date(resolvedAt).getTime();
  return Math.max(0, Math.round((resolved - created) / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Compute outcome for a single case
// ---------------------------------------------------------------------------

function computeCaseOutcome(
  c: typeof interventionCases.$inferSelect,
  currentMap: Map<string, StationEconomics>
): CaseOutcome {
  const hasBaseline =
    c.snapshotMarginPct !== null &&
    c.snapshotFrictionPct !== null;

  const snapshotMargin  = c.snapshotMarginPct  !== null ? parseFloat(String(c.snapshotMarginPct))  : null;
  const snapshotFriction = c.snapshotFrictionPct !== null ? parseFloat(String(c.snapshotFrictionPct)) : null;
  const snapshotFailure = c.snapshotFailureRate !== null ? parseFloat(String(c.snapshotFailureRate)) : null;
  const snapshotGross   = c.snapshotGrossIls   !== null ? parseFloat(String(c.snapshotGrossIls))   : null;

  // Current state — only available for station entities with matching id
  const current = c.entityType === 'station' ? currentMap.get(c.entityId) : null;
  const currentMargin   = current ? current.contributionMarginPct : null;
  const currentFriction = current
    ? (current.grossRevenueCents > 0 ? (current.frictionCostCents / current.grossRevenueCents) * 100 : 0)
    : null;
  const currentFailure  = current ? current.payoutFailureRate : null;
  const currentReserve  = current ? current.reserveAgeRisk : null;

  // Build deltas
  const marginDelta: MetricDelta = {
    before: snapshotMargin,
    after: currentMargin,
    delta: currentMargin !== null && snapshotMargin !== null ? currentMargin - snapshotMargin : null,
    improved: currentMargin !== null && snapshotMargin !== null ? currentMargin > snapshotMargin : null,
  };

  const frictionDelta: MetricDelta = {
    before: snapshotFriction,
    after: currentFriction,
    delta: currentFriction !== null && snapshotFriction !== null ? currentFriction - snapshotFriction : null,
    improved: currentFriction !== null && snapshotFriction !== null ? currentFriction < snapshotFriction : null, // lower = better
  };

  const failureRateDelta: MetricDelta = {
    before: snapshotFailure,
    after: currentFailure,
    delta: currentFailure !== null && snapshotFailure !== null ? currentFailure - snapshotFailure : null,
    improved: currentFailure !== null && snapshotFailure !== null ? currentFailure < snapshotFailure : null,
  };

  const reserveRiskDelta = {
    before: c.snapshotReserveRisk ?? null,
    after: currentReserve ?? null,
    improved: reserveImproved(c.snapshotReserveRisk ?? null, currentReserve ?? null),
  };

  // Count improved metrics
  const improvableMetrics = [marginDelta.improved, frictionDelta.improved, failureRateDelta.improved, reserveRiskDelta.improved];
  const improvedMetrics = improvableMetrics.filter(v => v === true).length;
  const measuredMetrics = improvableMetrics.filter(v => v !== null).length;

  // Verdict
  let verdict: OutcomeVerdict;
  if (!hasBaseline) {
    verdict = 'no_baseline';
  } else if (c.status !== 'resolved' && c.status !== 'escalated') {
    verdict = 'pending';
  } else if (measuredMetrics === 0) {
    verdict = 'no_baseline';
  } else if (improvedMetrics >= 2) {
    verdict = 'improved';
  } else if (improvedMetrics === 0) {
    verdict = 'deteriorated';
  } else {
    verdict = 'no_change';
  }

  const days = resolutionDays(c.createdAt, c.resolvedAt);

  return {
    caseId: c.id,
    entityType: c.entityType,
    entityId: c.entityId,
    entityName: c.entityName,
    triggerFlag: c.triggerFlag ?? null,
    triggerSignal: c.triggerSignal ?? null,
    decision: c.decision ?? null,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
    resolutionDays: days,
    hasBaseline,
    marginDelta,
    frictionDelta,
    reserveRiskDelta,
    failureRateDelta,
    verdict,
    improvedMetrics,
    totalMetrics: measuredMetrics,
  };
}

// ---------------------------------------------------------------------------
// Aggregate effectiveness by decision type
// ---------------------------------------------------------------------------

function aggregateByDecision(outcomes: CaseOutcome[]): EffectivenessByDecision[] {
  const map = new Map<string, {
    total: number; resolvedWithBaseline: number; successes: number;
    resolutionDays: number[]; marginDeltas: number[]; frictionDeltas: number[];
  }>();

  for (const o of outcomes) {
    const key = o.decision ?? 'no_decision';
    if (!map.has(key)) map.set(key, { total: 0, resolvedWithBaseline: 0, successes: 0, resolutionDays: [], marginDeltas: [], frictionDeltas: [] });
    const entry = map.get(key)!;
    entry.total++;

    if (o.hasBaseline && o.status === 'resolved') {
      entry.resolvedWithBaseline++;
      if (o.verdict === 'improved') entry.successes++;
      if (o.resolutionDays !== null) entry.resolutionDays.push(o.resolutionDays);
      if (o.marginDelta.delta !== null) entry.marginDeltas.push(o.marginDelta.delta);
      if (o.frictionDelta.delta !== null) entry.frictionDeltas.push(o.frictionDelta.delta);
    }
  }

  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 100) / 100 : null;

  return [...map.entries()].map(([decision, e]) => ({
    decision,
    totalCases: e.total,
    resolvedWithBaseline: e.resolvedWithBaseline,
    successRate: e.resolvedWithBaseline > 0 ? Math.round((e.successes / e.resolvedWithBaseline) * 100) : null,
    avgResolutionDays: avg(e.resolutionDays),
    avgMarginImprovement: avg(e.marginDeltas),
    avgFrictionReduction: avg(e.frictionDeltas.map(d => -d)), // negate: lower friction = positive improvement
  })).sort((a, b) => b.totalCases - a.totalCases);
}

// ---------------------------------------------------------------------------
// Main: compute outcome summary
// ---------------------------------------------------------------------------

export async function computeOutcomeSummary(): Promise<OutcomeSummary> {
  const [cases, currentMap] = await Promise.all([
    db.select().from(interventionCases),
    buildCurrentEconomicsMap(),
  ]);

  const outcomes = cases.map(c => computeCaseOutcome(c, currentMap));

  const open       = outcomes.filter(o => o.status === 'open').length;
  const inProgress = outcomes.filter(o => o.status === 'in_progress').length;
  const escalated  = outcomes.filter(o => o.status === 'escalated').length;
  const resolved   = outcomes.filter(o => o.status === 'resolved').length;

  const withBaseline = outcomes.filter(o => o.hasBaseline).length;
  const resolvedWithBaseline = outcomes.filter(o => o.hasBaseline && o.status === 'resolved').length;

  const improvedResolved = outcomes.filter(o => o.hasBaseline && o.status === 'resolved' && o.verdict === 'improved').length;
  const successRate = resolvedWithBaseline > 0
    ? Math.round((improvedResolved / resolvedWithBaseline) * 100)
    : null;

  const resolvedDays = outcomes
    .filter(o => o.resolutionDays !== null)
    .map(o => o.resolutionDays as number);
  const avgResolutionDays = resolvedDays.length > 0
    ? Math.round(resolvedDays.reduce((s, v) => s + v, 0) / resolvedDays.length)
    : null;

  return {
    totalCases: cases.length,
    openCases: open,
    inProgressCases: inProgress,
    escalatedCases: escalated,
    resolvedCases: resolved,
    casesWithBaseline: withBaseline,
    resolvedWithBaseline,
    overallSuccessRate: successRate,
    avgResolutionDays,
    byDecision: aggregateByDecision(outcomes),
    caseOutcomes: outcomes,
  };
}

// ---------------------------------------------------------------------------
// Helper used by the auto-generate route: build snapshot from current economics
// ---------------------------------------------------------------------------

export function buildEconomicSnapshot(stationId: string, currentMap: Map<string, StationEconomics>): {
  snapshotMarginPct: string | null;
  snapshotFrictionPct: string | null;
  snapshotReserveRisk: string | null;
  snapshotFailureRate: string | null;
  snapshotGrossIls: string | null;
} {
  const s = currentMap.get(stationId);
  if (!s) return { snapshotMarginPct: null, snapshotFrictionPct: null, snapshotReserveRisk: null, snapshotFailureRate: null, snapshotGrossIls: null };

  const frictionPct = s.grossRevenueCents > 0
    ? ((s.frictionCostCents / s.grossRevenueCents) * 100).toFixed(2)
    : '0.00';

  return {
    snapshotMarginPct:   s.contributionMarginPct.toFixed(2),
    snapshotFrictionPct: frictionPct,
    snapshotReserveRisk: s.reserveAgeRisk,
    snapshotFailureRate: s.payoutFailureRate.toFixed(2),
    snapshotGrossIls:    (s.grossRevenueCents / 100).toFixed(2),
  };
}

export { buildCurrentEconomicsMap };
