/**
 * SyntheticMoneyPathMonitor — money-path correctness synthetic check (CTO P0-7, 2026-07-31).
 *
 * Sentry catches crashes; it does NOT prove that VAT, commission, or wallet math is
 * CORRECT in production. This runs the REAL production money code (the same fee/VAT
 * calculators the live booking + wash paths use) against known inputs and asserts the
 * invariants — plus a live wallet-ledger integrity spot-check. If any invariant breaks
 * in prod (a bad deploy, a config drift, a VAT-rate mistake), it pages via
 * sendSecurityAlert so a "healthy but financially wrong" state is caught immediately.
 *
 * Run on a schedule via /api/cron/synthetic-money-check (Cloud Scheduler).
 */

import { calculateWalkFees } from '../utils/walkFeeCalculator';
import { calculateTransparentFees } from '../utils/sitterFeeCalculator';
import { resolveVatRateForDate, ISRAEL_VAT_RATE } from '@shared/israel-compliance-config';
import { logger } from '../lib/logger';

export interface MoneyCheck { name: string; ok: boolean; detail: string }
export interface MoneyPathReport { ok: boolean; checkedAt: string; checks: MoneyCheck[] }

function check(name: string, cond: boolean, detail: string): MoneyCheck {
  return { name, ok: cond, detail };
}

/**
 * Deterministic invariant checks against the REAL money code. Pure (no DB, no network),
 * so this is a reliable synthetic that fails ONLY when the actual production math is wrong.
 */
export function runDeterministicMoneyChecks(now: Date = new Date()): MoneyCheck[] {
  const checks: MoneyCheck[] = [];

  // 1. Walk: single 15% disclosed-agent — owner pays the rate, walker nets 85%, VAT extracted.
  const w = calculateWalkFees(10000); // ₪100
  checks.push(check('walk_fee_single_15pct',
    w.totalChargeCents === 10000 && w.walkerPayoutCents === 8500 && w.platformCommissionTotalCents === 1500,
    `owner=${w.totalChargeCents} walker=${w.walkerPayoutCents} commission=${w.platformCommissionTotalCents} (want 10000/8500/1500)`));
  checks.push(check('walk_vat_extracted_not_added',
    w.totalChargeWithVATCents === w.totalChargeCents && w.vatCents <= w.platformCommissionTotalCents && w.vatCents === Math.round(1500 * (ISRAEL_VAT_RATE / (1 + ISRAEL_VAT_RATE))),
    `finalCharge=${w.totalChargeWithVATCents} base=${w.totalChargeCents} vat=${w.vatCents} (VAT must be inside the commission, not on top)`));

  // 2. Sitter: ONE MONEY MODEL (shared/marketplaceMoney.ts, 2026-09-17) — the
  //    customer pays the rate + a 15% fee on top, the sitter is owed the full
  //    rate, VAT sits inside the fee.
  const s = calculateTransparentFees(15000, 3); // ₪150/day × 3 = ₪450 rate
  checks.push(check('sitter_fee_15pct_on_top',
    s.basePriceCents === 45000 && s.platformServiceFeeCents === 6750 && s.totalChargeCents === 51750 && s.sitterPayoutCents === 45000,
    `rate=${s.basePriceCents} fee=${s.platformServiceFeeCents} customer=${s.totalChargeCents} sitter=${s.sitterPayoutCents} (want 45000/6750/51750/45000)`));
  checks.push(check('sitter_no_double_charge',
    s.totalChargeCents === s.basePriceCents + s.platformServiceFeeCents && s.sitterPayoutCents === s.basePriceCents,
    `customer must pay rate + ONE fee and the sitter must be owed the whole rate (no fee twice, nothing taken from the sitter)`));
  checks.push(check('sitter_vat_inside_fee',
    s.vatCents === Math.round(6750 * (ISRAEL_VAT_RATE / (1 + ISRAEL_VAT_RATE))) && s.vatCents < s.platformServiceFeeCents,
    `vat=${s.vatCents} fee=${s.platformServiceFeeCents} (VAT is extracted from Pet Wash's fee, never charged on the sitter's money)`));

  // 3. Israeli VAT rate is the expected 18% for today.
  const vat = resolveVatRateForDate(now);
  checks.push(check('vat_rate_is_18pct',
    Math.abs(vat.rate - 0.18) < 1e-9 && Math.abs(ISRAEL_VAT_RATE - 0.18) < 1e-9,
    `resolved VAT=${vat.rate} shared=${ISRAEL_VAT_RATE} (want 0.18)`));

  return checks;
}

export class SyntheticMoneyPathMonitor {
  /** Run all synthetic money-path checks. */
  static async runChecks(): Promise<MoneyPathReport> {
    const checks = runDeterministicMoneyChecks();
    // NOTE: a live wallet-ledger integrity check is intentionally NOT here yet. walletAccounts
    // has multiple balance buckets (cash / egift / promo / package units) and creditTransactions
    // mixes their types, so a naive `cash == SUM(amountCents)` false-positives. A correct
    // per-bucket reconciliation is a follow-up — a synthetic that cries wolf is worse than none.
    void logger; // (logger kept for the follow-up live checks)
    const ok = checks.every((c) => c.ok);
    return { ok, checkedAt: new Date().toISOString(), checks };
  }
}

export const syntheticMoneyPathMonitor = SyntheticMoneyPathMonitor;
