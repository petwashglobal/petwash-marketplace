/**
 * Phase 12.19 — Unit Economics Engine
 *
 * T199 Rules (enforced throughout):
 * 1. Never call output "net profit" — it is "net releasable contribution"
 * 2. held / blocked / failed / delayed money are NEVER mixed into net contribution
 * 3. Ownership model (company vs franchise) treated separately first, then aggregated
 * 4. All amounts trace back to station_settlements
 * 5. Signals are deterministic — no AI, no black box
 * 6. One engine computes — UI only renders
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function c(v: any): number { return parseInt(v ?? '0', 10); }
function f(v: any): number { return parseFloat(v ?? '0'); }
function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 10000) / 100; // 2 decimal places
}

// Friction threshold: reserve held >14 days is considered "aged friction"
const RESERVE_AGE_FRICTION_DAYS = 14;

// ---------------------------------------------------------------------------
// Capital priority classification (T192, deterministic)
// ---------------------------------------------------------------------------
type CapitalPriority = 'invest' | 'maintain' | 'watch' | 'restrict';

function capitalPriority(
  marginPct: number,
  frictionRatio: number,
  failedPayouts: number
): CapitalPriority {
  if (failedPayouts > 0 && frictionRatio > 0.25) return 'restrict';
  if (failedPayouts > 0 || frictionRatio > 0.20) return 'watch';
  if (marginPct >= 20 && frictionRatio < 0.05) return 'invest';
  if (marginPct >= 10 && frictionRatio < 0.15) return 'maintain';
  if (marginPct < 5 || frictionRatio > 0.15) return 'watch';
  return 'maintain';
}

// Capital signal (T194, deterministic)
type CapitalSignal = 'invest_more' | 'maintain' | 'operational_fix_first' | 'freeze_expansion' | 'review_franchise' | 'treasury_attention_required';

interface SignalResult {
  signal: CapitalSignal;
  confidence: number;
  reasonCodes: string[];
  explanation: string;
}

function capitalSignal(params: {
  marginPct: number;
  frictionRatio: number;
  failedPayouts: number;
  reserveAge31Plus: boolean;
  approvalBacklog: boolean;
  disputeRatio: number;
  ownershipType: string;
}): SignalResult {
  const reasons: string[] = [];
  let signal: CapitalSignal = 'maintain';
  let confidence = 50;

  if (params.marginPct >= 20 && params.frictionRatio < 0.05 && params.failedPayouts === 0) {
    signal = 'invest_more';
    confidence = 80 + Math.round(params.marginPct / 5);
    reasons.push('strong_margin_low_friction');
  } else if (params.failedPayouts > 1 && params.frictionRatio > 0.20) {
    signal = 'treasury_attention_required';
    confidence = 85;
    reasons.push('repeated_failed_payouts', 'blocked_cash_pressure');
  } else if (params.reserveAge31Plus) {
    signal = 'operational_fix_first';
    confidence = 75;
    reasons.push('high_reserve_age');
  } else if (params.disputeRatio > 0.15) {
    signal = 'operational_fix_first';
    confidence = 70;
    reasons.push('low_margin_high_dispute');
  } else if (params.approvalBacklog && params.frictionRatio > 0.10) {
    signal = 'freeze_expansion';
    confidence = 65;
    reasons.push('approval_backlog', 'blocked_cash_pressure');
  } else if (params.ownershipType === 'franchise' && params.marginPct < 5) {
    signal = 'review_franchise';
    confidence = 60;
    reasons.push('low_margin_high_friction');
  } else if (params.frictionRatio > 0.10) {
    signal = 'operational_fix_first';
    confidence = 60;
    reasons.push('high_reserve_age');
  } else if (params.marginPct >= 10) {
    signal = 'maintain';
    confidence = 70;
    reasons.push('strong_margin_low_friction');
  }

  if (!reasons.length) reasons.push('strong_margin_low_friction');
  confidence = Math.min(100, confidence);

  const explanations: Record<CapitalSignal, string> = {
    invest_more: 'Strong margin with low operational friction — ideal for growth capital.',
    maintain: 'Acceptable performance — sustain current level, monitor friction trend.',
    operational_fix_first: 'Operational issues (reserves, disputes, approvals) must be resolved before expansion.',
    freeze_expansion: 'Cash is blocked. Expansion would compound treasury pressure.',
    review_franchise: 'Franchise unit economics are below threshold — review contract terms.',
    treasury_attention_required: 'Repeated payout failures and high friction require immediate treasury review.',
  };

  return { signal, confidence, reasonCodes: reasons, explanation: explanations[signal] };
}

// ---------------------------------------------------------------------------
// Risk-adjusted score (T193, weighted, deterministic)
// ---------------------------------------------------------------------------
function riskAdjustedScore(params: {
  marginPct: number;
  frictionRatio: number;
  failedPayouts: number;
  reserveAge31PlusRatio: number;
  disputeRatio: number;
  approvalBacklogRatio: number;
}): number {
  // Higher score = better
  const marginScore = Math.min(params.marginPct / 40, 1) * 35;        // up to 35 pts
  const frictionScore = Math.max(0, 1 - params.frictionRatio * 4) * 25; // up to 25 pts
  const failurePenalty = Math.min(params.failedPayouts * 5, 20);        // up to 20 pts penalty
  const reservePenalty = params.reserveAge31PlusRatio * 10;              // up to 10 pts penalty
  const disputePenalty = params.disputeRatio * 10;                       // up to 10 pts penalty

  const raw = marginScore + frictionScore - failurePenalty - reservePenalty - disputePenalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ---------------------------------------------------------------------------
// T191 — Full per-station economics computation
// ---------------------------------------------------------------------------

export interface StationEconomics {
  stationId: number;
  stationName: string;
  ownershipType: string;
  franchiseOwnerId: number | null;
  franchiseOwnerName: string | null;
  grossRevenueCents: number;
  platformFeeCents: number;
  stationPayoutCents: number;
  franchiseShareCents: number;
  heldAmountCents: number;
  blockedAmountCents: number;
  failedPayoutCents: number;
  delayedApprovalCents: number;
  frictionCostCents: number;
  netReleasableContributionCents: number;
  contributionMarginPct: number;
  disputeRate: number;
  payoutFailureRate: number;
  reserveAgeRisk: 'none' | 'low' | 'medium' | 'high';
  capitalPriority: CapitalPriority;
  capitalSignal: SignalResult;
  settlementCount: number;
}

export async function computeStationEconomics(): Promise<StationEconomics[]> {
  // Base economics from settlements — one row per station
  const baseRaw = await db.execute(sql`
    SELECT
      ss.station_id,
      s.name                                                            AS station_name,
      COALESCE(s.ownership_type, 'company')                             AS ownership_type,
      ss.franchise_owner_id,
      fo.business_name                                                  AS franchise_owner_name,
      COUNT(ss.id)::int                                                 AS settlement_count,

      -- Gross revenue
      COALESCE(SUM(ss.total_amount_cents), 0)                          AS gross_revenue,

      -- Platform contribution (PetWash's economic take)
      COALESCE(SUM(ss.platform_amount_cents), 0)                       AS platform_fee,

      -- Station payout
      COALESCE(SUM(ss.station_amount_cents), 0)                        AS station_payout,

      -- Franchise share
      COALESCE(SUM(ss.franchise_amount_cents), 0)                      AS franchise_share,

      -- Held capital (in reserve or payout hold)
      COALESCE(SUM(CASE WHEN ss.held_in_reserve OR ss.payout_hold_reason IS NOT NULL
        THEN ss.station_amount_cents END), 0)                          AS held_amount,

      -- Blocked by open disputes (linked via booking_id)
      COALESCE(SUM(CASE WHEN EXISTS(
        SELECT 1 FROM booking_disputes bd
        WHERE bd.booking_id = ss.booking_id AND bd.status NOT IN ('resolved','closed')
      ) THEN ss.station_amount_cents END), 0)                          AS blocked_amount,

      -- Failed payout (settlement is in a failed batch)
      COALESCE(SUM(CASE WHEN EXISTS(
        SELECT 1 FROM payout_batch_items pbi
        JOIN payout_batches pb ON pb.id = pbi.batch_id
        JOIN payout_failures pf ON pf.batch_id = pb.id
        WHERE pbi.settlement_id = ss.id AND pf.resolved = false
      ) THEN ss.station_amount_cents END), 0)                          AS failed_payout_amount,

      -- Approval-delayed (pending approval in financial_approval_log)
      COALESCE(SUM(CASE WHEN EXISTS(
        SELECT 1 FROM financial_approval_log fal
        WHERE fal.case_ref_id = ss.id::text AND fal.status IN ('pending','pending_second')
      ) THEN ss.station_amount_cents END), 0)                          AS approval_delayed_amount,

      -- Reserve aged over friction threshold
      COALESCE(SUM(CASE WHEN
        (ss.held_in_reserve OR ss.payout_hold_reason IS NOT NULL)
        AND EXTRACT(DAY FROM NOW() - ss.created_at) > ${RESERVE_AGE_FRICTION_DAYS}
      THEN ss.station_amount_cents END), 0)                            AS reserve_aged_amount,

      -- Max reserve age (for risk classification)
      COALESCE(MAX(CASE WHEN ss.held_in_reserve OR ss.payout_hold_reason IS NOT NULL
        THEN EXTRACT(DAY FROM NOW() - ss.created_at)::int END), 0)    AS max_reserve_age_days,

      -- Count of settlements with failed payouts
      COUNT(DISTINCT CASE WHEN EXISTS(
        SELECT 1 FROM payout_batch_items pbi
        JOIN payout_batches pb ON pb.id = pbi.batch_id
        JOIN payout_failures pf ON pf.batch_id = pb.id
        WHERE pbi.settlement_id = ss.id AND pf.resolved = false
      ) THEN ss.id END)::int                                           AS failed_payout_count,

      -- Count of settlements blocked by disputes
      COUNT(DISTINCT CASE WHEN EXISTS(
        SELECT 1 FROM booking_disputes bd
        WHERE bd.booking_id = ss.booking_id AND bd.status NOT IN ('resolved','closed')
      ) THEN ss.id END)::int                                           AS dispute_count

    FROM station_settlements ss
    LEFT JOIN stations s ON s.id = ss.station_id
    LEFT JOIN franchise_owners fo ON fo.id = ss.franchise_owner_id
    GROUP BY ss.station_id, s.name, s.ownership_type, ss.franchise_owner_id, fo.business_name
    ORDER BY gross_revenue DESC
  `);

  return (baseRaw.rows as any[]).map(r => {
    const gross = c(r.gross_revenue);
    const platformFee = c(r.platform_fee);
    const stationPayout = c(r.station_payout);
    const franchiseShare = c(r.franchise_share);
    const held = c(r.held_amount);
    const blocked = c(r.blocked_amount);
    const failedPayout = c(r.failed_payout_amount);
    const approvalDelayed = c(r.approval_delayed_amount);
    const reserveAged = c(r.reserve_aged_amount);
    const maxReserveAge = c(r.max_reserve_age_days);
    const failedCount = c(r.failed_payout_count);
    const disputeCount = c(r.dispute_count);
    const settleCount = c(r.settlement_count);

    // Friction cost (T191 definition — kept separate from net contribution)
    const frictionCost = blocked + reserveAged + failedPayout + approvalDelayed;

    // Net releasable contribution (T191 formula)
    // = platform_fee + franchise_share - failed_payout - friction_cost
    const netReleasable = Math.max(0, platformFee + franchiseShare - failedPayout - frictionCost);

    const marginPct = pct(netReleasable, gross);
    const frictionRatio = gross > 0 ? frictionCost / gross : 0;
    const disputeRate = pct(disputeCount, settleCount);
    const failureRate = pct(failedCount, settleCount);

    // Reserve age risk classification
    let reserveAgeRisk: StationEconomics['reserveAgeRisk'] = 'none';
    if (maxReserveAge > 30) reserveAgeRisk = 'high';
    else if (maxReserveAge > 14) reserveAgeRisk = 'medium';
    else if (maxReserveAge > 7) reserveAgeRisk = 'low';

    const ownershipType = r.ownership_type ?? (r.franchise_owner_id ? 'franchise' : 'company');
    const priority = capitalPriority(marginPct, frictionRatio, failedCount);
    const signal = capitalSignal({
      marginPct,
      frictionRatio,
      failedPayouts: failedCount,
      reserveAge31Plus: maxReserveAge > 31,
      approvalBacklog: approvalDelayed > 0,
      disputeRatio: disputeCount / Math.max(1, settleCount),
      ownershipType,
    });

    return {
      stationId: r.station_id,
      stationName: r.station_name ?? `Station #${r.station_id}`,
      ownershipType,
      franchiseOwnerId: r.franchise_owner_id ?? null,
      franchiseOwnerName: r.franchise_owner_name ?? null,
      grossRevenueCents: gross,
      platformFeeCents: platformFee,
      stationPayoutCents: stationPayout,
      franchiseShareCents: franchiseShare,
      heldAmountCents: held,
      blockedAmountCents: blocked,
      failedPayoutCents: failedPayout,
      delayedApprovalCents: approvalDelayed,
      frictionCostCents: frictionCost,
      netReleasableContributionCents: netReleasable,
      contributionMarginPct: marginPct,
      disputeRate,
      payoutFailureRate: failureRate,
      reserveAgeRisk,
      capitalPriority: priority,
      capitalSignal: signal,
      settlementCount: settleCount,
    };
  });
}

// ---------------------------------------------------------------------------
// T193 — Network profitability (aggregated per franchise / company network)
// ---------------------------------------------------------------------------

export interface NetworkEconomics {
  ownerId: string;
  ownerName: string;
  ownershipType: 'company' | 'franchise';
  stationCount: number;
  grossRevenueCents: number;
  netReleasableContributionCents: number;
  contributionMarginPct: number;
  heldAmountCents: number;
  reserve31PlusCents: number;
  failedPayoutCents: number;
  blockedAmountCents: number;
  frictionCostCents: number;
  riskAdjustedScore: number;
}

export function aggregateNetworkEconomics(stations: StationEconomics[]): NetworkEconomics[] {
  const map = new Map<string, NetworkEconomics>();

  for (const s of stations) {
    const key = s.ownershipType === 'company' ? 'company' : `franchise:${s.franchiseOwnerId}`;
    const ownerName = s.ownershipType === 'company'
      ? 'Company-Owned Network'
      : (s.franchiseOwnerName ?? (s.franchiseOwnerId ? `Franchise #${s.franchiseOwnerId}` : 'Franchise (Unassigned Owner)'));

    if (!map.has(key)) {
      map.set(key, {
        ownerId: key,
        ownerName,
        ownershipType: s.ownershipType as 'company' | 'franchise',
        stationCount: 0,
        grossRevenueCents: 0,
        netReleasableContributionCents: 0,
        contributionMarginPct: 0,
        heldAmountCents: 0,
        reserve31PlusCents: 0,
        failedPayoutCents: 0,
        blockedAmountCents: 0,
        frictionCostCents: 0,
        riskAdjustedScore: 0,
      });
    }

    const n = map.get(key)!;
    n.stationCount++;
    n.grossRevenueCents += s.grossRevenueCents;
    n.netReleasableContributionCents += s.netReleasableContributionCents;
    n.heldAmountCents += s.heldAmountCents;
    n.failedPayoutCents += s.failedPayoutCents;
    n.blockedAmountCents += s.blockedAmountCents;
    n.frictionCostCents += s.frictionCostCents;
    // reserve31Plus: held with age > 31 days — use reserveAgeRisk === 'high' as proxy
    if (s.reserveAgeRisk === 'high') n.reserve31PlusCents += s.heldAmountCents;
  }

  for (const n of map.values()) {
    n.contributionMarginPct = pct(n.netReleasableContributionCents, n.grossRevenueCents);
    const frictionRatio = n.grossRevenueCents > 0 ? n.frictionCostCents / n.grossRevenueCents : 0;
    const failedCount = stations
      .filter(s => (s.ownershipType === 'company' && n.ownershipType === 'company') || s.franchiseOwnerId === parseInt(n.ownerId.split(':')[1] ?? '-1'))
      .reduce((a, s) => a + (s.payoutFailureRate > 0 ? 1 : 0), 0);
    const reserveAge31Ratio = n.grossRevenueCents > 0 ? n.reserve31PlusCents / n.grossRevenueCents : 0;
    const disputeRatio = n.grossRevenueCents > 0 ? n.blockedAmountCents / n.grossRevenueCents : 0;

    n.riskAdjustedScore = riskAdjustedScore({
      marginPct: n.contributionMarginPct,
      frictionRatio,
      failedPayouts: failedCount,
      reserveAge31PlusRatio: reserveAge31Ratio,
      disputeRatio,
      approvalBacklogRatio: 0,
    });
  }

  return [...map.values()].sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);
}

// ---------------------------------------------------------------------------
// T195 — Ownership model comparison
// ---------------------------------------------------------------------------

export interface OwnershipBlock {
  ownershipType: 'company' | 'franchise';
  stationCount: number;
  grossRevenueCents: number;
  netContributionCents: number;
  marginPct: number;
  heldAmountCents: number;
  blockedAmountCents: number;
  reserve31PlusCents: number;
  payoutFailureRate: number;
  approvalDelayRate: number;
  avgSettlementCycleDays: number | null;
}

export function ownershipComparison(stations: StationEconomics[]): { company_owned: OwnershipBlock; franchise_owned: OwnershipBlock } {
  function block(type: 'company' | 'franchise'): OwnershipBlock {
    const group = stations.filter(s => s.ownershipType === type);
    if (!group.length) {
      return {
        ownershipType: type, stationCount: 0, grossRevenueCents: 0,
        netContributionCents: 0, marginPct: 0, heldAmountCents: 0,
        blockedAmountCents: 0, reserve31PlusCents: 0, payoutFailureRate: 0,
        approvalDelayRate: 0, avgSettlementCycleDays: null,
      };
    }
    const gross = group.reduce((a, s) => a + s.grossRevenueCents, 0);
    const net = group.reduce((a, s) => a + s.netReleasableContributionCents, 0);
    const held = group.reduce((a, s) => a + s.heldAmountCents, 0);
    const blocked = group.reduce((a, s) => a + s.blockedAmountCents, 0);
    const reserve31 = group.filter(s => s.reserveAgeRisk === 'high').reduce((a, s) => a + s.heldAmountCents, 0);
    const totalSettlements = group.reduce((a, s) => a + s.settlementCount, 0);
    const failedSettlements = group.reduce((a, s) => a + Math.round(s.payoutFailureRate / 100 * s.settlementCount), 0);
    const delayedSettlements = group.reduce((a, s) => a + (s.delayedApprovalCents > 0 ? 1 : 0), 0);

    return {
      ownershipType: type,
      stationCount: group.length,
      grossRevenueCents: gross,
      netContributionCents: net,
      marginPct: pct(net, gross),
      heldAmountCents: held,
      blockedAmountCents: blocked,
      reserve31PlusCents: reserve31,
      payoutFailureRate: pct(failedSettlements, totalSettlements),
      approvalDelayRate: pct(delayedSettlements, group.length),
      avgSettlementCycleDays: null, // no settled_at dates available in current data
    };
  }

  return { company_owned: block('company'), franchise_owned: block('franchise') };
}

// ---------------------------------------------------------------------------
// T196 — Friction analytics
// ---------------------------------------------------------------------------

export interface FrictionAnalytics {
  stationId: number;
  stationName: string;
  ownershipType: string;
  disputeBlockedCents: number;
  reserveHeldCents: number;
  approvalPendingCents: number;
  payoutFailureCents: number;
  mismatchAffectedCents: number;
  frictionTotalCents: number;
  frictionPctOfGross: number;
}

export async function computeFrictionAnalytics(): Promise<FrictionAnalytics[]> {
  // Mismatch-affected: settlements in batches with partial reconciliation
  const mismatchRaw = await db.execute(sql`
    SELECT pbi.settlement_id, rr.difference_cents
    FROM payout_batch_items pbi
    JOIN reconciliation_results rr ON rr.batch_id = pbi.batch_id
    WHERE rr.status = 'partial' AND rr.difference_cents IS NOT NULL AND rr.difference_cents <> 0
  `);
  const mismatchMap = new Map<number, number>();
  for (const row of mismatchRaw.rows as any[]) {
    mismatchMap.set(row.settlement_id, Math.abs(c(row.difference_cents)));
  }

  const baseRaw = await db.execute(sql`
    SELECT
      ss.station_id,
      s.name                                                              AS station_name,
      COALESCE(s.ownership_type, 'company')                               AS ownership_type,
      ss.id                                                               AS settlement_id,
      ss.station_amount_cents,
      ss.total_amount_cents,
      ss.held_in_reserve,
      ss.payout_hold_reason,
      -- dispute blocked
      EXISTS(
        SELECT 1 FROM booking_disputes bd
        WHERE bd.booking_id = ss.booking_id AND bd.status NOT IN ('resolved','closed')
      ) AS is_disputed,
      -- failed payout
      EXISTS(
        SELECT 1 FROM payout_batch_items pbi
        JOIN payout_batches pb ON pb.id = pbi.batch_id
        JOIN payout_failures pf ON pf.batch_id = pb.id
        WHERE pbi.settlement_id = ss.id AND pf.resolved = false
      ) AS has_failed_payout,
      -- approval pending
      EXISTS(
        SELECT 1 FROM financial_approval_log fal
        WHERE fal.case_ref_id = ss.id::text AND fal.status IN ('pending','pending_second')
      ) AS has_pending_approval
    FROM station_settlements ss
    LEFT JOIN stations s ON s.id = ss.station_id
    WHERE ss.status NOT IN ('paid', 'cancelled')
  `);

  // Aggregate per station
  const stationMap = new Map<number, FrictionAnalytics>();

  for (const r of baseRaw.rows as any[]) {
    const sid = r.station_id as number;
    if (!stationMap.has(sid)) {
      stationMap.set(sid, {
        stationId: sid,
        stationName: r.station_name ?? `Station #${sid}`,
        ownershipType: r.ownership_type ?? 'company',
        disputeBlockedCents: 0,
        reserveHeldCents: 0,
        approvalPendingCents: 0,
        payoutFailureCents: 0,
        mismatchAffectedCents: 0,
        frictionTotalCents: 0,
        frictionPctOfGross: 0,
      });
    }

    const entry = stationMap.get(sid)!;
    const amt = c(r.station_amount_cents);
    const gross = c(r.total_amount_cents);

    if (r.is_disputed) entry.disputeBlockedCents += amt;
    if (r.held_in_reserve || r.payout_hold_reason) entry.reserveHeldCents += amt;
    if (r.has_failed_payout) entry.payoutFailureCents += amt;
    if (r.has_pending_approval) entry.approvalPendingCents += amt;
    entry.mismatchAffectedCents += mismatchMap.get(r.settlement_id) ?? 0;

    // Accumulate gross for pct calculation (stored temporarily in frictionTotalCents field)
    // We'll recompute below using frictionPctOfGross as gross accumulator
    entry.frictionPctOfGross += gross; // temporarily using as gross accumulator
  }

  const results: FrictionAnalytics[] = [];
  for (const entry of stationMap.values()) {
    const gross = entry.frictionPctOfGross; // was temporarily storing gross
    entry.frictionTotalCents =
      entry.disputeBlockedCents +
      entry.reserveHeldCents +
      entry.payoutFailureCents +
      entry.approvalPendingCents +
      entry.mismatchAffectedCents;
    entry.frictionPctOfGross = pct(entry.frictionTotalCents, gross);
    results.push(entry);
  }

  return results.sort((a, b) => b.frictionTotalCents - a.frictionTotalCents);
}

// ---------------------------------------------------------------------------
// Network-level KPI strip (for dashboard header)
// ---------------------------------------------------------------------------

export interface NetworkKPIs {
  grossNetworkRevenueCents: number;
  netReleasableContributionCents: number;
  heldCapitalCents: number;
  blockedCapitalCents: number;
  frictionCostCents: number;
  contributionMarginPct: number;
}

export function networkKPIs(stations: StationEconomics[]): NetworkKPIs {
  const gross = stations.reduce((a, s) => a + s.grossRevenueCents, 0);
  const net = stations.reduce((a, s) => a + s.netReleasableContributionCents, 0);
  const held = stations.reduce((a, s) => a + s.heldAmountCents, 0);
  const blocked = stations.reduce((a, s) => a + s.blockedAmountCents, 0);
  const friction = stations.reduce((a, s) => a + s.frictionCostCents, 0);
  return {
    grossNetworkRevenueCents: gross,
    netReleasableContributionCents: net,
    heldCapitalCents: held,
    blockedCapitalCents: blocked,
    frictionCostCents: friction,
    contributionMarginPct: pct(net, gross),
  };
}
