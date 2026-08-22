/**
 * Wallet Ledger Drift Detector
 *
 * Detect-only job (NO auto-heal) that nightly compares the denormalized
 * `walletAccounts` balance columns to the SUM of `creditTransactions`
 * grouped by `creditType`. If a drift is found, the run is recorded in
 * `walletReconciliationRuns` with:
 *   runType  = 'ledger_drift_detector'
 *   verdict  = 'WARN' (drift found) or 'PASS' (clean)
 *   drifted  = number of (wallet, creditType) cells out of agreement
 *   healed   = 0 (this job NEVER writes to walletAccounts)
 *   summaryJson = top-N drifts with walletId, type, expected, actual
 *
 * This complements the existing `wallet-reconciliation.ts` job which
 * heals booking↔finance-hold drift. THIS file is strictly read-only and
 * surfaces silent corruption between the ledger and the cached balances.
 *
 * Why it's safe:
 *   - SELECT-only against creditTransactions and walletAccounts.
 *   - Writes only to walletReconciliationRuns (audit table) — never to
 *     walletAccounts, creditTransactions, or any money-bearing table.
 *   - No Nayax / Tranzila / K9000 calls.
 *   - No schema migration (uses existing walletReconciliationRuns columns).
 *
 * Schedule: nightly at 03:00 UTC. Manual run also available via
 * `runWalletLedgerDriftDetector('manual')` for ops-driven proof passes.
 */

import cron from 'node-cron';
import { nanoid } from 'nanoid';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { walletAccounts, walletReconciliationRuns } from '@shared/schema';
import { logger } from '../lib/logger';

const LABEL = '[WalletLedgerDrift]';

/** How many drift rows to include in the persisted summaryJson. */
const SUMMARY_SAMPLE_LIMIT = 50;

/** Fields on walletAccounts that we reconcile, mapped to creditType in creditTransactions. */
type DriftField = {
  /** column on walletAccounts (camelCase) */
  accountColumn: 'egiftBalanceCents' | 'promoBalanceCents' | 'referralBalanceCents' | 'loyaltyPointsBalance' | 'washPackageCredits';
  /** creditType filter on creditTransactions */
  creditType: 'egift' | 'promo_credit' | 'referral_credit' | 'loyalty_points' | 'wash_package';
  /** which amount column in creditTransactions to sum */
  ledgerColumn: 'amount_cents' | 'amount_units';
  /** human label for logs */
  label: string;
};

const DRIFT_FIELDS: DriftField[] = [
  { accountColumn: 'egiftBalanceCents',     creditType: 'egift',           ledgerColumn: 'amount_cents', label: 'egift' },
  { accountColumn: 'promoBalanceCents',     creditType: 'promo_credit',    ledgerColumn: 'amount_cents', label: 'promo' },
  { accountColumn: 'referralBalanceCents',  creditType: 'referral_credit', ledgerColumn: 'amount_cents', label: 'referral' },
  { accountColumn: 'loyaltyPointsBalance',  creditType: 'loyalty_points',  ledgerColumn: 'amount_cents', label: 'loyalty_points' },
  { accountColumn: 'washPackageCredits',    creditType: 'wash_package',    ledgerColumn: 'amount_units', label: 'wash_package_units' },
];

// SECOND pass (Lane B audit 2026-08-22 B-01): reconcile wallet_accounts
// against the CANONICAL ledger `wallet_ledger_entries` (bucket-keyed
// double-entry). Drift between wallet_ledger_entries and credit_transactions
// themselves was invisible until now — the primary pass above compares
// only against credit_transactions. This pass keys on the bucket enum
// (cash_wallet | egift | promo | wash_package | loyalty | ...) using
// direction to signed-sum. Same detect-only guarantee: writes only to
// wallet_reconciliation_runs. Empty ledger sum for an account is
// treated as "no drift to report" (rather than -balance drift) —
// wallet_ledger_entries adoption is per-writer and partial today.
type LedgerV2DriftField = {
  accountColumn: 'egiftBalanceCents' | 'promoBalanceCents' | 'cashWalletBalanceCents' | 'washPackageCredits' | 'loyaltyPointsBalance';
  bucket: 'egift' | 'promo' | 'cash_wallet' | 'wash_package' | 'loyalty';
  label: string;
};

const LEDGER_V2_DRIFT_FIELDS: LedgerV2DriftField[] = [
  { accountColumn: 'egiftBalanceCents',     bucket: 'egift',        label: 'egift@v2' },
  { accountColumn: 'promoBalanceCents',     bucket: 'promo',        label: 'promo@v2' },
  { accountColumn: 'cashWalletBalanceCents',bucket: 'cash_wallet',  label: 'cash_wallet@v2' },
  { accountColumn: 'washPackageCredits',    bucket: 'wash_package', label: 'wash_package_units@v2' },
  { accountColumn: 'loyaltyPointsBalance',  bucket: 'loyalty',      label: 'loyalty_points@v2' },
];

interface DriftRow {
  walletId: string;
  userId: string;
  field: string;
  expectedFromLedger: number;
  actualOnAccount: number;
  delta: number;
}

export interface DriftReport {
  runId: string;
  runAt: string;
  verdict: 'PASS' | 'WARN';
  totalWallets: number;
  driftedCells: number;
  drifts: DriftRow[];
  durationMs: number;
}

/**
 * Run the drift detector. NEVER writes to walletAccounts or
 * creditTransactions. Only writes the result to walletReconciliationRuns.
 */
export async function runWalletLedgerDriftDetector(
  triggeredBy: 'startup' | 'cron' | 'manual',
): Promise<DriftReport> {
  const runId = `WLDD-${nanoid(10)}`;
  const startedAt = new Date();
  const drifts: DriftRow[] = [];

  let totalWallets = 0;

  try {
    // 1. Pull every wallet account once. Bounded — production has < 1M
    //    wallets and this job runs nightly in the off-hours window.
    const accounts = await db.execute(sql`
      SELECT
        wallet_id            AS "walletId",
        user_id              AS "userId",
        egift_balance_cents  AS "egiftBalanceCents",
        promo_balance_cents  AS "promoBalanceCents",
        referral_balance_cents AS "referralBalanceCents",
        loyalty_points_balance AS "loyaltyPointsBalance",
        wash_package_credits AS "washPackageCredits",
        cash_wallet_balance_cents AS "cashWalletBalanceCents"
      FROM wallet_accounts
      WHERE is_active = true
    `);
    const rows = (accounts as any).rows as Array<Record<string, any>>;
    totalWallets = rows.length;

    // 2. For each drift field, sum the ledger per wallet in ONE query.
    //    Map walletId -> ledger sum, then walk accounts and compare.
    for (const field of DRIFT_FIELDS) {
      const ledgerSums = await db.execute(sql.raw(`
        SELECT
          wallet_id AS "walletId",
          COALESCE(SUM(${field.ledgerColumn}), 0)::int AS "ledgerSum"
        FROM credit_transactions
        WHERE credit_type = '${field.creditType}'
        GROUP BY wallet_id
      `));
      const ledgerMap = new Map<string, number>();
      for (const r of (ledgerSums as any).rows as Array<{ walletId: string; ledgerSum: number }>) {
        ledgerMap.set(r.walletId, Number(r.ledgerSum) || 0);
      }

      for (const acc of rows) {
        const expected = ledgerMap.get(acc.walletId) ?? 0;
        const actual = Number(acc[field.accountColumn]) || 0;
        if (expected !== actual) {
          drifts.push({
            walletId: acc.walletId,
            userId: acc.userId,
            field: field.label,
            expectedFromLedger: expected,
            actualOnAccount: actual,
            delta: actual - expected,
          });
        }
      }
    }

    // 2b. LEDGER-V2 PASS (Lane B audit 2026-08-22 B-01): reconcile the
    //     same wallet_accounts caches against the canonical
    //     wallet_ledger_entries ledger keyed by bucket. Double-entry
    //     means the signed balance = SUM(credit) - SUM(debit) per
    //     (wallet_id, bucket). Empty ledger for a bucket-on-account is
    //     SKIPPED (rather than treated as -balance) because adoption of
    //     wallet_ledger_entries is per-writer and partial today — a
    //     ZERO ledger sum against a real cache balance is more likely
    //     "not yet adopted" than "drift". Only NON-ZERO ledger sums
    //     that disagree with the cache are surfaced. This is the
    //     tightest safe read.
    for (const field of LEDGER_V2_DRIFT_FIELDS) {
      const ledgerSums = await db.execute(sql.raw(`
        SELECT
          wallet_id AS "walletId",
          COALESCE(SUM(
            CASE WHEN direction = 'credit' THEN amount_cents
                 WHEN direction = 'debit'  THEN -amount_cents
                 ELSE 0 END
          ), 0)::int AS "ledgerSum"
        FROM wallet_ledger_entries
        WHERE bucket = '${field.bucket}'
        GROUP BY wallet_id
      `));
      const ledgerMap = new Map<string, number>();
      for (const r of (ledgerSums as any).rows as Array<{ walletId: string; ledgerSum: number }>) {
        ledgerMap.set(r.walletId, Number(r.ledgerSum) || 0);
      }

      for (const acc of rows) {
        const expected = ledgerMap.get(acc.walletId);
        if (expected === undefined || expected === 0) continue; // no v2 rows for this wallet+bucket
        const actual = Number(acc[field.accountColumn]) || 0;
        if (expected !== actual) {
          drifts.push({
            walletId: acc.walletId,
            userId: acc.userId,
            field: field.label,
            expectedFromLedger: expected,
            actualOnAccount: actual,
            delta: actual - expected,
          });
        }
      }
    }

    const verdict: 'PASS' | 'WARN' = drifts.length === 0 ? 'PASS' : 'WARN';
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // 3. Persist a single audit row. summaryJson capped to SUMMARY_SAMPLE_LIMIT
    //    to keep the row size sane on large drifts.
    await db.insert(walletReconciliationRuns).values({
      runId,
      runType: 'ledger_drift_detector',
      status: 'completed',
      verdict,
      startedAt,
      completedAt,
      durationMs,
      drifted: drifts.length,
      healed: 0, // detector never heals
      failedCount: 0,
      triggeredBy,
      summaryJson: {
        totalWallets,
        driftedCells: drifts.length,
        sample: drifts.slice(0, SUMMARY_SAMPLE_LIMIT),
        truncated: drifts.length > SUMMARY_SAMPLE_LIMIT,
      } as any,
    });

    if (verdict === 'WARN') {
      logger.warn(`${LABEL} drift detected — ${drifts.length} cell(s) out of ${totalWallets * DRIFT_FIELDS.length} checked`, {
        runId,
        driftedCells: drifts.length,
        sample: drifts.slice(0, 5),
      });
    } else {
      logger.info(`${LABEL} clean run`, { runId, totalWallets, durationMs });
    }

    return {
      runId,
      runAt: startedAt.toISOString(),
      verdict,
      totalWallets,
      driftedCells: drifts.length,
      drifts,
      durationMs,
    };
  } catch (err: any) {
    logger.error(`${LABEL} run failed`, { runId, error: err?.message });
    // Best-effort: record the failure in the audit table so silent
    // failures don't accumulate.
    try {
      await db.insert(walletReconciliationRuns).values({
        runId,
        runType: 'ledger_drift_detector',
        status: 'failed',
        verdict: null,
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        drifted: 0,
        healed: 0,
        failedCount: 1,
        triggeredBy,
        summaryJson: { error: String(err?.message ?? err) } as any,
      });
    } catch { /* swallow secondary failure */ }
    throw err;
  }
}

/**
 * Wire up the nightly schedule. Idempotent — call once at server startup.
 */
export function startWalletLedgerDriftDetector(): void {
  // 03:00 UTC every day — far away from the 5-min hold-debit reconciliation
  // and the monthly settlements job.
  cron.schedule('0 3 * * *', () => {
    runWalletLedgerDriftDetector('cron').catch((err: any) =>
      logger.error(`${LABEL} Cron run failed`, { error: err.message }),
    );
  });
  logger.info(`${LABEL} Scheduler started — nightly at 03:00 UTC (detect-only, no auto-heal)`);
}
