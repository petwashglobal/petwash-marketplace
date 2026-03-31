/**
 * Phase 12.20 — Expansion Decision & Board Pack Layer
 *
 * All inputs come ONLY from the Phase 12.19 unit-economics engine.
 * No new financial formulas. No duplicated calculations.
 * Backend computes. UI renders.
 * Every score and recommendation is deterministic and explainable.
 */

import type { StationEconomics, NetworkEconomics, OwnershipBlock } from './unit-economics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Map string reserve age risk to a numeric penalty value (0–100) */
const RESERVE_RISK_NUM: Record<string, number> = {
  none: 0,
  low: 20,
  medium: 50,
  high: 100,
};

// ---------------------------------------------------------------------------
// Normalised input rows (cents → ILS, string → number where needed)
// These are adapters — they do NOT recompute economics, only reformat them.
// ---------------------------------------------------------------------------

export interface StationEconomicsRow {
  stationId: number;
  stationName: string;
  ownershipType: string;
  franchiseOwnerId: number | null;

  grossRevenueILS: number;
  platformFeeILS: number;
  netReleasableContributionILS: number;
  frictionCostILS: number;
  heldAmountILS: number;
  blockedAmountILS: number;
  failedPayoutILS: number;
  delayedApprovalILS: number;

  contributionMarginPct: number;
  disputeRate: number;
  payoutFailureRate: number;
  reserveAgeRisk: number;     // normalised numeric (RESERVE_RISK_NUM)
  capitalPriority: string;    // 'invest' | 'maintain' | 'watch' | 'restrict'
}

export interface NetworkEconomicsRow {
  ownerKey: string;
  ownerName: string;
  ownershipType: string;
  riskAdjustedScore: number;
  grossRevenueILS: number;
  netReleasableContributionILS: number;
  contributionMarginPct: number;
}

export interface OwnershipComparisonRow {
  ownershipType: 'company' | 'franchise';
  marginPct: number;
  heldAmountILS: number;
  blockedAmountILS: number;
  grossRevenueILS: number;
  netContributionILS: number;
  payoutFailureRate: number;
  stationCount: number;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type ExpansionSignal =
  | 'expand_now'
  | 'expand_carefully'
  | 'fix_operations_first'
  | 'freeze_capex'
  | 'review_franchise'
  | 'restructure'
  | 'maintain';

export interface StationScores {
  profitabilityScore: number;
  frictionScore: number;
  liquidityCleanlinessScore: number;
  expansionReadinessScore: number;
}

export interface StationEconomicsSnapshot {
  grossRevenueILS: number;
  netReleasableContributionILS: number;
  contributionMarginPct: number;
  frictionCostILS: number;
  heldAmountILS: number;
  blockedAmountILS: number;
  failedPayoutILS: number;
  delayedApprovalILS: number;
}

export interface ExpansionStationScore {
  stationId: number;
  stationName: string;
  ownershipType: string;
  franchiseOwnerId: number | null;
  economics: StationEconomicsSnapshot;
  scores: StationScores;
  recommendation: ExpansionSignal;
  confidence: number;
  reasons: string[];
}

export type NetworkGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface NetworkHealthGrade {
  ownerKey: string;
  ownerName: string;
  ownershipType: string;
  grade: NetworkGrade;
  score: number;
  reasons: string[];
}

export type OwnershipWinner = 'company' | 'franchise' | 'tie';

export interface OwnershipComparisonDecision {
  winner: OwnershipWinner;
  deltaMarginPct: number;
  deltaHeldILS: number;
  deltaBlockedILS: number;
  explanation: string[];
}

export type BoardFlagSeverity = 'critical' | 'warning' | 'info';

export interface BoardFlag {
  entityType: 'station' | 'network' | 'system';
  entityId: number | string;
  entityName: string;
  flagType: string;
  severity: BoardFlagSeverity;
  explanation: string;
}

export interface BoardPackSummary {
  executiveKpis: {
    networkGrossRevenueILS: number;
    networkNetContributionILS: number;
    networkMarginPct: number;
    heldCapitalILS: number;
    blockedCapitalILS: number;
    totalFrictionILS: number;
  };
  stations: ExpansionStationScore[];
  networks: NetworkHealthGrade[];
  ownershipDecision: OwnershipComparisonDecision;
  boardFlags: BoardFlag[];
}

// ---------------------------------------------------------------------------
// Adapters: Phase 12.19 engine output → normalised input rows
// ---------------------------------------------------------------------------

export function toStationRow(s: StationEconomics): StationEconomicsRow {
  const c2i = (cents: number) => Math.round(cents) / 100;
  return {
    stationId: s.stationId,
    stationName: s.stationName,
    ownershipType: s.ownershipType,
    franchiseOwnerId: s.franchiseOwnerId,
    grossRevenueILS: c2i(s.grossRevenueCents),
    platformFeeILS: c2i(s.platformFeeCents),
    netReleasableContributionILS: c2i(s.netReleasableContributionCents),
    frictionCostILS: c2i(s.frictionCostCents),
    heldAmountILS: c2i(s.heldAmountCents),
    blockedAmountILS: c2i(s.blockedAmountCents),
    failedPayoutILS: c2i(s.failedPayoutCents),
    delayedApprovalILS: c2i(s.delayedApprovalCents),
    contributionMarginPct: s.contributionMarginPct,
    disputeRate: s.disputeRate,
    payoutFailureRate: s.payoutFailureRate,
    reserveAgeRisk: RESERVE_RISK_NUM[s.reserveAgeRisk] ?? 0,
    capitalPriority: s.capitalPriority,
  };
}

export function toNetworkRow(n: NetworkEconomics): NetworkEconomicsRow {
  const c2i = (cents: number) => Math.round(cents) / 100;
  return {
    ownerKey: n.ownerId,
    ownerName: n.ownerName,
    ownershipType: n.ownershipType,
    riskAdjustedScore: n.riskAdjustedScore,
    grossRevenueILS: c2i(n.grossRevenueCents),
    netReleasableContributionILS: c2i(n.netReleasableContributionCents),
    contributionMarginPct: n.contributionMarginPct,
  };
}

export function toOwnershipRow(b: OwnershipBlock): OwnershipComparisonRow {
  const c2i = (cents: number) => Math.round(cents) / 100;
  return {
    ownershipType: b.ownershipType,
    marginPct: b.marginPct,
    heldAmountILS: c2i(b.heldAmountCents),
    blockedAmountILS: c2i(b.blockedAmountCents),
    grossRevenueILS: c2i(b.grossRevenueCents),
    netContributionILS: c2i(b.netContributionCents),
    payoutFailureRate: b.payoutFailureRate,
    stationCount: b.stationCount,
  };
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function safePct(num: number, den: number): number {
  if (!den || den <= 0) return 0;
  return (num / den) * 100;
}

function r(n: number) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Score engines (deterministic, explainable)
// ---------------------------------------------------------------------------

function computeProfitabilityScore(row: StationEconomicsRow): number {
  let score = 0;

  if (row.contributionMarginPct >= 30) score += 50;
  else if (row.contributionMarginPct >= 20) score += 40;
  else if (row.contributionMarginPct >= 10) score += 25;
  else score += 10;

  if (row.netReleasableContributionILS >= 5000) score += 25;
  else if (row.netReleasableContributionILS >= 2000) score += 18;
  else score += 8;

  if (row.grossRevenueILS >= 20000) score += 25;
  else if (row.grossRevenueILS >= 10000) score += 18;
  else score += 10;

  return clamp(score);
}

function computeFrictionScore(row: StationEconomicsRow): number {
  const gross = Math.max(row.grossRevenueILS, 1);

  const frictionPct = safePct(row.frictionCostILS, gross);
  const heldPct = safePct(row.heldAmountILS + row.blockedAmountILS, gross);

  let score = 100;
  score -= frictionPct * 1.2;
  score -= heldPct * 0.8;
  score -= row.reserveAgeRisk * 0.3;
  score -= row.disputeRate * 0.3;
  score -= row.payoutFailureRate * 0.4;

  return clamp(score);
}

function computeLiquidityScore(row: StationEconomicsRow): number {
  const gross = Math.max(row.grossRevenueILS, 1);

  const delayedPct = safePct(row.delayedApprovalILS, gross);
  const failedPct = safePct(row.failedPayoutILS, gross);

  let score = 100;
  score -= delayedPct * 1.2;
  score -= failedPct * 1.6;
  score -= row.reserveAgeRisk * 0.25;

  return clamp(score);
}

function computeReadiness(p: number, f: number, l: number): number {
  return clamp(p * 0.45 + f * 0.35 + l * 0.2);
}

// ---------------------------------------------------------------------------
// Decision engine (deterministic, fully explainable)
// ---------------------------------------------------------------------------

function decide(row: StationEconomicsRow, readiness: number): { signal: ExpansionSignal; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  const gross = Math.max(row.grossRevenueILS, 1);
  const frictionPct = safePct(row.frictionCostILS, gross);

  if (readiness >= 80 && row.contributionMarginPct >= 25 && frictionPct < 10) {
    reasons.push('clean_high_margin');
    return { signal: 'expand_now', confidence: 90, reasons };
  }

  if (readiness >= 65) {
    reasons.push('healthy_but_not_perfect');
    return { signal: 'expand_carefully', confidence: 75, reasons };
  }

  if (row.contributionMarginPct < 5) {
    reasons.push('low_margin');
    return { signal: 'fix_operations_first', confidence: 70, reasons };
  }

  if (row.reserveAgeRisk > 60 || row.failedPayoutILS > 0) {
    reasons.push('treasury_risk');
    return { signal: 'freeze_capex', confidence: 80, reasons };
  }

  if (row.capitalPriority === 'restrict') {
    reasons.push('capital_restricted');
    return {
      signal: row.ownershipType === 'franchise' ? 'review_franchise' : 'restructure',
      confidence: 90,
      reasons,
    };
  }

  return { signal: 'maintain', confidence: 60, reasons: ['stable'] };
}

// ---------------------------------------------------------------------------
// Network health grade
// ---------------------------------------------------------------------------

function networkGrade(row: NetworkEconomicsRow): NetworkHealthGrade {
  const score = row.riskAdjustedScore;
  const reasons: string[] = [];

  const grade: NetworkGrade =
    score >= 85 ? 'A' :
    score >= 70 ? 'B' :
    score >= 55 ? 'C' :
    score >= 40 ? 'D' : 'E';

  if (row.contributionMarginPct < 5) reasons.push('low_margin');
  if (row.grossRevenueILS > 0 && row.netReleasableContributionILS / row.grossRevenueILS < 0.05) reasons.push('friction_heavy');
  if (!reasons.length) reasons.push('meets_threshold');

  return { ownerKey: row.ownerKey, ownerName: row.ownerName, ownershipType: row.ownershipType, grade, score, reasons };
}

// ---------------------------------------------------------------------------
// Ownership comparison decision
// ---------------------------------------------------------------------------

function ownershipDecision(rows: OwnershipComparisonRow[]): OwnershipComparisonDecision {
  const co = rows.find(rw => rw.ownershipType === 'company');
  const fr = rows.find(rw => rw.ownershipType === 'franchise');

  if (!co || !fr || (co.stationCount === 0 && fr.stationCount === 0)) {
    return { winner: 'tie', deltaMarginPct: 0, deltaHeldILS: 0, deltaBlockedILS: 0, explanation: ['missing_data'] };
  }

  const delta = r(co.marginPct - fr.marginPct);
  const explanation: string[] = [];

  if (Math.abs(delta) <= 2) explanation.push('margins_comparable');
  else if (delta > 2) explanation.push('company_sites_outperform_margin');
  else explanation.push('franchise_sites_outperform_margin');

  if (co.payoutFailureRate > fr.payoutFailureRate) explanation.push('company_has_more_payout_failures');
  if (fr.payoutFailureRate > co.payoutFailureRate) explanation.push('franchise_has_more_payout_failures');
  if (co.heldAmountILS < fr.heldAmountILS) explanation.push('company_holds_less_capital');
  if (fr.heldAmountILS < co.heldAmountILS) explanation.push('franchise_holds_less_capital');

  return {
    winner: delta > 2 ? 'company' : delta < -2 ? 'franchise' : 'tie',
    deltaMarginPct: delta,
    deltaHeldILS: r(co.heldAmountILS - fr.heldAmountILS),
    deltaBlockedILS: r(co.blockedAmountILS - fr.blockedAmountILS),
    explanation,
  };
}

// ---------------------------------------------------------------------------
// Board flags — deterministic red-flag conditions (T199: visible, not hidden)
// ---------------------------------------------------------------------------

function computeBoardFlags(stationRows: StationEconomicsRow[], networkRows: NetworkEconomicsRow[]): BoardFlag[] {
  const flags: BoardFlag[] = [];

  for (const s of stationRows) {
    const gross = Math.max(s.grossRevenueILS, 1);

    // Critical: failed payout + high reserve age = treasury emergency
    if (s.failedPayoutILS > 0 && s.reserveAgeRisk >= 100) {
      flags.push({
        entityType: 'station', entityId: s.stationId, entityName: s.stationName,
        flagType: 'treasury_critical',
        severity: 'critical',
        explanation: `Failed payout AND 31+ day aged reserve at ${s.stationName}. Requires immediate treasury intervention.`,
      });
    }

    // Critical: margin below 5% (operational unsustainability)
    if (s.contributionMarginPct < 5 && s.grossRevenueILS > 0) {
      flags.push({
        entityType: 'station', entityId: s.stationId, entityName: s.stationName,
        flagType: 'margin_collapse',
        severity: 'critical',
        explanation: `Contribution margin is ${s.contributionMarginPct.toFixed(1)}% at ${s.stationName}. Below operational threshold of 5%.`,
      });
    }

    // Warning: blocked cash > 20% of gross
    const blockedPct = safePct(s.blockedAmountILS, gross);
    if (blockedPct > 20) {
      flags.push({
        entityType: 'station', entityId: s.stationId, entityName: s.stationName,
        flagType: 'cash_blocked',
        severity: 'warning',
        explanation: `${blockedPct.toFixed(1)}% of gross revenue is blocked by disputes at ${s.stationName}.`,
      });
    }

    // Warning: reserve aged >31 days (high risk)
    if (s.reserveAgeRisk >= 100) {
      flags.push({
        entityType: 'station', entityId: s.stationId, entityName: s.stationName,
        flagType: 'reserve_aged_31plus',
        severity: 'warning',
        explanation: `Reserve at ${s.stationName} has been held for more than 31 days without release.`,
      });
    }

    // Warning: approval backlog blocking capital
    if (s.delayedApprovalILS > 0) {
      flags.push({
        entityType: 'station', entityId: s.stationId, entityName: s.stationName,
        flagType: 'approval_backlog',
        severity: 'warning',
        explanation: `₪${s.delayedApprovalILS.toFixed(0)} is pending financial approval at ${s.stationName}.`,
      });
    }

    // Warning: repeated payout failure
    if (s.payoutFailureRate > 0 && s.failedPayoutILS > 0) {
      flags.push({
        entityType: 'station', entityId: s.stationId, entityName: s.stationName,
        flagType: 'payout_failure',
        severity: 'warning',
        explanation: `Payout failure rate is ${s.payoutFailureRate.toFixed(1)}% at ${s.stationName}. ${(s.failedPayoutILS).toFixed(0)} ILS unresolved.`,
      });
    }
  }

  // Network-level flags (grade D or E = intervention needed)
  for (const n of networkRows) {
    const grade = networkGrade(n).grade;
    if (grade === 'D' || grade === 'E') {
      flags.push({
        entityType: 'network', entityId: n.ownerKey, entityName: n.ownerName,
        flagType: 'network_health_low',
        severity: grade === 'E' ? 'critical' : 'warning',
        explanation: `${n.ownerName} scored ${n.riskAdjustedScore}/100 (Grade ${grade}). Board-level review required.`,
      });
    }
  }

  // Sort: critical first, then warning, then info
  const severityOrder: Record<BoardFlagSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return flags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ---------------------------------------------------------------------------
// Main builder — called by route handler with 12.19 output
// ---------------------------------------------------------------------------

export function buildExpansionDecisionPack(params: {
  stationRows: StationEconomicsRow[];
  networkRows: NetworkEconomicsRow[];
  ownershipRows: OwnershipComparisonRow[];
}): BoardPackSummary {

  const stations: ExpansionStationScore[] = params.stationRows.map(row => {
    const p = computeProfitabilityScore(row);
    const f = computeFrictionScore(row);
    const l = computeLiquidityScore(row);
    const readiness = computeReadiness(p, f, l);
    const decision = decide(row, readiness);

    return {
      stationId: row.stationId,
      stationName: row.stationName,
      ownershipType: row.ownershipType,
      franchiseOwnerId: row.franchiseOwnerId,
      economics: {
        grossRevenueILS: r(row.grossRevenueILS),
        netReleasableContributionILS: r(row.netReleasableContributionILS),
        contributionMarginPct: r(row.contributionMarginPct),
        frictionCostILS: r(row.frictionCostILS),
        heldAmountILS: r(row.heldAmountILS),
        blockedAmountILS: r(row.blockedAmountILS),
        failedPayoutILS: r(row.failedPayoutILS),
        delayedApprovalILS: r(row.delayedApprovalILS),
      },
      scores: {
        profitabilityScore: r(p),
        frictionScore: r(f),
        liquidityCleanlinessScore: r(l),
        expansionReadinessScore: r(readiness),
      },
      recommendation: decision.signal,
      confidence: decision.confidence,
      reasons: decision.reasons,
    };
  });

  const networks = params.networkRows.map(networkGrade);
  const ownDecision = ownershipDecision(params.ownershipRows);
  const boardFlags = computeBoardFlags(params.stationRows, params.networkRows);

  const executiveKpis = {
    networkGrossRevenueILS: r(params.stationRows.reduce((s, x) => s + x.grossRevenueILS, 0)),
    networkNetContributionILS: r(params.stationRows.reduce((s, x) => s + x.netReleasableContributionILS, 0)),
    networkMarginPct: r(safePct(
      params.stationRows.reduce((s, x) => s + x.netReleasableContributionILS, 0),
      params.stationRows.reduce((s, x) => s + x.grossRevenueILS, 0)
    )),
    heldCapitalILS: r(params.stationRows.reduce((s, x) => s + x.heldAmountILS, 0)),
    blockedCapitalILS: r(params.stationRows.reduce((s, x) => s + x.blockedAmountILS, 0)),
    totalFrictionILS: r(params.stationRows.reduce((s, x) => s + x.frictionCostILS, 0)),
  };

  return { executiveKpis, stations, networks, ownershipDecision: ownDecision, boardFlags };
}
