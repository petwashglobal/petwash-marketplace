/**
 * Phase 12.18 — Forecasting, Liquidity & Reserve Planning
 *
 * All forecasts are state-based (settlement states), never invented.
 * T190 rules: releasable / held / risky / failed are always kept separate.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function c(v: any): number { return parseInt(v ?? '0', 10); }
function f(v: any): number { return parseFloat(v ?? '0'); }

// settlement status classification
// releasable: status='approved', not held, no dispute
// held: held_in_reserve OR payout_hold_reason
// risky: approval pending, dispute open, mismatch on recon
// failed_retry: in a failed payout batch

export interface ForecastWindow {
  label: '7d' | '14d' | '30d';
  expected_gross_outflow_cents: number;
  expected_releasable_outflow_cents: number;
  expected_held_outflow_cents: number;
  expected_risky_outflow_cents: number;
  expected_failed_retry_outflow_cents: number;
}

// ---------------------------------------------------------------------------
// T181 — Forecast Snapshot
// ---------------------------------------------------------------------------

export async function forecastSnapshot(): Promise<ForecastWindow[]> {
  // Pull all open/pending settlements that have not yet been paid out
  const raw = await db.execute(sql`
    SELECT
      ss.id,
      ss.station_amount_cents,
      ss.held_in_reserve,
      ss.payout_hold_reason,
      ss.reserve_reason,
      ss.status,
      ss.created_at,
      -- Is there an open dispute for this booking?
      (
        SELECT COUNT(*) FROM booking_disputes bd
        WHERE bd.booking_id = ss.booking_id AND bd.status NOT IN ('resolved','closed')
      ) AS dispute_count,
      -- Is there a pending approval?
      (
        SELECT COUNT(*) FROM financial_approval_log fal
        WHERE fal.case_ref_id = ss.id::text AND fal.status IN ('pending','pending_second')
      ) AS pending_approval_count,
      -- Is there a failed payout batch for this settlement?
      (
        SELECT COUNT(*) FROM payout_batch_items pbi
        JOIN payout_batches pb ON pb.id = pbi.batch_id
        JOIN payout_failures pf ON pf.batch_id = pb.id
        WHERE pbi.settlement_id = ss.id AND pf.resolved = false
      ) AS failed_batch_count
    FROM station_settlements ss
    WHERE ss.status NOT IN ('paid', 'cancelled')
  `);

  const settlements = raw.rows as any[];

  // For each window, include all settlements (we don't have scheduled future dates,
  // so we distribute by expected release time: 7d = near-ready, 14d cumulative, 30d cumulative)
  // Categorise each settlement into one bucket
  function categorise(s: any): { gross: number; releasable: number; held: number; risky: number; failed: number } {
    const amt = c(s.station_amount_cents);
    const isHeld = s.held_in_reserve || !!s.payout_hold_reason;
    const hasDispute = c(s.dispute_count) > 0;
    const hasPendingApproval = c(s.pending_approval_count) > 0;
    const hasFailed = c(s.failed_batch_count) > 0;

    if (hasFailed) return { gross: amt, releasable: 0, held: 0, risky: 0, failed: amt };
    if (isHeld) return { gross: amt, releasable: 0, held: amt, risky: 0, failed: 0 };
    if (hasDispute || hasPendingApproval) return { gross: amt, releasable: 0, held: 0, risky: amt, failed: 0 };
    return { gross: amt, releasable: amt, held: 0, risky: 0, failed: 0 };
  }

  function sumWindow(window: '7d' | '14d' | '30d'): ForecastWindow {
    // Since we don't have explicit future payout dates (no `scheduled_payout_at` column),
    // use settlement age as proxy:
    // 7d  → settlements 0-7 days old (newly created, likely to process soon)
    // 14d → settlements 0-14 days old
    // 30d → all open settlements (0-30d+)
    const days = window === '7d' ? 7 : window === '14d' ? 14 : 36500; // 36500 = include all
    const now = Date.now();
    const cutoff = now - days * 24 * 3600 * 1000;

    const filtered = settlements.filter(s => {
      const age = new Date(s.created_at).getTime();
      // For 7d/14d: include settlements created within the window (expected to process next)
      // For 30d: include all
      return days >= 36500 || age >= cutoff;
    });

    const sums = filtered.reduce(
      (acc, s) => {
        const cat = categorise(s);
        return {
          gross: acc.gross + cat.gross,
          releasable: acc.releasable + cat.releasable,
          held: acc.held + cat.held,
          risky: acc.risky + cat.risky,
          failed: acc.failed + cat.failed,
        };
      },
      { gross: 0, releasable: 0, held: 0, risky: 0, failed: 0 }
    );

    return {
      label: window,
      expected_gross_outflow_cents: sums.gross,
      expected_releasable_outflow_cents: sums.releasable,
      expected_held_outflow_cents: sums.held,
      expected_risky_outflow_cents: sums.risky,
      expected_failed_retry_outflow_cents: sums.failed,
    };
  }

  return ['7d', '14d', '30d'].map(w => sumWindow(w as ForecastWindow['label']));
}

// ---------------------------------------------------------------------------
// T182 — Reserve Ageing
// ---------------------------------------------------------------------------

export async function reserveAgeing() {
  const now = new Date();

  const raw = await db.execute(sql`
    SELECT
      ss.id,
      ss.station_amount_cents,
      ss.franchise_owner_id,
      ss.station_id,
      ss.held_in_reserve,
      ss.payout_hold_reason,
      ss.reserve_reason,
      ss.created_at,
      EXTRACT(DAY FROM NOW() - ss.created_at)::int AS age_days,
      CASE
        WHEN ss.franchise_owner_id IS NULL THEN 'company'
        ELSE 'franchise'
      END AS owner_type
    FROM station_settlements ss
    WHERE (ss.held_in_reserve = true OR ss.payout_hold_reason IS NOT NULL)
    ORDER BY ss.created_at ASC
  `);

  const held = raw.rows as any[];

  // Data quality issues: missing hold reason
  const missingReason = held.filter(s => !s.reserve_reason && !s.payout_hold_reason);

  function bucket(days: number): '0-7d' | '8-14d' | '15-30d' | '31+d' {
    if (days <= 7) return '0-7d';
    if (days <= 14) return '8-14d';
    if (days <= 30) return '15-30d';
    return '31+d';
  }

  type BucketKey = '0-7d' | '8-14d' | '15-30d' | '31+d';
  const bucketDefs: BucketKey[] = ['0-7d', '8-14d', '15-30d', '31+d'];

  const buckets: Record<BucketKey, { reserve_count: number; reserve_amount_cents: number; ages: number[] }> = {
    '0-7d': { reserve_count: 0, reserve_amount_cents: 0, ages: [] },
    '8-14d': { reserve_count: 0, reserve_amount_cents: 0, ages: [] },
    '15-30d': { reserve_count: 0, reserve_amount_cents: 0, ages: [] },
    '31+d': { reserve_count: 0, reserve_amount_cents: 0, ages: [] },
  };

  for (const s of held) {
    const age = Math.max(0, Math.round(f(s.age_days)));
    const b = bucket(age);
    buckets[b].reserve_count++;
    buckets[b].reserve_amount_cents += c(s.station_amount_cents);
    buckets[b].ages.push(age);
  }

  const summary = bucketDefs.map(b => ({
    bucket: b,
    reserve_count: buckets[b].reserve_count,
    reserve_amount_cents: buckets[b].reserve_amount_cents,
    avg_age_days: buckets[b].ages.length
      ? Math.round(buckets[b].ages.reduce((a, v) => a + v, 0) / buckets[b].ages.length)
      : 0,
    oldest_reserve_days: buckets[b].ages.length ? Math.max(...buckets[b].ages) : 0,
  }));

  // Breakdown by owner type
  const byOwner: Record<string, { owner_type: string; owner_id: string | null; amount_cents: number; count: number }> = {};
  for (const s of held) {
    const key = s.owner_type === 'company' ? 'company' : `franchise:${s.franchise_owner_id}`;
    if (!byOwner[key]) byOwner[key] = { owner_type: s.owner_type, owner_id: s.franchise_owner_id ?? null, amount_cents: 0, count: 0 };
    byOwner[key].amount_cents += c(s.station_amount_cents);
    byOwner[key].count++;
  }

  return {
    total_held: held.length,
    total_held_cents: held.reduce((a, s) => a + c(s.station_amount_cents), 0),
    data_quality_issues: missingReason.length,
    buckets: summary,
    by_owner: Object.values(byOwner),
  };
}

// ---------------------------------------------------------------------------
// T183 — Liquidity Pressure
// ---------------------------------------------------------------------------

export async function liquidityPressure() {
  const [settleRaw, failRaw, approvalRaw, disputeRaw] = await Promise.all([
    db.execute(sql`
      SELECT
        COALESCE(SUM(station_amount_cents), 0)                                                                                    AS total_open,
        COALESCE(SUM(CASE WHEN NOT held_in_reserve AND payout_hold_reason IS NULL THEN station_amount_cents END), 0)              AS releasable,
        COALESCE(SUM(CASE WHEN held_in_reserve OR payout_hold_reason IS NOT NULL THEN station_amount_cents END), 0)               AS held,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN station_amount_cents END), 0)                        AS last_7d,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '14 days' THEN station_amount_cents END), 0)                       AS last_14d
      FROM station_settlements
      WHERE status NOT IN ('paid', 'cancelled')
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(pb.total_net_cents), 0) AS failed_retry_cents, COUNT(pf.id) AS failed_count
      FROM payout_failures pf
      JOIN payout_batches pb ON pb.id = pf.batch_id
      WHERE pf.resolved = false
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(amount_cents), 0) AS pending_approval_cents, COUNT(*) AS pending_count
      FROM financial_approval_log
      WHERE status IN ('pending', 'pending_second')
    `),
    db.execute(sql`
      SELECT COUNT(*) AS dispute_count
      FROM booking_disputes
      WHERE status NOT IN ('resolved','closed')
    `),
  ]);

  const s = settleRaw.rows[0] as any;
  const f = failRaw.rows[0] as any;
  const a = approvalRaw.rows[0] as any;
  const d = disputeRaw.rows[0] as any;

  const totalHeld = c(s.held);
  const failedRetryCents = c(f.failed_retry_cents);
  const pendingApprovalCents = c(a.pending_approval_cents);
  const openDisputeCount = c(d.dispute_count);
  const failedCount = c(f.failed_count);

  // Pressure scoring (deterministic rules, T190 rule 5)
  let pressure: 'low' | 'medium' | 'high' | 'critical' = 'low';
  const reasons: string[] = [];

  if (failedCount > 0 && totalHeld > 0 && pendingApprovalCents > 0) {
    pressure = 'critical';
    reasons.push('failed batches + aged reserves + unresolved approvals');
  } else if (failedCount > 0 || (totalHeld > 0 && pendingApprovalCents > 0)) {
    pressure = 'high';
    if (failedCount > 0) reasons.push('failed payout batches awaiting retry');
    if (totalHeld > 0 && pendingApprovalCents > 0) reasons.push('aged reserves + unresolved approvals');
  } else if (totalHeld > 0 || pendingApprovalCents > 0 || openDisputeCount > 0) {
    pressure = 'medium';
    if (totalHeld > 0) reasons.push('active reserve holds');
    if (pendingApprovalCents > 0) reasons.push('approval backlog');
    if (openDisputeCount > 0) reasons.push('open disputes');
  }

  if (!reasons.length) reasons.push('all payouts flowing normally');

  return {
    next_7_days_expected_outflow: c(s.last_7d),
    next_14_days_expected_outflow: c(s.last_14d),
    total_open_outflow: c(s.total_open),
    total_held_amount: totalHeld,
    releasable_amount: c(s.releasable),
    failed_batches_waiting_retry: failedCount,
    failed_retry_cents: failedRetryCents,
    unresolved_approval_amount: pendingApprovalCents,
    unresolved_approval_count: c(a.pending_count),
    unresolved_dispute_count: openDisputeCount,
    pressure_level: pressure,
    pressure_reason: reasons.join('; '),
  };
}

// ---------------------------------------------------------------------------
// T184 — Payout Calendar Forecast
// ---------------------------------------------------------------------------

export async function payoutCalendarForecast() {
  // Build 4 weekly cycles ahead based on current settlement state
  // Each cycle: settlements created in that age window
  const cycles: Array<{
    cycle_start: string;
    cycle_end: string;
    projected_gross_cents: number;
    projected_releasable_cents: number;
    projected_held_cents: number;
    projected_risky_cents: number;
    projected_failed_retry_cents: number;
    dominant_blocker: string;
  }> = [];

  const now = Date.now();

  for (let week = 0; week < 4; week++) {
    const start = new Date(now + week * 7 * 86400000);
    const end = new Date(now + (week + 1) * 7 * 86400000);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    // For the first week: use releasable from current settlements
    // For subsequent weeks: use held/risky/failed that might release
    // Source: settlements where created_at is within -7*(week+1) to -7*week days old
    const raw = await db.execute(sql`
      SELECT
        ss.station_amount_cents,
        ss.held_in_reserve,
        ss.payout_hold_reason,
        (SELECT COUNT(*) FROM booking_disputes bd WHERE bd.booking_id = ss.booking_id AND bd.status NOT IN ('resolved','closed')) AS dispute_count,
        (SELECT COUNT(*) FROM financial_approval_log fal WHERE fal.case_ref_id = ss.id::text AND fal.status IN ('pending','pending_second')) AS pending_approval_count,
        (SELECT COUNT(*) FROM payout_batch_items pbi JOIN payout_batches pb ON pb.id = pbi.batch_id JOIN payout_failures pf ON pf.batch_id = pb.id WHERE pbi.settlement_id = ss.id AND pf.resolved = false) AS failed_batch_count
      FROM station_settlements ss
      WHERE ss.status NOT IN ('paid', 'cancelled')
      AND ss.created_at >= NOW() - ${(week + 1) * 7}::int * INTERVAL '1 day'
      AND ss.created_at < NOW() - ${week * 7}::int * INTERVAL '1 day'
    `);

    const rows = raw.rows as any[];
    let gross = 0, releasable = 0, held = 0, risky = 0, failed = 0;
    const blockers: Record<string, number> = { disputes: 0, mismatches: 0, pending_approvals: 0, failed_transfers: 0, no_blocker: 0 };

    for (const s of rows) {
      const amt = c(s.station_amount_cents);
      const isHeld = s.held_in_reserve || !!s.payout_hold_reason;
      const hasDispute = c(s.dispute_count) > 0;
      const hasPending = c(s.pending_approval_count) > 0;
      const hasFailed = c(s.failed_batch_count) > 0;
      gross += amt;

      if (hasFailed) { failed += amt; blockers.failed_transfers++; }
      else if (isHeld) { held += amt; blockers.mismatches++; }
      else if (hasDispute) { risky += amt; blockers.disputes++; }
      else if (hasPending) { risky += amt; blockers.pending_approvals++; }
      else { releasable += amt; blockers.no_blocker++; }
    }

    const dominant = Object.entries(blockers)
      .filter(([k]) => k !== 'no_blocker')
      .sort((a, b) => b[1] - a[1])[0];
    const dominant_blocker = releasable >= gross * 0.8 ? 'no_blocker' : (dominant?.[0] ?? 'no_blocker');

    cycles.push({
      cycle_start: startStr,
      cycle_end: endStr,
      projected_gross_cents: gross,
      projected_releasable_cents: releasable,
      projected_held_cents: held,
      projected_risky_cents: risky,
      projected_failed_retry_cents: failed,
      dominant_blocker,
    });
  }

  return { cycles };
}

// ---------------------------------------------------------------------------
// T185 — Risk Comparison by franchise / company
// ---------------------------------------------------------------------------

export async function riskComparison() {
  const raw = await db.execute(sql`
    SELECT
      CASE WHEN ss.franchise_owner_id IS NULL THEN 'company' ELSE 'franchise' END AS owner_type,
      COALESCE(ss.franchise_owner_id::text, 'company-owned') AS owner_id,
      COALESCE(SUM(ss.station_amount_cents), 0) AS total_open_cents,
      COALESCE(SUM(CASE WHEN ss.held_in_reserve OR ss.payout_hold_reason IS NOT NULL THEN ss.station_amount_cents END), 0) AS held_cents,
      COALESCE(SUM(CASE WHEN EXTRACT(DAY FROM NOW() - ss.created_at) >= 31 AND (ss.held_in_reserve OR ss.payout_hold_reason IS NOT NULL) THEN ss.station_amount_cents END), 0) AS aged_31_plus_cents,
      COUNT(DISTINCT CASE WHEN EXISTS(
        SELECT 1 FROM payout_batch_items pbi
        JOIN payout_batches pb ON pb.id = pbi.batch_id
        JOIN payout_failures pf ON pf.batch_id = pb.id
        WHERE pbi.settlement_id = ss.id AND pf.resolved = false
      ) THEN ss.id END)::int AS failed_payout_count,
      COALESCE(SUM(CASE WHEN EXISTS(
        SELECT 1 FROM booking_disputes bd WHERE bd.booking_id = ss.booking_id AND bd.status NOT IN ('resolved','closed')
      ) THEN ss.station_amount_cents END), 0) AS dispute_blocked_cents,
      COALESCE(SUM(CASE WHEN EXISTS(
        SELECT 1 FROM financial_approval_log fal WHERE fal.case_ref_id = ss.id::text AND fal.status IN ('pending','pending_second')
      ) THEN ss.station_amount_cents END), 0) AS approval_pending_cents
    FROM station_settlements ss
    WHERE ss.status NOT IN ('paid', 'cancelled')
    GROUP BY
      CASE WHEN ss.franchise_owner_id IS NULL THEN 'company' ELSE 'franchise' END,
      COALESCE(ss.franchise_owner_id::text, 'company-owned')
    ORDER BY total_open_cents DESC
  `);

  const rows = raw.rows as any[];

  return rows.map(r => {
    const total = c(r.total_open_cents) || 1;
    const held = c(r.held_cents);
    const aged = c(r.aged_31_plus_cents);
    const failed = c(r.failed_payout_count);
    const disputed = c(r.dispute_blocked_cents);
    const pending = c(r.approval_pending_cents);

    // Deterministic risk score 0–100 (T190 rule 5)
    const heldRatio = held / total;
    const agedRatio = aged / total;
    const disputedRatio = disputed / total;
    const pendingRatio = pending / total;
    const failedScore = Math.min(failed * 15, 30);
    const score = Math.round(
      heldRatio * 25 + agedRatio * 25 + disputedRatio * 20 + pendingRatio * 15 + failedScore
    );

    return {
      owner_type: r.owner_type,
      owner_id: r.owner_id,
      expected_outflow_30d_cents: c(r.total_open_cents),
      held_amount_cents: held,
      reserve_age_31_plus_cents: aged,
      failed_payout_count: failed,
      dispute_blocked_cents: disputed,
      approval_pending_cents: pending,
      risk_score: Math.min(score, 100),
    };
  });
}

// ---------------------------------------------------------------------------
// T186 — Treasury Warnings
// ---------------------------------------------------------------------------

export interface TreasuryWarning {
  type: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  title: string;
  description: string;
  entity_scope: string;
  entity_id: string | null;
  amount_cents: number;
  age_days: number | null;
  action_hint: string;
}

export async function treasuryWarnings(): Promise<TreasuryWarning[]> {
  const warnings: TreasuryWarning[] = [];

  // W1: Reserves aged over 30 days
  const agedRaw = await db.execute(sql`
    SELECT id, station_amount_cents, franchise_owner_id,
           EXTRACT(DAY FROM NOW() - created_at)::int AS age_days
    FROM station_settlements
    WHERE (held_in_reserve = true OR payout_hold_reason IS NOT NULL)
      AND created_at < NOW() - INTERVAL '30 days'
  `);
  for (const r of agedRaw.rows as any[]) {
    warnings.push({
      type: 'reserve_aged_over_30_days',
      severity: 'high',
      title: 'Reserve aged over 30 days',
      description: `Settlement #${r.id} has been held for ${r.age_days} days with no release.`,
      entity_scope: r.franchise_owner_id ? 'franchise' : 'company',
      entity_id: String(r.id),
      amount_cents: c(r.station_amount_cents),
      age_days: c(r.age_days),
      action_hint: 'Review reserve reason and release or escalate if stale.',
    });
  }

  // W2: Repeated failed batch (retry_count ≥ 2)
  const failedRaw = await db.execute(sql`
    SELECT pf.id, pf.retry_count, pf.reason, pb.total_net_cents, pb.batch_id
    FROM payout_failures pf
    JOIN payout_batches pb ON pb.id = pf.batch_id
    WHERE pf.resolved = false AND pf.retry_count >= 2
  `);
  for (const r of failedRaw.rows as any[]) {
    warnings.push({
      type: 'repeated_failed_batch',
      severity: 'critical',
      title: 'Repeated payout failure',
      description: `Batch ${r.batch_id} has failed ${r.retry_count} times. Reason: ${r.reason ?? 'unknown'}.`,
      entity_scope: 'batch',
      entity_id: r.batch_id,
      amount_cents: c(r.total_net_cents),
      age_days: null,
      action_hint: 'Investigate bank transaction matching manually before retrying again.',
    });
  }

  // W3: First-time failed batch (retry_count 0-1)
  const failedOnceRaw = await db.execute(sql`
    SELECT pf.id, pf.retry_count, pf.reason, pb.total_net_cents, pb.batch_id
    FROM payout_failures pf
    JOIN payout_batches pb ON pb.id = pf.batch_id
    WHERE pf.resolved = false AND pf.retry_count < 2
  `);
  for (const r of failedOnceRaw.rows as any[]) {
    warnings.push({
      type: 'payout_batch_failed',
      severity: 'high',
      title: 'Payout batch failed',
      description: `Batch ${r.batch_id} failed and awaits retry. ${r.retry_count === 1 ? '1 retry attempted.' : 'No retries yet.'}`,
      entity_scope: 'batch',
      entity_id: r.batch_id,
      amount_cents: c(r.total_net_cents),
      age_days: null,
      action_hint: 'Retry or investigate bank transaction import.',
    });
  }

  // W4: Approval backlog (>3 pending approvals)
  const approvalRaw = await db.execute(sql`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_cents), 0) AS total
    FROM financial_approval_log WHERE status IN ('pending','pending_second')
  `);
  const aCount = c((approvalRaw.rows[0] as any)?.cnt);
  const aTotal = c((approvalRaw.rows[0] as any)?.total);
  if (aCount >= 3) {
    warnings.push({
      type: 'approval_backlog',
      severity: aCount >= 10 ? 'critical' : 'warning',
      title: `Approval backlog — ${aCount} pending`,
      description: `${aCount} financial approvals are pending totalling ${(aTotal / 100).toLocaleString('he-IL')} ₪.`,
      entity_scope: 'platform',
      entity_id: null,
      amount_cents: aTotal,
      age_days: null,
      action_hint: 'Review and action pending approvals in the Financial Approvals queue.',
    });
  }

  // W5: High reserve relative to open settlements
  const pressureRaw = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN held_in_reserve OR payout_hold_reason IS NOT NULL THEN station_amount_cents END), 0) AS held,
      COALESCE(SUM(station_amount_cents), 0) AS total
    FROM station_settlements WHERE status NOT IN ('paid','cancelled')
  `);
  const held = c((pressureRaw.rows[0] as any)?.held);
  const total = c((pressureRaw.rows[0] as any)?.total) || 1;
  if (total > 0 && held / total > 0.5) {
    warnings.push({
      type: 'payout_cycle_high_pressure',
      severity: held / total > 0.75 ? 'critical' : 'high',
      title: 'High reserve pressure',
      description: `${Math.round((held / total) * 100)}% of open settlement value is currently held or reserved.`,
      entity_scope: 'platform',
      entity_id: null,
      amount_cents: held,
      age_days: null,
      action_hint: 'Review reserve reasons. Consider batch release if reserves are stale.',
    });
  }

  // W6: Data quality — settlements with hold but no reason
  const missingRaw = await db.execute(sql`
    SELECT COUNT(*) AS cnt,
           COALESCE(SUM(station_amount_cents), 0) AS total
    FROM station_settlements
    WHERE (held_in_reserve = true OR payout_hold_reason IS NOT NULL)
      AND reserve_reason IS NULL AND payout_hold_reason IS NULL
  `);
  const missingCount = c((missingRaw.rows[0] as any)?.cnt);
  if (missingCount > 0) {
    warnings.push({
      type: 'data_quality_missing_hold_reason',
      severity: 'warning',
      title: `${missingCount} held settlement(s) missing hold reason`,
      description: 'Treasury data quality: held settlements without an explicit reason are not traceable.',
      entity_scope: 'platform',
      entity_id: null,
      amount_cents: c((missingRaw.rows[0] as any)?.total),
      age_days: null,
      action_hint: 'Audit these settlements and assign explicit hold/reserve reasons.',
    });
  }

  // Sort: critical → high → warning → info
  const order = { critical: 0, high: 1, warning: 2, info: 3 };
  warnings.sort((a, b) => order[a.severity] - order[b.severity]);

  return warnings;
}

// ---------------------------------------------------------------------------
// T187 — Forecast vs Actual
// ---------------------------------------------------------------------------

export async function forecastVsActual() {
  // Use completed (paid/reconciled) payout batches as "actual" cycles
  // We compare what was "expected" (total_net_cents at batch creation)
  // vs what was "actually paid" (confirmed via reconciliation)
  const raw = await db.execute(sql`
    SELECT
      pb.id,
      pb.batch_id,
      pb.total_net_cents AS forecasted_releasable_cents,
      COALESCE(rr.amount_actual, 0) AS actual_paid_cents,
      pb.paid_at,
      pb.created_at
    FROM payout_batches pb
    LEFT JOIN reconciliation_results rr ON rr.batch_id = pb.id
    WHERE pb.status IN ('paid', 'reconciled')
    ORDER BY pb.paid_at DESC NULLS LAST
    LIMIT 20
  `);

  const rows = (raw.rows as any[]).map(r => {
    const forecasted = c(r.forecasted_releasable_cents);
    const actual = c(r.actual_paid_cents);
    const variance = forecasted - actual;
    const variance_pct = forecasted > 0 ? Math.round((variance / forecasted) * 100) : 0;
    return {
      batch_id: r.batch_id,
      paid_at: r.paid_at,
      forecasted_releasable_cents: forecasted,
      actual_paid_cents: actual,
      variance_cents: variance,
      variance_pct,
    };
  });

  const totalForecasted = rows.reduce((a, r) => a + r.forecasted_releasable_cents, 0);
  const totalActual = rows.reduce((a, r) => a + r.actual_paid_cents, 0);
  const avgVariancePct = rows.length ? Math.round(rows.reduce((a, r) => a + Math.abs(r.variance_pct), 0) / rows.length) : 0;

  return {
    cycles: rows,
    summary: {
      total_forecasted_cents: totalForecasted,
      total_actual_cents: totalActual,
      total_variance_cents: totalForecasted - totalActual,
      avg_abs_variance_pct: avgVariancePct,
    },
  };
}
