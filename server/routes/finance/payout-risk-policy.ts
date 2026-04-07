/**
 * PAYOUT_RISK_POLICY — Centralized payout risk threshold config.
 *
 * Single source of truth for anomaly detection thresholds, owner routing, and platform
 * classification. Imported by:
 *   - payout-anomaly-monitor.ts  (detection + severity)
 *   - payout-repair-tools.ts     (drill-down + runbook context)
 *   - Gemini watchdog             (geminiThresholds block)
 *   - Octopus PayoutHealthPanel   (UI severity/owner display)
 *
 * Finance/ops can adjust thresholds here without touching detection logic.
 *
 * ownerTeam mapping:
 *   'Finance Ops'       — payout state correctness, stale transfers, missing references
 *   'Engineering'       — drift between booking/payout tables, orphan rows, legacy vocab
 *   'Finance + Eng'     — cross-domain issues requiring both teams
 *
 * payoutFlowType:
 *   'israeli_bank_transfer'  — all current payouts (Nayax-blocked, queued for ops release)
 *   'escrow_release'         — booking→escrow→provider path
 *   'direct_payout'          — future direct integration
 */

export const PAYOUT_RISK_POLICY = {
  stalePendingTransfer: {
    ownerTeam: 'Finance Ops',
    platformType: 'booking_engine',
    payoutFlowType: 'israeli_bank_transfer',
    isCustomerFacing: false,
    infoIfAnyOlderThanHours:     6,
    warningIfAnyOlderThanHours:  24,
    criticalIfAnyOlderThanHours: 48,
    escalateIfAnyOlderThanHours: 72,
    escalateIfCountExceeds:      10,
    amountWeighting: {
      criticalIfAnyAmountAboveILS:   5000,
      escalateIfTotalAmountAboveILS: 20000,
      smallAmountThresholdILS:       100,
    },
  },
  bookingPayoutDrift: {
    ownerTeam: 'Finance + Eng',
    platformType: 'booking_engine',
    payoutFlowType: 'escrow_release',
    isCustomerFacing: false,
    warningIfTotalDriftExceeds:  1,
    criticalIfTotalDriftExceeds: 5,
    criticalBuckets:     ['pending_transfer_vs_paid_out', 'paid_out_vs_failed', 'payout_row_missing_booking'],
    warningBuckets:      ['pending_vs_pending_transfer', 'booking_missing_payout_row', 'payout_date_mismatch'],
    alwaysCriticalBuckets: ['paid_out_vs_failed'],
  },
  paidOutMissingRef: {
    ownerTeam: 'Finance Ops',
    platformType: 'booking_engine',
    payoutFlowType: 'israeli_bank_transfer',
    isCustomerFacing: false,
    criticalIfCountExceeds: 0,
    amountWeighting: {
      immediateEscalateIfAnyAboveILS: 1000,
    },
  },
  paidOutMissingPaidAt: {
    ownerTeam: 'Finance Ops',
    platformType: 'booking_engine',
    payoutFlowType: 'israeli_bank_transfer',
    isCustomerFacing: false,
    criticalIfCountExceeds: 0,
  },
  failedWithNoReason: {
    ownerTeam: 'Finance Ops',
    platformType: 'booking_engine',
    payoutFlowType: 'israeli_bank_transfer',
    isCustomerFacing: true,
    warningIfCountExceeds:  0,
    criticalIfCountExceeds: 5,
    amountWeighting: {
      criticalIfAnyAmountAboveILS: 2000,
    },
  },
  orphanPayoutRows: {
    ownerTeam: 'Engineering',
    platformType: 'booking_engine',
    payoutFlowType: 'escrow_release',
    isCustomerFacing: false,
    warningIfCountExceeds:  0,
    criticalIfCountExceeds: 10,
    amountWeighting: {
      criticalIfTotalAmountAboveILS: 5000,
    },
  },
  payoutDateWithoutPaidOut: {
    ownerTeam: 'Finance + Eng',
    platformType: 'booking_engine',
    payoutFlowType: 'escrow_release',
    isCustomerFacing: false,
    criticalIfCountExceeds: 0,
  },
  legacyCompleted: {
    ownerTeam: 'Engineering',
    platformType: 'booking_engine',
    payoutFlowType: 'escrow_release',
    isCustomerFacing: false,
    criticalIfCountExceeds: 0,
  },
} as const;

export type PayoutRiskPolicy = typeof PAYOUT_RISK_POLICY;
